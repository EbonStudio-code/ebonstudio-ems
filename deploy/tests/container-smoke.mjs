import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const suffix = randomBytes(6).toString('hex');
const project = `ems-ci-${suffix}`, restore = `ems-restore-${suffix}`;
const directory = await mkdtemp(join(tmpdir(), 'ems-container-'));
await mkdir(join(directory, 'secrets'), { mode: 0o700 });
for (const key of ['db_admin_password', 'db_owner_password', 'db_app_password', 'rate_limit_secret', 'readiness_secret', 'mail_outbox_key', 'resend_api_key']) {
  const value = key === 'resend_api_key' ? 're_synthetic_no_delivery' : randomBytes(32).toString('hex');
  await writeFile(join(directory, 'secrets', key), value, { mode: 0o444, flag: 'wx' });
}
await writeFile(join(directory, 'api.env'), 'MAIL_MODE=resend\nMAIL_FROM=EMS <no-reply@notify.example.test>\nMAIL_FROM_DOMAIN=notify.example.test\nHR_NOTIFICATIONS_ENABLED=false\n', { mode: 0o600 });
const manifest = join(directory, 'release.env');
await writeFile(manifest, [
  `EMS_RUNTIME_DIR=${directory.replaceAll('\\', '/')}`,
  `EMS_API_IMAGE=${process.env.EMS_API_IMAGE || 'ems-prep-api:20261105'}`,
  `EMS_WEB_IMAGE=${process.env.EMS_WEB_IMAGE || 'ems-prep-web:20261105'}`,
  `EMS_DB_IMAGE=${process.env.EMS_DB_IMAGE || 'ems-prep-db:20261105'}`,
].join('\n') + '\n');
function command(args, input, quiet = false) {
  const result = spawnSync('docker', args, { cwd: root, input, maxBuffer: 16 * 1024 * 1024, timeout: 180000 });
  if (result.error || result.status !== 0) {
    // Only synthetic environment; no config/environment dumps.
    throw new Error(`Docker command failed (${result.status}): ${result.stderr?.toString().slice(-5000) || result.error?.message}`);
  }
  if (!quiet && result.stdout.length) console.log(result.stdout.toString().trim());
  return result.stdout;
}
const dc = (name, args, input, quiet) => command(['compose', '-p', name, '--env-file', manifest, '-f', join(root, 'deploy/compose.yaml'), ...args], input, quiet);
const execNode = code => dc(project, ['exec', '-T', 'api', 'node', '--import', './src/core/secrets.js', '--input-type=module'], code, true);
const sql = (name, query) => dc(name, ['exec', '-T', 'db', 'sh', '-c',
  'export PGPASSWORD="$(cat /run/secrets/db_owner_password)"; exec psql -X -h 127.0.0.1 -U ems_owner -d ems -v ON_ERROR_STOP=1 -At'], query, true).toString().trim();
try {
  dc(project, ['config', '--quiet']);
  dc(project, ['up', '-d', '--wait', '--wait-timeout', '120', 'db']);
  dc(project, ['run', '--rm', '--no-deps', 'migrate']);
  dc(project, ['up', '-d', '--wait', '--wait-timeout', '120', 'api', 'web', 'mail-worker']);
  execNode(`
    import assert from 'node:assert/strict';
    import { request } from 'node:http';
    import { access } from 'node:fs/promises';
    import { pool } from './src/core/database.js';
    import { hashPassword } from './src/modules/identity/service.js';
    import { statementPdf } from './src/modules/salary-slips/pdf.js';
    for (const path of ['/usr/local/bin/npm','/usr/local/bin/yarn','/usr/local/lib/node_modules/npm']) {
      await assert.rejects(access(path), {code:'ENOENT'});
    }
    assert.ok(process.env.PDF_FONT_PATH);
    const pdf=await statementPdf({
      template_version:1, state:'PUBLISHED', period:'2026-11', revision:1,
      currency_code:'INR', currency_minor_unit:2, earnings:[{label:'Base',amountMinor:100}],
      deductions:[], gross_minor:100, total_deductions_minor:0, net_minor:100,
    }, {
      company:{displayName:'Synthetic Company'},
      employee:{fullName:'Synthetic Employee',employeeCode:'TEST',jobTitle:'Tester',department:'QA'},
    }, process.env.PDF_FONT_PATH);
    assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
    const headers = { Host: 'ems.ebonstudio.com' };
    // Node fetch may discard an explicit Host override; raw HTTP tests the virtual host.
    const req = (path, options={}) => new Promise((resolve,reject)=>{
      const call=request('http://web:8080'+path,{method:options.method||'GET',headers:{...headers,...options.headers},signal:AbortSignal.timeout(10000)},response=>{
        const chunks=[]; response.on('data',chunk=>chunks.push(chunk));
        response.on('end',()=>resolve(new Response(response.statusCode===204?null:Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})));
      });
      call.on('error',reject); call.end(options.body);
    });
    for (const path of ['/login','/reset-password','/accept-invitation','/employee/dashboard']) assert.equal((await req(path)).status,200);
    for (const path of ['/preview/login','/.env','/source.map','/api/v1/health/ready']) assert.equal((await req(path)).status,404);
    assert.equal((await req('/api/v1/health/live')).status,200);
    assert.equal((await req('/api/v1/employees')).status,401);
    const page=await req('/login');
    assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
    assert.equal(page.headers.get('referrer-policy'),'no-referrer');
    const asset=(await page.text()).match(/src="([^"]+\\.js)"/)[1];
    const bundle=await (await req(asset)).text();
    for (const forbidden of ['ems.frontend-demo.v1','ems.preview-session','Open fictional demo','RESEND_API_KEY']) assert.ok(!bundle.includes(forbidden));
    const csrf=await req('/api/v1/auth/csrf');
    const cookie=csrf.headers.get('set-cookie');
    assert.match(cookie,/__Host-ems=/); assert.match(cookie,/Secure/); assert.match(cookie,/HttpOnly/); assert.match(cookie,/SameSite=Lax/);
    const token=(await csrf.json()).data.csrfToken;
    const body=JSON.stringify({email:'ceo@example.test',password:'Synthetic-container-password-2026!'});
    const authHeaders={Cookie:cookie.split(';')[0],'Content-Type':'application/json','X-CSRF-Token':token,Origin:'https://evil.example'};
    assert.equal((await req('/api/v1/auth/login',{method:'POST',headers:authHeaders,body})).status,403);
    await pool.query("INSERT INTO users(email_canonical,role,status,ceo_display_name,password_hash) VALUES('ceo@example.test','CEO','ACTIVE','Synthetic CEO',$1)",[await hashPassword('Synthetic-container-password-2026!')]);
    const login=await req('/api/v1/auth/login',{method:'POST',headers:{...authHeaders,Origin:'https://ems.ebonstudio.com'},body});
    assert.equal(login.status,200);
    const session=await req('/api/v1/auth/session',{headers:{Cookie:login.headers.get('set-cookie').split(';')[0]}});
    assert.equal((await session.json()).data.role,'CEO');
    await assert.rejects(pool.query('CREATE TABLE forbidden(id int)'),{code:'42501'});
    await pool.end();
  `);
  console.log('PASS musl-native Argon2 login, bundled-font PDF rendering and removed API toolchains');
  console.log('PASS same-origin proxy, SPA paths, private endpoints, cookies, CSRF, login, headers and runtime grants');
  const dbId = dc(project, ['ps', '-q', 'db'], undefined, true).toString().trim();
  const dbInspection = JSON.parse(command(['inspect', dbId], undefined, true).toString())[0];
  assert.equal(dbInspection.Config.User, 'postgres');
  assert.deepEqual(dbInspection.HostConfig.PortBindings, {});
  dc(project, ['exec', '-T', 'db', 'sh', '-c', 'test "$(id -u)" -ne 0 && ! command -v gosu'], undefined, true);
  console.log('PASS fresh-volume non-root PostgreSQL initialization without gosu');
  // A backup never passes through PowerShell text redirection.
  const dump = dc(project, ['exec', '-T', 'db', 'sh', '-c',
    'export PGPASSWORD="$(cat /run/secrets/db_owner_password)"; exec pg_dump -h 127.0.0.1 -U ems_owner -d ems -Fc --no-owner --no-privileges'], undefined, true);
  assert.equal(dump.subarray(0, 5).toString(), 'PGDMP');
  dc(restore, ['up', '-d', '--wait', '--wait-timeout', '120', 'db']);
  dc(restore, ['exec', '-T', 'db', 'sh', '-c',
    'export PGPASSWORD="$(cat /run/secrets/db_owner_password)"; exec pg_restore --exit-on-error --single-transaction --no-owner --no-privileges -h 127.0.0.1 -U ems_owner -d ems'], dump, true);
  dc(restore, ['run', '--rm', '--no-deps', 'migrate']);
  assert.equal(sql(restore, 'SELECT count(*) FROM users;'), '1');
  sql(restore, 'BEGIN; DELETE FROM sessions; DELETE FROM account_tokens; DELETE FROM email_outbox; UPDATE users SET session_version=session_version+1; COMMIT;');
  assert.equal(sql(restore, 'SELECT count(*) FROM sessions;'), '0');
  console.log('PASS fresh-volume backup/restore, migration/grant repeatability and restored session invalidation');
  const previous = JSON.parse(command(['image', 'inspect', process.env.EMS_API_IMAGE || 'ems-prep-api:20261105', '--format', '{{json .Id}}'], undefined, true).toString());
  dc(project, ['up', '-d', '--no-deps', '--force-recreate', '--wait', '--wait-timeout', '120', 'api', 'web']);
  assert.equal(sql(project, 'SELECT count(*) FROM users;'), '1');
  execNode(`import {get} from 'node:http'; await new Promise((resolve,reject)=>{get('http://web:8080/api/v1/health/live',{headers:{Host:'ems.ebonstudio.com'}},r=>{r.resume();r.on('end',()=>r.statusCode===200?resolve():reject(new Error('Proxy unavailable')));}).on('error',reject);});`);
  const id = dc(project, ['ps', '-q', 'api'], undefined, true).toString().trim();
  assert.equal(command(['inspect', '--format', '{{.Image}}', id], undefined, true).toString().trim(), previous);
  console.log('PASS same-schema immutable-image rollback/recreation and persistent database');
  const inspection = JSON.parse(command(['inspect', id], undefined, true).toString())[0];
  assert.equal(inspection.HostConfig.ReadonlyRootfs, true);
  assert.equal(inspection.Config.User, '1000:1000');
  assert.deepEqual(inspection.HostConfig.PortBindings, {});
  const assets = resolve(root, 'apps/web/dist/assets');
  try {
    for (const file of await readdir(assets)) {
      if (!file.endsWith('.js')) continue;
      const body = await readFile(join(assets, file), 'utf8');
      assert.ok(!/ems\.frontend-demo\.v1|ems\.preview-session|Open fictional demo|RESEND_API_KEY/.test(body));
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  console.log('PASS container privilege, port isolation and production asset checks');
} finally {
  // No volumes are deleted. These unique synthetic resources are retained on disk.
  for (const name of [project, restore]) {
    try { dc(name, ['stop', '--timeout', '15']); }
    catch { console.error(`Could not stop synthetic project ${name}`); process.exitCode = 1; }
  }
  console.log(`Synthetic projects retained and stopped: ${project}, ${restore}`);
  console.log('No production services, DNS or actual email were used.');
}
