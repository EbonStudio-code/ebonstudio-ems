import { Router } from 'express';
import { parse, object, send } from '../../core/validation.js';
import { company } from '../company/service.js';
import { today } from '../../core/dates.js';
import { dashboardEmployees } from '../employees/service.js';
import { dashboardAttendance } from '../attendance/service.js';
import { dashboardLeave } from '../leave/service.js';
import { dashboardTasks } from '../tasks/service.js';
import { dashboardComplaints } from '../complaints/service.js';
import { dashboardHolidays, holidayDates } from '../holidays/service.js';
import { dashboardSalary } from '../salary-slips/service.js';

export function dashboardRoutes({ pool, config }) {
  const router = Router();
  router.get('/', async (req, res) => {
    parse(object({}), req.query);
    const settings = await company(pool);
    const day = today(settings.timezone);
    const holidays = await holidayDates(pool, day, day);
    const workingDay = settings.working_weekdays.includes(new Date(day + 'T12:00:00Z').getUTCDay()) && !holidays.length;
    const result = { date: day, timezone: settings.timezone, workingDay };
    if (req.actor.role === 'CEO') result.employees = await dashboardEmployees(pool, day);
    const enabled = name => config.modules.includes(name);
    if (enabled('attendance')) result.attendance = await dashboardAttendance(pool, req.actor, day, workingDay);
    if (enabled('leave')) result.leave = await dashboardLeave(pool, req.actor, day);
    if (enabled('tasks')) result.tasks = await dashboardTasks(pool, req.actor, day);
    if (enabled('complaints')) result.complaints = await dashboardComplaints(pool, req.actor);
    if (enabled('holidays')) result.holidays = await dashboardHolidays(pool, day);
    if (enabled('salary-slips')) result.salarySlips = await dashboardSalary(pool, req.actor);
    send(res, result);
  });
  return router;
}
