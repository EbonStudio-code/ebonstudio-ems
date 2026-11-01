import type { DemoData, Employee, SalarySlip } from './models';
import { addDays, dateKey, workingDates } from './dates';

export function createDemoData(now = new Date()): DemoData {
  const today = dateKey(now);
  const at = now.toISOString();
  const people = [
    ['Maya Chen', 'Product Designer', 'Design'], ['Alex Morgan', 'Frontend Developer', 'Engineering'],
    ['Olivia Brooks', 'People Coordinator', 'Operations'], ['James Wilson', 'Backend Developer', 'Engineering'],
    ['Sofia Patel', 'Marketing Specialist', 'Marketing'], ['Liam Turner', 'QA Engineer', 'Engineering'],
    ['Emma Davis', 'Content Designer', 'Design'], ['Noah Kim', 'Account Executive', 'Sales'],
    ['Ava Robinson', 'Operations Analyst', 'Operations'], ['Ethan Lewis', 'Full-stack Developer', 'Engineering'],
  ];
  const employees: Employee[] = people.map(([name, jobTitle, department], i) => ({
    id: `emp-${i + 1}`, code: `EMP-${String(i + 1).padStart(3, '0')}`, name, jobTitle, department,
    email: `${name.toLowerCase().replaceAll(' ', '.')}@example.test`, phone: '',
    startDate: addDays(today, -120 - i * 10), status: 'Active', account: 'Active',
  }));
  const settings = {
    name: 'Your company', legalName: 'Sample Company (Demo)', address: 'Sample business address',
    timezone: 'UTC', currency: 'USD', workingDays: [1, 2, 3, 4, 5],
  };
  const holidays = [
    { id: 'hol-1', name: 'Company recharge day', date: addDays(today, 8), note: 'A sample company-wide day off.' },
    { id: 'hol-2', name: 'Team appreciation day', date: addDays(today, 23), note: 'Sample holiday for review.' },
    { id: 'hol-3', name: 'Winter break', date: addDays(today, 45), note: 'Sample calendar entry.' },
    { id: 'hol-4', name: 'Founding day', date: addDays(today, -20), note: 'A past, read-only sample holiday.' },
  ];
  const nextDays = workingDates(addDays(today, 2), addDays(today, 14), settings.workingDays, holidays.map(h => h.date));
  const leaveToday = workingDates(today, addDays(today, 6), settings.workingDays, [])[0];
  const leaves: DemoData['leaves'] = [
    { id: 'leave-1', employeeId: 'emp-1', type: 'Annual', startDate: nextDays[0], endDate: nextDays[1], days: nextDays.slice(0, 2), reason: 'A short family trip.', status: 'Pending', history: [{ at, actor: 'Maya Chen', status: 'Pending', reason: 'Request submitted' }] },
    { id: 'leave-2', employeeId: 'emp-2', type: 'Annual', startDate: nextDays[3], endDate: nextDays[3], days: [nextDays[3]], reason: 'Personal appointment.', status: 'Pending', history: [{ at, actor: 'Alex Morgan', status: 'Pending', reason: 'Request submitted' }] },
    { id: 'leave-3', employeeId: 'emp-3', type: 'Sick', startDate: leaveToday, endDate: leaveToday, days: [leaveToday], reason: 'Taking a day to recover.', status: 'Approved', history: [{ at, actor: 'CEO', status: 'Approved', reason: '' }] },
  ];
  const attendance: DemoData['attendance'] = [];
  for (let back = 1; back <= 12; back++) {
    const day = addDays(today, -back);
    if (![1, 2, 3, 4, 5].includes(new Date(`${day}T12:00:00Z`).getUTCDay())) continue;
    employees.forEach((employee, i) => attendance.push({
      id: `att-${employee.id}-${day}`, employeeId: employee.id, date: day,
      checkIn: `${day}T09:${String(i * 2).padStart(2, '0')}:00.000Z`,
      checkOut: `${day}T17:${String(i * 2).padStart(2, '0')}:00.000Z`,
      nonWorking: false, corrections: [],
    }));
  }
  employees.filter((_, i) => [1, 3, 4, 5, 6, 7].includes(i)).forEach((employee, i) => {
    const candidate = new Date(now.getTime() - (i + 1) * 60000);
    const checkIn = dateKey(candidate) === today ? candidate.toISOString() : at;
    attendance.push({ id: `att-${employee.id}-${today}`, employeeId: employee.id, date: today, checkIn, checkOut: null,
      nonWorking: !settings.workingDays.includes(now.getUTCDay()), corrections: [] });
  });
  const tasks: DemoData['tasks'] = [
    { id: 'task-1', title: 'Review the employee portal wireframes', description: 'Review the first round of screens and note anything that would make everyday tasks simpler.', assigneeId: 'emp-1', priority: 'High', status: 'In progress', dueDate: addDays(today, 1), createdAt: at },
    { id: 'task-2', title: 'Update the component library', description: 'Document the current buttons, form fields, and empty states.', assigneeId: 'emp-1', priority: 'Normal', status: 'To do', dueDate: addDays(today, 3), createdAt: at },
    { id: 'task-3', title: 'Prepare the weekly engineering update', description: 'Summarize progress, current blockers, and next steps.', assigneeId: 'emp-2', priority: 'High', status: 'In progress', dueDate: addDays(today, -1), createdAt: at },
    { id: 'task-4', title: 'Review the website copy', description: 'Proofread the new landing page copy.', assigneeId: 'emp-7', priority: 'Normal', status: 'To do', dueDate: addDays(today, 2), createdAt: at },
    { id: 'task-5', title: 'Complete the monthly quality checklist', description: 'Run the agreed checks and document any issues.', assigneeId: 'emp-6', priority: 'High', status: 'Done', dueDate: today, createdAt: at },
    { id: 'task-6', title: 'Share the updated onboarding guide', description: 'Share the revised internal guide with the team.', assigneeId: 'emp-9', priority: 'Low', status: 'In progress', dueDate: addDays(today, 4), createdAt: at },
    { id: 'task-7', title: 'Finalize the icon set', description: 'Export the approved icons and document naming.', assigneeId: 'emp-1', priority: 'Low', status: 'Done', dueDate: addDays(today, -2), createdAt: at },
  ];
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const slips: SalarySlip[] = employees.map((employee, i) => ({
    id: `slip-${i + 1}`, employeeId: employee.id, period: previousMonth, revision: 1, status: 'Published',
    earnings: [{ label: 'Base salary', amountMinor: 350000 + i * 15000 }, { label: 'Allowance', amountMinor: 20000 }],
    deductions: [{ label: 'Sample deduction', amountMinor: 15000 }], note: 'Fictional statement for frontend review. Not a payment record.',
    publishedAt: at, voidReason: '', snapshot: { name: employee.name, code: employee.code, jobTitle: employee.jobTitle,
      department: employee.department, company: settings.legalName, address: settings.address, currency: settings.currency },
  }));
  slips.push({ ...slips[0], id: 'slip-draft', period: today.slice(0, 7), status: 'Draft', publishedAt: null, snapshot: null });
  return {
    schemaVersion: 1, employees, settings, attendance, leaves, tasks, holidays, slips,
    complaints: [
      { id: 'complaint-1', employeeId: 'emp-1', subject: 'Workstation equipment request', category: 'Workplace',
        description: 'My monitor stand needs replacing. Could we arrange a replacement for the workstation?', status: 'In review', createdAt: at,
        messages: [{ id: 'message-1', author: 'CEO', text: 'Thanks for flagging this. I am checking the available options.', at }] },
      { id: 'complaint-2', employeeId: 'emp-4', subject: 'Access to the test environment', category: 'Technical',
        description: 'The shared test environment has been unavailable this week.', status: 'Open', createdAt: at, messages: [] },
      { id: 'complaint-3', employeeId: 'emp-1', subject: 'Salary statement clarification', category: 'Pay',
        description: 'Could you clarify the labels on the sample statement?', status: 'Resolved', createdAt: at,
        messages: [{ id: 'message-2', author: 'CEO', text: 'The statement labels have now been explained. Please reopen if anything remains unclear.', at }] },
    ],
    audit: [
      { id: 'audit-1', actor: 'CEO', action: 'Published salary statements', entity: 'salary-slips', at },
      { id: 'audit-2', actor: 'CEO', action: 'Approved a leave request', entity: 'leave', at },
      { id: 'audit-3', actor: 'CEO', action: 'Created the demo workspace', entity: 'company', at },
    ],
  };
}
