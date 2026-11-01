import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import pg from 'pg';
import { isolatedPostgres } from '../helpers/postgres.js';
import { setupLocal } from '../../scripts/setup-local.js';

test('Local setup backs up before adopting 001, preserves data and grants a limited runtime', {timeout:120000}, async t => {
  const fixture = await isolatedPostgres();
  const backups = await mkdtemp(join(tmpdir(),'ems-setup-backup-test-'));
  const pools = [];
  const bin = process.env.PG_TEST_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '/usr/lib/postgresql/18/bin');
  try {
    // This database name exists only in the uniquely owned, random-port test cluster.
    await fixture.admin.query('CREATE DATABASE employee_management_dev');
    const owner = new pg.Pool({...fixture.connection,database:'employee_management_dev'});
    pools.push(owner);
    const password = randomBytes(32).toString('hex');
    await owner.query(`CREATE ROLE setup_runtime LOGIN PASSWORD '${password}'`);
    await owner.query(await readFile(new URL('../../migrations/001_create_users.sql',import.meta.url),'utf8'));
    await owner.query("INSERT INTO users(email_canonical,role) VALUES('setup-ceo@example.test','CEO')");
    const admin = {PGHOST:'127.0.0.1',PGPORT:String(fixture.connection.port),PGDATABASE:'employee_management_dev',PGUSER:'postgres',PGPASSWORD:fixture.connection.password};
    const app = {...admin,PGUSER:'setup_runtime',PGPASSWORD:password};
    const options = {admin,app,backupRoot:backups,bin};

    await t.test('Rejects wrong targets, wrong authentication and privileged runtime before backup or DDL',async()=>{
      await assert.rejects(setupLocal({...options,app:{...app,PGDATABASE:'wrong'}}),/targets must match/);
      await assert.rejects(setupLocal({...options,admin:{...admin,PGPASSWORD:'wrong-synthetic-password'}}),{code:'28P01'});
      await owner.query('ALTER ROLE setup_runtime REPLICATION');
      await assert.rejects(setupLocal(options),/nonprivileged/);
      await owner.query('ALTER ROLE setup_runtime NOREPLICATION');
      assert.deepEqual(await readdir(backups),[]);
      assert.equal((await owner.query("SELECT to_regclass('public.schema_migrations') AS name")).rows[0].name,null);
    });

    const result = await setupLocal(options);
    await t.test('Creates a validated archive and checksum, migrates and retains the existing account',async()=>{
      assert.equal(result.accounts,1);
      assert.equal(result.accountCountUnchanged,true);
      assert.equal(result.runtimeVerified,true);
      assert.deepEqual(result.migrations,['Baselined 001_create_users.sql','Applied 002_backend.sql']);
      const archive = await readFile(join(result.backupDirectory,'database.dump'));
      const manifest = JSON.parse(await readFile(join(result.backupDirectory,'manifest.json'),'utf8'));
      assert.equal(archive.subarray(0,5).toString(),'PGDMP');
      assert.equal(createHash('sha256').update(archive).digest('hex'),manifest.sha256);
      const runtime = new pg.Pool({...fixture.connection,database:'employee_management_dev',user:app.PGUSER,password});
      pools.push(runtime);
      assert.equal((await runtime.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,2);
      assert.equal((await runtime.query('SELECT email_canonical FROM users')).rows[0].email_canonical,'setup-ceo@example.test');
      await assert.rejects(runtime.query('CREATE TABLE public.not_allowed(id int)'),{code:'42501'});
      await assert.rejects(runtime.query('DELETE FROM users'),{code:'42501'});
    });

    await t.test('Restores the pre-upgrade archive into a separate empty synthetic database',async()=>{
      await fixture.admin.query('CREATE DATABASE setup_restore_test');
      const env = {...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG'))),
        ...admin,PGDATABASE:'setup_restore_test',PGSSLMODE:'disable'};
      await promisify(execFile)(join(bin,process.platform==='win32'?'pg_restore.exe':'pg_restore'),
        ['--no-password','--exit-on-error','--no-owner','--no-privileges','--dbname','setup_restore_test',join(result.backupDirectory,'database.dump')],
        {env,windowsHide:true,timeout:30000});
      const restored = new pg.Pool({...fixture.connection,database:'setup_restore_test'});
      pools.push(restored);
      assert.equal((await restored.query('SELECT email_canonical FROM users')).rows[0].email_canonical,'setup-ceo@example.test');
      assert.equal((await restored.query("SELECT to_regclass('public.schema_migrations') AS name")).rows[0].name,null);
      assert.equal((await restored.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='users'")).rows[0].n,7);
    });

    await t.test('Repeating setup creates a new backup without replaying migrations or changing accounts',async()=>{
      const again = await setupLocal(options);
      assert.notEqual(again.backupDirectory,result.backupDirectory);
      assert.deepEqual(again.migrations,[]);
      assert.equal(again.accounts,1);
    });
  } finally {
    await Promise.all(pools.map(pool=>pool.end()));
    await fixture.close();
    await rm(backups,{recursive:true,force:true});
  }
});
