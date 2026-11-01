import { Router } from 'express';
import { z, object, text, date, uuid, reason, version, parse, id, send, pageQuery, list } from '../../core/validation.js';
import { role } from '../identity/session.js';
import { company, advanceCalendar } from '../company/service.js';
import { eligibleEmployee } from '../employees/service.js';
import { transaction, audit } from '../../core/transactions.js';
import { checkVersion, fail } from '../../core/errors.js';
import { leaveRequest, leaveQuery, previewLeave } from './service.js';

const fields = { type: text(60), startDate: date, endDate: date };
export function leaveRoutes({ pool }) {
  const router = Router();
  router.post('/preview', role('EMPLOYEE'), async (req, res) => {
    const data = parse(object(fields), req.body);
    send(res, await transaction(pool, db => previewLeave(db, req.actor, data), req.actor));
  });
  router.post('/requests', role('EMPLOYEE'), async (req, res) => {
    const data = parse(object({ ...fields, reason }), req.body);
    const row = await transaction(pool, async db => {
      const preview = await previewLeave(db, req.actor, data);
      const conflicts = await db.query('SELECT 1 FROM leave_reservations WHERE employee_id=$1 AND work_date=ANY($2::date[]) LIMIT 1', [preview.employeeId, preview.workingDatesSnapshot]);
      if (conflicts.rowCount) fail(409, 'LEAVE_OVERLAP', 'A pending or approved request already reserves these dates');
      const result = await db.query(`INSERT INTO leave_requests(employee_id,type,start_date,end_date,working_dates,day_count,reason,calendar_revision)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [preview.employeeId, data.type, data.startDate, data.endDate, preview.workingDatesSnapshot, preview.dayCount, data.reason, preview.calendarRevision]);
      const leaveId = result.rows[0].id;
      await db.query('INSERT INTO leave_reservations(employee_id,work_date,request_id) SELECT $1,unnest($2::date[]),$3', [preview.employeeId, preview.workingDatesSnapshot, leaveId]);
      await db.query("INSERT INTO leave_history(request_id,actor_user_id,to_state) VALUES($1,$2,'PENDING')", [leaveId, req.actor.id]);
      await advanceCalendar(db);
      await audit(db, req.actor, 'leave', 'LEAVE_SUBMITTED', leaveId);
      return leaveRequest(db, leaveId, req.actor);
    }, req.actor);
    send(res, row, 201);
  });
  router.get('/requests', async (req, res) => {
    const q = pageQuery(req, { state: z.enum(['PENDING','APPROVED','REJECTED','CANCELLED']).optional(),
      employeeId: uuid.optional(), from: date.optional(), to: date.optional() });
    res.json(await list(pool, leaveQuery + ` WHERE ($1='CEO' OR e.user_id=$2) AND ($3::text IS NULL OR l.state=$3)
      AND ($4::uuid IS NULL OR l.employee_id=$4) AND ($5::date IS NULL OR l.end_date>=$5) AND ($6::date IS NULL OR l.start_date<=$6)
      ORDER BY l.created_at DESC,l.id`, [req.actor.role, req.actor.id, q.state || null, q.employeeId || null, q.from || null, q.to || null], q));
  });
  router.get('/requests/:id', async (req, res) => {
    parse(object({}), req.query);
    const row = await leaveRequest(pool, id(req), req.actor);
    row.history = (await pool.query('SELECT id,actor_user_id,from_state,to_state,reason,created_at FROM leave_history WHERE request_id=$1 ORDER BY created_at,id LIMIT 100', [row.id])).rows;
    send(res, row);
  });
  for (const [action, target] of [['approve','APPROVED'], ['reject','REJECTED'], ['cancel','CANCELLED']]) {
    const permission = action === 'cancel' ? (req, res, next) => next() : role('CEO');
    router.post('/requests/:id/' + action, permission, async (req, res) => {
      const leaveId = id(req);
      const data = parse(object(action === 'approve' ? { version } : { version, reason: reason.optional() }), req.body);
      const row = await transaction(pool, async db => {
        const current = await leaveRequest(db, leaveId, req.actor);
        checkVersion(current, data.version);
        const ceo = req.actor.role === 'CEO';
        const allowed = current.state === 'PENDING' || (action === 'cancel' && ceo && current.state === 'APPROVED');
        if (!allowed) fail(409, 'INVALID_STATE', 'Leave request cannot make this transition');
        if ((action === 'reject' || (action === 'cancel' && ceo)) && !data.reason) fail(422, 'REASON_REQUIRED', 'A reason is required');
        if (action === 'approve') await eligibleEmployee(db, current.employee_id, await company(db), false);
        await db.query(`UPDATE leave_requests SET state=$2,decision_by=$3,decision_at=now(),decision_reason=$4,
          version=version+1,updated_at=now() WHERE id=$1`, [leaveId, target, req.actor.id, data.reason || null]);
        if (target !== 'APPROVED') await db.query('DELETE FROM leave_reservations WHERE request_id=$1', [leaveId]);
        await db.query('INSERT INTO leave_history(request_id,actor_user_id,from_state,to_state,reason) VALUES($1,$2,$3,$4,$5)',
          [leaveId, req.actor.id, current.state, target, data.reason || null]);
        await advanceCalendar(db);
        await audit(db, req.actor, 'leave', 'LEAVE_' + target, leaveId, data.reason || null);
        return leaveRequest(db, leaveId, req.actor);
      }, req.actor);
      send(res, row);
    });
  }
  return router;
}
