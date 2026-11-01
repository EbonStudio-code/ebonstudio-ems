import { useId } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { clockSummary } from '../core/attendance-summary';
import { formatDate } from '../core/dates';
import { timezoneLabel } from '../core/attendance-view';
import { useCurrentTime } from '../core/useCurrentTime';

export default function AttendanceClock({ summary, timezone, action, historyTo, preview = false }: {
  summary: ReturnType<typeof clockSummary>; timezone: string; action: ReactNode; historyTo?: string; preview?: boolean;
}) {
  const heading = useId();
  const now = useCurrentTime();
  const record = summary.record;
  const time = (instant: string) => new Intl.DateTimeFormat('en', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: timezone,
  }).format(new Date(instant));
  return <section className="attendance-clock" aria-labelledby={heading}>
    <div className="attendance-clock-main">
      <span className="attendance-clock-icon" aria-hidden="true">{summary.present ? <CheckCircle2 size={25} /> : <Clock3 size={25} />}</span>
      <div className="attendance-clock-copy">
        <span className="eyebrow">Today’s attendance</span>
        <div className="attendance-live-time">
          <span>Current time · {timezoneLabel(timezone)}</span>
          <time dateTime={now.toISOString()}>{time(now.toISOString())}</time>
        </div>
        <div role="status" aria-live="polite" aria-atomic="true">
          <div className="attendance-clock-heading"><h2 id={heading}>{summary.title}</h2><span className="attendance-clock-status">{summary.present ? 'Present' : 'Not recorded'}</span></div>
          <p>{summary.description}</p>
        </div>
      </div>
    </div>
    <div className="attendance-clock-action">{action}{historyTo && <Link className="text-link" to={historyTo}>View attendance history</Link>}</div>
    <dl className="attendance-clock-times">
      <div><dt>{record && !summary.present ? 'Earlier shift' : 'Today’s shift'}</dt><dd>{record ? <><time dateTime={record.workDate}>{formatDate(record.workDate)}</time><small>{record.checkOutAt ? 'Completed' : 'In progress'}</small></> : 'Not started'}</dd></div>
      <div><dt>Saved clock in</dt><dd>{record ? <time dateTime={record.checkInAt}>{time(record.checkInAt)}</time> : '—'}</dd></div>
      <div><dt>Saved clock out</dt><dd>{record?.checkOutAt ? <time dateTime={record.checkOutAt}>{time(record.checkOutAt)}</time> : '—'}</dd></div>
    </dl>
    <p className="attendance-clock-note">{preview ? 'Fictional preview · Browser clock' : 'Your saved punches appear above.'}</p>
  </section>;
}
