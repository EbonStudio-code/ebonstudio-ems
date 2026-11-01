import { addDays, validDate } from './dates';

export type AttendanceRange = 'week' | 'month' | 'custom';
export function attendanceRange(today: string, range: Exclude<AttendanceRange, 'custom'>) {
  if (range === 'week') {
    const weekday = new Date(today+'T12:00:00Z').getUTCDay();
    const from = addDays(today, -((weekday+6)%7));
    return {from,to:addDays(from,6)};
  }
  const from = today.slice(0,7)+'-01';
  const next = new Date(from+'T12:00:00Z');
  next.setUTCMonth(next.getUTCMonth()+1);
  return {from,to:addDays(next.toISOString().slice(0,10),-1)};
}
export function validAttendanceRange(from: string, to: string) {
  return (!from || validDate(from)) && (!to || validDate(to)) && (!from || !to || from <= to);
}
export function timezoneLabel(timezone: string) {
  return ['Asia/Kolkata','Asia/Calcutta'].includes(timezone) ? 'India time' : timezone.replaceAll('_',' ');
}
export function attendanceTimestamp(instant: string | null, timezone: string) {
  return instant ? new Intl.DateTimeFormat('en', {
    month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:timezone,
  }).format(new Date(instant)) : '—';
}
export function attendanceHours(seconds: number | null) {
  if (seconds === null) return 'In progress';
  const minutes = Math.floor(seconds/60);
  return `${Math.floor(minutes/60)}h ${minutes%60}m`;
}
export interface AttendanceTotalRow { workDate: string; checkOutAt: string | null; durationSeconds: number | null }
export function attendanceTotals(records: AttendanceTotalRow[], from: string, to: string) {
  const month = records.filter(r => r.workDate >= from && r.workDate <= to);
  return {
    present: new Set(month.map(r => r.workDate)).size,
    seconds: month.reduce((total,r) => total+(r.checkOutAt && r.durationSeconds !== null ? Math.max(0,r.durationSeconds) : 0),0),
    open: month.filter(r => !r.checkOutAt).length,
  };
}
