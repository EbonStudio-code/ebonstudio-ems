import { fail, notFound } from '../../core/errors.js';
import { employee } from '../employees/service.js';
import { company } from '../company/service.js';
export const salaryColumns = `s.id,s.employee_id,s.period,s.revision,s.state,s.currency_code,s.currency_minor_unit,s.earnings,s.deductions,
  s.gross::float8 AS gross_minor,s.deduction_total::float8 AS total_deductions_minor,s.net::float8 AS net_minor,s.note,
  s.employee_snapshot,s.company_snapshot,s.template_version,s.published_at,s.voided_at,s.void_reason,s.created_by_user_id,
  s.published_by_user_id,s.voided_by_user_id,s.version,s.created_at,s.updated_at`;
export const salaryQuery = `SELECT ${salaryColumns} FROM salary_slips s JOIN employees e ON e.id=s.employee_id`;
export async function salarySlip(db, id, actor) {
  const result = await db.query(salaryQuery + " WHERE s.id=$1 AND ($2='CEO' OR (e.user_id=$3 AND s.state IN ('PUBLISHED','VOIDED')))", [id, actor.role, actor.id]);
  if (!result.rowCount) notFound();
  return result.rows[0];
}
export function totals(earnings, deductions) {
  const sum = lines => {
    let total = 0;
    for (const line of lines) {
      total += line.amountMinor;
      if (!Number.isSafeInteger(total) || total < 0) fail(422, 'INVALID_AMOUNT', 'All totals must be nonnegative safe integers');
    }
    return total;
  };
  const gross = sum(earnings);
  const deductionTotal = sum(deductions);
  if (deductionTotal > gross) fail(422, 'NEGATIVE_NET', 'Deductions cannot exceed earnings');
  return { gross, deductionTotal, net: gross - deductionTotal };
}
export async function snapshots(db, employeeId) {
  const person = await employee(db, employeeId);
  const settings = await company(db);
  return {
    employee: { fullName: person.full_name, employeeCode: person.employee_code, jobTitle: person.job_title, department: person.department },
    company: { displayName: settings.display_name, legalName: settings.legal_name, statementAddress: settings.statement_address,
      jurisdiction: settings.salary_jurisdiction },
  };
}
export async function salaryUsage(db) {
  return (await db.query('SELECT EXISTS(SELECT 1 FROM salary_slips) AS present')).rows[0].present;
}
export async function dashboardSalary(db, actor) {
  const counts = (await db.query(`SELECT count(*) FILTER(WHERE s.state='DRAFT')::int AS drafts,
    count(*) FILTER(WHERE s.state='PUBLISHED')::int AS published
    FROM salary_slips s JOIN employees e ON e.id=s.employee_id
    WHERE ($1='CEO' OR (e.user_id=$2 AND s.state IN ('PUBLISHED','VOIDED')))`, [actor.role, actor.id])).rows[0];
  const latest = (await db.query(`SELECT s.id,s.period,s.revision FROM salary_slips s JOIN employees e ON e.id=s.employee_id
    WHERE ($1='CEO' OR e.user_id=$2) AND s.state='PUBLISHED' ORDER BY s.period DESC,s.published_at DESC,s.id LIMIT 1`, [actor.role, actor.id])).rows[0] || null;
  return { ...counts, latestPublished: latest };
}
