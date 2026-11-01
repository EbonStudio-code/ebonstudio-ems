import { Router } from 'express';
import { z, object, text, optionalText, uuid, date, version, parse, id, send, pageQuery, list } from '../../core/validation.js';
import { role } from '../identity/session.js';
import { company } from '../company/service.js';
import { eligibleEmployee } from '../employees/service.js';
import { transaction, audit } from '../../core/transactions.js';
import { checkVersion, fail } from '../../core/errors.js';
import { task, taskQuery } from './service.js';

const fields = {
  title: text(), description: optionalText(5000).default(''), assigneeEmployeeId: uuid,
  priority: z.enum(['LOW','NORMAL','HIGH']), dueDate: date.nullable().default(null),
};
export function taskRoutes({ pool }) {
  const router = Router();
  router.get('/', async (req, res) => {
    const q = pageQuery(req, { state: z.enum(['TODO','IN_PROGRESS','DONE','CANCELLED']).optional(),
      priority: fields.priority.optional(), assigneeEmployeeId: uuid.optional(), dueBefore: date.optional() });
    res.json(await list(pool, taskQuery + ` WHERE ($1='CEO' OR e.user_id=$2) AND ($3::text IS NULL OR t.state=$3)
      AND ($4::text IS NULL OR t.priority=$4) AND ($5::uuid IS NULL OR t.assignee_employee_id=$5)
      AND ($6::date IS NULL OR t.due_date<$6) ORDER BY t.created_at DESC,t.id`,
    [req.actor.role, req.actor.id, q.state || null, q.priority || null, q.assigneeEmployeeId || null, q.dueBefore || null], q));
  });
  router.post('/', role('CEO'), async (req, res) => {
    const data = parse(object(fields), req.body);
    const row = await transaction(pool, async db => {
      await eligibleEmployee(db, data.assigneeEmployeeId, await company(db), false);
      const result = await db.query(`INSERT INTO tasks(title,description,assignee_employee_id,created_by,priority,due_date)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [data.title, data.description, data.assigneeEmployeeId, req.actor.id, data.priority, data.dueDate]);
      await audit(db, req.actor, 'tasks', 'TASK_CREATED', result.rows[0].id);
      return task(db, result.rows[0].id, req.actor);
    }, req.actor);
    send(res, row, 201);
  });
  router.get('/:id', async (req, res) => send(res, await task(pool, id(req), req.actor)));
  router.patch('/:id', role('CEO'), async (req, res) => {
    const taskId = id(req);
    const data = parse(object({ ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])), version }), req.body);
    const row = await transaction(pool, async db => {
      const current = await task(db, taskId, req.actor);
      checkVersion(current, data.version);
      const assignee = data.assigneeEmployeeId ?? current.assignee_employee_id;
      if (data.assigneeEmployeeId || ['TODO','IN_PROGRESS'].includes(current.state)) {
        await eligibleEmployee(db, assignee, await company(db), false);
      }
      await db.query(`UPDATE tasks SET title=$2,description=$3,assignee_employee_id=$4,priority=$5,due_date=$6,
        version=version+1,updated_at=now() WHERE id=$1`,
      [taskId, data.title ?? current.title, data.description ?? current.description, assignee, data.priority ?? current.priority,
        data.dueDate === undefined ? current.due_date : data.dueDate]);
      await audit(db, req.actor, 'tasks', 'TASK_UPDATED', taskId);
      return task(db, taskId, req.actor);
    }, req.actor);
    send(res, row);
  });
  router.post('/:id/status', async (req, res) => {
    const taskId = id(req);
    const data = parse(object({ version, state: z.enum(['TODO','IN_PROGRESS','DONE','CANCELLED']) }), req.body);
    const row = await transaction(pool, async db => {
      const current = await task(db, taskId, req.actor);
      checkVersion(current, data.version);
      if (req.actor.role !== 'CEO' && (current.state === 'CANCELLED' || data.state === 'CANCELLED')) fail(403, 'FORBIDDEN', 'Only the CEO can cancel or reopen cancelled tasks');
      if (data.state === current.state) fail(409, 'INVALID_STATE', 'Task already has that state');
      if (['TODO','IN_PROGRESS'].includes(data.state)) await eligibleEmployee(db, current.assignee_employee_id, await company(db), false);
      await db.query(`UPDATE tasks SET state=$2,completed_at=CASE WHEN $2='DONE' THEN now() ELSE NULL END,
        version=version+1,updated_at=now() WHERE id=$1`, [taskId, data.state]);
      await audit(db, req.actor, 'tasks', 'TASK_STATE_CHANGED', taskId);
      return task(db, taskId, req.actor);
    }, req.actor);
    send(res, row);
  });
  return router;
}
