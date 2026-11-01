import { createApp } from './app.js';
import { pool } from './core/database.js';
import { loadConfig } from './core/config.js';
const config = loadConfig();
try {
  await pool.query('SELECT 1');
  const schema = await pool.query("SELECT count(*)::int AS count FROM schema_migrations WHERE name IN ('001_create_users.sql','002_backend.sql')");
  if (schema.rows[0].count !== 2) throw new Error('Migrations required');
  console.log('PostgreSQL connected');
} catch {
  console.error('PostgreSQL/schema check failed. Check PG settings and run migrations with the migration owner.');
  await pool.end();
  process.exit(1);
}
const app = createApp({ pool, config, logger: event => console.log(JSON.stringify(event)) });
const server = app.listen(config.port, config.host, () => {
  console.log(`API listening on ${config.host}:${config.port}`);
});
server.on('error', async () => {
  console.error('API could not start. Check the listen address and port.');
  await pool.end();
  process.exitCode = 1;
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    await pool.end();
    process.exitCode = 0;
  });
  server.closeIdleConnections();
  const timer = setTimeout(() => { server.closeAllConnections(); }, 10000);
  timer.unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
