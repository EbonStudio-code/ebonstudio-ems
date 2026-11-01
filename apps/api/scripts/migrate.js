import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

const directory = fileURLToPath(new URL('../migrations/', import.meta.url));
const body = source => source.replace(/^\s*BEGIN\s*;/i, '').replace(/COMMIT\s*;\s*$/i, '');
async function shape(db, schema) {
  const table = `${schema}.users`;
  const columns = (await db.query(`SELECT a.attname,t.typname,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_value
    FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`, [table])).rows;
  const constraints = (await db.query(`SELECT conname,pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid=$1::regclass ORDER BY conname`, [table])).rows;
  const indexes = (await db.query(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename='users' ORDER BY indexname`, [schema])).rows
    .map(r => ({ name: r.indexname, definition: r.indexdef.replaceAll(schema + '.', 'SCHEMA.') }));
  return JSON.stringify({ columns, constraints, indexes });
}
export async function migrate(pool, { baseline = false } = {}) {
  const files = (await readdir(directory)).filter(f => /^\d{3}_.+\.sql$/.test(f)).sort();
  const db = await pool.connect();
  const applied = [];
  try {
    await db.query('SELECT pg_advisory_lock(74182,2)');
    await db.query('BEGIN');
    await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const tracked = (await db.query('SELECT name,sha256 FROM schema_migrations ORDER BY name')).rows;
    if (tracked.some(r => !files.includes(r.name))) throw new Error('Database has migrations not present in this checkout');
    const hasUsers = (await db.query("SELECT to_regclass('public.users') AS name")).rows[0].name;
    if (hasUsers && !tracked.some(r => r.name === files[0])) {
      if (!baseline) throw new Error('Existing users table found. Review 001, then use --baseline once.');
      const source = await readFile(join(directory, files[0]), 'utf8');
      const reference = 'ems_baseline_' + randomUUID().replaceAll('-', '');
      await db.query(`CREATE SCHEMA ${reference}`);
      await db.query(body(source).replaceAll('public.users', `${reference}.users`));
      if (await shape(db, 'public') !== await shape(db, reference)) throw new Error('Existing users schema differs from 001. Manual review required.');
      await db.query(`DROP SCHEMA ${reference} CASCADE`);
      const checksum = createHash('sha256').update(source).digest('hex');
      await db.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)', [files[0], checksum]);
      tracked.push({ name: files[0], sha256: checksum });
      applied.push('Baselined ' + files[0]);
    }
    await db.query('COMMIT');
    for (const file of files) {
      const source = await readFile(join(directory, file), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const existing = tracked.find(row => row.name === file);
      if (existing) {
        if (existing.sha256 !== checksum) throw new Error('Applied migration checksum mismatch: ' + file);
        continue;
      }
      await db.query('BEGIN');
      await db.query(body(source));
      await db.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)', [file, checksum]);
      await db.query('COMMIT');
      applied.push('Applied ' + file);
    }
    return applied;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.query('SELECT pg_advisory_unlock(74182,2)');
    db.release();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = new pg.Pool({ connectionTimeoutMillis: 5000 });
  try {
    const args = process.argv.slice(2);
    if (args.some(v => v !== '--baseline')) throw new Error('Only --baseline is supported');
    console.log((await migrate(pool, { baseline: args.includes('--baseline') })).join('\n') || 'Schema is current');
  } catch (error) {
    console.error(error.code ? `Migration failed (${error.code}). Check migration-owner permissions and schema.` : error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
