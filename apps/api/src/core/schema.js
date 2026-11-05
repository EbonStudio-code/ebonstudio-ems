import { readFileSync, readdirSync } from 'node:fs';
import { migrationChecksums } from './migration-checksum.js';

const directory = new URL('../../migrations/', import.meta.url);
const expected = readdirSync(directory).filter(name => /^\d{3}_.+\.sql$/.test(name)).sort().map(name => ({
  name, checksums: migrationChecksums(readFileSync(new URL(name, directory))),
}));
export async function checkSchema(pool) {
  const { rows } = await pool.query('SELECT name,sha256 FROM schema_migrations ORDER BY name');
  if (rows.length !== expected.length || expected.some((row, index) =>
    row.name !== rows[index].name || !row.checksums.includes(rows[index].sha256))) throw new Error('Schema does not match this release');
}
