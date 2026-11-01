import type { DemoData } from './models';

const categories = [
  { id: 'employees', label: 'Employees', aliases: ['employee'] },
  { id: 'attendance', label: 'Attendance', aliases: [] },
  { id: 'leave', label: 'Leave requests', aliases: ['Leave'] },
  { id: 'tasks', label: 'Tasks', aliases: ['task'] },
  { id: 'complaints', label: 'Complaints', aliases: ['complaint'] },
  { id: 'holidays', label: 'Holidays', aliases: ['holiday'] },
  { id: 'salary-slips', label: 'Salary slips', aliases: ['slip', 'slips'] },
  { id: 'company', label: 'Company settings', aliases: ['settings', 'Company'] },
];

export function auditModuleId(entity: string) {
  const key = entity.trim().toLowerCase();
  return categories.find(category =>
    [category.id, category.label, ...category.aliases].some(alias => alias.toLowerCase() === key))?.id ?? entity;
}

export function auditModuleLabel(entity: string) {
  const id = auditModuleId(entity);
  return categories.find(category => category.id === id)?.label ?? entity;
}

export function normalizeAuditHistory(events: DemoData['audit']): DemoData['audit'] {
  if (events.every(event => auditModuleId(event.entity) === event.entity)) return events;
  return events.map(event => ({ ...event, entity: auditModuleId(event.entity) }));
}

export function auditModuleOptions(events: DemoData['audit']) {
  return [...new Set(events.map(event => auditModuleId(event.entity)))]
    .map(id => ({ id, label: auditModuleLabel(id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function filterAuditHistory(events: DemoData['audit'], entity: string, search = '') {
  const query = search.trim().toLowerCase();
  return events.filter(event =>
    (!entity || auditModuleId(event.entity) === auditModuleId(entity)) &&
    `${event.actor} ${event.action}`.toLowerCase().includes(query));
}
