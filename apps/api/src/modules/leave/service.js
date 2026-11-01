import { notFound, fail } from '../../core/errors.js';
import { today, workingDates } from '../../core/dates.js';
import { company } from '../company/service.js';
import { eligibleEmployee, self } from '../employees/service.js';
import { holidayDates } from '../holidays/service.js';

export const leaveColumns = `l.id,l.employee_id,l.type,l.start_date,l.end_date,l.working_dates AS working_dates_snapshot,
  l.calendar_revision AS calendar_revision_at_submission,l.day_count,l.reason,l.state,l.decision_by,l.decision_at,l.decision_reason,l.version,l.created_at,l.updated_at`;
export const leaveQuery = `SELECT ${leaveColumns} FROM leave_requests l JOIN employees e ON e.id=l.employee_id`;
export async function leaveRequest(db, id, actor) {
  const result = await db.query(leaveQuery + " WHERE l.id=$1 AND ($2='CEO' OR e.user_id=$3)", [id, actor.role, actor.id]);
  if (!result.rowCount) notFound();
  return result.rows[0];
}
export async function previewLeave(db, actor, data) {
  const settings = await company(db);
  const employee = await self(db, actor);
  await eligibleEmployee(db, employee.id, settings);
  if (!settings.leave_types.includes(data.type)) fail(422, 'INVALID_LEAVE_TYPE', 'Choose a configured leave type');
  if (data.startDate < today(settings.timezone) || data.startDate < employee.start_date) fail(422, 'INVALID_DATE_RANGE', 'Leave must start today or later, and not before employment starts');
  const holidays = await holidayDates(db, data.startDate, data.endDate);
  const dates = workingDates(data.startDate, data.endDate, settings.working_weekdays, holidays);
  if (!dates.length) fail(422, 'NO_WORKING_DAYS', 'The range has no eligible working days');
  return { employeeId: employee.id, workingDatesSnapshot: dates, dayCount: dates.length, calendarRevision: settings.calendar_revision };
}
export async function leaveBlockers(db, employeeId, day) {
  return (await db.query(`SELECT count(*) FILTER(WHERE state='PENDING')::int AS pending_leave,
    count(*) FILTER(WHERE state='APPROVED' AND EXISTS(SELECT 1 FROM unnest(working_dates) d WHERE d >= $2::date))::int AS approved_future_leave
    FROM leave_requests WHERE employee_id=$1`, [employeeId, day])).rows[0];
}
export async function leaveUsage(db, employeeId = null, startDate = null) {
  return (await db.query(`SELECT EXISTS(SELECT 1 FROM leave_requests WHERE ($1::uuid IS NULL OR employee_id=$1)
    AND ($2::date IS NULL OR start_date<$2)) AS present`, [employeeId, startDate])).rows[0].present;
}
export async function approvedLeave(db, employeeId, day) {
  return (await db.query("SELECT EXISTS(SELECT 1 FROM leave_requests WHERE employee_id=$1 AND state='APPROVED' AND $2::date=ANY(working_dates)) AS present", [employeeId, day])).rows[0].present;
}
export async function holidayImpact(db, dates) {
  const where = `FROM leave_requests WHERE state IN ('PENDING','APPROVED')
    AND EXISTS(SELECT 1 FROM unnest($1::date[]) d WHERE d BETWEEN start_date AND end_date)`;
  const count = (await db.query('SELECT count(*)::int AS count ' + where, [dates])).rows[0].count;
  const rows = await db.query('SELECT id,employee_id,state,start_date,end_date,day_count,version ' + where + ' ORDER BY id LIMIT 100', [dates]);
  return { count, requests: rows.rows, truncated: count > 100 };
}
export async function dashboardLeave(db, actor, day) {
  const counts = (await db.query(`SELECT count(*) FILTER(WHERE l.state='PENDING')::int AS pending,
    count(*) FILTER(WHERE l.state='APPROVED' AND $3::date=ANY(l.working_dates))::int AS approved_today
    FROM leave_requests l JOIN employees e ON e.id=l.employee_id WHERE ($1='CEO' OR e.user_id=$2)
    AND e.employment_status='ACTIVE' AND e.start_date<=$3`, [actor.role, actor.id, day])).rows[0];
  const upcoming = (await db.query(`SELECT l.id,l.start_date,l.end_date,l.day_count,l.state
    FROM leave_requests l JOIN employees e ON e.id=l.employee_id WHERE ($1='CEO' OR e.user_id=$2)
    AND ((l.state='APPROVED' AND l.end_date >= $3) OR l.state='PENDING') ORDER BY l.start_date,l.id LIMIT 5`, [actor.role, actor.id, day])).rows;
  const nextApproved = (await db.query(`SELECT l.id,l.start_date,l.end_date,l.day_count
    FROM leave_requests l JOIN employees e ON e.id=l.employee_id WHERE ($1='CEO' OR e.user_id=$2)
    AND l.state='APPROVED' AND l.end_date >= $3 ORDER BY l.start_date,l.id LIMIT 1`, [actor.role, actor.id, day])).rows[0] || null;
  return { ...counts, upcoming, nextApproved };
}
