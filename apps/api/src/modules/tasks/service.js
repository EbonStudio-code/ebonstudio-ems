import { notFound } from '../../core/errors.js';
export const taskColumns = 't.id,t.title,t.description,t.assignee_employee_id,t.created_by,t.priority,t.state,t.due_date,t.completed_at,t.version,t.created_at,t.updated_at';
export const taskQuery = `SELECT ${taskColumns},e.full_name AS assignee_name FROM tasks t JOIN employees e ON e.id=t.assignee_employee_id`;
export async function task(db, id, actor) {
  const result = await db.query(taskQuery + " WHERE t.id=$1 AND ($2='CEO' OR e.user_id=$3)", [id, actor.role, actor.id]);
  if (!result.rowCount) notFound();
  return result.rows[0];
}
export async function taskBlockers(db, employeeId) {
  return (await db.query("SELECT count(*)::int AS unfinished_tasks FROM tasks WHERE assignee_employee_id=$1 AND state IN ('TODO','IN_PROGRESS')", [employeeId])).rows[0];
}
export async function dashboardTasks(db, actor, day) {
  const counts = (await db.query(`SELECT count(*) FILTER(WHERE t.state IN ('TODO','IN_PROGRESS'))::int AS unfinished,
    count(*) FILTER(WHERE t.state IN ('TODO','IN_PROGRESS') AND t.due_date<$3)::int AS overdue
    FROM tasks t JOIN employees e ON e.id=t.assignee_employee_id WHERE ($1='CEO' OR e.user_id=$2)`, [actor.role, actor.id, day])).rows[0];
  const work = (await db.query(`SELECT t.id,t.title,t.state,t.priority,t.due_date FROM tasks t JOIN employees e ON e.id=t.assignee_employee_id
    WHERE ($1='CEO' OR e.user_id=$2) AND t.state IN ('TODO','IN_PROGRESS') ORDER BY t.due_date NULLS LAST,t.id LIMIT 5`, [actor.role, actor.id])).rows;
  return { ...counts, work };
}
