import { Router } from 'express';
import { z, object, uuid, date, instant, version, reason, parse, id, send, pageQuery, list } from '../../core/validation.js';
import { role } from '../identity/session.js';
import { company } from '../company/service.js';
import { holidayDates } from '../holidays/service.js';
import { approvedLeave } from '../leave/service.js';
import { self, eligibleEmployee } from '../employees/service.js';
import { transaction, audit } from '../../core/transactions.js';
import { today } from '../../core/dates.js';
import { checkVersion, fail } from '../../core/errors.js';
import { attendanceRecord, attendanceQuery } from './service.js';

export function attendanceRoutes({ pool }) {
  const router = Router();
  async function history(req, res) {
    const q = pageQuery(req, { from: date.optional(), to: date.optional(), employeeId: uuid.optional(), state: z.enum(['OPEN','CLOSED']).optional() });
    res.json(await list(pool, attendanceQuery + ` WHERE ($1='CEO' OR e.user_id=$2) AND ($3::date IS NULL OR a.work_date>=$3)
      AND ($4::date IS NULL OR a.work_date<=$4) AND ($5::uuid IS NULL OR a.employee_id=$5)
      AND ($6::text IS NULL OR a.state=$6) ORDER BY a.work_date DESC,a.id`,
    [req.actor.role, req.actor.id, q.from || null, q.to || null, q.employeeId || null, q.state || null], q));
  }
  router.get('/me', role('EMPLOYEE'), history);
  router.get('/me/current', role('EMPLOYEE'), async (req, res) => {
    const settings = await company(pool);
    const employee = await self(pool, req.actor);
    const day = today(settings.timezone);
    const records = await pool.query(attendanceQuery + " WHERE a.employee_id=$1 AND (a.state='OPEN' OR a.work_date=$2) ORDER BY a.work_date DESC LIMIT 2", [employee.id, day]);
    const open = records.rows.find(r => r.state === 'OPEN') || null;
    const current = records.rows.find(r => r.work_date === day) || null;
    let nextAction = 'CHECK_IN';
    if (employee.start_date > day) nextAction = 'NOT_STARTED';
    else if (open) nextAction = Date.now() - new Date(open.check_in_at).getTime() > 86400000 ? 'CEO_CORRECTION_REQUIRED' : 'CHECK_OUT';
    else if (current) nextAction = 'COMPLETE';
    send(res, { openRecord: open, todayRecord: current, nextAction });
  });
  router.post('/check-in', role('EMPLOYEE'), async (req, res) => {
    parse(object({}), req.body);
    const row = await transaction(pool, async db => {
      const settings = await company(db);
      const employee = await self(db, req.actor);
      await eligibleEmployee(db, employee.id, settings);
      const now = new Date();
      const day = today(settings.timezone, now);
      const existing = await db.query("SELECT state FROM attendance WHERE employee_id=$1 AND (state='OPEN' OR work_date=$2)", [employee.id, day]);
      if (existing.rows.some(r => r.state === 'OPEN')) fail(409, 'ATTENDANCE_ALREADY_OPEN', 'Check out or ask the CEO to correct the existing open record');
      if (existing.rowCount) fail(409, 'ATTENDANCE_ALREADY_EXISTS', 'Attendance for this date is already complete');
      const holidays = await holidayDates(db, day, day);
      const nonWorking = !settings.working_weekdays.includes(new Date(day + 'T12:00:00Z').getUTCDay()) || holidays.length > 0;
      const leaveFlag = await approvedLeave(db, employee.id, day);
      const result = await db.query(`INSERT INTO attendance(employee_id,work_date,check_in_at,state,timezone_snapshot,
        calendar_revision,non_working_day_flag,approved_leave_flag) VALUES($1,$2,$3,'OPEN',$4,$5,$6,$7) RETURNING id`,
      [employee.id, day, now, settings.timezone, settings.calendar_revision, nonWorking, leaveFlag]);
      await audit(db, req.actor, 'attendance', 'CHECKED_IN', result.rows[0].id);
      return attendanceRecord(db, result.rows[0].id, req.actor);
    }, req.actor);
    send(res, row, 201);
  });
  router.post('/check-out', role('EMPLOYEE'), async (req, res) => {
    const data = parse(object({ attendanceId: uuid, version }), req.body);
    const row = await transaction(pool, async db => {
      const current = await attendanceRecord(db, data.attendanceId, req.actor);
      checkVersion(current, data.version);
      if (current.state !== 'OPEN') fail(409, 'ATTENDANCE_CLOSED', 'Attendance is already closed');
      const now = new Date();
      const duration = now.getTime() - new Date(current.check_in_at).getTime();
      if (duration <= 0) fail(409, 'INVALID_PUNCH_TIME', 'Checkout must be after check-in');
      if (duration > 86400000) fail(409, 'ATTENDANCE_STALE', 'More than 24 hours elapsed. Ask the CEO to correct this record.');
      await db.query("UPDATE attendance SET state='CLOSED',check_out_at=$2,version=version+1,updated_at=now() WHERE id=$1", [current.id, now]);
      await audit(db, req.actor, 'attendance', 'CHECKED_OUT', current.id);
      return attendanceRecord(db, current.id, req.actor);
    }, req.actor);
    send(res, row);
  });
  router.get('/', role('CEO'), history);
  router.get('/:id', async (req, res) => {
    const q = pageQuery(req);
    const row = await attendanceRecord(pool, id(req), req.actor);
    row.corrections = await list(pool, `SELECT id,actor_user_id,before_values,after_values,reason,created_at
      FROM attendance_corrections WHERE attendance_id=$1 ORDER BY created_at DESC,id`, [row.id], q);
    send(res, row);
  });
  router.post('/:id/corrections', role('CEO'), async (req, res) => {
    const attendanceId = id(req);
    const data = parse(object({ version, checkInAt: instant, checkOutAt: instant.nullable(), reason }), req.body);
    const row = await transaction(pool, async db => {
      const current = await attendanceRecord(db, attendanceId, req.actor);
      checkVersion(current, data.version);
      const checkIn = new Date(data.checkInAt);
      const checkOut = data.checkOutAt ? new Date(data.checkOutAt) : null;
      if (today(current.timezone_snapshot, checkIn) !== current.work_date || checkIn.getTime() > Date.now()) {
        fail(422, 'INVALID_CORRECTION', 'Check-in must remain on the original company-local work date and cannot be in the future');
      }
      if (checkOut && (checkOut.getTime() > Date.now() || checkOut <= checkIn || checkOut - checkIn > 86400000)) {
        fail(422, 'INVALID_CORRECTION', 'Checkout must be after check-in, within 24 hours and not in the future');
      }
      const state = checkOut ? 'CLOSED' : 'OPEN';
      if (state === 'OPEN' && current.state === 'CLOSED') {
        await eligibleEmployee(db, current.employee_id, await company(db), false);
      }
      const before = { checkInAt: current.check_in_at, checkOutAt: current.check_out_at, state: current.state, version: current.version };
      const after = { checkInAt: checkIn, checkOutAt: checkOut, state, version: current.version + 1 };
      await db.query('UPDATE attendance SET check_in_at=$2,check_out_at=$3,state=$4,version=version+1,updated_at=now() WHERE id=$1',
        [attendanceId, checkIn, checkOut, state]);
      await db.query(`INSERT INTO attendance_corrections(attendance_id,actor_user_id,before_values,after_values,reason)
        VALUES($1,$2,$3,$4,$5)`, [attendanceId, req.actor.id, before, after, data.reason]);
      await audit(db, req.actor, 'attendance', 'ATTENDANCE_CORRECTED', attendanceId, data.reason);
      return attendanceRecord(db, attendanceId, req.actor);
    }, req.actor);
    send(res, row);
  });
  return router;
}
