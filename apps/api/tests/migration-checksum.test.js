import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { migrationChecksums } from '../src/core/migration-checksum.js';

test('Migration checksums are portable across LF/CRLF without accepting SQL changes', () => {
  const lf = 'BEGIN;\nSELECT 1;\nCOMMIT;\n';
  const crlf = lf.replaceAll('\n', '\r\n');
  assert.deepEqual(migrationChecksums(lf), migrationChecksums(crlf));
  assert.ok(migrationChecksums(lf).includes(createHash('sha256').update(crlf).digest('hex')));
  assert.notEqual(migrationChecksums(lf)[0], migrationChecksums(lf.replace('SELECT 1', 'SELECT 2'))[0]);
});
