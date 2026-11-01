import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import pg from 'pg';
import { migrate } from '../../scripts/migrate.js';
import { grantRuntime } from '../../scripts/grant-runtime.js';

function command(file, args) {
  const result = spawnSync(file, args, { stdio: 'ignore', timeout: 60000, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`${file.split(/[\\/]/).pop()} failed (status ${result.status}). Is PostgreSQL 18 installed?`);
}
async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
export async function isolatedPostgres() {
  // Never consumes PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD from the user's .env.
  const bin = resolve(process.env.PG_TEST_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '/usr/lib/postgresql/18/bin'));
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const executable = name => join(bin, name + suffix);
  await access(executable('initdb'));
  const directory = await mkdtemp(join(tmpdir(), 'ems-api-test-'));
  const data = join(directory, 'data');
  const passwordFile = join(directory, 'bootstrap-password');
  const password = randomBytes(32).toString('hex');
  const runtimePassword = randomBytes(32).toString('hex');
  const port = await unusedPort();
  let started = false;
  let admin;
  let runtime;
  async function close() {
    if (runtime) { await runtime.end(); runtime = null; }
    if (admin) { await admin.end(); admin = null; }
    if (started) {
      command(executable('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop']);
      started = false;
    }
    // Only the uniquely generated directory belonging to this fixture is removed.
    await rm(directory, { recursive: true, force: true });
  }
  try {
    if (process.platform === 'win32') {
      const account = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
      command(join(process.env.SystemRoot, 'System32', 'icacls.exe'), [directory, '/inheritance:r', '/grant:r', `${account}:(OI)(CI)F`]);
    }
    await writeFile(passwordFile, password, { mode: 0o600, flag: 'wx' });
    command(executable('initdb'), ['-D', data, '--username=postgres', '--auth=scram-sha-256', '--encoding=UTF8', '--no-locale', '--pwfile=' + passwordFile]);
    await rm(passwordFile);
    command(executable('pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
    started = true;
    const connection = { host: '127.0.0.1', port, database: 'postgres', user: 'postgres', password, ssl: false, connectionTimeoutMillis: 5000 };
    admin = new pg.Pool(connection);
    await admin.query("CREATE DATABASE ems_test");
    await admin.end();
    connection.database = 'ems_test';
    admin = new pg.Pool(connection);
    await migrate(admin);
    await admin.query(`CREATE ROLE ems_test_runtime LOGIN PASSWORD '${runtimePassword}'`);
    await grantRuntime(admin, 'ems_test_runtime');
    runtime = new pg.Pool({ ...connection, user: 'ems_test_runtime', password: runtimePassword, max: 8, statement_timeout: 15000 });
    return { admin, pool: runtime, connection, close };
  } catch (error) {
    await close();
    throw error;
  }
}
