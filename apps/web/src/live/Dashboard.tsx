import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock3, ListTodo, ReceiptText, Users } from 'lucide-react';
import { Badge, Card, CompactState, Person, Stat } from '../components/ui';
import DashboardSections from '../components/DashboardSections';
import type { DashboardSection } from '../components/DashboardSections';
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
  const d = !result.loading && !result.error ? result.result?.data : undefined;
  const attendance = d?.attendance && !Array.isArray(d.attendance) ? d.attendance : null;
  const activeCount = d?.employees?.activeCount;
  const viewAll = (path: string, text = 'View all') => <Link className="text-link" to={`${base}/${path}`}>{text}<ArrowRight size={14} aria-hidden="true" /></Link>;
  const sections: DashboardSection[] = [];
  if (d?.tasks) {
    const tasks = d.tasks;
    sections.push({id:'tasks', priority:tasks.overdue ? 2 : 0, quiet:!tasks.unfinished && !tasks.work.length,
      content: tasks.unfinished || tasks.work.length ? <Card title={ceo ? 'Work in Focus' : 'Your Next Tasks'} className={tasks.overdue ? 'dashboard-attention' : ''} action={viewAll('tasks')}>
        {(!ceo || tasks.overdue > 0) && <div className="section-intro">
          {!ceo && <span>{tasks.unfinished} unfinished task{tasks.unfinished === 1 ? '' : 's'}</span>}
          {tasks.overdue > 0 && <span className="danger-text">{tasks.overdue} overdue</span>}
        </div>}
        <div className="list-stack">{tasks.work.map(t => <Link className="task-summary" to={`${base}/tasks/${t.id}`} key={t.id}>
          <span className="task-check"><ListTodo size={18} aria-hidden="true" /></span><div><strong>{t.title}</strong>
            <small className={t.dueDate && t.dueDate < d.date ? 'danger-text' : undefined}>{t.dueDate ? `${t.dueDate < d.date ? 'Overdue' : 'Due'} ${formatDate(t.dueDate)}` : 'No due date'}</small>
          </div><Badge>{label(t.state)}</Badge></Link>)}</div>
        {!tasks.work.length && <p className="dashboard-note">Open tasks to review the remaining work.</p>}
      </Card> : <CompactState title="Tasks" description="No unfinished tasks." to={base+'/tasks'} action="View tasks" />});
  }
  if (ceo && attendance && d) sections.push({id:'attendance', priority:attendance.staleOpen ? 1 : 0,
    content:<Card title={attendance.staleOpen ? 'Attendance Corrections' : 'Attendance'} className={attendance.staleOpen ? 'dashboard-attention' : ''} action={viewAll('attendance', attendance.staleOpen ? 'Review attendance' : 'View attendance')}>
      {attendance.staleOpen > 0 && <p className="warning-text">{attendance.staleOpen} earlier record{attendance.staleOpen === 1 ? '' : 's'} need{attendance.staleOpen === 1 ? 's' : ''} correction.</p>}
      <p className="dashboard-note">{attendance.currentlyOpen} currently clocked in.</p>
      {!d.workingDay ? <p className="dashboard-note">Non-working day. No absence classification.</p> : <>
        <div className="section-intro"><strong>Not checked in</strong><span>{attendance.notCheckedIn} team member{attendance.notCheckedIn === 1 ? '' : 's'}</span></div>
        {attendance.notCheckedInEmployees.slice(0,5).map(person => <div className="attendance-person" key={person.id}><Person name={person.fullName} secondary="No check-in recorded today" /><Link className="text-link" to={`${base}/employees/${person.id}`}>Profile<ArrowRight size={14} aria-hidden="true" /></Link></div>)}
        {!attendance.notCheckedIn && <p className="dashboard-note">No team members are waiting to check in.</p>}
        {attendance.notCheckedIn > 5 && <p className="dashboard-note">View attendance for the full list.</p>}
      </>}
    </Card>});
  if (d?.leave) {
    const leave = d.leave;
    const populated = Boolean(leave.pending || leave.approvedToday || leave.upcoming.length || leave.nextApproved);
    sections.push({id:'leave', priority:ceo && leave.pending ? 3 : 0, quiet:!populated,
      content:populated ? <Card title={ceo ? leave.pending ? 'Leave Approvals' : 'Time Off & Requests' : 'My Leave Requests'}
        className={ceo && leave.pending ? 'dashboard-attention' : ''} action={viewAll('leave', ceo && leave.pending ? 'Review requests' : 'View leave')}>
        {leave.pending > 0 && <div className="leave-overview"><strong>{leave.pending}</strong><div><span>{ceo ? 'Awaiting your approval' : 'Waiting for CEO review'}</span></div></div>}
        {leave.approvedToday > 0 && <p className="dashboard-note">{leave.approvedToday} approved for today.</p>}
        {leave.upcoming.length > 0 && <div className="list-stack">{leave.upcoming.map(l => <Link className="leave-summary" to={`${base}/leave/${l.id}`} key={l.id}>
          <div><strong>{formatDate(l.startDate, {year:undefined})} – {formatDate(l.endDate, {year:undefined})}</strong><small>Leave request</small></div><Badge>{label(l.state)}</Badge></Link>)}</div>}
        {leave.nextApproved && <Link className="text-link section-link" to={`${base}/leave/${leave.nextApproved.id}`}>Next approved: {formatDate(leave.nextApproved.startDate)}<ArrowRight size={14} aria-hidden="true" /></Link>}
      </Card> : <CompactState title="Leave Requests" description="No pending or upcoming leave." to={base+'/leave'} action="View leave" />});
  }
  if (d?.holidays) sections.push({id:'holidays', quiet:!d.holidays.length,
    content:d.holidays.length ? <Card title="On the Calendar" action={viewAll('holidays', 'Open calendar')}>
      <div className="list-stack">{d.holidays.map(h => <div className="holiday-summary" key={h.id}><div className="date-tile"><span>{formatDate(h.date, {month:'short',day:undefined,year:undefined})}</span><strong>{Number(h.date.slice(-2))}</strong></div><div><strong>{h.name}</strong><small>{formatDate(h.date, {weekday:'long'})}</small></div></div>)}</div>
    </Card> : <CompactState title="On the Calendar" description="No upcoming holidays." to={base+'/holidays'} action="Open calendar" />});
  if (d?.salarySlips) {
    const slips = d.salarySlips;
    sections.push({id:'salary', quiet:!slips.published && !slips.drafts,
      content:slips.published || slips.drafts ? <Card title="Salary Slips" action={viewAll('salary-slips', 'View Salary Slips')}>
        <div className="salary-summary"><span className="stat-icon"><ReceiptText size={22} aria-hidden="true" /></span><div><strong>{slips.published} published</strong>
          {ceo && slips.drafts > 0 && <p className="muted">{slips.drafts} drafts awaiting review</p>}</div></div>
        {slips.latestPublished && <Link className="text-link section-link" to={`${base}/salary-slips/${slips.latestPublished.id}`}>Latest Salary Slip: {slips.latestPublished.period}<ArrowRight size={14} aria-hidden="true" /></Link>}
      </Card> : <CompactState title="Salary Slips" description="No salary slips yet." to={base+'/salary-slips'} action="View Salary Slips" />});
  }
  if (d?.complaints) sections.push({id:'complaints', quiet:true,
    content:<CompactState title="Private Complaints" description={`${d.complaints.unresolved} unresolved · ${d.complaints.resolved} resolved · ${d.complaints.closed} closed`} to={base+'/complaints'} action="View complaints" />});
  return <div className="studio-dashboard"><StudioIntro title={ceo ? 'Company Overview' : 'My Overview'}
    actions={ceo ? <Link className="button primary" to={base+'/employees'}><Users size={16} aria-hidden="true" />View team</Link> : undefined}
    meta={d && <div className="workday-strip"><span><CalendarDays size={16} aria-hidden="true" /><time dateTime={d.date}>{formatDate(d.date, {weekday:'long'})}</time></span>
      <span>{d.timezone}</span><span>{d.workingDay ? 'Working day' : 'Non-working day'}</span></div>} />
    <ResourceState loading={result.loading} error={result.error} layout="dashboard" />
    {!ceo && session?.enabledModules.includes('attendance') && <AttendanceClockControl history />}
    {d && <>
      {ceo && <div className="stats-grid live-dashboard-stats">
        {d.employees && <Stat title="Active Employees" value={d.employees.activeCount} caption="Excludes CEO and future starters" icon={<Users size={20} />} to={base+'/employees'} />}
        {attendance && <Stat title="Present Today" value={attendance.checkedIn}
          caption={activeCount !== undefined ? `${attendance.checkedIn} of ${activeCount} present` : 'Recorded check-ins today'}
          progress={activeCount ? {value:attendance.checkedIn,max:activeCount} : undefined} icon={<Clock3 size={20} />} to={base+'/attendance'} />}
        {d.tasks && <Stat title="Open Tasks" value={d.tasks.unfinished} caption="Unfinished team tasks" icon={<ListTodo size={20} />} to={base+'/tasks'} />}
      </div>}
      <DashboardSections sections={sections} />
    </>}
  </div>;
}
