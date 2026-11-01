import { fail } from './errors.js';

export function today(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = key => parts.find(p => p.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function datesBetween(start, end) {
  const length = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (!Number.isInteger(length) || length < 1 || length > 366) fail(422, 'INVALID_DATE_RANGE', 'Choose between 1 and 366 calendar days');
  return Array.from({ length }, (_, i) => new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10));
}
export function workingDates(start, end, weekdays, holidays) {
  return datesBetween(start, end).filter(d => weekdays.includes(new Date(d + 'T12:00:00Z').getUTCDay()) && !holidays.includes(d));
}
