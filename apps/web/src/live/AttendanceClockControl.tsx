import AttendanceClock from '../components/AttendanceClock';
import { Button, Card } from '../components/ui';
import { clockSummary } from '../core/attendance-summary';
import { api } from './api';
import { AsyncForm, ResourceState } from './components';
import { useResource, useSession } from './state';
import type { Attendance, CurrentAttendance } from './types';

export async function submitClockAction(current: CurrentAttendance) {
  if (clockSummary(current.nextAction, current.openRecord, current.todayRecord).disabled) {
    throw new Error('Refresh your attendance before recording another clock-in or clock-out.');
  }
  if (current.nextAction === 'CHECK_IN') return api.request<Attendance>('/attendance/check-in', 'POST', {});
  if (current.nextAction === 'CHECK_OUT' && current.openRecord) {
    return api.request<Attendance>('/attendance/check-out', 'POST', {
      attendanceId: current.openRecord.id, version: current.openRecord.version,
    });
  }
  throw new Error('Refresh your attendance before recording another clock-in or clock-out.');
}

export default function AttendanceClockControl({ history = false }: { history?: boolean }) {
  const { ceo, session, company, companyError, base, refresh, notify } = useSession();
  const enabled = !ceo && session?.enabledModules.includes('attendance');
  const current = useResource<CurrentAttendance>(enabled ? '/attendance/me/current' : null);
  if (!enabled) return null;
  const now = current.result?.data;
  if (!now || !company) return <Card title="Today’s Attendance"><ResourceState
    loading={current.loading || (!company && !companyError)} error={current.error || companyError} /></Card>;
  const summary = clockSummary(now.nextAction, now.openRecord, now.todayRecord);
  return <AttendanceClock summary={summary} timezone={company.timezone} compact={history} historyTo={history ? base+'/attendance' : undefined}
    action={summary.disabled ? <Button disabled>{summary.action}</Button> : <AsyncForm label={summary.action} submit={async () => {
      await submitClockAction(now);
      refresh();
      notify(now.nextAction === 'CHECK_IN' ? 'Present — attendance recorded. Your actual clock-in time is saved.' : 'Clock-out saved. Your attendance record is retained.');
    }} />} />;
}
