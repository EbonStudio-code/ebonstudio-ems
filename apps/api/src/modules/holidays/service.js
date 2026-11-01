import { createHash } from 'node:crypto';
import { fail, notFound, checkVersion } from '../../core/errors.js';
import { today } from '../../core/dates.js';
import { company } from '../company/service.js';
import { holidayImpact } from '../leave/service.js';

export async function holidayDates(db, start, end) {
  return (await db.query('SELECT date FROM holidays WHERE date BETWEEN $1 AND $2 ORDER BY date', [start, end])).rows.map(r => r.date);
}
export async function holidayPreview(db, proposal) {
  const settings = await company(db);
  const day = today(settings.timezone);
  let existing;
  if (proposal.operation !== 'CREATE') {
    if (!proposal.holidayId || proposal.version === undefined) fail(422, 'VALIDATION_FAILED', 'Holiday ID and version are required');
    existing = (await db.query('SELECT id,date,name,note,version FROM holidays WHERE id=$1', [proposal.holidayId])).rows[0];
    if (!existing) notFound();
    checkVersion(existing, proposal.version);
    if (existing.date < day) fail(409, 'PAST_HOLIDAY', 'Past holidays are read-only');
  } else if (proposal.holidayId || proposal.version !== undefined) fail(422, 'VALIDATION_FAILED', 'A create preview cannot target an existing holiday');
  const proposed = {
    date: proposal.date ?? existing?.date,
    name: proposal.name ?? existing?.name,
    note: proposal.note ?? existing?.note ?? '',
  };
  if (proposal.operation !== 'DELETE' && (!proposed.date || !proposed.name || proposed.date < day)) fail(422, 'INVALID_HOLIDAY', 'A name and today/future date are required');
  if (proposal.operation === 'DELETE' && (proposal.date || proposal.name || proposal.note !== undefined)) fail(422, 'VALIDATION_FAILED', 'Delete previews do not accept replacement fields');
  const dates = [...new Set([existing?.date, proposed.date].filter(Boolean))].sort();
  const impact = await holidayImpact(db, dates);
  const fingerprint = createHash('sha256').update(JSON.stringify({
    operation: proposal.operation, id: existing?.id || null, version: existing?.version ?? null,
    proposed, dates, calendarGuard: settings.calendar_guard,
  })).digest('hex');
  return { impactFingerprint: fingerprint, affectedDates: dates, affectedCount: impact.count,
    affectedRequests: impact.requests, truncated: impact.truncated, proposed };
}
export async function dashboardHolidays(db, day) {
  return (await db.query('SELECT id,date,name FROM holidays WHERE date >= $1 ORDER BY date LIMIT 5', [day])).rows;
}
