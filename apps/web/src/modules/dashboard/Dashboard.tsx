import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, CalendarDays, CheckCircle2, Clock3, ListTodo, MessageSquareText, Users } from 'lucide-react';
import { Badge, Card, Empty, Person, Stat, Table } from '../../components/ui';
import StudioIntro from '../../components/StudioIntro';
import { useWorkspace } from '../../core/store';
import { dateKey, formatDate, formatTime } from '../../core/dates';
import AttendanceClockControl from '../attendance/AttendanceClockControl';

export default function Dashboard() {
  const { data, ceo, base, person, session } = useWorkspace();
  const today = dateKey(new Date(), data.settings.timezone);
  const active = data.employees.filter(e => e.status === 'Active' && e.startDate <= today);
  const todayRecords = data.attendance.filter(a => a.date === today);
  const pending = data.leaves.filter(l => l.status === 'Pending');
  const unfinished = data.tasks.filter(t => !['Done', 'Cancelled'].includes(t.status));
  const overdue = unfinished.filter(t => t.dueDate && t.dueDate < today);
  const complaints = data.complaints.filter(c => !['Resolved', 'Closed'].includes(c.status));
  const onLeave = data.leaves.filter(l => l.status === 'Approved' && l.days.includes(today));
  const holidays = [...data.holidays].filter(h => h.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const current = data.attendance.find(a => a.employeeId === session?.employeeId && !a.checkOut);
  const presentToday = todayRecords.some(a => a.employeeId === session?.employeeId);
  const firstName = person?.name.split(' ')[0] ?? 'there';
  const taskTotal = data.tasks.filter(t => t.status !== 'Cancelled').length;
  const taskCompleted = data.tasks.filter(t => t.status === 'Done').length;
  return <div className="studio-dashboard"><StudioIntro title={ceo ? 'Your Team, at a Glance' : `Hello, ${firstName}`} description={ceo ? 'A clear view of your people, their work and what needs your attention.' : 'Your people, plans and next moves. Here is what your workday looks like.'}
    actions={<Link className="button primary" to={`${base}/${ceo ? 'employees' : 'tasks'}`}>{ceo ? 'View team' : 'View my tasks'}<ArrowRight size={16} /></Link>}
    meta={<div className="workday-strip"><span><CalendarDays size={16} aria-hidden="true" /><time dateTime={today}>{formatDate(today, {weekday:'long'})}</time></span><span>{data.settings.timezone}<span className="workday-label">Fictional preview</span></span></div>} />
    {!ceo && <AttendanceClockControl history />}
    <div className="stats-grid">
      <Stat title={ceo ? 'Total Employees' : 'My Active Tasks'} value={ceo ? active.length : unfinished.length} caption={ceo ? 'Active team members' : 'Assigned to you'} icon={ceo ? <Users size={19} /> : <ListTodo size={19} />} to={`${base}/${ceo ? 'employees' : 'tasks'}`} />
      <Stat title={ceo ? 'Present Today' : 'Attendance Today'} value={ceo ? todayRecords.length : presentToday ? 'Present' : current ? 'Needs review' : 'Not yet'} caption={ceo ? `${data.attendance.filter(a => !a.checkOut).length} currently clocked in` : `Company timezone: ${data.settings.timezone}`} icon={<Clock3 size={19} />} to={`${base}/attendance`} />
      <Stat title="Pending Leave" value={pending.length} caption={ceo ? `${onLeave.length} on approved leave today` : 'Waiting for CEO review'} icon={<CalendarCheck2 size={19} />} to={`${base}/leave`} />
      <Stat title={ceo ? 'Overdue Tasks' : 'Open Complaints'} value={ceo ? overdue.length : complaints.length} caption={ceo ? 'A little attention needed' : 'Private to you and the CEO'} icon={ceo ? <ListTodo size={19} /> : <MessageSquareText size={19} />} to={`${base}/${ceo ? 'tasks' : 'complaints'}`} />
    </div>
    <div className="dashboard-section-heading"><span className="eyebrow">Overview</span></div>
    <div className="dashboard-columns">
      <div className="stack">
        {ceo ? <Card title="Today’s Attendance" action={<Link className="text-link" to={`${base}/attendance`}>View all <ArrowRight size={14} /></Link>}>
          {todayRecords.length ? <Table headings={['Employee', 'Clock in', 'Attendance']}>{todayRecords.slice(0, 5).map(record => {
            const employee = data.employees.find(e => e.id === record.employeeId)!;
            return <tr key={record.id}><td><Person name={employee.name} secondary={employee.department} /></td><td>{formatTime(record.checkIn, data.settings.timezone)}</td><td><Badge>Present</Badge></td></tr>;
          })}</Table> : <Empty title="No check-ins today" description="Check-ins will appear as employees start their day." />}
        </Card> : <Card title="Your Next Tasks" action={<Link className="text-link" to={`${base}/tasks`}>View all <ArrowRight size={14} /></Link>}>
          {unfinished.length ? <div className="list-stack">{unfinished.slice(0, 5).map(task => <Link className="task-summary" to={`${base}/tasks/${task.id}`} key={task.id}><span className="task-check"><ListTodo size={17} /></span><div><strong>{task.title}</strong><small>{task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date'}</small></div><Badge>{task.status}</Badge></Link>)}</div> : <Empty title="All caught up" description="No unfinished tasks are assigned to you." />}
        </Card>}
        <Card title={ceo ? 'Team Task Progress' : 'My Task Progress'}><div className="progress-summary"><strong>{taskCompleted}<span> / {taskTotal} completed</span></strong><CheckCircle2 size={22} /></div>
          <div className="progress-track"><div style={{ width: `${taskTotal ? taskCompleted / taskTotal * 100 : 0}%` }} /></div>
          <div className="progress-legend">{['To do', 'In progress', 'Done'].map(status => <span key={status}><Badge>{status}</Badge><strong>{data.tasks.filter(t => t.status === status).length}</strong></span>)}</div>
        </Card>
      </div>
      <div className="stack">
        <Card title={ceo ? 'Requests to Review' : 'My Leave Requests'} action={<Link className="text-link" to={`${base}/leave`}>View all</Link>}>
          {pending.length ? <div className="list-stack">{pending.slice(0, 3).map(request => <Link className="request-summary" to={`${base}/leave/${request.id}`} key={request.id}><Person name={data.employees.find(e => e.id === request.employeeId)?.name ?? 'Employee'} secondary={`${request.type} leave · ${request.days.length} day${request.days.length === 1 ? '' : 's'}`} /><div><small>{formatDate(request.startDate, { year: undefined })}</small><Badge>{request.status}</Badge></div></Link>)}</div> : <Empty title="No pending requests" description="You are all caught up here." />}
        </Card>
        <Card title="Upcoming Holidays" action={<CalendarDays size={18} />}>{holidays.length ? <div className="list-stack">{holidays.slice(0, 3).map(holiday => <div className="holiday-summary" key={holiday.id}><div className="date-tile"><span>{formatDate(holiday.date, { month: 'short', day: undefined, year: undefined })}</span><strong>{Number(holiday.date.slice(-2))}</strong></div><div><strong>{holiday.name}</strong><small>{formatDate(holiday.date, { weekday: 'long' })}</small></div></div>)}</div> : <Empty title="No upcoming holidays" />}<Link className="text-link section-link" to={`${base}/holidays`}>Open calendar <ArrowRight size={15} /></Link></Card>
        <div className="note-card"><MessageSquareText size={21} /><div><strong>{ceo ? `${complaints.length} open complaint${complaints.length === 1 ? '' : 's'}` : 'A private place to speak up'}</strong><p>{ceo ? 'Private threads stay inside the complaints module.' : 'Your complaints are visible only to you and the CEO in the intended application.'}</p><Link className="text-link" to={`${base}/complaints`}>View complaints <ArrowRight size={14} /></Link></div></div>
      </div>
    </div>
  </div>;
}
