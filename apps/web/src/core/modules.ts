import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { LayoutDashboard, Users, Clock3, CalendarCheck2, ListTodo, MessageSquareText, CalendarDays, ReceiptText, Settings2, ShieldCheck, ScrollText, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from './models';

type Module = {
  id: string; path: string; title: string; employeeTitle?: string; roles: Role[];
  icon: LucideIcon; Page: LazyExoticComponent<ComponentType>; details?: boolean; group?: 'Workspace' | 'Administration';
};
const Employees = lazy(() => import('../modules/employees/Employees'));
export const modules: Module[] = [
  { id: 'dashboard', path: 'dashboard', title: 'Overview', roles: ['CEO', 'Employee'], icon: LayoutDashboard, Page: lazy(() => import('../modules/dashboard/Dashboard')) },
  { id: 'employees', path: 'employees', title: 'Employees', roles: ['CEO'], icon: Users, Page: Employees, details: true },
  { id: 'profile', path: 'profile', title: 'My Profile', roles: ['Employee'], icon: UserRound, Page: Employees },
  { id: 'attendance', path: 'attendance', title: 'Attendance', employeeTitle: 'My Attendance', roles: ['CEO', 'Employee'], icon: Clock3, Page: lazy(() => import('../modules/attendance/Attendance')) },
  { id: 'leave', path: 'leave', title: 'Leave Requests', employeeTitle: 'My Leave', roles: ['CEO', 'Employee'], icon: CalendarCheck2, Page: lazy(() => import('../modules/leave/Leave')), details: true },
  { id: 'tasks', path: 'tasks', title: 'Tasks', employeeTitle: 'My Tasks', roles: ['CEO', 'Employee'], icon: ListTodo, Page: lazy(() => import('../modules/tasks/Tasks')), details: true },
  { id: 'complaints', path: 'complaints', title: 'Complaints', employeeTitle: 'My Complaints', roles: ['CEO', 'Employee'], icon: MessageSquareText, Page: lazy(() => import('../modules/complaints/Complaints')), details: true },
  { id: 'holidays', path: 'holidays', title: 'Holidays', roles: ['CEO', 'Employee'], icon: CalendarDays, Page: lazy(() => import('../modules/holidays/Holidays')) },
  { id: 'salary-slips', path: 'salary-slips', title: 'Salary Slips', employeeTitle: 'My Salary Slips', roles: ['CEO', 'Employee'], icon: ReceiptText, Page: lazy(() => import('../modules/salary/Salary')), details: true },
  { id: 'settings', path: 'settings', title: 'Company Settings', roles: ['CEO'], icon: Settings2, Page: lazy(() => import('../modules/settings/Settings')), group: 'Administration' },
  { id: 'audit', path: 'audit', title: 'Audit History', roles: ['CEO'], icon: ScrollText, Page: lazy(() => import('../modules/settings/Audit')), group: 'Administration' },
  { id: 'security', path: 'security', title: 'Account Security', roles: ['CEO', 'Employee'], icon: ShieldCheck, Page: lazy(() => import('../modules/auth/Security')), group: 'Administration' },
];
