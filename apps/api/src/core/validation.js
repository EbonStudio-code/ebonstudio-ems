import { z } from 'zod';
import { fail } from './errors.js';

export { z };
export const uuid = z.uuid();
export const version = z.number().int().min(0).max(2147483646);
export const text = (max = 120) => z.string().trim().min(1).max(max);
export const optionalText = (max = 500) => z.string().trim().max(max);
export const email = z.string().trim().toLowerCase().max(254).email();
export const password = z.string().min(12).max(128);
export const reason = text(500);
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '9999-12-31';
});
export const instant = z.iso.datetime({ offset: true });
export const period = z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/);
export const phone = z.string().trim().max(32).refine(value => {
  if (value === '') return true;
  const digits = value.replace(/\D/g, '');
  return /^\+?(?:\d|[ .-]|\(\d+\))+$/.test(value) && digits.length >= 7 && digits.length <= 15 && /[1-9]/.test(digits);
}, 'Phone must have 7–15 digits and common phone formatting, or be blank');
export const object = shape => z.strictObject(shape);
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) fail(422, 'VALIDATION_FAILED', 'Invalid or unexpected input fields');
  return result.data;
}
export function id(req) {
  const result = uuid.safeParse(req.params.id);
  if (!result.success) fail(400, 'INVALID_ID', 'Invalid record ID');
  return result.data;
}
export function pageQuery(req, extra = {}) {
  return parse(object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    ...extra,
  }), req.query);
}
export async function list(db, sql, values, query) {
  const count = await db.query(`SELECT count(*)::int AS total FROM (${sql}) result`, values);
  const pageValues = [...values, query.limit, (query.page - 1) * query.limit];
  const rows = await db.query(`${sql} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, pageValues);
  return { data: rows.rows.map(publicRow), pagination: { page: query.page, limit: query.limit, total: count.rows[0].total } };
}
export function publicRow(row) {
  if (row === null || row === undefined) return row;
  if (row instanceof Date) return row.toISOString();
  if (Array.isArray(row)) return row.map(publicRow);
  if (typeof row !== 'object') return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    result[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = publicRow(value);
  }
  return result;
}
export const send = (res, row, status = 200) => res.status(status).json({ data: publicRow(row) });
