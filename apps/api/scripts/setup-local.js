// Explicit local operator command: backup -> verified migration -> runtime grants.
// No server automatically imports or calls this file.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { migrate } from './migrate.js';
import { grantRuntime } from './grant-runtime.js';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
export async function setupLocal({ admin, app, backupRoot, bin }) {
  let owner;
  let runtime;
  let phase = 'preflight';
  let backupDir;
  try {
  const keys = ['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD'];
  for (const config of [admin, app]) {
    for (const key of keys) if (typeof config[key] !== 'string' || !config[key]) throw new Error('Required PostgreSQL configuration is missing');
    if (!/^\d+$/.test(config.PGPORT) || Number(config.PGPORT) < 1 || Number(config.PGPORT) > 65535) throw new Error('Invalid PostgreSQL port');
  }
  for (const key of ['PGHOST','PGPORT','PGDATABASE']) if (admin[key] !== app[key]) throw new Error('Owner/runtime database targets must match');
  if (!['127.0.0.1','localhost','::1'].includes(admin.PGHOST) || admin.PGDATABASE !== 'employee_management_dev') {
    throw new Error('This command is limited to the reviewed local development database');
  }
  const options = env => ({host:env.PGHOST,port:Number(env.PGPORT),database:env.PGDATABASE,user:env.PGUSER,password:env.PGPASSWORD,ssl:false,connectionTimeoutMillis:5000,statement_timeout:60000});
  owner = new pg.Pool(options(admin));
  runtime = new pg.Pool(options(app));
  const role = (await owner.query(`SELECT current_user=(SELECT tableowner FROM pg_tables WHERE schemaname='public' AND tablename='users') AS owns_users,
    (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser`)).rows[0];
  if (!role.owns_users && !role.superuser) throw new Error('Owner credentials do not own the existing users table');
  await runtime.query('SELECT 1');
  const privileges = (await owner.query(`SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,
    EXISTS(SELECT 1 FROM pg_auth_members WHERE member=pg_roles.oid) AS memberships
    FROM pg_roles WHERE rolname=$1`, [app.PGUSER])).rows[0];
  if (!privileges || Object.values(privileges).some(Boolean) || admin.PGUSER === app.PGUSER) throw new Error('Runtime role must be separate, nonprivileged and have no inherited roles');
  const ddl = (await runtime.query(`SELECT has_schema_privilege(current_user,'public','CREATE') AS schema_create,
    has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns_objects`)).rows[0];
  if (Object.values(ddl).some(Boolean)) throw new Error('Runtime login must not own public objects or have schema/database CREATE privileges');
  phase = 'backup';
  const project = resolve(root, '..', '..');
  backupRoot ||= join(dirname(project), 'EMPLOYE MANAGEMENT BACKUPS');
  backupDir = join(backupRoot, new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'-before-connected-api');
  await mkdir(backupDir, {recursive:true,mode:0o700});
  if (process.platform === 'win32') {
    await exec(join(process.env.SystemRoot,'System32','icacls.exe'),
      [backupDir,'/inheritance:r','/grant:r',`${process.env.USERDOMAIN}\\${process.env.USERNAME}:(OI)(CI)F`],{windowsHide:true});
  }
  bin ||= process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '/usr/lib/postgresql/18/bin';
  const dump = join(backupDir,'database.dump');
  const env = {...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG'))),
    ...Object.fromEntries(keys.map(key=>[key,admin[key]])),PGSSLMODE:'disable'};
  await exec(join(bin,process.platform==='win32'?'pg_dump.exe':'pg_dump'),['--format=custom','--no-password','--file',dump],{env,windowsHide:true,timeout:120000});
  const archive = await readFile(dump);
  if (!archive.subarray(0,5).equals(Buffer.from('PGDMP'))) throw new Error('Backup format check failed');
  await exec(join(bin,process.platform==='win32'?'pg_restore.exe':'pg_restore'),['--list',dump],{windowsHide:true,timeout:30000});
  await writeFile(join(backupDir,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),database:'employee_management_dev',
    archive:'database.dump',bytes:archive.length,sha256:createHash('sha256').update(archive).digest('hex'),
    note:'Custom-format database backup before local API upgrade. Restore only to a separate empty database for review; no PostgreSQL role passwords exported. Application records and password hashes, if present, are sensitive.'},null,2),{flag:'wx',mode:0o600});
  const before = (await owner.query('SELECT count(*)::int AS accounts FROM users')).rows[0].accounts;
  phase = 'migration';
  const changes = await migrate(owner,{baseline:true});
  phase = 'runtime grants';
  const db = await owner.connect();
  try {await db.query('BEGIN');await grantRuntime(db,app.PGUSER);await db.query('COMMIT');}
  catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  const after = (await runtime.query('SELECT count(*)::int AS accounts FROM users')).rows[0].accounts;
  if (before !== after) throw new Error('Account count unexpectedly changed. Review backup before any further operation.');
  return {backupDirectory:backupDir,accountCountUnchanged:true,accounts:after,migrations:changes,runtimeVerified:true};
  } catch(error) {
    error.setupPhase = phase;
    error.backupDirectory = backupDir;
    throw error;
  } finally {
    if (runtime) await runtime.end();
    if (owner) await owner.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const admin = parseEnv(await readFile(join(root, '.env.admin'), 'utf8'));
    const app = parseEnv(await readFile(join(root, '.env'), 'utf8'));
    console.log(JSON.stringify(await setupLocal({admin,app,backupRoot:process.env.EMS_BACKUP_DIR,bin:process.env.PG_BIN})));
  } catch(error) {
    const message = error.code === '28P01' ? 'Owner or runtime password authentication failed. Correct local credentials; no password is printed.'
      : 'Local setup failed. Check local configuration, permissions, backup and schema before retrying.';
    console.error(JSON.stringify({message,phase:error.setupPhase || 'configuration',code:error.code || null,backupDirectory:error.backupDirectory}));
    process.exitCode=1;
  }
}
