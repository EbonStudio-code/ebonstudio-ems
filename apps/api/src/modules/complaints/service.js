import { notFound } from '../../core/errors.js';
export const complaintColumns = 'c.id,c.employee_id,c.subject,c.category,c.state,c.resolved_at,c.closed_at,c.version,c.created_at,c.updated_at';
export async function complaint(db, id, actor) {
  const result = await db.query(`SELECT ${complaintColumns},c.description FROM complaints c JOIN employees e ON e.id=c.employee_id
    WHERE c.id=$1 AND ($2='CEO' OR e.user_id=$3)`, [id, actor.role, actor.id]);
  if (!result.rowCount) notFound();
  return result.rows[0];
}
export async function dashboardComplaints(db, actor) {
  return (await db.query(`SELECT count(*) FILTER(WHERE c.state IN ('OPEN','IN_REVIEW'))::int AS unresolved,
    count(*) FILTER(WHERE c.state='OPEN')::int AS open,count(*) FILTER(WHERE c.state='IN_REVIEW')::int AS in_review,
    count(*) FILTER(WHERE c.state='RESOLVED')::int AS resolved,count(*) FILTER(WHERE c.state='CLOSED')::int AS closed
    FROM complaints c JOIN employees e ON e.id=c.employee_id WHERE ($1='CEO' OR e.user_id=$2)`, [actor.role, actor.id])).rows[0];
}
