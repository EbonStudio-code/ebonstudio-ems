import AttendanceClock from '../../components/AttendanceClock';
import { Button } from '../../components/ui';
import { attendanceSummary } from '../../core/attendance-summary';
import { dateKey } from '../../core/dates';
import { useWorkspace } from '../../core/store';

export default function AttendanceClockControl({ history = false }: { history?: boolean }) {
  const { data, ceo, session, person, base, perform } = useWorkspace();
  if (ceo) return null;
  const today = dateKey(new Date(), data.settings.timezone);
  const current = data.attendance.find(a => a.employeeId === session?.employeeId && !a.checkOut);
  const completed = data.attendance.find(a => a.employeeId === session?.employeeId && a.date === today && a.checkOut);
  const summary = attendanceSummary(current, completed, data.settings.timezone, Date.now(), person?.startDate);
  return <AttendanceClock summary={summary} timezone={data.settings.timezone} preview historyTo={history ? base+'/attendance' : undefined}
    action={<Button disabled={summary.disabled} onClick={() => perform(current ? { type:'attendance.out', id:current.id } : { type:'attendance.in' },
      current ? 'Demo clock-out recorded.' : 'Present — demo attendance recorded. Actual browser time saved.')}>{summary.action}</Button>} />;
}
