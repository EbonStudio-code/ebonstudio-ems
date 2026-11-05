import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { isolatedPostgres } from '../helpers/postgres.js';
import { bootstrapCeo, issueToken, deliverToken } from '../../src/modules/identity/service.js';
import { processOutbox, decryptMessage } from '../../src/modules/identity/outbox.js';
import { MailDeliveryError } from '../../src/modules/identity/resend.js';
import { transaction, audit } from '../../src/core/transactions.js';
import { checkSchema } from '../../src/core/schema.js';
import { migrationChecksums } from '../../src/core/migration-checksum.js';
import { readFile } from 'node:fs/promises';
import { migrate } from '../../scripts/migrate.js';

test('Transactional Resend queue against an isolated limited-role PostgreSQL', { timeout: 120000 }, async t => {
  const db = await isolatedPostgres();
  t.after(() => db.close());
  const config = { mailMode: 'resend', mailOutboxKey: randomBytes(32).toString('hex'),
    origin: 'https://ems.example.test', mailFrom: 'EMS <no-reply@notify.example.test>', hrNotifications: true };
  const sent = [], logs = [];
  const mailer = { send: async m => { sent.push(m); return { id: randomUUID() }; } };
  const run = (provider = mailer) => processOutbox(db.pool, config, provider, e => logs.push(e));
  const initial = await bootstrapCeo(db.pool, 'Synthetic CEO', 'ceo@example.test', undefined, config);
  const ceo = (await db.pool.query("SELECT id FROM users WHERE role='CEO'")).rows[0].id;
  await t.test('Account emails commit encrypted, survive process boundaries and clear payload after acceptance', async () => {
    assert.equal(await deliverToken(db.pool, config, mailer, initial), 'pending');
    assert.equal(sent.length, 0);
    const queued = (await db.pool.query('SELECT * FROM email_outbox')).rows[0];
    assert.ok(!queued.payload.includes(initial.token));
    assert.equal(decryptMessage(queued.payload, config.mailOutboxKey, queued.id).email, 'ceo@example.test');
    assert.equal(await run(), true);
    assert.equal(sent.length, 1);
    const accepted = (await db.pool.query('SELECT * FROM email_outbox')).rows[0];
    assert.equal(accepted.status, 'accepted');
    assert.equal(accepted.payload, null);
    assert.equal((await db.pool.query('SELECT delivery_status FROM account_tokens WHERE id=$1', [initial.id])).rows[0].delivery_status, 'sent');
    assert.ok(!JSON.stringify(logs).includes('ceo@example.test') && !JSON.stringify(logs).includes(initial.token));
  });
  async function invite() {
    return transaction(db.pool, async q => issueToken(q, { id: ceo, email_canonical: 'ceo@example.test' }, 'INVITATION', config));
  }
  await t.test('Provider retries preserve idempotency and do not keep permanent failures pending', async () => {
    const delivery = await invite();
    let key;
    await run({ send: async m => { key = m.idempotencyKey; throw new MailDeliveryError('MAIL_HTTP_429', true, 90); } });
    let item = (await db.pool.query('SELECT * FROM email_outbox WHERE account_token_id=$1', [delivery.id])).rows[0];
    assert.equal(item.status, 'pending'); assert.equal(item.attempts, 1); assert.ok(item.payload);
    await db.pool.query('UPDATE email_outbox SET next_attempt_at=now() WHERE id=$1', [item.id]);
    await run({ send: async m => { assert.equal(m.idempotencyKey, key); throw new MailDeliveryError('MAIL_HTTP_403'); } });
    item = (await db.pool.query('SELECT * FROM email_outbox WHERE id=$1', [item.id])).rows[0];
    assert.equal(item.status, 'failed'); assert.equal(item.payload, null);
  });
  await t.test('Superseded and expired links never reach provider; parallel workers claim once', async () => {
    await invite(); const latest = await invite();
    const before = sent.length;
    await Promise.all([run(), run()]);
    assert.equal(sent.length, before + 1);
    const expired = await invite();
    await db.pool.query("UPDATE email_outbox SET expires_at=now()-interval '1 second' WHERE account_token_id=$1", [expired.id]);
    await run(); assert.equal(sent.length, before + 1);
    assert.ok(sent.at(-1).url.includes(latest.token));
  });
  await t.test('Rollback removes account delivery and domain-event queues atomically', async () => {
    const before = (await db.pool.query('SELECT count(*)::int AS n FROM email_outbox')).rows[0].n;
    await assert.rejects(transaction(db.pool, async q => {
      await issueToken(q, { id: ceo, email_canonical: 'ceo@example.test' }, 'INVITATION', config);
      throw new Error('rollback');
    }));
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM email_outbox')).rows[0].n, before);
  });
  await t.test('HR audit creates only owner-directed generic notification; disabled delivery cancels', async () => {
    await db.pool.query("UPDATE users SET status='ACTIVE' WHERE id=$1", [ceo]);
    const user = (await db.pool.query("INSERT INTO users(email_canonical,role,status) VALUES('employee@example.test','EMPLOYEE','ACTIVE') RETURNING id")).rows[0];
    const employee = (await db.pool.query(`INSERT INTO employees(user_id,employee_code,full_name,job_title,department,start_date)
      VALUES($1,'TEST','Synthetic','Tester','Tests','2026-01-01') RETURNING id`, [user.id])).rows[0];
    const task = (await db.pool.query(`INSERT INTO tasks(title,assignee_employee_id,created_by,priority)
      VALUES('Sensitive task title',$1,$2,'NORMAL') RETURNING id`, [employee.id, ceo])).rows[0];
    const actor = { id: ceo, requestId: randomUUID() };
    await assert.rejects(transaction(db.pool, async q => { await audit(q, actor, 'tasks', 'TASK_CREATED', task.id); throw new Error('rollback'); }));
    assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM email_outbox WHERE kind='TASK_UPDATED'")).rows[0].n, 0);
    await transaction(db.pool, q => audit(q, actor, 'tasks', 'TASK_CREATED', task.id));
    await run();
    assert.equal(sent.at(-1).email, 'employee@example.test');
    assert.equal(sent.at(-1).purpose, 'TASK_UPDATED');
    assert.equal(sent.at(-1).url, config.origin + '/employee/tasks');
    assert.ok(!JSON.stringify(sent.at(-1)).includes('Sensitive'));
    await transaction(db.pool, q => audit(q, actor, 'tasks', 'TASK_UPDATED', task.id));
    const before = sent.length;
    await processOutbox(db.pool, { ...config, hrNotifications: false }, mailer);
    assert.equal(sent.length, before);
  });
  await t.test('Readiness verifies every migration checksum, not just the first two names', async () => {
    await checkSchema(db.pool);
    const source = await readFile(new URL('../../migrations/001_create_users.sql', import.meta.url));
    await db.admin.query("UPDATE schema_migrations SET sha256=$1 WHERE name='001_create_users.sql'", [migrationChecksums(source)[1]]);
    await checkSchema(db.pool);
    assert.deepEqual(await migrate(db.admin), []);
    await db.admin.query("UPDATE schema_migrations SET sha256='invalid' WHERE name='003_email_outbox.sql'");
    await assert.rejects(checkSchema(db.pool), /Schema/);
  });
});
