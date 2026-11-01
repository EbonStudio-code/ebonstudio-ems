import { attendanceRoutes } from '../modules/attendance/routes.js';
import { leaveRoutes } from '../modules/leave/routes.js';
import { taskRoutes } from '../modules/tasks/routes.js';
import { complaintRoutes } from '../modules/complaints/routes.js';
import { holidayRoutes } from '../modules/holidays/routes.js';
import { salaryRoutes } from '../modules/salary-slips/routes.js';
import { attendanceBlockers, attendanceUsage } from '../modules/attendance/service.js';
import { leaveBlockers, leaveUsage } from '../modules/leave/service.js';
import { taskBlockers } from '../modules/tasks/service.js';
import { salaryUsage } from '../modules/salary-slips/service.js';

export const featureRegistry = [
  { name: 'holidays', route: '/holidays', dependencies: [], factory: holidayRoutes },
  { name: 'attendance', route: '/attendance', dependencies: ['holidays'], factory: attendanceRoutes },
  { name: 'leave', route: '/leave', dependencies: ['holidays'], factory: leaveRoutes },
  { name: 'tasks', route: '/tasks', dependencies: [], factory: taskRoutes },
  { name: 'complaints', route: '/complaints', dependencies: [], factory: complaintRoutes },
  { name: 'salary-slips', route: '/salary-slips', dependencies: [], factory: salaryRoutes },
];
export function validateModules(modules) {
  for (const name of modules) {
    const item = featureRegistry.find(m => m.name === name);
    if (!item || item.dependencies.some(d => !modules.includes(d))) throw new Error('Invalid module dependency configuration');
  }
}
// Disabled routes retain data. Their lifecycle blockers must still be enforced.
export const guards = {
  async blockers(db, employeeId, day) {
    return { ...await attendanceBlockers(db, employeeId), ...await leaveBlockers(db, employeeId, day), ...await taskBlockers(db, employeeId) };
  },
  async startDateInvalid(db, employeeId, startDate) {
    return await attendanceUsage(db, employeeId, startDate) || await leaveUsage(db, employeeId, startDate);
  },
  async companyLocks(db) {
    return { calendar: await attendanceUsage(db) || await leaveUsage(db), currency: await salaryUsage(db) };
  },
};
