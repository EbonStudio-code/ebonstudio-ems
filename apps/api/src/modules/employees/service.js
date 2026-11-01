import { fail, notFound } from '../../core/errors.js';
import { today } from '../../core/dates.js';

export const employeeColumns = `e.id,e.user_id,e.employee_code,e.full_name,u.email_canonical AS email,
  e.job_title,e.department,e.start_date,e.phone,e.employment_status,u.status AS account_status,
  e.deactivated_at,e.deactivation_reason,e.version,e.created_at,e.updated_at,
  (SELECT t.delivery_status FROM account_tokens t WHERE t.user_id=e.user_id AND t.purpose='INVITATION'
    ORDER BY t.created_at DESC,t.id DESC LIMIT 1) AS invitation_delivery`;
export const employeeQuery = `SELECT ${employeeColumns} FROM employees e JOIN users u ON u.id=e.user_id`;
export async function employee(db, id) {
  const result = await db.query(employeeQuery + ' WHERE e.id=$1', [id]);
  if (!result.rowCount) notFound();
  return result.rows[0];
}
export async function self(db, actor) {
  const result = await db.query(employeeQuery + ' WHERE e.user_id=$1', [actor.id]);
  if (!result.rowCount) notFound();
  return result.rows[0];
}
export async function eligibleEmployee(db, id, settings, requireStarted = true) {
  const row = await employee(db, id);
  if (row.employment_status !== 'ACTIVE') fail(409, 'EMPLOYEE_INACTIVE', 'Employee is inactive');
  if (requireStarted && row.start_date > today(settings.timezone)) fail(409, 'EMPLOYEE_NOT_STARTED', 'Employee start date is in the future');
  return row;
}
export async function dashboardEmployees(db, workDate) {
  return (await db.query(`SELECT count(*)::int AS active_count FROM employees
    WHERE employment_status='ACTIVE' AND start_date<=$1`, [workDate])).rows[0];
}
