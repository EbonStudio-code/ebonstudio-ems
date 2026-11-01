import { afterEach, describe, expect, it, vi } from 'vitest';
import { phoneValidationError } from './phone';
import { auditModuleId, auditModuleLabel, auditModuleOptions, filterAuditHistory, normalizeAuditHistory } from './audit';
import { DATA_KEY, loadDemoData } from './persistence';
import { applyCommand } from './domain';
import { createDemoData } from './seed';
import { attendanceSummary } from './attendance-summary';
import type { Attendance, Employee, Session } from './models';

const now = '2026-10-30T12:00:00.000Z';
const ceo: Session = { role: 'CEO', employeeId: 'emp-1' };
const employee: Session = { role: 'Employee', employeeId: 'emp-1' };
const fixture = () => createDemoData(new Date(now));
const employeeValues = (person: Employee) => ({
  name: person.name, code: person.code, email: person.email, jobTitle: person.jobTitle,
  department: person.department, startDate: person.startDate, phone: person.phone,
});

afterEach(() => vi.unstubAllGlobals());

describe('BUG-01: shared optional phone validation', () => {
  it.each(['', '   ', '5550123', '2025550123', '+1 (202) 555-0123', '(020) 7946 0958', '+44 20 7946 0958', '202.555.0123', '+123456789012345', '  +1 (202) 555-0123  '])('accepts a blank or plausible formatted phone: %j', value => {
    expect(phoneValidationError(value)).toBe('');
  });

  it.each(['not-a-phone', '123', '1234567890123456', '000-000-0000', '++12025550123', '202+5550123', '(202 555-0123', '202) 555-0123', '()2025550123', '202--555-0123', '202/555/0123', '2025550123 ext 12', '202\n5550123', '1'.repeat(33)])('rejects an invalid phone: %j', value => {
    expect(phoneValidationError(value)).not.toBe('');
  });

  it('rejects an invalid employee phone without changing the record or audit trail', () => {
    const data = fixture();
    data.employees[0].phone = '+1 (202) 555-0123';
    const before = JSON.stringify(data);
    expect(() => applyCommand(data, employee, { type: 'employee.phone', phone: 'not-a-phone' }, now)).toThrow('valid phone number');
    expect(JSON.stringify(data)).toBe(before);
  });

  it('saves a trimmed valid employee phone and permits clearing the optional field', () => {
    const saved = applyCommand(fixture(), employee, { type: 'employee.phone', phone: '  +1 (202) 555-0123  ' }, now);
    expect(saved.employees[0].phone).toBe('+1 (202) 555-0123');
    expect(applyCommand(saved, employee, { type: 'employee.phone', phone: '  ' }, now).employees[0].phone).toBe('');
  });

  it('also rejects invalid phone numbers on CEO employee creation and editing', () => {
    const data = fixture();
    const values = { ...employeeValues(data.employees[0]), phone: 'not-a-phone' };
    expect(() => applyCommand(data, ceo, { type: 'employee.save', id: 'emp-1', values }, now)).toThrow('valid phone number');
    expect(() => applyCommand(data, ceo, { type: 'employee.save', values: { ...values, code: 'EMP-QA', email: 'qa@example.test' } }, now)).toThrow('valid phone number');
    expect(data.employees).toHaveLength(10);
  });

  it('accepts optional or formatted phone numbers when the CEO edits a profile', () => {
    const data = fixture();
    const values = { ...employeeValues(data.employees[0]), phone: '  +44 20 7946 0958  ' };
    const saved = applyCommand(data, ceo, { type: 'employee.save', id: 'emp-1', values }, now);
    expect(saved.employees[0].phone).toBe('+44 20 7946 0958');
    expect(applyCommand(saved, ceo, { type: 'employee.save', id: 'emp-1', values: { ...values, phone: '' } }, now).employees[0].phone).toBe('');
  });
});

describe('BUG-02: canonical audit categories and persisted-history migration', () => {
  const historicalEvents = () => [
    { id: 'seed-salary', actor: 'CEO', action: 'Published salary statements', entity: 'Salary slips', at: now },
    { id: 'old-draft', actor: 'CEO', action: 'slip: save', entity: 'slip', at: now },
    { id: 'old-publish', actor: 'CEO', action: 'slip: publish', entity: 'slip', at: now },
    { id: 'old-company', actor: 'CEO', action: 'Created workspace', entity: 'Company', at: now },
    { id: 'old-settings', actor: 'CEO', action: 'settings: save', entity: 'settings', at: now },
    { id: 'unknown', actor: 'CEO', action: 'Future event', entity: 'Future module', at: now },
  ];

  it.each(['Salary slips', 'slip', 'slips', 'salary-slips', ' SALARY SLIPS '])('maps %j to one salary category', entity => {
    expect(auditModuleId(entity)).toBe('salary-slips');
    expect(auditModuleLabel(entity)).toBe('Salary slips');
  });

  it('preserves every historical event and unknown category, changing only recognized category IDs', () => {
    const old = historicalEvents();
    const before = structuredClone(old);
    const migrated = normalizeAuditHistory(old);
    expect(old).toEqual(before);
    expect(migrated).toHaveLength(old.length);
    expect(migrated.map(({ entity: _entity, ...rest }) => rest)).toEqual(old.map(({ entity: _entity, ...rest }) => rest));
    expect(migrated.map(e => e.entity)).toEqual(['salary-slips', 'salary-slips', 'salary-slips', 'company', 'company', 'Future module']);
    expect(normalizeAuditHistory(migrated)).toBe(migrated);
  });

  it('shows one salary option and filters all historical salary actions together', () => {
    const events = historicalEvents();
    expect(auditModuleOptions(events).filter(option => option.label === 'Salary slips')).toEqual([{ id: 'salary-slips', label: 'Salary slips' }]);
    expect(auditModuleOptions(events).some(option => option.label === 'slip')).toBe(false);
    expect(filterAuditHistory(events, 'salary-slips').map(e => e.id)).toEqual(['seed-salary', 'old-draft', 'old-publish']);
    expect(filterAuditHistory(events, 'Salary slips')).toHaveLength(3);
    expect(filterAuditHistory(events, '', '')).toHaveLength(events.length);
    expect(filterAuditHistory(events, 'salary-slips', ' PUBLISH ')).toHaveLength(2);
  });

  it('uses the same salary category for newly created, published, and voided statements and seed events', () => {
    const data = fixture();
    const created = applyCommand(data, ceo, { type: 'slip.save', employeeId: 'emp-2', period: '2026-10',
      earnings: [{ label: 'Sample salary', amountMinor: 123400 }], deductions: [], note: 'Regression fixture' }, now);
    const id = created.slips[0].id;
    const published = applyCommand(created, ceo, { type: 'slip.publish', id }, now);
    const voided = applyCommand(published, ceo, { type: 'slip.void', id, reason: 'Regression fixture correction' }, now);
    const salaryEvents = filterAuditHistory(voided.audit, 'salary-slips');
    expect(salaryEvents.map(event => event.action)).toEqual(['slip: void', 'slip: publish', 'slip: save', 'Published salary statements']);
    expect(salaryEvents.every(event => event.entity === 'salary-slips')).toBe(true);
    expect(auditModuleOptions(voided.audit).filter(option => option.id === 'salary-slips')).toHaveLength(1);
  });

  it('loads and persists old audit IDs without resetting employee, salary, or other module data', () => {
    const old = fixture();
    old.audit = historicalEvents();
    old.employees[0].phone = 'not-a-phone'; // Existing invalid data is retained for user correction, never silently discarded.
    old.settings.name = 'Existing review workspace';
    let stored = JSON.stringify(old);
    const setItem = vi.fn((key: string, value: string) => { expect(key).toBe(DATA_KEY); stored = value; });
    vi.stubGlobal('localStorage', { getItem: () => stored, setItem });
    const loaded = loadDemoData();
    expect(loaded.warning).toBe('');
    expect({ ...loaded.data, audit: old.audit }).toEqual(old);
    expect(loaded.data.audit.map(event => event.entity)).toEqual(normalizeAuditHistory(old.audit).map(event => event.entity));
    expect(JSON.parse(stored)).toEqual(loaded.data);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(loadDemoData().data).toEqual(loaded.data);
    expect(setItem).toHaveBeenCalledTimes(1); // Idempotent on reload.
  });

  it('retains existing data and normalized in-memory filters if migration persistence fails', () => {
    const old = fixture();
    old.audit = historicalEvents();
    old.settings.name = 'Keep this workspace';
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(old), setItem: () => { throw new Error('Quota exceeded'); } });
    const loaded = loadDemoData();
    expect(loaded.warning).toContain('updated in memory');
    expect(loaded.data.settings.name).toBe('Keep this workspace');
    expect(loaded.data.employees).toEqual(old.employees);
    expect(loaded.data.slips).toEqual(old.slips);
    expect(loaded.data.audit).toHaveLength(old.audit.length);
    expect(filterAuditHistory(loaded.data.audit, 'salary-slips')).toHaveLength(3);
  });
});

describe('post-checkout guidance', () => {
  const record: Attendance = { id: 'attendance-qa', employeeId: 'emp-1', date: '2026-10-30', checkIn: '2026-10-30T09:00:00.000Z',
    checkOut: null, nonWorking: false, corrections: [] };

  it('only prompts check-in before a workday has started', () => {
    const summary = attendanceSummary(undefined, undefined, 'UTC', Date.parse(now));
    expect(summary.action).toBe('Clock in');
    expect(summary.disabled).toBe(false);
    expect(summary.description).toContain('marked Present right away');
  });

  it('describes an active workday and enables checkout', () => {
    const summary = attendanceSummary(record, undefined, 'UTC', Date.parse(now));
    expect(summary.action).toBe('Clock out');
    expect(summary.disabled).toBe(false);
    expect(summary.description).toContain('marked Present');
    expect(summary.present).toBe(true);
  });

  it('describes completion and disables further check-in after checkout', () => {
    const summary = attendanceSummary(undefined, { ...record, checkOut: '2026-10-30T11:30:00.000Z' }, 'UTC', Date.parse(now));
    expect(summary.title).toBe('Day Completed');
    expect(summary.description).toContain('remain Present');
    expect(summary.description).toContain('No further clock-in is needed today.');
    expect(summary.record?.checkOutAt).toBe('2026-10-30T11:30:00.000Z');
    expect(summary.description).not.toContain('Use the demo check-in');
    expect(summary.action).toBe('Day completed');
    expect(summary.disabled).toBe(true);
  });

  it('guides stale check-ins to a CEO correction rather than another check-in', () => {
    const summary = attendanceSummary({ ...record, checkIn: '2026-10-29T09:00:00.000Z' }, undefined, 'UTC', Date.parse(now));
    expect(summary.description).toContain('Ask the CEO to correct it');
    expect(summary.action).toBe('Correction required');
    expect(summary.disabled).toBe(true);
  });
});
