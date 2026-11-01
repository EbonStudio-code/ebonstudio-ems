import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMailer } from '../src/modules/identity/mail.js';

test('Delivery is disabled by default; explicit local preview is private and production-forbidden', async () => {
  await assert.rejects(createMailer({ mailMode: 'disabled' }).send({}), /disabled/);
  assert.throws(() => createMailer({ mailMode: 'preview', production: true }), /forbidden/);
  const directory = await mkdtemp(join(tmpdir(), 'ems-mail-test-'));
  try {
    const mailer = createMailer({ mailMode: 'preview', production: false, mailDir: directory });
    const synthetic = { email: 'local-preview@example.test', purpose: 'INVITATION', url: 'http://127.0.0.1:5173/accept-invitation#token=synthetic-only' };
    await mailer.send(synthetic);
    const files = await readdir(directory);
    assert.equal(files.length, 1);
    assert.match(files[0], /^[a-f0-9-]{36}\.json$/);
    assert.deepEqual(JSON.parse(await readFile(join(directory, files[0]), 'utf8')), synthetic);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
