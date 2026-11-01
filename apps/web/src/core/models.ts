import { z } from 'zod';

export const roles = ['CEO', 'Employee'] as const;
export type Role = (typeof roles)[number];
export type Session = { role: Role; employeeId: string };
const stamp = z.string();
const id = z.string().min(1);

const employeeSchema = z.object({
  id, code: z.string(), name: z.string(), email: z.string(), jobTitle: z.string(),
  department: z.string(), startDate: z.string(), phone: z.string(),
  status: z.enum(['Active', 'Inactive']), account: z.enum(['Active', 'Invited']),
});
const correctionSchema = z.object({
  at: stamp, reason: z.string(), beforeIn: stamp, beforeOut: stamp.nullable(),
  afterIn: stamp, afterOut: stamp.nullable(),
});
const attendanceSchema = z.object({
  id, employeeId: id, date: z.string(), checkIn: stamp, checkOut: stamp.nullable(),
  nonWorking: z.boolean(), corrections: z.array(correctionSchema),
});
export const leaveStatuses = ['Pending', 'Approved', 'Rejected', 'Cancelled'] as const;
const historySchema = z.object({ at: stamp, actor: z.string(), status: z.string(), reason: z.string() });
const leaveSchema = z.object({
  id, employeeId: id, type: z.enum(['Annual', 'Sick', 'Unpaid']), startDate: z.string(),
  endDate: z.string(), days: z.array(z.string()), reason: z.string(),
  status: z.enum(leaveStatuses), history: z.array(historySchema),
});
export const taskStatuses = ['To do', 'In progress', 'Done', 'Cancelled'] as const;
const taskSchema = z.object({
  id, title: z.string(), description: z.string(), assigneeId: id,
  priority: z.enum(['Low', 'Normal', 'High']), status: z.enum(taskStatuses),
  dueDate: z.string(), createdAt: stamp,
});
export const complaintStatuses = ['Open', 'In review', 'Resolved', 'Closed'] as const;
const complaintSchema = z.object({
  id, employeeId: id, subject: z.string(),
  category: z.enum(['Workplace', 'Pay', 'Technical', 'Other']),
  description: z.string(), status: z.enum(complaintStatuses), createdAt: stamp,
  messages: z.array(z.object({ id, author: z.string(), text: z.string(), at: stamp })),
});
const holidaySchema = z.object({ id, name: z.string(), date: z.string(), note: z.string() });
const lineSchema = z.object({ label: z.string(), amountMinor: z.number().int().nonnegative() });
const slipSchema = z.object({
  id, employeeId: id, period: z.string(), revision: z.number().int(),
  status: z.enum(['Draft', 'Published', 'Voided']),
  earnings: z.array(lineSchema), deductions: z.array(lineSchema), note: z.string(),
  publishedAt: stamp.nullable(), voidReason: z.string(),
  snapshot: z.object({
    name: z.string(), code: z.string(), jobTitle: z.string(), department: z.string(),
    company: z.string(), address: z.string(), currency: z.string(),
  }).nullable(),
});
const settingsSchema = z.object({
  name: z.string(), legalName: z.string(), address: z.string(),
  timezone: z.string(), currency: z.string(), workingDays: z.array(z.number().int()),
});
export const dataSchema = z.object({
  schemaVersion: z.literal(1),
  employees: z.array(employeeSchema), attendance: z.array(attendanceSchema),
  leaves: z.array(leaveSchema), tasks: z.array(taskSchema), complaints: z.array(complaintSchema),
  holidays: z.array(holidaySchema), slips: z.array(slipSchema), settings: settingsSchema,
  audit: z.array(z.object({ id, actor: z.string(), action: z.string(), entity: z.string(), at: stamp })),
});
export type Employee = z.infer<typeof employeeSchema>;
export type Attendance = z.infer<typeof attendanceSchema>;
export type Leave = z.infer<typeof leaveSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Complaint = z.infer<typeof complaintSchema>;
export type Holiday = z.infer<typeof holidaySchema>;
export type SalarySlip = z.infer<typeof slipSchema>;
export type SalaryLine = z.infer<typeof lineSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type DemoData = z.infer<typeof dataSchema>;
