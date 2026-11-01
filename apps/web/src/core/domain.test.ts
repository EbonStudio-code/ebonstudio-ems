import { beforeEach, describe, expect, it } from 'vitest';
import { applyCommand, blockers, holidayImpact, scopedData, totals } from './domain';
import { createDemoData } from './seed';
import { dataSchema } from './models';
import type { DemoData, Session } from './models';
import { dateKey, toMinor, validDate, workingDates } from './dates';

const now = '2026-10-29T12:00:00.000Z';
const ceo: Session = { role: 'CEO', employeeId: 'emp-1' };
const employee: Session = { role: 'Employee', employeeId: 'emp-1' };
let data: DemoData;
beforeEach(() => { data = createDemoData(new Date(now)); });

describe('demo data and scoping', () => {
  it('starts with exactly 10 fictional employees and schema-valid records', () => {
    expect(data.employees).toHaveLength(10);
    expect(dataSchema.safeParse(data).success).toBe(true);
    expect(data.employees.every(e => e.email.endsWith('@example.test'))).toBe(true);
  });
  it('limits employee views to owned records and hides drafts and audit events', () => {
    const view = scopedData(data, employee);
    expect(view.employees).toHaveLength(1);
    expect(view.tasks.every(t => t.assigneeId === employee.employeeId)).toBe(true);
    expect(view.complaints.every(c => c.employeeId === employee.employeeId)).toBe(true);
    expect(view.attendance.every(a => a.employeeId === employee.employeeId)).toBe(true);
    expect(view.slips.every(s => s.employeeId === employee.employeeId && s.status !== 'Draft')).toBe(true);
    expect(view.audit).toHaveLength(0);
  });
  it('exposes no private records to a signed-out preview', () => {
    const view = scopedData(data, null);
    expect([view.employees, view.tasks, view.complaints, view.attendance, view.leaves, view.slips].flat()).toHaveLength(0);
  });
  it('does not mutate the previous state', () => {
    const before = JSON.stringify(data);
    applyCommand(data, ceo, { type: 'task.status', id: 'task-1', status: 'Done' }, now);
    expect(JSON.stringify(data)).toBe(before);
  });
  it('rejects actions when signed out', () => {
    expect(() => applyCommand(data, null, { type: 'attendance.in' }, now)).toThrow('Open a demo account');
  });
});

describe('employee and attendance workflows', () => {
  it('rejects duplicate account email and employee code', () => {
    const { id: _id, status: _status, account: _account, ...values } = data.employees[0];
    expect(() => applyCommand(data, ceo, { type: 'employee.save', values }, now)).toThrow('unique');
  });
  it('blocks deactivation with unresolved leave or tasks', () => {
    expect(blockers(data, 'emp-1', '2026-10-29').length).toBeGreaterThan(0);
    expect(() => applyCommand(data, ceo, { type: 'employee.status', id: 'emp-1', active: false, reason: 'Exit' }, now)).toThrow();
  });
  it('creates an invited account and supports demo acceptance', () => {
    const created = applyCommand(data, ceo, { type: 'employee.save', values: { name: 'Demo Reviewer', code: 'EMP-011', email: 'reviewer@example.test', jobTitle: 'Reviewer', department: 'QA', startDate: '2026-10-29', phone: '' } }, now);
    const person = created.employees.at(-1)!;
    expect(person.account).toBe('Invited');
    expect(applyCommand(created, ceo, { type: 'employee.activate', id: person.id }, now).employees.at(-1)!.account).toBe('Active');
  });
  it('records one check-in and prevents double check-in', () => {
    const updated = applyCommand(data, employee, { type: 'attendance.in' }, now);
    expect(updated.attendance.filter(a => a.employeeId === 'emp-1' && a.date === '2026-10-29')).toHaveLength(1);
    expect(() => applyCommand(updated, employee, { type: 'attendance.in' }, now)).toThrow('already');
  });
  it.each(['08:00:00', '09:00:00', '09:01:00', '18:45:23'])('records the actual %s clock-in with no 9 AM cutoff', time => {
    const instant = `2026-10-29T${time}.000Z`;
    const updated = applyCommand(data, employee, { type: 'attendance.in' }, instant);
    const record = updated.attendance.at(-1)!;
    expect(record.checkIn).toBe(instant);
    expect(record.date).toBe('2026-10-29');
    expect(record.checkOut).toBeNull();
  });
  it('checks out only the owning open record and disallows duplicate checkout', () => {
    const checked = applyCommand(data, employee, { type: 'attendance.in' }, now);
    const record = checked.attendance.at(-1)!;
    const closed = applyCommand(checked, employee, { type: 'attendance.out', id: record.id }, '2026-10-29T13:00:00.000Z');
    expect(closed.attendance.at(-1)!.checkOut).toBe('2026-10-29T13:00:00.000Z');
    expect(() => applyCommand(closed, employee, { type: 'attendance.out', id: record.id }, '2026-10-29T14:00:00.000Z')).toThrow();
    expect(() => applyCommand(data, employee, { type: 'attendance.out', id: data.attendance.at(-1)!.id }, now)).toThrow();
  });
  it('allows cross-midnight checkout without changing the work date', () => {
    const checked = applyCommand(data, employee, { type: 'attendance.in' }, '2026-10-29T23:30:00.000Z');
    const closed = applyCommand(checked, employee, { type: 'attendance.out', id: checked.attendance.at(-1)!.id }, '2026-10-30T00:30:00.000Z');
    expect(closed.attendance.at(-1)!.date).toBe('2026-10-29');
  });
  it('requires CEO correction for stale attendance', () => {
    const checked = applyCommand(data, employee, { type: 'attendance.in' }, now);
    expect(() => applyCommand(checked, employee, { type: 'attendance.out', id: checked.attendance.at(-1)!.id }, '2026-10-30T13:00:00.000Z')).toThrow('correction');
  });
  it('preserves correction history', () => {
    const record = data.attendance[0];
    const result = applyCommand(data, ceo, { type: 'attendance.correct', id: record.id, checkIn: record.checkIn, checkOut: `${record.date}T16:00:00.000Z`, reason: 'Correcting a demo punch.' }, now);
    expect(result.attendance[0].corrections[0].beforeOut).toBe(record.checkOut);
    expect(() => applyCommand(data, employee, { type: 'attendance.correct', id: record.id, checkIn: record.checkIn, checkOut: record.checkOut, reason: 'Test' }, now)).toThrow('CEO');
  });
});

describe('leave, tasks, and complaints', () => {
  it('rejects overlapping leave and releases dates after cancellation', () => {
    const request = data.leaves[0];
    const command = { type: 'leave.create' as const, values: { type: 'Annual' as const, startDate: request.startDate, endDate: request.endDate, reason: 'A replacement request' } };
    expect(() => applyCommand(data, employee, command, now)).toThrow('overlap');
    const cancelled = applyCommand(data, employee, { type: 'leave.status', id: request.id, status: 'Cancelled', reason: '' }, now);
    expect(applyCommand(cancelled, employee, command, now).leaves[0].status).toBe('Pending');
  });
  it('allows only CEO approval and requires a rejection reason', () => {
    expect(() => applyCommand(data, employee, { type: 'leave.status', id: 'leave-1', status: 'Approved', reason: '' }, now)).toThrow();
    expect(() => applyCommand(data, ceo, { type: 'leave.status', id: 'leave-1', status: 'Rejected', reason: '' }, now)).toThrow('reason');
    const updated = applyCommand(data, ceo, { type: 'leave.status', id: 'leave-1', status: 'Approved', reason: '' }, now);
    expect(updated.leaves[0].history.at(-1)!.status).toBe('Approved');
  });
  it('removes prior assignee access immediately after reassignment', () => {
    const item = data.tasks[0];
    const updated = applyCommand(data, ceo, { type: 'task.save', id: item.id, values: { ...item, assigneeId: 'emp-2' } }, now);
    expect(scopedData(updated, employee).tasks.some(t => t.id === item.id)).toBe(false);
    expect(() => applyCommand(updated, employee, { type: 'task.status', id: item.id, status: 'Done' }, now)).toThrow();
  });
  it('prevents employees from cancelling tasks', () => {
    expect(() => applyCommand(data, employee, { type: 'task.status', id: 'task-1', status: 'Cancelled' }, now)).toThrow();
  });
  it('denies cross-employee complaint replies', () => {
    expect(() => applyCommand(data, employee, { type: 'complaint.reply', id: 'complaint-2', text: 'Hidden reply' }, now)).toThrow();
  });
  it('requires a resolution message and makes closed complaints read-only', () => {
    expect(() => applyCommand(data, ceo, { type: 'complaint.status', id: 'complaint-1', status: 'Resolved', reason: '' }, now)).toThrow('reason');
    const resolved = applyCommand(data, ceo, { type: 'complaint.status', id: 'complaint-1', status: 'Resolved', reason: 'Demo resolution' }, now);
    expect(resolved.complaints[0].messages.at(-1)!.text).toBe('Demo resolution');
    const closed = applyCommand(resolved, employee, { type: 'complaint.status', id: 'complaint-1', status: 'Closed', reason: '' }, now);
    expect(() => applyCommand(closed, employee, { type: 'complaint.reply', id: 'complaint-1', text: 'Too late' }, now)).toThrow('closed');
  });
  it('does not put complaint contents in the audit trail', () => {
    const updated = applyCommand(data, employee, { type: 'complaint.reply', id: 'complaint-1', text: 'Private fictional detail' }, now);
    expect(JSON.stringify(updated.audit)).not.toContain('Private fictional detail');
  });
});

describe('holidays and salary statements', () => {
  it('identifies leave impact without rewriting existing leave snapshots', () => {
    const day = data.leaves[0].startDate;
    const before = [...data.leaves[0].days];
    expect(holidayImpact(data, [day]).length).toBeGreaterThan(0);
    const updated = applyCommand(data, ceo, { type: 'holiday.save', values: { date: day, name: 'Demo holiday', note: '' }, reason: '', acknowledged: true }, now);
    expect(updated.leaves[0].days).toEqual(before);
  });
  it('requires acknowledgement and prevents editing past holidays', () => {
    expect(() => applyCommand(data, ceo, { type: 'holiday.save', values: { date: '2026-11-15', name: 'Demo', note: '' }, reason: '', acknowledged: false }, now)).toThrow('Acknowledge');
    expect(() => applyCommand(data, ceo, { type: 'holiday.remove', id: 'hol-4', reason: 'Remove', acknowledged: true }, now)).toThrow('Past');
  });
  it('publishes immutable employee/company snapshots and exposes the slip to its owner', () => {
    const updated = applyCommand(data, ceo, { type: 'slip.publish', id: 'slip-draft' }, now);
    const slip = updated.slips.find(s => s.id === 'slip-draft')!;
    expect(slip.status).toBe('Published');
    expect(slip.snapshot?.name).toBe('Maya Chen');
    expect(scopedData(updated, employee).slips.some(s => s.id === slip.id)).toBe(true);
    const settings = applyCommand(updated, ceo, { type: 'settings.save', name: 'New demo', legalName: 'New name', address: 'New address' }, now);
    expect(settings.slips.find(s => s.id === slip.id)!.snapshot?.company).toBe('Sample Company (Demo)');
  });
  it('prevents employee publication and editing published values', () => {
    expect(() => applyCommand(data, employee, { type: 'slip.publish', id: 'slip-draft' }, now)).toThrow('CEO');
    const slip = data.slips[0];
    expect(() => applyCommand(data, ceo, { type: 'slip.save', id: slip.id, employeeId: slip.employeeId, period: slip.period, earnings: slip.earnings, deductions: slip.deductions, note: 'Change' }, now)).toThrow('immutable');
  });
  it('prevents duplicate current publication and permits void/reissue', () => {
    const old = data.slips[0];
    const created = applyCommand(data, ceo, { type: 'slip.save', employeeId: old.employeeId, period: old.period, earnings: old.earnings, deductions: old.deductions, note: 'Revision' }, now);
    const revision = created.slips[0];
    expect(revision.revision).toBe(2);
    expect(() => applyCommand(created, ceo, { type: 'slip.publish', id: revision.id }, now)).toThrow('Void');
    const voided = applyCommand(created, ceo, { type: 'slip.void', id: old.id, reason: 'Correction' }, now);
    expect(applyCommand(voided, ceo, { type: 'slip.publish', id: revision.id }, now).slips[0].status).toBe('Published');
  });
  it('rejects negative net salary and duplicate drafts', () => {
    const draft = data.slips.find(s => s.id === 'slip-draft')!;
    expect(() => applyCommand(data, ceo, { type: 'slip.save', employeeId: draft.employeeId, period: draft.period, earnings: draft.earnings, deductions: draft.deductions, note: '' }, now)).toThrow('draft already exists');
    expect(() => applyCommand(data, ceo, { type: 'slip.save', id: draft.id, employeeId: draft.employeeId, period: draft.period, earnings: [{ label: 'Salary', amountMinor: 100 }], deductions: [{ label: 'Deduction', amountMinor: 101 }], note: '' }, now)).toThrow('exceed');
  });
});

describe('date and monetary helpers', () => {
  it('validates real calendar dates and bounds long leave ranges', () => {
    expect(validDate('2026-02-30')).toBe(false);
    expect(validDate('2028-02-29')).toBe(true);
    expect(workingDates('2026-01-01', '2028-01-01', [1, 2, 3, 4, 5], [])).toEqual([]);
  });
  it('excludes weekends and holidays', () => {
    expect(workingDates('2026-10-29', '2026-11-02', [1, 2, 3, 4, 5], ['2026-10-30'])).toEqual(['2026-10-29', '2026-11-02']);
  });
  it('derives business dates from the company timezone', () => {
    expect(dateKey('2026-10-29T23:30:00.000Z', 'Asia/Tokyo')).toBe('2026-10-30');
    expect(dateKey('2026-10-29T01:00:00.000Z', 'America/New_York')).toBe('2026-10-28');
  });
  it('uses exact integer minor units and supports different currency exponents', () => {
    expect(toMinor('10.29', 'USD')).toBe(1029);
    expect(toMinor('10', 'JPY')).toBe(10);
    expect(toMinor('10.123', 'BHD')).toBe(10123);
    expect(() => toMinor('10.001', 'USD')).toThrow();
    expect(() => toMinor('10.1', 'JPY')).toThrow();
    expect(() => toMinor('-2', 'USD')).toThrow();
    expect(totals([{ label: 'A', amountMinor: 1029 }], [{ label: 'B', amountMinor: 29 }]).net).toBe(1000);
  });
});
