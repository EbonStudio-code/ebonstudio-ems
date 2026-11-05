import pg from 'pg';
import { migrate } from './migrate.js';
import { grantRuntime } from './grant-runtime.js';
const pool = new pg.Pool({ connectionTimeoutMillis: 5000 });
try {
  console.log((await migrate(pool)).join('\n') || 'Schema is current');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await grantRuntime(db, 'ems_app');
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
  console.log('Runtime grants verified');
} catch {
  console.error('Migration failed. Stop rollout and inspect the migration journal with the owner.');
  process.exitCode = 1;
} finally { await pool.end(); }
