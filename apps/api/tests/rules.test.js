import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import '../src/core/database.js';
import { today, datesBetween, workingDates } from '../src/core/dates.js';
import { parse, date, phone, object, email } from '../src/core/validation.js';
import { loadConfig } from '../src/core/config.js';
import { totals } from '../src/modules/salary-slips/service.js';
import { statementPdf } from '../src/modules/salary-slips/pdf.js';

test('Company date respects timezone and DST boundaries', () => {
  assert.equal(today('Asia/Kolkata', new Date('2026-01-01T20:00:00Z')), '2026-01-02');
  assert.equal(today('America/New_York', new Date('2026-03-08T06:59:00Z')), '2026-03-08');
  assert.equal(today('America/New_York', new Date('2026-03-08T07:01:00Z')), '2026-03-08');
});
test('Date ranges validate leap years, order and the 366-day limit', () => {
  assert.equal(parse(date, '2028-02-29'), '2028-02-29');
  assert.throws(() => parse(date, '2027-02-29'));
  assert.throws(() => datesBetween('2026-01-02', '2026-01-01'));
  assert.equal(datesBetween('2028-01-01', '2028-12-31').length, 366);
  assert.throws(() => datesBetween('2028-01-01', '2029-01-01'));
});
test('PostgreSQL DATE arrays stay calendar dates instead of local-midnight instants', () => {
  assert.deepEqual(pg.types.getTypeParser(1182)('{2028-02-29,2028-03-01}'), ['2028-02-29','2028-03-01']);
});
test('Working dates exclude weekends and holidays', () => {
  assert.deepEqual(workingDates('2026-01-05', '2026-01-11', [1,2,3,4,5], ['2026-01-06']),
    ['2026-01-05','2026-01-07','2026-01-08','2026-01-09']);
});
test('Strict input shapes reject mass assignment and canonicalize email', () => {
  assert.equal(parse(email, '  EXAMPLE@EXAMPLE.TEST  '), 'example@example.test');
  assert.throws(() => parse(object({ email }), { email: 'a@example.test', role: 'CEO' }));
  assert.throws(() => parse(email, { $ne: null }));
});
test('Optional phone validation rejects letters, zero-only and short numbers', () => {
  for (const value of ['', '+91 98765 43210', '(212) 555-0123']) assert.equal(parse(phone, value), value);
  for (const value of ['123', '0000000000', '12abc345678', '++++123456789']) assert.throws(() => parse(phone, value));
});
test('Salary totals are integer-only and cannot be negative or overflow', () => {
  assert.deepEqual(totals([{ amountMinor: 420050 }], [{ amountMinor: 50 }]), { gross: 420050, deductionTotal: 50, net: 420000 });
  assert.throws(() => totals([{ amountMinor: 1 }], [{ amountMinor: 2 }]));
  assert.throws(() => totals([{ amountMinor: Number.MAX_SAFE_INTEGER }, { amountMinor: 1 }], []));
  assert.throws(() => totals([{ amountMinor: 1.1 }], []));
});
test('Module dependency and production configuration fail closed', () => {
  assert.throws(() => loadConfig({ ENABLED_MODULES: 'leave' }));
  assert.throws(() => loadConfig({ ENABLED_MODULES: 'tasks,tasks' }));
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }));
  assert.throws(() => loadConfig({ APP_ORIGIN: 'http://127.0.0.1:5173/path' }));
  assert.throws(() => loadConfig({ PORT: '0' }));
  assert.throws(() => loadConfig({ NODE_ENV: 'prod' }));
  assert.equal(loadConfig({ ENABLED_MODULES: '' }).modules.length, 0);
  assert.equal(loadConfig({}).rateLimitSecret, loadConfig({}).rateLimitSecret);
});
test('PDF refuses unsupported text instead of silently corrupting glyphs', async () => {
  await assert.rejects(statementPdf({ template_version: 1, earnings: [], deductions: [] },
    { company: { displayName: 'Company' }, employee: { fullName: 'कर्मचारी' } }),
  error => error.code === 'PDF_FONT_REQUIRED');
});
