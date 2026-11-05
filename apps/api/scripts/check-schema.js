import { pool } from '../src/core/database.js';
import { checkSchema } from '../src/core/schema.js';
try {
  await checkSchema(pool);
  console.log('Schema matches the release');
} catch {
  console.error('Schema does not match this release. Deployment or rollback refused.');
  process.exitCode = 1;
} finally { await pool.end(); }
