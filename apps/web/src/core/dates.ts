export function dateKey(value: Date | string = new Date(), timezone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function workingDates(start: string, end: string, weekdays: number[], holidays: string[]) {
  if (!validDate(start) || !validDate(end) || start > end) return [];
  const count = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (count > 366) return [];
  return Array.from({ length: count }, (_, i) => addDays(start, i)).filter(day =>
    weekdays.includes(new Date(`${day}T12:00:00Z`).getUTCDay()) && !holidays.includes(day));
}

export function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  if (!date) return 'Not set';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC', ...options })
    .format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

export function formatTime(instant: string | null, timezone = 'UTC') {
  if (!instant) return 'Not checked out';
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(instant));
}

export function formatStamp(instant: string, timezone = 'UTC') {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(instant));
}

export function duration(checkIn: string, checkOut: string | null) {
  if (!checkOut) return 'In progress';
  const minutes = Math.floor((Date.parse(checkOut) - Date.parse(checkIn)) / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function currencyDigits(currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function money(minor: number, currency = 'USD') {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(minor / 10 ** currencyDigits(currency));
}

export function toMinor(value: string, currency = 'USD') {
  const digits = currencyDigits(currency);
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${Math.max(digits, 1)}})?$`).test(value.trim()) ||
    (digits === 0 && value.includes('.'))) throw new Error(`Enter a positive amount with at most ${digits} decimal places.`);
  const [whole, fraction = ''] = value.trim().split('.');
  const result = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
  if (!Number.isSafeInteger(result) || result > 1_000_000_000_000) throw new Error('Amount is too large.');
  return result;
}
