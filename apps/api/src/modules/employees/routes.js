import { Router } from 'express';
import { z, object, text, email, date, phone, version, reason, parse, id, send, pageQuery, list } from '../../core/validation.js';
import { role } from '../identity/session.js';
import { transaction, audit } from '../../core/transactions.js';
import { checkVersion, fail } from '../../core/errors.js';
import { company } from '../company/service.js';
import { today } from '../../core/dates.js';
import { reinvite, deliverToken, revokeSessions } from '../identity/service.js';
import { employeeQuery, employee, self } from './service.js';

const fields = {
  fullName: text(), email, employeeCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{0,29}$/),
  jobTitle: text(100), department: text(100), startDate: date, phone: phone.default(''),
};
export function employeeRoutes({ pool, config, mailer, guards }) {
  const router = Router();
  router.get('/me', role('EMPLOYEE'), async (req, res) => send(res, await self(pool, req.actor)));
  router.patch('/me', role('EMPLOYEE'), async (req, res) => {
    const data = parse(object({ version, phone }), req.body);
    const row = await transaction(pool, async db => {
      const current = await self(db, req.actor);
      checkVersion(current, data.version);
      await db.query('UPDATE employees SET phone=$2,version=version+1,updated_at=now() WHERE id=$1', [current.id, data.phone]);
      await audit(db, req.actor, 'employees', 'SELF_PROFILE_UPDATED', current.id);
      return employee(db, current.id);
    }, req.actor);
    send(res, row);
  });
  router.use(role('CEO'));
  router.get('/', async (req, res) => {
    const query = pageQuery(req, { search: text(100).optional(), department: text(100).optional(),
      status: z.enum(['ACTIVE','INACTIVE']).optional() });
    const search = query.search ? '%' + query.search.replace(/[\\%_]/g, '\\$&') + '%' : null;
    res.json(await list(pool, employeeQuery + ` WHERE ($1::text IS NULL OR e.full_name ILIKE $1 OR e.employee_code ILIKE $1)
      AND ($2::text IS NULL OR e.department=$2) AND ($3::text IS NULL OR e.employment_status=$3)
      ORDER BY e.full_name,e.id`, [search, query.department || null, query.status || null], query));
  });
  router.post('/', async (req, res) => {
    const data = parse(object(fields), req.body);
    const result = await transaction(pool, async db => {
      await company(db);
      const user = await db.query("INSERT INTO users(email_canonical,role) VALUES($1,'EMPLOYEE') RETURNING id", [data.email]);
      const created = await db.query(`INSERT INTO employees(user_id,employee_code,full_name,job_title,department,start_date,phone)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [user.rows[0].id, data.employeeCode, data.fullName, data.jobTitle, data.department, data.startDate, data.phone]);
      const row = await employee(db, created.rows[0].id);
      const delivery = await reinvite(db, row.user_id, config);
      await audit(db, req.actor, 'employees', 'EMPLOYEE_CREATED', row.id);
      return { row, delivery };
    }, req.actor);
    result.row.invitationDelivery = await deliverToken(pool, config, mailer, result.delivery);
    send(res, result.row, 201);
  });
  router.get('/:id', async (req, res) => send(res, await employee(pool, id(req))));
  router.patch('/:id', async (req, res) => {
    const employeeId = id(req);
    const data = parse(object({ ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])), version }), req.body);
    const result = await transaction(pool, async db => {
      const row = await employee(db, employeeId);
      checkVersion(row, data.version);
      if (data.startDate && data.startDate !== row.start_date) {
        if (await guards.startDateInvalid(db, row.id, data.startDate)) fail(409, 'START_DATE_HAS_HISTORY', 'Start date would invalidate attendance or leave history');
      }
      let delivery;
      if (data.email && data.email !== row.email) {
        if (row.employment_status !== 'ACTIVE') fail(409, 'EMPLOYEE_INACTIVE', 'Reactivate the employee before changing their email');
        await db.query('UPDATE users SET email_canonical=$2 WHERE id=$1', [row.user_id, data.email]);
        delivery = await reinvite(db, row.user_id, config);
      }
      await db.query(`UPDATE employees SET full_name=$2,employee_code=$3,job_title=$4,department=$5,start_date=$6,phone=$7,
        version=version+1,updated_at=now() WHERE id=$1`,
      [row.id, data.fullName ?? row.full_name, data.employeeCode ?? row.employee_code, data.jobTitle ?? row.job_title,
        data.department ?? row.department, data.startDate ?? row.start_date, data.phone ?? row.phone]);
      await audit(db, req.actor, 'employees', delivery ? 'EMPLOYEE_EMAIL_CHANGED' : 'EMPLOYEE_UPDATED', row.id);
      return { row: await employee(db, row.id), delivery };
    }, req.actor);
    if (result.delivery) result.row.invitationDelivery = await deliverToken(pool, config, mailer, result.delivery);
    send(res, result.row);
  });
  router.post('/:id/invitation', async (req, res) => {
    const employeeId = id(req);
    parse(object({}), req.body);
    const delivery = await transaction(pool, async db => {
      const row = await employee(db, employeeId);
      if (row.account_status !== 'INVITED' || row.employment_status !== 'ACTIVE') fail(409, 'ACCOUNT_NOT_INVITED', 'Only active invited employees can receive a setup invitation');
      await audit(db, req.actor, 'employees', 'INVITATION_REISSUED', row.id);
      return reinvite(db, row.user_id, config);
    }, req.actor);
    send(res, { invitationDelivery: await deliverToken(pool, config, mailer, delivery) });
  });
  router.get('/:id/deactivation-check', async (req, res) => {
    const row = await employee(pool, id(req));
    const settings = await company(pool);
    send(res, await guards.blockers(pool, row.id, today(settings.timezone)));
  });
  router.post('/:id/deactivate', async (req, res) => {
    const employeeId = id(req);
    const data = parse(object({ version, reason }), req.body);
    const row = await transaction(pool, async db => {
      const current = await employee(db, employeeId);
      checkVersion(current, data.version);
      if (current.employment_status !== 'ACTIVE') fail(409, 'INVALID_STATE', 'Employee is already inactive');
      const settings = await company(db);
      const blockers = await guards.blockers(db, current.id, today(settings.timezone));
      if (Object.values(blockers).some(v => v > 0)) fail(409, 'EMPLOYEE_HAS_BLOCKERS', 'Resolve open attendance, leave and unfinished tasks before deactivation');
      await revokeSessions(db, current.user_id);
      await db.query("UPDATE users SET status='SUSPENDED' WHERE id=$1", [current.user_id]);
      await db.query('UPDATE account_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL', [current.user_id]);
      await db.query(`UPDATE employees SET employment_status='INACTIVE',deactivated_at=now(),deactivation_reason=$2,
        version=version+1,updated_at=now() WHERE id=$1`, [current.id, data.reason]);
      await audit(db, req.actor, 'employees', 'EMPLOYEE_DEACTIVATED', current.id, data.reason);
      return employee(db, current.id);
    }, req.actor);
    send(res, row);
  });
  router.post('/:id/reactivate', async (req, res) => {
    const employeeId = id(req);
    const data = parse(object({ version }), req.body);
    const result = await transaction(pool, async db => {
      const row = await employee(db, employeeId);
      checkVersion(row, data.version);
      if (row.employment_status !== 'INACTIVE') fail(409, 'INVALID_STATE', 'Employee is already active');
      await db.query(`UPDATE employees SET employment_status='ACTIVE',deactivated_at=NULL,deactivation_reason=NULL,
        version=version+1,updated_at=now() WHERE id=$1`, [row.id]);
      const delivery = await reinvite(db, row.user_id, config);
      await audit(db, req.actor, 'employees', 'EMPLOYEE_REACTIVATED', row.id);
      return { row: await employee(db, row.id), delivery };
    }, req.actor);
    result.row.invitationDelivery = await deliverToken(pool, config, mailer, result.delivery);
    send(res, result.row);
  });
  return router;
}
