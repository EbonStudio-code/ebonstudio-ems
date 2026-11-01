import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { isolatedPostgres } from '../helpers/postgres.js';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/core/config.js';
import { bootstrapCeo } from '../../src/modules/identity/service.js';
import { digest } from '../../src/modules/identity/session.js';
import { migrate } from '../../scripts/migrate.js';

const base = '/api/v1';
const initialPassword = 'Synthetic test password 2026!';
const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
function client(app, config) {
  const agent = request.agent(app);
  return {
    agent, csrf: null, cookie: null,
    async refresh() {
      const result = await agent.get(base + '/auth/csrf').expect(200);
      this.csrf = result.body.data.csrfToken;
      if (result.headers['set-cookie']) this.cookie = result.headers['set-cookie'][0].split(';')[0].split('=')[1];
      return result;
    },
    async get(path, status = 200) {
      return agent.get(base + path).expect(status);
    },
    async send(method, path, data, status = 200) {
      const result = await agent[method](base + path).set('Origin', config.origin).set('X-CSRF-Token', this.csrf || '')
        .send(data);
      assert.equal(result.status, status, `${method} ${path}: ${JSON.stringify(result.body)}`);
      if (result.body.data?.csrfToken) this.csrf = result.body.data.csrfToken;
      if (result.headers['set-cookie']) this.cookie = result.headers['set-cookie'][0].split(';')[0].split('=')[1];
      return result;
    },
    async login(email, password = initialPassword, status = 200) {
      await this.refresh();
      return this.send('post', '/auth/login', { email, password }, status);
    },
  };
}
function pdfContents(buffer) {
  const text = buffer.toString('latin1');
  let decoded = '';
  for (const match of text.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const end = text.indexOf('\nendstream', start);
    if (end < 0) continue;
    let content = buffer.subarray(start, end);
    try { content = inflateSync(content); } catch { /* Uncompressed metadata is not a page text stream. */ }
    for (const hex of content.toString('latin1').matchAll(/<([a-f0-9]+)>/gi)) decoded += Buffer.from(hex[1], 'hex').toString('latin1');
  }
  return decoded;
}
test('Backend integration against isolated SCRAM PostgreSQL and limited runtime role', { timeout: 180000 }, async t => {
  const db = await isolatedPostgres();
  t.after(() => db.close());
  const config = { ...loadConfig({ APP_ORIGIN: 'http://127.0.0.1:5173', RATE_LIMIT_SECRET: 'synthetic-integration-rate-limit-secret' }), testRateScale: 100 };
  const messages = [];
  const events = [];
  let failMail = false;
  const mailer = { async send(message) { if (failMail) throw new Error('Synthetic provider failure'); messages.push(message); } };
  const app = createApp({ pool: db.pool, config, mailer, logger: event => events.push(event) });
  const tokenFor = email => new URL(messages.findLast(m => m.email === email).url).hash.slice('#token='.length);
  const bootstrap = await bootstrapCeo(db.pool, 'Synthetic CEO', 'ceo@example.test');
  const ceo = client(app, config);
  await ceo.refresh();
  await ceo.send('post', '/auth/accept-invitation', { token: bootstrap.token, newPassword: initialPassword });
  await ceo.login('ceo@example.test');
  const company = {
    version: 0, displayName: 'Synthetic Company', legalName: '', statementAddress: '', timezone: 'UTC',
    workingWeekdays: [0,1,2,3,4,5,6], currencyCode: 'USD', currencyMinorUnit: 2,
    leaveTypes: ['Annual','Sick','Unpaid'], salaryPublicationEnabled: false, salaryJurisdiction: '',
  };
  await ceo.send('patch', '/company', company);
  let sequence = 0;
  async function employee({ activate = true, startDate = day(-30) } = {}) {
    sequence += 1;
    const email = `synthetic-${sequence}@example.test`;
    const result = await ceo.send('post', '/employees', { fullName: `Synthetic Employee ${sequence}`, email,
      employeeCode: `TEST-${sequence}`, jobTitle: 'Tester', department: 'Synthetic', startDate }, 201);
    const session = client(app, config);
    if (activate) {
      await session.refresh();
      await session.send('post', '/auth/accept-invitation', { token: tokenFor(email), newPassword: initialPassword });
      await session.login(email);
    }
    return { ...result.body.data, email, session };
  }
  const alice = await employee();
  const bob = await employee();
  const a = alice.session;
  const b = bob.session;
  const taskData = id => ({ title: 'Synthetic task', description: 'Private task detail', assigneeEmployeeId: id, priority: 'NORMAL' });
  const leaveData = (offset = 10) => ({ type: 'Annual', startDate: day(offset), endDate: day(offset), reason: 'Synthetic leave' });
  async function latestEmployee(id) { return (await ceo.get('/employees/' + id)).body.data; }
  async function companyPatch(fields, status = 200) {
    const current = (await ceo.get('/company')).body.data;
    return ceo.send('patch', '/company', { version: current.version, ...fields }, status);
  }
  async function holidayCreate(date, name = 'Synthetic holiday') {
    const preview = (await ceo.send('post', '/holidays/impact-preview', { operation: 'CREATE', date, name })).body.data;
    return ceo.send('post', '/holidays', { date, name, impactFingerprint: preview.impactFingerprint, acknowledgeImpact: true }, 201);
  }

  await t.test('Migrations are repeatable and enforce limited runtime privileges', async () => {
    assert.deepEqual(await migrate(db.admin), []);
    await assert.rejects(db.pool.query('CREATE TABLE forbidden_test(id int)'), e => e.code === '42501');
    await assert.rejects(db.pool.query("UPDATE audit_events SET action='tampered'"), e => e.code === '42501');
    await assert.rejects(db.pool.query("DELETE FROM employees"), e => e.code === '42501');
    await request(app).get(base + '/health/ready').expect(200);
  });
  await t.test('Manual 001 is adopted only explicitly after exact catalog comparison', async () => {
    await db.admin.query('CREATE DATABASE ems_baseline_case');
    const baseline = new pg.Pool({ ...db.connection, database: 'ems_baseline_case' });
    try {
      await baseline.query(await readFile(new URL('../../migrations/001_create_users.sql', import.meta.url), 'utf8'));
      await assert.rejects(migrate(baseline), /--baseline/);
      const result = await migrate(baseline, { baseline: true });
      assert.ok(result.includes('Baselined 001_create_users.sql'));
      assert.equal((await baseline.query('SELECT count(*)::int AS count FROM users')).rows[0].count, 0);
    } finally { await baseline.end(); }
  });
  await t.test('Single CEO bootstrap and normalized uniqueness are database-enforced', async () => {
    await assert.rejects(bootstrapCeo(db.pool, 'Second', 'second@example.test'), e => e.code === 'CEO_EXISTS');
    await assert.rejects(db.pool.query("INSERT INTO users(email_canonical,role) VALUES('UPPER@example.test','EMPLOYEE')"), e => e.code === '23514');
    await ceo.send('post', '/employees', { fullName: 'Duplicate', email: alice.email.toUpperCase(), employeeCode: 'NEW-DUPLICATE',
      jobTitle: 'Tester', department: 'Synthetic', startDate: day(0) }, 409);
    const user = (await db.admin.query('SELECT password_hash FROM users WHERE email_canonical=$1', [alice.email])).rows[0];
    assert.ok(user.password_hash.startsWith('$argon2id$'));
  });
  await t.test('Migration checksum drift and incompatible manual baselines fail closed', async () => {
    const original = (await db.admin.query("SELECT sha256 FROM schema_migrations WHERE name='001_create_users.sql'")).rows[0].sha256;
    await db.admin.query("UPDATE schema_migrations SET sha256='invalid' WHERE name='001_create_users.sql'");
    try { await assert.rejects(migrate(db.admin), /checksum mismatch/); }
    finally { await db.admin.query("UPDATE schema_migrations SET sha256=$1 WHERE name='001_create_users.sql'", [original]); }
    await db.admin.query('CREATE DATABASE ems_incompatible_case');
    const incompatible = new pg.Pool({ ...db.connection, database: 'ems_incompatible_case' });
    try {
      await incompatible.query(await readFile(new URL('../../migrations/001_create_users.sql', import.meta.url), 'utf8'));
      await incompatible.query('ALTER TABLE users ADD COLUMN unexpected TEXT');
      await assert.rejects(migrate(incompatible, { baseline: true }), /differs from 001/);
      assert.equal((await incompatible.query("SELECT to_regclass('public.schema_migrations') AS journal")).rows[0].journal, null);
      assert.ok((await incompatible.query("SELECT to_regclass('public.users') AS users")).rows[0].users);
    } finally { await incompatible.end(); }
  });
  await t.test('Session responses are allowlisted, private and include role capabilities', async () => {
    const result = await a.get('/auth/session');
    assert.equal(result.body.data.employee.id, alice.id);
    assert.equal(result.body.data.role, 'EMPLOYEE');
    assert.equal(result.headers['cache-control'], 'private, no-store');
    assert.ok(!/passwordHash|tokenHash|sessionHash/.test(result.text));
    await request(app).get(base + '/employees/me').expect(401);
  });
  await t.test('CSRF requires session-bound token and exact Origin even on login', async () => {
    const anon = client(app, config);
    await anon.refresh();
    await anon.agent.post(base + '/auth/login').send({ email: alice.email, password: initialPassword }).expect(403);
    await anon.agent.post(base + '/auth/login').set('Origin', 'http://evil.example').set('X-CSRF-Token', anon.csrf)
      .send({ email: alice.email, password: initialPassword }).expect(403);
    await anon.agent.post(base + '/auth/login').set('Origin', config.origin).set('X-CSRF-Token', a.csrf)
      .send({ email: alice.email, password: initialPassword }).expect(403);
    const oldCookie = anon.cookie;
    await anon.send('post', '/auth/login', { email: alice.email, password: initialPassword });
    assert.ok(anon.cookie !== oldCookie);
  });
  await t.test('Strict bodies, malformed JSON, size limits and parameterized directory search', async () => {
    await a.send('patch', '/employees/me', { version: 0, phone: '', role: 'CEO' }, 422);
    await ceo.send('post', '/employees', { email: { $ne: null } }, 422);
    await a.agent.patch(base + '/employees/me').set('Origin', config.origin).set('X-CSRF-Token', a.csrf)
      .set('Content-Type', 'application/json').send('{"bad":').expect(400);
    await a.send('patch', '/employees/me', { version: 0, phone: 'x'.repeat(66000) }, 413);
    await a.agent.post(base + '/attendance/check-in').set('Origin', config.origin).set('X-CSRF-Token', a.csrf)
      .set('Content-Encoding', 'gzip').send({}).expect(415);
    await ceo.get('/employees?limit=101', 422);
    const found = await ceo.get('/employees?search=' + encodeURIComponent("' OR 1=1 --"));
    assert.equal(found.body.pagination.total, 0);
  });
  await t.test('CEO-only checks run before lookup and self profile only edits phone', async () => {
    await a.get('/employees/not-an-id', 403);
    await a.get('/audit-events', 403);
    await ceo.send('post', '/attendance/check-in', {}, 403);
    await ceo.get('/employees/not-an-id', 400);
    await a.send('patch', '/employees/me', { version: 0, phone: '123' }, 422);
    const changed = await a.send('patch', '/employees/me', { version: 0, phone: '+91 98765 43210' });
    assert.equal(changed.body.data.version, 1);
    await a.send('patch', '/employees/me', { version: 0, phone: '' }, 409);
  });
  await t.test('Invitation delivery failure persists safely and resend invalidates old links', async () => {
    failMail = true;
    const invited = await employee({ activate: false });
    failMail = false;
    assert.equal(invited.invitationDelivery, 'failed');
    assert.equal((await latestEmployee(invited.id)).accountStatus, 'INVITED');
    assert.equal((await latestEmployee(invited.id)).invitationDelivery, 'failed');
    await ceo.send('post', `/employees/${invited.id}/invitation`, {});
    const oldToken = tokenFor(invited.email);
    await ceo.send('post', `/employees/${invited.id}/invitation`, {});
    await invited.session.refresh();
    await invited.session.send('post', '/auth/accept-invitation', { token: oldToken, newPassword: initialPassword }, 422);
    const newToken = tokenFor(invited.email);
    await invited.session.send('post', '/auth/accept-invitation', { token: newToken, newPassword: initialPassword });
    await invited.session.refresh();
    await invited.session.send('post', '/auth/accept-invitation', { token: newToken, newPassword: initialPassword }, 422);
    await invited.session.login(invited.email);
  });
  await t.test('Expired invitation tokens cannot activate an account', async () => {
    const invited = await employee({ activate: false });
    await db.admin.query("UPDATE account_tokens SET expires_at=now()-interval '1 second' WHERE user_id=$1", [invited.userId]);
    await invited.session.refresh();
    await invited.session.send('post', '/auth/accept-invitation', { token: tokenFor(invited.email), newPassword: initialPassword }, 422);
    await invited.session.login(invited.email, initialPassword, 401);
  });
  await t.test('Concurrent redemption of one setup token activates only once', async () => {
    const invited = await employee({ activate: false });
    await invited.session.refresh();
    const second = client(app, config);
    await second.refresh();
    const token = tokenFor(invited.email);
    const redeem = session => session.agent.post(base + '/auth/accept-invitation').set('Origin', config.origin)
      .set('X-CSRF-Token', session.csrf).send({ token, newPassword: initialPassword });
    assert.deepEqual((await Promise.all([redeem(invited.session),redeem(second)])).map(r => r.status).sort(), [200,422]);
  });
  await t.test('Password recovery is generic and reset revokes sessions and token replay', async () => {
    const target = await employee();
    const recovery = client(app, config);
    await recovery.refresh();
    const unknown = await recovery.send('post', '/auth/forgot-password', { email: 'unknown@example.test' });
    const known = await recovery.send('post', '/auth/forgot-password', { email: target.email });
    assert.deepEqual(known.body, unknown.body);
    const token = tokenFor(target.email);
    await recovery.send('post', '/auth/reset-password', { token, newPassword: 'Changed synthetic password 2026!' });
    await target.session.get('/auth/session', 401);
    await recovery.refresh();
    await recovery.send('post', '/auth/reset-password', { token, newPassword: initialPassword }, 422);
    await target.session.login(target.email, initialPassword, 401);
    await target.session.login(target.email, 'Changed synthetic password 2026!');
  });
  await t.test('Password change rotates current session and revokes other sessions', async () => {
    const target = await employee();
    const other = client(app, config);
    await other.login(target.email);
    const oldCookie = target.session.cookie;
    await target.session.send('post', '/auth/change-password', { currentPassword: initialPassword, newPassword: 'A different synthetic password!' });
    assert.ok(target.session.cookie !== oldCookie);
    await target.session.get('/auth/session');
    await other.get('/auth/session', 401);
  });
  await t.test('Idle, absolute and account-version session expiry are enforced', async () => {
    const target = await employee();
    await db.admin.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1", [target.userId]);
    await target.session.get('/auth/session', 401);
    await target.session.login(target.email);
    await db.admin.query("UPDATE sessions SET absolute_expires_at=now()-interval '1 second' WHERE user_id=$1", [target.userId]);
    await target.session.get('/auth/session', 401);
    await target.session.login(target.email);
    await db.admin.query('UPDATE users SET session_version=session_version+1 WHERE id=$1', [target.userId]);
    await target.session.get('/auth/session', 401);
  });
  await t.test('Email change revokes sessions and requires a fresh invitation', async () => {
    const target = await employee();
    const result = await ceo.send('patch', '/employees/' + target.id, { version: 0, email: 'changed-' + target.email });
    assert.equal(result.body.data.accountStatus, 'INVITED');
    await target.session.get('/auth/session', 401);
    await target.session.login('changed-' + target.email, initialPassword, 401);
    await target.session.send('post', '/auth/accept-invitation', { token: tokenFor('changed-' + target.email), newPassword: initialPassword });
    await target.session.login('changed-' + target.email);
  });
  await t.test('Future starters cannot punch or request leave', async () => {
    const future = await employee({ startDate: day(20) });
    await future.session.send('post', '/attendance/check-in', {}, 409);
    await future.session.send('post', '/leave/requests', leaveData(25), 409);
    assert.equal((await future.session.get('/attendance/me/current')).body.data.nextAction, 'NOT_STARTED');
  });
  await t.test('Clock-in records attendance immediately using server time, before checkout', async () => {
    const target = await employee();
    const beforeCount = (await ceo.get('/dashboard')).body.data.attendance.checkedIn;
    await target.session.send('post', '/attendance/check-in', { checkInAt: day(0)+'T09:00:00.000Z' }, 422);
    assert.equal((await target.session.get('/attendance/me/current')).body.data.todayRecord, null);
    const before = Date.now();
    const record = (await target.session.send('post', '/attendance/check-in', {}, 201)).body.data;
    assert.ok(Date.parse(record.checkInAt) >= before && Date.parse(record.checkInAt) <= Date.now());
    assert.equal(record.checkOutAt, null);
    assert.equal(record.state, 'OPEN');
    const current = (await target.session.get('/attendance/me/current')).body.data;
    assert.equal(current.todayRecord.id, record.id);
    assert.equal(current.nextAction, 'CHECK_OUT');
    assert.ok((await target.session.get('/dashboard')).body.data.attendance.some(a => a.id === record.id));
    assert.equal((await ceo.get('/dashboard')).body.data.attendance.checkedIn, beforeCount + 1);
    await target.session.send('post', '/attendance/check-out', {attendanceId: record.id, version: record.version});
    assert.equal((await target.session.get('/attendance/me/current')).body.data.nextAction, 'COMPLETE');
    assert.equal((await ceo.get('/dashboard')).body.data.attendance.checkedIn, beforeCount + 1);
    assert.equal((await target.session.get('/attendance/me')).body.data.find(a => a.id === record.id).checkInAt, record.checkInAt);
  });
  await t.test('Concurrent check-ins/checkouts yield one winner and preserve timestamps', async () => {
    const target = await employee();
    const punch = () => target.session.agent.post(base + '/attendance/check-in').set('Origin', config.origin).set('X-CSRF-Token', target.session.csrf).send({});
    const results = await Promise.all([punch(), punch()]);
    assert.deepEqual(results.map(r => r.status).sort(), [201,409]);
    const row = results.find(r => r.status === 201).body.data;
    await b.get('/attendance/' + row.id, 404);
    const checkout = () => target.session.agent.post(base + '/attendance/check-out').set('Origin', config.origin).set('X-CSRF-Token', target.session.csrf).send({ attendanceId: row.id, version: 0 });
    const closed = await Promise.all([checkout(), checkout()]);
    assert.deepEqual(closed.map(r => r.status).sort(), [200,409]);
    const timestamp = closed.find(r => r.status === 200).body.data.checkOutAt;
    await target.session.send('post', '/attendance/check-in', {}, 409);
    assert.equal((await target.session.get('/attendance/' + row.id)).body.data.checkOutAt, timestamp);
    await ceo.send('patch', '/employees/' + target.id, { version: 0, startDate: day(1) }, 409);
  });
  await t.test('Live leave overlap changes without rewriting punch-time flags', async () => {
    const target = await employee();
    const record = (await target.session.send('post', '/attendance/check-in', {}, 201)).body.data;
    assert.equal(record.approvedLeaveFlag, false);
    const leave = (await target.session.send('post', '/leave/requests', leaveData(0), 201)).body.data;
    await ceo.send('post', `/leave/requests/${leave.id}/approve`, { version: 0 });
    const current = (await target.session.get('/attendance/' + record.id)).body.data;
    assert.equal(current.approvedLeaveFlag, false);
    assert.equal(current.currentApprovedLeaveOverlap, true);
    await ceo.send('post', `/leave/requests/${leave.id}/cancel`, { version: 1, reason: 'Synthetic cancellation' });
    assert.equal((await target.session.get('/attendance/' + record.id)).body.data.currentApprovedLeaveOverlap, false);
  });
  await t.test('Cross-midnight checkout retains original date; stale punches need correction', async () => {
    const target = await employee();
    const checkIn = new Date(day(0) + 'T00:00:00Z').getTime() - 1000;
    const result = await db.admin.query(`INSERT INTO attendance(employee_id,work_date,check_in_at,state,timezone_snapshot,calendar_revision,non_working_day_flag,approved_leave_flag)
      VALUES($1,$2,$3,'OPEN','UTC',0,false,false) RETURNING id`, [target.id, day(-1), new Date(checkIn)]);
    const closed = await target.session.send('post', '/attendance/check-out', { attendanceId: result.rows[0].id, version: 0 });
    assert.equal(closed.body.data.workDate, day(-1));
    const stale = await employee();
    const old = new Date(Date.now() - 25 * 3600000);
    const oldRecord = await db.admin.query(`INSERT INTO attendance(employee_id,work_date,check_in_at,state,timezone_snapshot,calendar_revision,non_working_day_flag,approved_leave_flag)
      VALUES($1,$2,$3,'OPEN','UTC',0,false,false) RETURNING id`, [stale.id, old.toISOString().slice(0,10), old]);
    const recordId = oldRecord.rows[0].id;
    await stale.session.send('post', '/attendance/check-out', { attendanceId: recordId, version: 0 }, 409);
    assert.equal((await stale.session.get('/attendance/me/current')).body.data.nextAction, 'CEO_CORRECTION_REQUIRED');
    await ceo.send('post', `/attendance/${recordId}/corrections`, { version: 0, checkInAt: old.toISOString(),
      checkOutAt: new Date(old.getTime() + 3600000).toISOString(), reason: 'Synthetic correction' });
    const history = (await stale.session.get('/attendance/' + recordId)).body.data.corrections;
    assert.equal(history.pagination.total, 1);
    assert.equal(history.data[0].beforeValues.state, 'OPEN');
    await assert.rejects(db.admin.query("UPDATE attendance_corrections SET reason='tamper'"), e => e.code === '23514');
  });
  await t.test('Overlapping concurrent leave reserves only one set of dates', async () => {
    const target = await employee();
    const submit = () => target.session.agent.post(base + '/leave/requests').set('Origin', config.origin).set('X-CSRF-Token', target.session.csrf).send(leaveData(30));
    const results = await Promise.all([submit(), submit()]);
    assert.deepEqual(results.map(r => r.status).sort(), [201,409]);
    const row = results.find(r => r.status === 201).body.data;
    await b.get('/leave/requests/' + row.id, 404);
    await target.session.send('post', `/leave/requests/${row.id}/approve`, { version: 0 }, 403);
    await ceo.send('post', `/leave/requests/${row.id}/reject`, { version: 0 }, 422);
    await ceo.send('post', `/leave/requests/${row.id}/reject`, { version: 0, reason: 'Synthetic rejection' });
    await target.session.send('post', '/leave/requests', leaveData(30), 201);
    assert.equal((await db.admin.query('SELECT count(*)::int AS n FROM leave_reservations WHERE employee_id=$1', [target.id])).rows[0].n, 1);
  });
  await t.test('Approved leave cannot be withdrawn by employee; CEO cancellation releases dates', async () => {
    const target = await employee();
    const leave = (await target.session.send('post', '/leave/requests', leaveData(31), 201)).body.data;
    await ceo.send('post', `/leave/requests/${leave.id}/approve`, { version: 0 });
    await target.session.send('post', `/leave/requests/${leave.id}/cancel`, { version: 1 }, 409);
    await ceo.send('post', `/leave/requests/${leave.id}/cancel`, { version: 1, reason: 'Reviewed cancellation' });
    await ceo.send('post', `/leave/requests/${leave.id}/approve`, { version: 2 }, 409);
    assert.equal((await db.admin.query('SELECT count(*)::int AS n FROM leave_reservations WHERE request_id=$1', [leave.id])).rows[0].n, 0);
  });
  await t.test('Holiday preview fingerprints detect new leave and changed proposals', async () => {
    const preview = (await ceo.send('post', '/holidays/impact-preview', { operation: 'CREATE', date: day(40), name: 'Reviewed' })).body.data;
    assert.equal(preview.affectedCount, 0);
    await ceo.send('post', '/holidays', { date: day(40), name: 'Different', impactFingerprint: preview.impactFingerprint, acknowledgeImpact: true }, 409);
    await a.send('post', '/leave/requests', leaveData(40), 201);
    await ceo.send('post', '/holidays', { date: day(40), name: 'Reviewed', impactFingerprint: preview.impactFingerprint, acknowledgeImpact: true }, 409);
  });
  await t.test('Holiday changes preserve leave snapshots and preview both old/new dates', async () => {
    const target = await employee();
    const leave = (await target.session.send('post', '/leave/requests', leaveData(45), 201)).body.data;
    const holiday = (await holidayCreate(day(45))).body.data;
    assert.deepEqual((await target.session.get('/leave/requests/' + leave.id)).body.data.workingDatesSnapshot, [day(45)]);
    await b.send('post', '/leave/preview', { type: 'Annual', startDate: day(45), endDate: day(45) }, 422);
    const preview = (await ceo.send('post', '/holidays/impact-preview', { operation: 'UPDATE', holidayId: holiday.id, version: 0, date: day(46) })).body.data;
    assert.deepEqual(preview.affectedDates, [day(45),day(46)]);
    assert.equal(preview.affectedCount, 1);
    await ceo.send('patch', '/holidays/' + holiday.id, { version: 0, date: day(46), reason: 'Synthetic move', impactFingerprint: preview.impactFingerprint, acknowledgeImpact: true });
    const removal = (await ceo.send('post', '/holidays/impact-preview', { operation: 'DELETE', holidayId: holiday.id, version: 1 })).body.data;
    await ceo.send('delete', '/holidays/' + holiday.id, { version: 1, reason: 'Synthetic removal', impactFingerprint: removal.impactFingerprint, acknowledgeImpact: true }, 204);
    const past = (await db.admin.query("INSERT INTO holidays(date,name) VALUES($1,'Past synthetic') RETURNING id", [day(-10)])).rows[0];
    await ceo.send('post', '/holidays/impact-preview', { operation: 'DELETE', holidayId: past.id, version: 0 }, 409);
  });
  await t.test('Task reassignment removes access and concurrent versions have one winner', async () => {
    const created = (await ceo.send('post', '/tasks', taskData(alice.id), 201)).body.data;
    await b.get('/tasks/' + created.id, 404);
    await a.send('post', '/tasks/' + created.id + '/status', { version: 0, state: 'DONE', assigneeEmployeeId: bob.id }, 422);
    const update = title => ceo.agent.patch(base + '/tasks/' + created.id).set('Origin', config.origin).set('X-CSRF-Token', ceo.csrf).send({ version: 0, title });
    assert.deepEqual((await Promise.all([update('First'),update('Second')])).map(r => r.status).sort(), [200,409]);
    await ceo.send('patch', '/tasks/' + created.id, { version: 1, assigneeEmployeeId: bob.id });
    await a.get('/tasks/' + created.id, 404);
    await b.get('/tasks/' + created.id);
    await b.send('post', '/tasks/' + created.id + '/status', { version: 2, state: 'CANCELLED' }, 403);
    await ceo.send('post', '/tasks/' + created.id + '/status', { version: 2, state: 'CANCELLED' });
    await b.send('post', '/tasks/' + created.id + '/status', { version: 3, state: 'TODO' }, 403);
  });
  await t.test('Complaint access, state machine, immutable messages and redacted lists', async () => {
    const created = (await a.send('post', '/complaints', { subject: 'Synthetic private subject', category: 'OTHER', description: 'UNIQUE_PRIVATE_COMPLAINT_BODY' }, 201)).body.data;
    await b.get('/complaints/' + created.id, 404);
    await b.get('/complaints/' + created.id + '/messages', 404);
    assert.ok(!(await a.get('/complaints')).text.includes('UNIQUE_PRIVATE_COMPLAINT_BODY'));
    await a.send('post', `/complaints/${created.id}/status`, { version: 0, state: 'IN_REVIEW' }, 409);
    await ceo.send('post', `/complaints/${created.id}/status`, { version: 0, state: 'IN_REVIEW' });
    await ceo.send('post', `/complaints/${created.id}/status`, { version: 1, state: 'RESOLVED' }, 422);
    await ceo.send('post', `/complaints/${created.id}/status`, { version: 1, state: 'RESOLVED', resolutionText: 'UNIQUE_PRIVATE_RESOLUTION' });
    const reply = await a.send('post', `/complaints/${created.id}/messages`, { version: 2, text: 'Synthetic follow-up' }, 201);
    assert.equal(reply.body.data.parentVersion, 3);
    await a.send('post', `/complaints/${created.id}/status`, { version: 2, state: 'CLOSED' }, 409);
    await a.send('post', `/complaints/${created.id}/status`, { version: 3, state: 'IN_REVIEW' });
    await ceo.send('post', `/complaints/${created.id}/status`, { version: 4, state: 'RESOLVED', resolutionText: 'Final synthetic resolution' });
    await a.send('post', `/complaints/${created.id}/status`, { version: 5, state: 'CLOSED' });
    await a.send('post', `/complaints/${created.id}/messages`, { version: 6, text: 'Not allowed' }, 409);
    await assert.rejects(db.admin.query("UPDATE complaint_messages SET text='tampered'"), e => e.code === '23514');
  });
  await t.test('Deactivation blockers serialize with task creation; reactivation requires setup', async () => {
    const target = await employee();
    const task = (await ceo.send('post', '/tasks', taskData(target.id), 201)).body.data;
    assert.equal((await ceo.get(`/employees/${target.id}/deactivation-check`)).body.data.unfinishedTasks, 1);
    await ceo.send('post', `/employees/${target.id}/deactivate`, { version: 0, reason: 'Synthetic exit' }, 409);
    await ceo.send('post', `/tasks/${task.id}/status`, { version: 0, state: 'CANCELLED' });
    await ceo.send('post', `/employees/${target.id}/deactivate`, { version: 0, reason: 'Synthetic exit' });
    await target.session.get('/auth/session', 401);
    await ceo.send('post', '/tasks', taskData(target.id), 409);
    await ceo.send('post', `/tasks/${task.id}/status`, { version: 1, state: 'TODO' }, 409);
    await ceo.send('post', `/employees/${target.id}/reactivate`, { version: 1 });
    await target.session.login(target.email, initialPassword, 401);
    await target.session.send('post', '/auth/accept-invitation', { token: tokenFor(target.email), newPassword: initialPassword });
    await target.session.login(target.email);
    const racer = await employee();
    const deactivate = ceo.agent.post(base + `/employees/${racer.id}/deactivate`).set('Origin', config.origin).set('X-CSRF-Token', ceo.csrf).send({ version: 0, reason: 'Race test' });
    const assign = ceo.agent.post(base + '/tasks').set('Origin', config.origin).set('X-CSRF-Token', ceo.csrf).send(taskData(racer.id));
    const results = await Promise.all([deactivate, assign]);
    assert.ok((results[0].status === 200 && results[1].status === 409) || (results[0].status === 409 && results[1].status === 201));
  });
  await t.test('Leave/attendance blockers and inactive attendance reopen are enforced', async () => {
    const target = await employee();
    const record = (await target.session.send('post', '/attendance/check-in', {}, 201)).body.data;
    await ceo.send('post', `/employees/${target.id}/deactivate`, { version: 0, reason: 'Synthetic exit' }, 409);
    await target.session.send('post', '/attendance/check-out', { attendanceId: record.id, version: 0 });
    const leave = (await target.session.send('post', '/leave/requests', leaveData(35), 201)).body.data;
    await ceo.send('post', `/employees/${target.id}/deactivate`, { version: 0, reason: 'Synthetic exit' }, 409);
    await ceo.send('post', `/leave/requests/${leave.id}/approve`, { version: 0 });
    assert.equal((await ceo.get(`/employees/${target.id}/deactivation-check`)).body.data.approvedFutureLeave, 1);
    await ceo.send('post', `/employees/${target.id}/deactivate`, { version: 0, reason: 'Synthetic exit' }, 409);
    await ceo.send('post', `/leave/requests/${leave.id}/cancel`, { version: 1, reason: 'Exit checklist' });
    await ceo.send('post', `/employees/${target.id}/deactivate`, { version: 0, reason: 'Synthetic exit' });
    await ceo.send('post', `/attendance/${record.id}/corrections`, { version: 1, checkInAt: record.checkInAt,
      checkOutAt: null, reason: 'Must not reopen inactive record' }, 409);
  });
  await t.test('Audit insertion failure rolls back the entire domain mutation', async () => {
    const before = (await db.admin.query('SELECT count(*)::int AS n FROM tasks')).rows[0].n;
    await db.admin.query(`CREATE FUNCTION synthetic_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='TASK_CREATED' THEN RAISE EXCEPTION 'Synthetic failure' USING ERRCODE='23514'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION synthetic_audit_failure()`);
    try { await ceo.send('post', '/tasks', taskData(alice.id), 422); }
    finally { await db.admin.query('DROP TRIGGER synthetic_audit_failure ON audit_events; DROP FUNCTION synthetic_audit_failure()'); }
    assert.equal((await db.admin.query('SELECT count(*)::int AS n FROM tasks')).rows[0].n, before);
  });
  let published;
  await t.test('Salary validation, draft privacy and legal-publication gate', async () => {
    const fields = { employeeId: alice.id, period: '2026-10', earnings: [{ label: 'UNIQUE_SALARY_LABEL', amountMinor: 420050 }], deductions: [] };
    await ceo.send('post', '/salary-slips', { ...fields, earnings: [{ label: 'Invalid', amountMinor: 1.5 }] }, 422);
    await ceo.send('post', '/salary-slips', { ...fields, deductions: [{ label: 'Too much', amountMinor: 420051 }] }, 422);
    const slip = (await ceo.send('post', '/salary-slips', fields, 201)).body.data;
    published = slip;
    assert.equal(slip.netMinor, 420050);
    await ceo.send('post', '/salary-slips', fields, 409);
    await a.get('/salary-slips/' + slip.id, 404);
    await a.get('/salary-slips/' + slip.id + '/pdf', 404);
    assert.equal((await a.get('/salary-slips?state=DRAFT')).body.pagination.total, 0);
    await ceo.send('post', '/salary-slips/' + slip.id + '/publish', { version: 0 }, 409);
    const pdf = await ceo.get('/salary-slips/' + slip.id + '/pdf');
    assert.ok(Buffer.isBuffer(pdf.body));
    assert.ok(pdfContents(pdf.body).includes('DRAFT'));
  });
  await t.test('Salary publication is concurrent-safe with immutable snapshots and private PDFs', async () => {
    await companyPatch({ legalName: 'Synthetic Legal Name', statementAddress: 'Synthetic address only',
      salaryJurisdiction: 'Synthetic reviewed test jurisdiction', salaryPublicationEnabled: true });
    const publish = () => ceo.agent.post(base + `/salary-slips/${published.id}/publish`).set('Origin', config.origin).set('X-CSRF-Token', ceo.csrf).send({ version: 0 });
    const results = await Promise.all([publish(), publish()]);
    assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
    published = results.find(r => r.status === 200).body.data;
    await ceo.send('patch', '/salary-slips/' + published.id, { version: 1, note: 'Tamper' }, 409);
    await assert.rejects(db.admin.query("UPDATE salary_slips SET note='tampered' WHERE id=$1", [published.id]), e => e.code === '23514');
    const current = await latestEmployee(alice.id);
    await ceo.send('patch', '/employees/' + alice.id, { version: current.version, fullName: 'Renamed synthetic employee' });
    assert.equal((await a.get('/salary-slips/' + published.id)).body.data.employeeSnapshot.fullName, published.employeeSnapshot.fullName);
    await b.get('/salary-slips/' + published.id, 404);
    await b.get('/salary-slips/' + published.id + '/pdf', 404);
    const pdf = await a.get('/salary-slips/' + published.id + '/pdf');
    assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
    assert.equal(pdf.headers['cache-control'], 'private, no-store');
    assert.match(pdf.headers['content-disposition'], /^attachment; filename="salary-/);
    assert.ok(pdfContents(pdf.body).includes('PUBLISHED'));
    await request(app).get(base + '/salary-slips/' + published.id + '/pdf').expect(401);
  });
  await t.test('Voiding preserves history; replacement revisions and one-current invariant', async () => {
    const replacement = (await ceo.send('post', '/salary-slips', { employeeId: alice.id, period: '2026-10',
      earnings: [{ label: 'Replacement', amountMinor: 420050 }], deductions: [] }, 201)).body.data;
    assert.equal(replacement.revision, 2);
    await ceo.send('post', `/salary-slips/${replacement.id}/publish`, { version: 0 }, 409);
    await ceo.send('post', `/salary-slips/${published.id}/void`, { version: 1, reason: 'Synthetic revision' });
    assert.ok(pdfContents((await a.get(`/salary-slips/${published.id}/pdf`)).body).includes('VOID'));
    await ceo.send('post', `/salary-slips/${replacement.id}/publish`, { version: 0 });
    assert.equal((await a.get('/salary-slips')).body.pagination.total, 2);
    await companyPatch({ currencyCode: 'EUR', currencyMinorUnit: 2 }, 409);
    await companyPatch({ timezone: 'Asia/Kolkata' }, 409);
    await companyPatch({ workingWeekdays: [1,2,3,4,5] }, 409);
  });
  await t.test('CEO may publish for a former employee without restoring account access', async () => {
    const target = await employee();
    await ceo.send('post', `/employees/${target.id}/deactivate`, { version: 0, reason: 'Synthetic departure' });
    const slip = (await ceo.send('post', '/salary-slips', { employeeId: target.id, period: '2026-09',
      earnings: [{ label: 'Final internal statement', amountMinor: 100 }], deductions: [] }, 201)).body.data;
    await ceo.send('post', `/salary-slips/${slip.id}/publish`, { version: 0 });
    await target.session.get(`/salary-slips/${slip.id}`, 401);
  });
  await t.test('Dashboards are scoped, bounded and omit complaint bodies and salary amounts', async () => {
    const employeeDashboard = await a.get('/dashboard');
    assert.equal(employeeDashboard.body.data.employees, undefined);
    assert.ok(employeeDashboard.body.data.tasks.work.length <= 5);
    assert.ok(employeeDashboard.body.data.salarySlips.latestPublished.id);
    const ceoDashboard = await ceo.get('/dashboard');
    assert.ok(ceoDashboard.body.data.employees.activeCount > 0);
    assert.ok(!/UNIQUE_PRIVATE|UNIQUE_SALARY_LABEL|420050|netMinor|description/.test(employeeDashboard.text + ceoDashboard.text));
    const audit = await ceo.get('/audit-events?limit=100');
    assert.ok(!/UNIQUE_PRIVATE|UNIQUE_SALARY_LABEL|passwordHash|tokenHash/.test(audit.text));
    assert.ok(events.every(e => Object.keys(e).sort().join() === 'durationMs,method,requestId,status'));
  });
  await t.test('Holiday today marks punches and removes not-checked-in classification', async () => {
    await holidayCreate(day(0), 'Synthetic nonworking day');
    const target = await employee();
    const row = (await target.session.send('post', '/attendance/check-in', {}, 201)).body.data;
    assert.equal(row.nonWorkingDayFlag, true);
    const dashboard = (await ceo.get('/dashboard')).body.data;
    assert.equal(dashboard.workingDay, false);
    assert.equal(dashboard.attendance.notCheckedIn, 0);
    assert.deepEqual(dashboard.attendance.notCheckedInEmployees, []);
  });
  await t.test('Disabled feature routes/widgets disappear without deleting historical data', async () => {
    const disabledConfig = { ...config, modules: ['holidays'] };
    const disabled = createApp({ pool: db.pool, config: disabledConfig, mailer });
    const session = client(disabled, disabledConfig);
    await session.login('ceo@example.test');
    await session.get('/tasks', 404);
    await session.send('post', '/tasks', taskData(alice.id), 404);
    assert.equal((await session.get('/dashboard')).body.data.tasks, undefined);
    assert.ok((await db.admin.query('SELECT count(*)::int AS n FROM tasks')).rows[0].n > 0);
  });
  await t.test('Persistent rate limits survive creating a new API instance', async () => {
    const rateConfig = { ...config, testRateScale: 1, rateLimitSecret: 'separate-synthetic-rate-limit-key' };
    const rateApp = createApp({ pool: db.pool, config: rateConfig, mailer });
    const session = client(rateApp, rateConfig);
    await session.refresh();
    for (let i = 0; i < 10; i += 1) await session.send('post', '/auth/login', { email: 'limited@example.test', password: initialPassword }, 401);
    const second = client(createApp({ pool: db.pool, config: rateConfig, mailer }), rateConfig);
    await second.refresh();
    const blocked = await second.send('post', '/auth/login', { email: 'limited@example.test', password: initialPassword }, 429);
    assert.ok(Number(blocked.headers['retry-after']) > 0);
  });
  await t.test('Production cookie attributes and logout invalidation', async () => {
    const production = { ...config, production: true, cookieName: '__Host-ems', origin: 'https://ems.example.test', readinessSecret: 'synthetic-private-readiness-key-2026' };
    const productionApp = createApp({ pool: db.pool, config: production, mailer });
    await request(productionApp).get(base + '/health/ready').expect(404);
    await request(productionApp).get(base + '/health/ready').set('X-Readiness-Key', production.readinessSecret).expect(200);
    const result = await request(productionApp).get(base + '/auth/csrf').expect(200);
    const cookie = result.headers['set-cookie'][0];
    assert.ok(cookie.startsWith('__Host-ems=') && cookie.includes('Secure') && cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax'));
    assert.ok(!cookie.includes('Domain='));
    const target = await employee();
    const hash = digest(target.session.cookie);
    await target.session.send('post', '/auth/logout', {}, 204);
    assert.equal((await db.admin.query('SELECT 1 FROM sessions WHERE token_hash=$1', [hash])).rowCount, 0);
    await target.session.get('/auth/session', 401);
  });
});
