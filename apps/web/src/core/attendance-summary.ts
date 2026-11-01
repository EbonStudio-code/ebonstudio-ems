import type { Attendance } from './models';
import { dateKey, formatDate } from './dates';

export interface ClockRecord { workDate: string; checkInAt: string; checkOutAt: string | null }

export function clockSummary(nextAction: string, openRecord: ClockRecord | null, todayRecord: ClockRecord | null) {
  const recorded = { present: Boolean(todayRecord), record: openRecord || todayRecord };
  if (nextAction === 'NOT_STARTED') return {
    ...recorded, title: 'Your Workday Starts Soon',
    description: 'Clock-in is available from your employment start date.',
    action: 'Not started yet', disabled: true,
  };
  if (nextAction === 'CEO_CORRECTION_REQUIRED') return {
    ...recorded, title: 'An Earlier Workday Needs Attention',
    description: 'This open record is over 24 hours old. Ask the CEO to correct it before starting another workday.',
    action: 'Correction required', disabled: true,
  };
  if (nextAction === 'CHECK_OUT' && openRecord) return {
    ...recorded, title: todayRecord ? 'Attendance Recorded' : 'An Earlier Workday Is Still Open',
    description: todayRecord ? 'You are marked Present. Clock out when you finish work.' :
      `Clock out your ${formatDate(openRecord.workDate)} record first. Today is not marked Present until you clock in for today.`,
    action: 'Clock out', disabled: false,
  };
  if (nextAction === 'COMPLETE' && todayRecord) return {
    ...recorded, title: 'Day Completed',
    description: 'Your clock-out is saved and you remain Present. No further clock-in is needed today.',
    action: 'Day completed', disabled: true,
  };
  if (nextAction === 'CHECK_IN' && !openRecord && !todayRecord) return {
    ...recorded, title: 'Mark Your Attendance',
    description: 'Clock in when you start work. You’ll be marked Present right away.',
    action: 'Clock in', disabled: false,
  };
  return {
    ...recorded, title: 'Attendance Status Unavailable',
    description: 'Refresh your attendance before recording another clock-in or clock-out.',
    action: 'Unavailable', disabled: true,
  };
}

export function attendanceSummary(current: Attendance | undefined, completed: Attendance | undefined, timezone: string, now = Date.now(), startDate?: string) {
  const today = dateKey(new Date(now), timezone);
  const record = (row: Attendance | undefined): ClockRecord | null => row ? {
    workDate: row.date, checkInAt: row.checkIn, checkOutAt: row.checkOut,
  } : null;
  const todayRecord = current?.date === today ? current : completed?.date === today ? completed : undefined;
  const nextAction = startDate && startDate > today ? 'NOT_STARTED' : current ?
    now - Date.parse(current.checkIn) > 86400000 ? 'CEO_CORRECTION_REQUIRED' : 'CHECK_OUT' :
    todayRecord ? 'COMPLETE' : 'CHECK_IN';
  return clockSummary(nextAction, record(current), record(todayRecord));
}
