import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createResendMailer, emailContent } from '../src/modules/identity/resend.js';
import { encryptMessage, decryptMessage, retryDelay } from '../src/modules/identity/outbox.js';
import { loadConfig } from '../src/core/config.js';
import { loadSecrets } from '../src/core/secrets.js';

const config = { resendApiKey: 're_synthetic_test_only', mailFrom: 'EMS <no-reply@notify.example.test>' };
const message = { email: 'recipient@example.test', purpose: 'INVITATION', url: 'https://example.test/#token=synthetic', idempotencyKey: 'ems/synthetic-id' };
test('Resend sends only through official HTTPS API with server credentials and idempotency', async () => {
  const mailer = createResendMailer(config, { fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, `Bearer ${config.resendApiKey}`);
    assert.equal(options.headers['Idempotency-Key'], message.idempotencyKey);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    const body = JSON.parse(options.body);
    assert.deepEqual(body.to, [message.email]);
    assert.equal(body.from, config.mailFrom);
    assert.ok(!body.html && !body.attachments);
    return Response.json({ id: '12345678-1234-1234-1234-123456789abc' });
  } });
  assert.ok((await mailer.send(message)).id);
  await assert.rejects(mailer.send({ ...message, idempotencyKey: undefined }), { code: 'MAIL_IDEMPOTENCY_REQUIRED' });
});
for (const [status, retryable] of [[400, false], [401, false], [403, false], [409, false], [422, false], [429, true], [500, true]]) {
  test(`Resend classifies HTTP ${status} without exposing provider details`, async () => {
    const mailer = createResendMailer(config, { fetchImpl: async () =>
      new Response('sensitive-recipient-and-token', { status, headers: { 'retry-after': '60' } }) });
    await assert.rejects(mailer.send(message), error => error.retryable === retryable &&
      error.code === `MAIL_HTTP_${status}` && error.retryAfter === 60 && !String(error).includes('sensitive'));
  });
}
test('Resend network/response errors retry safely and never include error bodies', async () => {
  const mailer = createResendMailer(config, { fetchImpl: async () => { throw new Error('sensitive'); } });
  await assert.rejects(mailer.send(message), { code: 'MAIL_NETWORK', retryable: true });
  const invalid = createResendMailer(config, { fetchImpl: async () => Response.json({ message: 'sensitive' }) });
  await assert.rejects(invalid.send(message), { code: 'MAIL_RESPONSE', retryable: true });
});
test('Encrypted outbox payloads are authenticated, row-bound and do not store plaintext links', () => {
  const key = randomBytes(32).toString('hex'), id = randomUUID();
  const encrypted = encryptMessage(message, key, id);
  assert.ok(!encrypted.includes(message.email) && !encrypted.includes('synthetic'));
  assert.deepEqual(decryptMessage(encrypted, key, id), message);
  assert.throws(() => decryptMessage(encrypted, key, randomUUID()));
  assert.throws(() => decryptMessage(encrypted, randomBytes(32).toString('hex'), id));
  assert.equal(retryDelay(1, 0, () => 0), 30);
  assert.equal(retryDelay(2, 120, () => 0), 120);
  assert.equal(retryDelay(8, 0, () => 0), 3600);
});
test('HR templates contain only generic sign-in links, not submitted details', () => {
  for (const purpose of ['TASK_UPDATED', 'LEAVE_UPDATED', 'COMPLAINT_UPDATED', 'SALARY_UPDATED']) {
    const content = emailContent({ purpose, url: 'https://example.test', salary: 99999, description: 'sensitive' });
    assert.ok(!JSON.stringify(content).includes('sensitive') && !JSON.stringify(content).includes('99999'));
  }
});
test('Resend production configuration fails closed and secrets support mounted files', () => {
  const env = { NODE_ENV: 'production', APP_ORIGIN: 'https://example.test', MAIL_MODE: 'resend',
    RESEND_API_KEY: config.resendApiKey, MAIL_FROM: config.mailFrom, MAIL_FROM_DOMAIN: 'notify.example.test',
    MAIL_OUTBOX_KEY: randomBytes(32).toString('hex'), READINESS_SECRET: 'r'.repeat(32), RATE_LIMIT_SECRET: 's'.repeat(32) };
  assert.equal(loadConfig(env).mailMode, 'resend');
  for (const name of ['RESEND_API_KEY', 'MAIL_OUTBOX_KEY', 'MAIL_FROM', 'MAIL_FROM_DOMAIN']) {
    assert.throws(() => loadConfig({ ...env, [name]: '' }));
  }
  assert.throws(() => loadConfig({ ...env, MAIL_FROM: 'EMS <other@example.test>' }));
  const target = { RESEND_API_KEY_FILE: '/synthetic/key' };
  loadSecrets(target, () => 're_synthetic\n');
  assert.equal(target.RESEND_API_KEY, 're_synthetic');
  assert.throws(() => loadSecrets(target, () => 'other'), /not both/);
});
