import type { Complaint, DemoData, Employee, Holiday, Leave, SalaryLine, Session, Task } from './models';
import { dateKey, validDate, workingDates } from './dates';
import { phoneValidationError } from './phone';
import { auditModuleId } from './audit';

export type Command =
  | { type: 'employee.save'; id?: string; values: Omit<Employee, 'id' | 'status' | 'account'> }
  | { type: 'employee.status'; id: string; active: boolean; reason: string }
  | { type: 'employee.invite' | 'employee.activate'; id: string }
  | { type: 'employee.phone'; phone: string }
  | { type: 'attendance.in' }
  | { type: 'attendance.out'; id: string }
  | { type: 'attendance.correct'; id: string; checkIn: string; checkOut: string | null; reason: string }
  | { type: 'leave.create'; values: Pick<Leave, 'type' | 'startDate' | 'endDate' | 'reason'> }
  | { type: 'leave.status'; id: string; status: Leave['status']; reason: string }
  | { type: 'task.save'; id?: string; values: Pick<Task, 'title' | 'description' | 'assigneeId' | 'priority' | 'dueDate'> }
  | { type: 'task.status'; id: string; status: Task['status'] }
  | { type: 'complaint.create'; values: Pick<Complaint, 'subject' | 'category' | 'description'> }
  | { type: 'complaint.reply'; id: string; text: string }
  | { type: 'complaint.status'; id: string; status: Complaint['status']; reason: string }
  | { type: 'holiday.save'; id?: string; values: Omit<Holiday, 'id'>; reason: string; acknowledged: boolean }
  | { type: 'holiday.remove'; id: string; reason: string; acknowledged: boolean }
  | { type: 'slip.save'; id?: string; employeeId: string; period: string; earnings: SalaryLine[]; deductions: SalaryLine[]; note: string }
  | { type: 'slip.publish' | 'slip.void'; id: string; reason?: string }
  | { type: 'settings.save'; name: string; legalName: string; address: string };

function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function find<T extends { id: string }>(items: T[], id: string) {
  const item = items.find(row => row.id === id);
  requireThat(item, 'This record is no longer available.');
  return item;
}
const uid = () => crypto.randomUUID();
const nonempty = (s: string, max = 5000) => s.trim().length > 0 && s.length <= max;

export function blockers(data: DemoData, employeeId: string, today = dateKey(new Date(), data.settings.timezone)) {
  const result: string[] = [];
  if (data.attendance.some(a => a.employeeId === employeeId && !a.checkOut)) result.push('An attendance record is still open.');
  if (data.leaves.some(l => l.employeeId === employeeId && (l.status === 'Pending' || (l.status === 'Approved' && l.days.some(d => d >= today)))))
    result.push('Pending or upcoming approved leave must be cancelled.');
  const count = data.tasks.filter(t => t.assigneeId === employeeId && !['Done', 'Cancelled'].includes(t.status)).length;
  if (count) result.push(`${count} unfinished task${count === 1 ? '' : 's'} must be reassigned or cancelled.`);
  return result;
}

export function holidayImpact(data: DemoData, dates: string[]) {
  return data.leaves.filter(l => ['Pending', 'Approved'].includes(l.status) && dates.some(d => d >= l.startDate && d <= l.endDate));
}

export function totals(earnings: SalaryLine[], deductions: SalaryLine[]) {
  const gross = earnings.reduce((sum, line) => sum + line.amountMinor, 0);
  const deducted = deductions.reduce((sum, line) => sum + line.amountMinor, 0);
  return { gross, deducted, net: gross - deducted };
}

export function scopedData(data: DemoData, session: Session | null): DemoData {
  if (session?.role === 'CEO') return data;
  const employeeId = session?.employeeId;
  return { ...data,
    employees: data.employees.filter(e => e.id === employeeId),
    attendance: data.attendance.filter(a => a.employeeId === employeeId),
    leaves: data.leaves.filter(l => l.employeeId === employeeId),
    tasks: data.tasks.filter(t => t.assigneeId === employeeId),
    complaints: data.complaints.filter(c => c.employeeId === employeeId),
    slips: data.slips.filter(s => s.employeeId === employeeId && s.status !== 'Draft'),
    audit: [],
  };
}

// Frontend demo rules only. Production must enforce these through an authenticated API.
export function applyCommand(original: DemoData, session: Session | null, command: Command, now = new Date().toISOString()): DemoData {
  requireThat(session, 'Open a demo account first.');
  const data = structuredClone(original);
  const ceo = session.role === 'CEO';
  const employeeId = session.employeeId;
  const today = dateKey(now, data.settings.timezone);
  const actor = ceo ? 'CEO' : find(data.employees, employeeId).name;
  const admin = () => requireThat(ceo, 'This action is only available in the CEO preview.');
  const owner = (id: string) => requireThat(ceo || id === employeeId, 'This record is not available to this employee.');
  const employee = () => {
    requireThat(!ceo, 'Switch to an employee account for this action.');
    const person = find(data.employees, employeeId);
    requireThat(person.status === 'Active' && person.account === 'Active', 'This account is not active.');
    return person;
  };
  const activeAssignee = (id: string) => requireThat(find(data.employees, id).status === 'Active', 'Choose an active employee.');
  const reason = (value: string) => requireThat(nonempty(value, 500), 'Please enter a reason (up to 500 characters).');

  switch (command.type) {
    case 'employee.save': {
      admin();
      const v = { ...command.values, email: command.values.email.trim().toLowerCase(), code: command.values.code.trim().toUpperCase(), name: command.values.name.trim(), phone: command.values.phone.trim() };
      const phoneError = phoneValidationError(v.phone);
      requireThat(!phoneError, phoneError);
      requireThat(nonempty(v.name, 120) && nonempty(v.code, 30) && nonempty(v.jobTitle, 100) && nonempty(v.department, 100), 'Complete the employee details.');
      requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) && validDate(v.startDate), 'Enter a valid email and start date.');
      requireThat(!data.employees.some(e => e.id !== command.id && (e.email.toLowerCase() === v.email || e.code === v.code)), 'Email and employee code must be unique.');
      if (command.id) {
        const item = find(data.employees, command.id);
        if (item.startDate !== v.startDate && (data.attendance.some(a => a.employeeId === item.id) || data.leaves.some(l => l.employeeId === item.id)))
          throw new Error('Start date is locked once attendance or leave history exists.');
        if (item.email !== v.email) item.account = 'Invited';
        Object.assign(item, v);
      } else data.employees.push({ ...v, id: uid(), status: 'Active', account: 'Invited' });
      break;
    }
    case 'employee.status': {
      admin();
      const item = find(data.employees, command.id);
      if (!command.active) {
        reason(command.reason);
        const pending = blockers(data, item.id, today);
        requireThat(pending.length === 0, pending.join(' '));
      }
      item.status = command.active ? 'Active' : 'Inactive';
      if (command.active) item.account = 'Invited';
      break;
    }
    case 'employee.invite':
      admin();
      requireThat(find(data.employees, command.id).account === 'Invited', 'This demo account is already active.');
      break;
    case 'employee.activate': {
      admin();
      const item = find(data.employees, command.id);
      requireThat(item.status === 'Active', 'Reactivate the employee first.');
      item.account = 'Active';
      break;
    }
    case 'employee.phone': {
      const phoneError = phoneValidationError(command.phone);
      requireThat(!phoneError, phoneError);
      employee().phone = command.phone.trim();
      break;
    }
    case 'attendance.in': {
      const person = employee();
      requireThat(person.startDate <= today, 'Check-in is available from your start date.');
      requireThat(!data.attendance.some(a => a.employeeId === employeeId && (!a.checkOut || a.date === today)), 'You already have an attendance record today or an open check-in.');
      data.attendance.push({ id: uid(), employeeId, date: today, checkIn: now, checkOut: null, corrections: [],
        nonWorking: !data.settings.workingDays.includes(new Date(`${today}T12:00:00Z`).getUTCDay()) || data.holidays.some(h => h.date === today) });
      break;
    }
    case 'attendance.out': {
      employee();
      const item = find(data.attendance, command.id);
      requireThat(item.employeeId === employeeId && !item.checkOut, 'No open check-in is available.');
      const elapsed = Date.parse(now) - Date.parse(item.checkIn);
      requireThat(elapsed > 0 && elapsed <= 86400000, 'This check-in needs a CEO correction before it can be closed.');
      item.checkOut = now;
      break;
    }
    case 'attendance.correct': {
      admin(); reason(command.reason);
      const item = find(data.attendance, command.id);
      const start = Date.parse(command.checkIn);
      const end = command.checkOut ? Date.parse(command.checkOut) : null;
      requireThat(Number.isFinite(start) && dateKey(command.checkIn, data.settings.timezone) === item.date, 'Check-in must belong to the original working date.');
      requireThat(start <= Date.parse(now) && (end === null || (Number.isFinite(end) && end > start && end - start <= 86400000 && end <= Date.parse(now))), 'Use past timestamps and a positive duration of at most 24 hours.');
      requireThat(end !== null || !data.attendance.some(a => a.id !== item.id && a.employeeId === item.employeeId && !a.checkOut), 'Another open attendance record already exists.');
      item.corrections.push({ at: now, reason: command.reason, beforeIn: item.checkIn, beforeOut: item.checkOut, afterIn: command.checkIn, afterOut: command.checkOut });
      item.checkIn = command.checkIn; item.checkOut = command.checkOut;
      break;
    }
    case 'leave.create': {
      requireThat(employee().startDate <= today, 'Leave requests are available from your start date.');
      const v = command.values;
      reason(v.reason);
      requireThat(v.startDate >= today, 'Backdated leave is not included in this preview.');
      const days = workingDates(v.startDate, v.endDate, data.settings.workingDays, data.holidays.map(h => h.date));
      requireThat(days.length > 0, 'Choose a valid range with working days (maximum 366 calendar days).');
      requireThat(!data.leaves.some(l => l.employeeId === employeeId && ['Pending', 'Approved'].includes(l.status) && l.days.some(d => days.includes(d))), 'These dates overlap an existing pending or approved request.');
      data.leaves.unshift({ ...v, id: uid(), employeeId, days, status: 'Pending', history: [{ at: now, actor, status: 'Pending', reason: v.reason }] });
      break;
    }
    case 'leave.status': {
      const item = find(data.leaves, command.id); owner(item.employeeId);
      if (!ceo) requireThat(item.status === 'Pending' && command.status === 'Cancelled', 'Employees may withdraw pending requests only.');
      else {
        requireThat((item.status === 'Pending' && ['Approved', 'Rejected', 'Cancelled'].includes(command.status)) || (item.status === 'Approved' && command.status === 'Cancelled'), 'This leave transition is not available.');
        if (command.status !== 'Approved') reason(command.reason);
      }
      item.status = command.status;
      item.history.push({ at: now, actor, status: command.status, reason: command.reason });
      break;
    }
    case 'task.save': {
      admin(); activeAssignee(command.values.assigneeId);
      requireThat(nonempty(command.values.title, 120), 'Enter a task title.');
      requireThat(!command.values.dueDate || validDate(command.values.dueDate), 'Choose a valid due date.');
      if (command.id) Object.assign(find(data.tasks, command.id), command.values);
      else data.tasks.unshift({ ...command.values, id: uid(), status: 'To do', createdAt: now });
      break;
    }
    case 'task.status': {
      const item = find(data.tasks, command.id); owner(item.assigneeId);
      if (!ceo) requireThat(item.status !== 'Cancelled' && command.status !== 'Cancelled', 'Only the CEO can cancel or reopen a cancelled task.');
      if (!['Done', 'Cancelled'].includes(command.status)) activeAssignee(item.assigneeId);
      item.status = command.status;
      break;
    }
    case 'complaint.create':
      employee();
      requireThat(nonempty(command.values.subject, 120) && nonempty(command.values.description), 'Enter a subject and description.');
      data.complaints.unshift({ ...command.values, id: uid(), employeeId, status: 'Open', createdAt: now, messages: [] });
      break;
    case 'complaint.reply': {
      const item = find(data.complaints, command.id); owner(item.employeeId);
      requireThat(item.status !== 'Closed', 'This complaint is closed.');
      requireThat(nonempty(command.text), 'Enter a reply (up to 5,000 characters).');
      item.messages.push({ id: uid(), author: ceo ? 'CEO' : employeeId, text: command.text.trim(), at: now });
      break;
    }
    case 'complaint.status': {
      const item = find(data.complaints, command.id); owner(item.employeeId);
      const allowed = (ceo && item.status === 'Open' && command.status === 'In review') ||
        (ceo && item.status === 'In review' && command.status === 'Resolved') ||
        (item.status === 'Resolved' && ['In review', 'Closed'].includes(command.status));
      requireThat(allowed, 'This complaint transition is not available.');
      if (command.status === 'Resolved') {
        reason(command.reason);
        item.messages.push({ id: uid(), author: 'CEO', text: command.reason, at: now });
      }
      item.status = command.status;
      break;
    }
    case 'holiday.save': {
      admin();
      const previous = command.id ? find(data.holidays, command.id) : null;
      requireThat(validDate(command.values.date) && command.values.date >= today && (!previous || previous.date >= today), 'Past holidays are read-only.');
      requireThat(nonempty(command.values.name, 120), 'Enter a holiday name.');
      requireThat(!data.holidays.some(h => h.id !== command.id && h.date === command.values.date), 'A holiday already exists on this date.');
      requireThat(command.acknowledged, 'Acknowledge the calendar impact before saving.');
      if (previous) { reason(command.reason); Object.assign(previous, command.values); }
      else data.holidays.push({ ...command.values, id: uid() });
      break;
    }
    case 'holiday.remove':
      admin(); reason(command.reason);
      requireThat(find(data.holidays, command.id).date >= today && command.acknowledged, 'Past holidays are read-only; acknowledge the calendar impact.');
      data.holidays = data.holidays.filter(h => h.id !== command.id);
      break;
    case 'slip.save': {
      admin(); find(data.employees, command.employeeId);
      requireThat(/^\d{4}-(0[1-9]|1[0-2])$/.test(command.period), 'Choose a salary month.');
      requireThat(command.earnings.length >= 1 && command.earnings.length <= 20 && command.deductions.length <= 20, 'Use 1-20 earnings and up to 20 deduction lines.');
      requireThat([...command.earnings, ...command.deductions].every(l => nonempty(l.label, 80) && Number.isSafeInteger(l.amountMinor) && l.amountMinor >= 0 && l.amountMinor <= 1_000_000_000_000), 'Enter valid labels and nonnegative monetary values.');
      requireThat(totals(command.earnings, command.deductions).net >= 0, 'Deductions cannot exceed earnings.');
      if (command.id) {
        const item = find(data.slips, command.id);
        requireThat(item.status === 'Draft', 'Published statements are immutable. Void and create a new revision.');
        requireThat(item.employeeId === command.employeeId && item.period === command.period, 'Employee and month cannot change on an existing draft.');
        Object.assign(item, { earnings: command.earnings, deductions: command.deductions, note: command.note });
      } else {
        requireThat(!data.slips.some(s => s.employeeId === command.employeeId && s.period === command.period && s.status === 'Draft'), 'A draft already exists for this employee and month.');
        const revision = Math.max(0, ...data.slips.filter(s => s.employeeId === command.employeeId && s.period === command.period).map(s => s.revision)) + 1;
        data.slips.unshift({ id: uid(), employeeId: command.employeeId, period: command.period, revision, status: 'Draft',
          earnings: command.earnings, deductions: command.deductions, note: command.note, publishedAt: null, snapshot: null, voidReason: '' });
      }
      break;
    }
    case 'slip.publish': {
      admin(); const item = find(data.slips, command.id);
      requireThat(item.status === 'Draft', 'Only a draft can be published.');
      requireThat(!data.slips.some(s => s.id !== item.id && s.employeeId === item.employeeId && s.period === item.period && s.status === 'Published'), 'Void the existing published statement before publishing a replacement.');
      requireThat(nonempty(data.settings.legalName) && nonempty(data.settings.address), 'Complete the company statement details first.');
      const person = find(data.employees, item.employeeId);
      item.snapshot = { name: person.name, code: person.code, jobTitle: person.jobTitle, department: person.department,
        company: data.settings.legalName, address: data.settings.address, currency: data.settings.currency };
      item.status = 'Published'; item.publishedAt = now;
      break;
    }
    case 'slip.void': {
      admin(); reason(command.reason ?? '');
      const item = find(data.slips, command.id);
      requireThat(item.status === 'Published', 'Only a published statement can be voided.');
      item.status = 'Voided'; item.voidReason = command.reason ?? '';
      break;
    }
    case 'settings.save':
      admin(); requireThat(nonempty(command.name, 120), 'Enter a company display name.');
      Object.assign(data.settings, { name: command.name, legalName: command.legalName, address: command.address });
      break;
  }
  data.audit.unshift({ id: uid(), actor, action: command.type.replace('.', ': '), entity: auditModuleId(command.type.split('.')[0]), at: now });
  data.audit = data.audit.slice(0, 500);
  return data;
}
