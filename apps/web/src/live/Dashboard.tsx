import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, CalendarDays, Clock3, ListTodo, MessageSquareText, ReceiptText, Users } from 'lucide-react';
import { Badge, Card, CompactState, Person, Stat } from '../components/ui';
import StudioIntro from '../components/StudioIntro';
import { formatDate } from '../core/dates';
import { useResource, useSession } from './state';
import { label, ResourceState } from './components';
import type { Attendance } from './types';
import AttendanceClockControl from './AttendanceClockControl';

interface Summary {
  date: string; timezone: string; workingDay: boolean; employees?: {activeCount: number};
  attendance?: Attendance[] | {checkedIn:number; currentlyOpen:number; staleOpen:number; notCheckedIn:number; notCheckedInEmployees:{id:string;fullName:string}[]};
  leave?: {pending:number; approvedToday:number; upcoming:{id:string;startDate:string;endDate:string;state:string}[];nextApproved:{id:string;startDate:string} | null};
  tasks?: {unfinished:number; overdue:number; work:{id:string;title:string;state:string;dueDate:string | null}[]};
  complaints?: {unresolved:number;open:number;inReview:number;resolved:number;closed:number};
  holidays?: {id:string;name:string;date:string}[];
  salarySlips?: {drafts:number;published:number;latestPublished:{id:string;period:string;revision:number} | null};
}
export default function Dashboard() {
  const { ceo, base, session } = useSession();
  const result = useResource<Summary>('/dashboard');
  const d = result.result?.data;
  const attendance = d?.attendance && !Array.isArray(d.attendance) ? d.attendance : null;
  const personalAttendance = Array.isArray(d?.attendance) ? d.attendance : null;
  const earlierOpen = personalAttendance?.some(a => a.state === 'OPEN' && a.workDate !== d?.date);
  const myAttendance = personalAttendance?.some(a => a.workDate === d?.date) ? 'Present' : earlierOpen ? 'Needs review' : 'Not yet';
  const activeCount = d?.employees?.activeCount;
  const viewAll = (path: string, text = 'View all') => <Link className="text-link" to={`${base}/${path}`}>{text}<ArrowRight size={14} aria-hidden="true" /></Link>;
  return <div className="studio-dashboard"><StudioIntro title={ceo ? 'Company Overview' : 'My Overview'}
    actions={ceo ? <Link className="button primary" to={base+'/employees'}><Users size={16} aria-hidden="true" />View team</Link>
      : session?.enabledModules.includes('tasks') ? <Link className="button primary" to={base+'/tasks'}>My tasks<ArrowRight size={16} aria-hidden="true" /></Link> : undefined}
    meta={d && <div className="workday-strip"><span><CalendarDays size={16} aria-hidden="true" /><time dateTime={d.date}>{formatDate(d.date, {weekday:'long'})}</time></span>
      <span>{d.timezone}</span><span>{d.workingDay ? 'Working day' : 'Non-working day'}</span></div>} />
    <ResourceState loading={result.loading} error={result.error} layout="dashboard" />
    {!ceo && session?.enabledModules.includes('attendance') && <AttendanceClockControl history />}
    {d && <>
      <div className="stats-grid live-dashboard-stats">
        {ceo && d.employees && <Stat title="Active Employees" value={d.employees.activeCount} caption="Excludes CEO and future starters" icon={<Users size={20} />} to={base+'/employees'} />}
        {!ceo && d.tasks && <Stat title="My Active Tasks" value={d.tasks.unfinished} caption={`${d.tasks.overdue} overdue`} icon={<ListTodo size={20} />} to={base+'/tasks'} />}
        {d.attendance && <Stat title={ceo ? 'Present Today' : 'Attendance Today'} value={attendance?.checkedIn ?? myAttendance}
          caption={attendance ? activeCount !== undefined ? `${attendance.checkedIn} of ${activeCount} present` : `${attendance.currentlyOpen} currently clocked in` : earlierOpen ? 'An earlier check-in is still open' : 'Present as soon as you clock in'}
          progress={attendance && activeCount ? {value:attendance.checkedIn,max:activeCount} : undefined} icon={<Clock3 size={20} />} to={base+'/attendance'} />}
        {d.leave && <Stat title="Pending Leave" value={d.leave.pending} caption={`${d.leave.approvedToday} approved for today`} icon={<CalendarCheck2 size={20} />} to={base+'/leave'} />}
        {ceo && d.tasks && <Stat title="Open Tasks" value={d.tasks.unfinished} caption={`${d.tasks.overdue} overdue`} icon={<ListTodo size={20} />} to={base+'/tasks'} />}
        {!ceo && d.complaints && <Stat title="Open Complaints" value={d.complaints.unresolved} caption="Private to you and the CEO" icon={<MessageSquareText size={20} />} to={base+'/complaints'} />}
      </div>
      <div className="dashboard-panels">
          {d.tasks && (d.tasks.work.length ? <Card title={ceo ? 'Work in Focus' : 'Your Next Tasks'} action={viewAll('tasks')}>
            <div className="section-intro"><span>{d.tasks.unfinished} unfinished task{d.tasks.unfinished === 1 ? '' : 's'}</span>
              <span className={d.tasks.overdue ? 'warning-text' : 'muted'}>{d.tasks.overdue} overdue</span></div>
            <div className="list-stack">{d.tasks.work.map(t => <Link className="task-summary" to={`${base}/tasks/${t.id}`} key={t.id}>
              <span className="task-check"><ListTodo size={18} aria-hidden="true" /></span><div><strong>{t.title}</strong><small>{t.dueDate ? `Due ${formatDate(t.dueDate)}` : 'No due date'}</small></div><Badge>{label(t.state)}</Badge>
            </Link>)}</div>
          </Card> : <CompactState title="Tasks" description="No unfinished tasks." to={base+'/tasks'} action="View tasks" />)}
          {ceo && attendance && <Card title="Attendance" action={viewAll('attendance', 'View attendance')}>
              <div className="attendance-totals"><div><strong>{attendance.checkedIn}</strong><span>Present today</span></div><div><strong>{attendance.currentlyOpen}</strong><span>Currently clocked in</span></div><div><strong>{attendance.staleOpen}</strong><span>Needs correction</span></div></div>
              {!d.workingDay ? <p className="dashboard-note">Non-working day. No absence classification.</p> : <>
                <div className="section-intro"><strong>Not checked in</strong><span>{attendance.notCheckedIn} team member{attendance.notCheckedIn === 1 ? '' : 's'}</span></div>
                {attendance.notCheckedInEmployees.slice(0,5).map(person => <div className="attendance-person" key={person.id}><Person name={person.fullName} secondary="No check-in recorded today" /><Link className="text-link" to={`${base}/employees/${person.id}`}>Profile<ArrowRight size={14} aria-hidden="true" /></Link></div>)}
                {!attendance.notCheckedIn && <p className="dashboard-note">No team members are waiting to check in.</p>}
                {attendance.notCheckedIn > 5 && <p className="dashboard-note">View attendance for the full list.</p>}
              </>}
          </Card>}
          {d.leave && (d.leave.pending || d.leave.approvedToday || d.leave.upcoming.length || d.leave.nextApproved ? <Card title={ceo ? 'Time Off & Requests' : 'My Leave Requests'} action={viewAll('leave')}>
            <div className="leave-overview"><strong>{d.leave.pending}</strong><div><span>Pending request{d.leave.pending === 1 ? '' : 's'}</span><small>{d.leave.approvedToday} approved for today</small></div><CalendarCheck2 size={24} aria-hidden="true" /></div>
            {d.leave.upcoming.length ? <div className="list-stack">{d.leave.upcoming.map(l => <Link className="leave-summary" to={`${base}/leave/${l.id}`} key={l.id}>
              <div><strong>{formatDate(l.startDate, {year:undefined})} – {formatDate(l.endDate, {year:undefined})}</strong><small>Leave request</small></div><Badge>{label(l.state)}</Badge></Link>)}</div> : <p className="dashboard-note">No upcoming leave requests.</p>}
            {d.leave.nextApproved && <Link className="text-link section-link" to={`${base}/leave/${d.leave.nextApproved.id}`}>Next approved: {formatDate(d.leave.nextApproved.startDate)}<ArrowRight size={14} aria-hidden="true" /></Link>}
          </Card> : <CompactState title="Leave Requests" description="No pending or upcoming leave." to={base+'/leave'} action="View leave" />)}
          {d.holidays && (d.holidays.length ? <Card title="On the Calendar" action={<CalendarDays size={18} aria-hidden="true" />}>
            <div className="list-stack">{d.holidays.map(h => <div className="holiday-summary" key={h.id}><div className="date-tile"><span>{formatDate(h.date, {month:'short',day:undefined,year:undefined})}</span><strong>{Number(h.date.slice(-2))}</strong></div><div><strong>{h.name}</strong><small>{formatDate(h.date, {weekday:'long'})}</small></div></div>)}</div>
            {viewAll('holidays', 'Holiday calendar')}
          </Card> : <CompactState title="On the Calendar" description="No upcoming holidays." to={base+'/holidays'} action="Open calendar" />)}
          {d.salarySlips && (d.salarySlips.published || d.salarySlips.drafts ? <Card title="Salary Statements" action={viewAll('salary-slips', 'View statements')}>
            <div className="salary-summary"><span className="stat-icon"><ReceiptText size={22} aria-hidden="true" /></span><div><strong>{d.salarySlips.published} published</strong><p className="muted">{ceo ? `${d.salarySlips.drafts} drafts awaiting review` : 'Your published statements'}</p></div></div>
            {d.salarySlips.latestPublished && <Link className="text-link section-link" to={`${base}/salary-slips/${d.salarySlips.latestPublished.id}`}>Latest published: {d.salarySlips.latestPublished.period}<ArrowRight size={14} aria-hidden="true" /></Link>}
          </Card> : <CompactState title="Salary Statements" description="No statements yet." to={base+'/salary-slips'} action="View statements" />)}
          {d.complaints && <CompactState title="Private Complaints" description={`${d.complaints.unresolved} unresolved · ${d.complaints.resolved} resolved · ${d.complaints.closed} closed`} to={base+'/complaints'} action="View complaints" />}
      </div></>}</div>;
}
