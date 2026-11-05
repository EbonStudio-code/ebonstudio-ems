import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock3, ListTodo, Users } from 'lucide-react';
import { Badge, Card, CompactState, Person, Stat } from '../../components/ui';
import DashboardSections from '../../components/DashboardSections';
import type { DashboardSection } from '../../components/DashboardSections';
import StudioIntro from '../../components/StudioIntro';
import { useWorkspace } from '../../core/store';
import { dateKey, formatDate, formatTime } from '../../core/dates';
import { attendanceSummary } from '../../core/attendance-summary';
import AttendanceClockControl from '../attendance/AttendanceClockControl';

export default function Dashboard() {
  const { data, ceo, base } = useWorkspace();
  const today = dateKey(new Date(), data.settings.timezone);
  const active = data.employees.filter(e => e.status === 'Active' && e.startDate <= today);
  const todayRecords = data.attendance.filter(a => a.date === today);
  const pending = data.leaves.filter(l => l.status === 'Pending');
  const unfinished = data.tasks.filter(t => !['Done', 'Cancelled'].includes(t.status));
  const overdue = unfinished.filter(t => t.dueDate && t.dueDate < today);
  const work = [...unfinished].sort((a, b) =>
    Number(Boolean(b.dueDate && b.dueDate < today)) - Number(Boolean(a.dueDate && a.dueDate < today)));
  const complaints = data.complaints.filter(c => !['Resolved', 'Closed'].includes(c.status));
  const onLeave = data.leaves.filter(l => l.status === 'Approved' && l.days.includes(today));
  const holidays = [...data.holidays].filter(h => h.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const corrections = data.attendance.filter(a => !a.checkOut &&
    attendanceSummary(a, undefined, data.settings.timezone).action === 'Correction required');
  const viewAll = (path: string, text = 'View all') => <Link className="text-link" to={`${base}/${path}`}>{text}<ArrowRight size={14} aria-hidden="true" /></Link>;
  const sections: DashboardSection[] = [{
    id:'tasks', priority:overdue.length ? 2 : 0, quiet:!unfinished.length,
    content:unfinished.length ? <Card title={ceo ? 'Work in Focus' : 'Your Next Tasks'} className={overdue.length ? 'dashboard-attention' : ''} action={viewAll('tasks')}>
      {(!ceo || overdue.length > 0) && <div className="section-intro">{!ceo && <span>{unfinished.length} unfinished tasks</span>}
        {overdue.length > 0 && <span className="danger-text">{overdue.length} overdue</span>}</div>}
      <div className="list-stack">{work.slice(0,5).map(task => <Link className="task-summary" to={`${base}/tasks/${task.id}`} key={task.id}>
        <span className="task-check"><ListTodo size={18} aria-hidden="true" /></span><div><strong>{task.title}</strong>
          <small className={task.dueDate && task.dueDate < today ? 'danger-text' : undefined}>{task.dueDate ? `${task.dueDate < today ? 'Overdue' : 'Due'} ${formatDate(task.dueDate)}` : 'No due date'}</small>
        </div><Badge>{task.status}</Badge></Link>)}</div>
    </Card> : <CompactState title="Tasks" description="No unfinished tasks." to={`${base}/tasks`} action="View tasks" />,
  }];
  if (ceo) sections.push({id:'attendance', priority:corrections.length ? 1 : 0,
    content:<Card title={corrections.length ? 'Attendance Corrections' : 'Today’s Attendance'} className={corrections.length ? 'dashboard-attention' : ''} action={viewAll('attendance', corrections.length ? 'Review attendance' : 'View attendance')}>
      {corrections.length > 0 && <p className="warning-text">{corrections.length} earlier open record{corrections.length === 1 ? '' : 's'} to review.</p>}
      {todayRecords.length ? todayRecords.slice(0,5).map(record => <div className="attendance-person" key={record.id}>
        <Person name={data.employees.find(e => e.id === record.employeeId)?.name ?? 'Employee'} secondary={`Clocked in ${formatTime(record.checkIn, data.settings.timezone)}`} /><Badge>Present</Badge>
      </div>) : <p className="dashboard-note">No check-ins recorded today.</p>}
    </Card>});
  sections.push({
    id:'leave', priority:ceo && pending.length ? 3 : 0, quiet:!pending.length && !onLeave.length,
    content:pending.length || onLeave.length ? <Card title={ceo ? pending.length ? 'Leave Approvals' : 'Time Off & Requests' : 'My Leave Requests'} className={ceo && pending.length ? 'dashboard-attention' : ''} action={viewAll('leave', ceo && pending.length ? 'Review requests' : 'View leave')}>
      {pending.length > 0 && <div className="leave-overview"><strong>{pending.length}</strong><div><span>{ceo ? 'Awaiting your approval' : 'Waiting for CEO review'}</span></div></div>}
      {onLeave.length > 0 && <p className="dashboard-note">{onLeave.length} on approved leave today.</p>}
      <div className="list-stack">{pending.slice(0,3).map(request => <Link className="request-summary" to={`${base}/leave/${request.id}`} key={request.id}>
        <Person name={data.employees.find(e => e.id === request.employeeId)?.name ?? 'Employee'} secondary={`${request.type} leave · ${request.days.length} day${request.days.length === 1 ? '' : 's'}`} />
        <div><small>{formatDate(request.startDate, {year:undefined})}</small><Badge>{request.status}</Badge></div>
      </Link>)}</div>
    </Card> : <CompactState title="Leave Requests" description="No pending requests." to={`${base}/leave`} action="View leave" />,
  }, {
    id:'holidays', quiet:!holidays.length,
    content:holidays.length ? <Card title="Upcoming Holidays" action={viewAll('holidays', 'Open calendar')}>
      <div className="list-stack">{holidays.slice(0,3).map(holiday => <div className="holiday-summary" key={holiday.id}>
        <div className="date-tile"><span>{formatDate(holiday.date, {month:'short',day:undefined,year:undefined})}</span><strong>{Number(holiday.date.slice(-2))}</strong></div>
        <div><strong>{holiday.name}</strong><small>{formatDate(holiday.date, {weekday:'long'})}</small></div>
      </div>)}</div>
    </Card> : <CompactState title="Upcoming Holidays" description="No upcoming holidays." to={`${base}/holidays`} action="Open calendar" />,
  }, {
    id:'complaints', quiet:true,
    content:<CompactState title="Private Complaints" description={`${complaints.length} unresolved · Private to you and the CEO`} to={`${base}/complaints`} action="View complaints" />,
  });
  return <div className="studio-dashboard"><StudioIntro title={ceo ? 'Company Overview' : 'My Overview'}
    actions={ceo ? <Link className="button primary" to={`${base}/employees`}>View team<ArrowRight size={16} aria-hidden="true" /></Link> : undefined}
    meta={<div className="workday-strip"><span><CalendarDays size={16} aria-hidden="true" /><time dateTime={today}>{formatDate(today, {weekday:'long'})}</time></span><span>{data.settings.timezone}</span><span>Fictional preview</span></div>} />
    {!ceo && <AttendanceClockControl history />}
    {ceo && <div className="stats-grid live-dashboard-stats">
      <Stat title="Active Employees" value={active.length} caption="Active team members" icon={<Users size={20} />} to={`${base}/employees`} />
      <Stat title="Present Today" value={todayRecords.length} caption="Recorded check-ins today" icon={<Clock3 size={20} />} to={`${base}/attendance`} />
      <Stat title="Open Tasks" value={unfinished.length} caption="Unfinished team tasks" icon={<ListTodo size={20} />} to={`${base}/tasks`} />
    </div>}
    <DashboardSections sections={sections} />
  </div>;
}
