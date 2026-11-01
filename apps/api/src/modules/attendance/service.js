import { notFound } from '../../core/errors.js';
export const attendanceQuery = `SELECT a.id,a.employee_id,a.work_date,a.check_in_at,a.check_out_at,a.state,
  a.timezone_snapshot,a.calendar_revision,a.non_working_day_flag,a.approved_leave_flag,a.version,a.created_at,a.updated_at,
  CASE WHEN a.check_out_at IS NOT NULL THEN floor(extract(epoch FROM a.check_out_at-a.check_in_at))::int ELSE NULL END AS duration_seconds,
  EXISTS(SELECT 1 FROM leave_requests l WHERE l.employee_id=a.employee_id AND l.state='APPROVED' AND a.work_date=ANY(l.working_dates)) AS current_approved_leave_overlap
  FROM attendance a JOIN employees e ON e.id=a.employee_id`;
export async function attendanceRecord(db, id, actor) {
  const result = await db.query(attendanceQuery + " WHERE a.id=$1 AND ($2='CEO' OR e.user_id=$3)", [id, actor.role, actor.id]);
  if (!result.rowCount) notFound();
  return result.rows[0];
}
export async function attendanceBlockers(db, employeeId) {
  return (await db.query("SELECT count(*)::int AS open_attendance FROM attendance WHERE employee_id=$1 AND state='OPEN'", [employeeId])).rows[0];
}
export async function attendanceUsage(db, employeeId = null, startDate = null) {
  return (await db.query(`SELECT EXISTS(SELECT 1 FROM attendance WHERE ($1::uuid IS NULL OR employee_id=$1)
    AND ($2::date IS NULL OR work_date<$2)) AS present`, [employeeId, startDate])).rows[0].present;
}
export async function dashboardAttendance(db, actor, day, isWorking) {
  if (actor.role === 'EMPLOYEE') {
    return (await db.query(attendanceQuery + " WHERE e.user_id=$1 AND (a.work_date=$2 OR a.state='OPEN') ORDER BY a.work_date DESC LIMIT 2", [actor.id, day])).rows;
  }
  const counts = (await db.query(`SELECT
    count(*) FILTER(WHERE EXISTS(SELECT 1 FROM attendance a WHERE a.employee_id=e.id AND a.work_date=$1))::int AS checked_in,
    count(*) FILTER(WHERE $2 AND NOT EXISTS(SELECT 1 FROM attendance a WHERE a.employee_id=e.id AND a.work_date=$1)
      AND NOT EXISTS(SELECT 1 FROM leave_requests l WHERE l.employee_id=e.id AND l.state='APPROVED' AND $1::date=ANY(l.working_dates)))::int AS not_checked_in,
    count(*) FILTER(WHERE EXISTS(SELECT 1 FROM attendance a WHERE a.employee_id=e.id AND a.state='OPEN'))::int AS currently_open,
    count(*) FILTER(WHERE EXISTS(SELECT 1 FROM attendance a WHERE a.employee_id=e.id AND a.state='OPEN' AND a.check_in_at<now()-interval '24 hours'))::int AS stale_open
    FROM employees e WHERE e.employment_status='ACTIVE' AND e.start_date<=$1`, [day, isWorking])).rows[0];
  const notCheckedIn = (await db.query(`SELECT e.id,e.full_name FROM employees e
    WHERE $2 AND e.employment_status='ACTIVE' AND e.start_date<=$1
      AND NOT EXISTS(SELECT 1 FROM attendance a WHERE a.employee_id=e.id AND a.work_date=$1)
      AND NOT EXISTS(SELECT 1 FROM leave_requests l WHERE l.employee_id=e.id AND l.state='APPROVED' AND $1::date=ANY(l.working_dates))
    ORDER BY e.full_name,e.id LIMIT 10`, [day, isWorking])).rows;
  return { ...counts, notCheckedInEmployees: notCheckedIn };
}
