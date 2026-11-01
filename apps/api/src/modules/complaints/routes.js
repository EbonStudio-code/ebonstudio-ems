import { Router } from 'express';
import { z, object, text, version, parse, id, send, pageQuery, list } from '../../core/validation.js';
import { role } from '../identity/session.js';
import { self } from '../employees/service.js';
import { transaction, audit } from '../../core/transactions.js';
import { checkVersion, fail } from '../../core/errors.js';
import { complaint, complaintColumns } from './service.js';

const category = z.enum(['WORKPLACE','PAY','TECHNICAL','OTHER']);
const state = z.enum(['OPEN','IN_REVIEW','RESOLVED','CLOSED']);
export function complaintRoutes({ pool }) {
  const router = Router();
  router.get('/', async (req, res) => {
    const q = pageQuery(req, { state: state.optional(), category: category.optional() });
    res.json(await list(pool, `SELECT ${complaintColumns} FROM complaints c JOIN employees e ON e.id=c.employee_id
      WHERE ($1='CEO' OR e.user_id=$2) AND ($3::text IS NULL OR c.state=$3) AND ($4::text IS NULL OR c.category=$4)
      ORDER BY c.created_at DESC,c.id`, [req.actor.role, req.actor.id, q.state || null, q.category || null], q));
  });
  router.post('/', role('EMPLOYEE'), async (req, res) => {
    const data = parse(object({ subject: text(), category, description: text(5000) }), req.body);
    const row = await transaction(pool, async db => {
      const employee = await self(db, req.actor);
      const result = await db.query(`INSERT INTO complaints(employee_id,subject,category,description) VALUES($1,$2,$3,$4) RETURNING id`,
      [employee.id, data.subject, data.category, data.description]);
      await audit(db, req.actor, 'complaints', 'COMPLAINT_CREATED', result.rows[0].id);
      return complaint(db, result.rows[0].id, req.actor);
    }, req.actor);
    send(res, row, 201);
  });
  router.get('/:id', async (req, res) => send(res, await complaint(pool, id(req), req.actor)));
  router.get('/:id/messages', async (req, res) => {
    const parent = await complaint(pool, id(req), req.actor);
    const q = pageQuery(req);
    res.json(await list(pool, `SELECT id,complaint_id,author_user_id,text,message_type,created_at
      FROM complaint_messages WHERE complaint_id=$1 ORDER BY created_at,id`, [parent.id], q));
  });
  router.post('/:id/messages', async (req, res) => {
    const complaintId = id(req);
    const data = parse(object({ version, text: text(5000) }), req.body);
    const row = await transaction(pool, async db => {
      const current = await complaint(db, complaintId, req.actor);
      checkVersion(current, data.version);
      if (current.state === 'CLOSED') fail(409, 'COMPLAINT_CLOSED', 'Closed complaints are read-only');
      const message = await db.query(`INSERT INTO complaint_messages(complaint_id,author_user_id,text,message_type)
        VALUES($1,$2,$3,'REPLY') RETURNING id,complaint_id,author_user_id,text,message_type,created_at`, [complaintId, req.actor.id, data.text]);
      await db.query('UPDATE complaints SET version=version+1,updated_at=now() WHERE id=$1', [complaintId]);
      await audit(db, req.actor, 'complaints', 'COMPLAINT_REPLY_ADDED', complaintId);
      return { ...message.rows[0], parent_version: current.version + 1 };
    }, req.actor);
    send(res, row, 201);
  });
  router.post('/:id/status', async (req, res) => {
    const complaintId = id(req);
    const data = parse(object({ version, state, resolutionText: text(5000).optional() }), req.body);
    const row = await transaction(pool, async db => {
      const current = await complaint(db, complaintId, req.actor);
      checkVersion(current, data.version);
      const ceo = req.actor.role === 'CEO';
      const allowed = (current.state === 'OPEN' && data.state === 'IN_REVIEW' && ceo) ||
        (current.state === 'IN_REVIEW' && data.state === 'RESOLVED' && ceo) ||
        (current.state === 'RESOLVED' && ['IN_REVIEW','CLOSED'].includes(data.state));
      if (!allowed) fail(409, 'INVALID_STATE', 'Complaint transition is not allowed');
      if (data.state === 'RESOLVED') {
        if (!data.resolutionText) fail(422, 'RESOLUTION_REQUIRED', 'A resolution message is required');
        await db.query(`INSERT INTO complaint_messages(complaint_id,author_user_id,text,message_type)
          VALUES($1,$2,$3,'RESOLUTION')`, [complaintId, req.actor.id, data.resolutionText]);
      } else if (data.resolutionText) fail(422, 'VALIDATION_FAILED', 'Resolution text is only allowed when resolving');
      await db.query(`UPDATE complaints SET state=$2,resolved_at=CASE WHEN $2='RESOLVED' THEN now() WHEN $2='IN_REVIEW' THEN NULL ELSE resolved_at END,
        closed_at=CASE WHEN $2='CLOSED' THEN now() ELSE NULL END,version=version+1,updated_at=now() WHERE id=$1`, [complaintId, data.state]);
      await audit(db, req.actor, 'complaints', 'COMPLAINT_STATE_CHANGED', complaintId);
      return complaint(db, complaintId, req.actor);
    }, req.actor);
    send(res, row);
  });
  return router;
}
