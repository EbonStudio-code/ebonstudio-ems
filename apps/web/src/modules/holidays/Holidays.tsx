import { useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Confirm, Empty, Field, FormActions, Modal, PageHeader, Table } from '../../components/ui';
import { useWorkspace } from '../../core/store';
import { dateKey, formatDate } from '../../core/dates';
import { holidayImpact } from '../../core/domain';
import type { Holiday } from '../../core/models';

function HolidayEditor({ holiday, onClose }: { holiday: Holiday | null; onClose: () => void }) {
  const { data, perform } = useWorkspace();
  const today = dateKey(new Date(), data.settings.timezone);
  const [date, setDate] = useState(holiday?.date ?? today);
  const impacted = holidayImpact(data, [date, ...(holiday ? [holiday.date] : [])]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (perform({ type: 'holiday.save', id: holiday?.id, values: { name: String(form.get('name')).trim(), date, note: String(form.get('note')).trim() }, reason: String(form.get('reason') ?? ''), acknowledged: form.get('acknowledge') === 'on' }, 'Demo calendar updated. Existing leave snapshots were retained.')) onClose();
  }
  return <Modal title={holiday ? 'Edit Holiday' : 'Add Holiday'} onClose={onClose}><form onSubmit={submit} className="stack">
    <Field label="Holiday name"><input name="name" required maxLength={120} defaultValue={holiday?.name} /></Field>
    <Field label="Holiday date"><input type="date" required min={today} value={date} onChange={e => setDate(e.target.value)} /></Field>
    <Field label="Note (optional)"><textarea name="note" maxLength={500} defaultValue={holiday?.note} rows={2} /></Field>
    {holiday && <Field label="Reason for change"><textarea name="reason" maxLength={500} required rows={2} /></Field>}
    <div className="inline-alert warning"><div><strong>Calendar impact: {impacted.length} leave request{impacted.length === 1 ? '' : 's'}</strong><p>Existing leave dates will not be recalculated. Only new requests use the changed calendar.</p>{impacted.map(l => <p key={l.id}>{data.employees.find(e => e.id === l.employeeId)?.name}: {formatDate(l.startDate)} - {formatDate(l.endDate)}</p>)}</div></div>
    <label className="checkbox-field"><input type="checkbox" name="acknowledge" required />I have reviewed the calendar impact.</label>
    <FormActions onCancel={onClose} submitLabel="Save holiday" />
  </form></Modal>;
}

export default function Holidays() {
  const { data, ceo, perform } = useWorkspace();
  const today = dateKey(new Date(), data.settings.timezone);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [editing, setEditing] = useState<Holiday | null | undefined>();
  const [removing, setRemoving] = useState<Holiday | null>(null);
  const [details, setDetails] = useState<Holiday | null>(null);
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const offset = (firstDay.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const yearHolidays = [...data.holidays].filter(h => h.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date));
  function moveMonth(delta: number) { setMonth(new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7)); }
  return <><PageHeader title="Holidays" description="Company-wide days off, planned together. Sample working week: Monday to Friday." actions={ceo && <Button onClick={() => setEditing(null)}><Plus size={17} />Add holiday</Button>} />
    <Card><div className="toolbar spread"><div className="inline"><Button variant="secondary" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></Button><h2 className="calendar-title">{formatDate(`${month}-01`, { month: 'long', day: undefined })}</h2><Button variant="secondary" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={17} /></Button><Button variant="ghost" onClick={() => setMonth(today.slice(0, 7))}>Today</Button></div>
      <div className="segmented"><button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><CalendarDays size={16} />Calendar</button><button aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} />Year list</button></div></div>
      {view === 'calendar' ? <div className="calendar"><div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day}>{day}</div>)}</div><div className="calendar-grid">
        {Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, i) => {
          const number = i - offset + 1;
          const valid = number > 0 && number <= length;
          const date = `${month}-${String(number).padStart(2, '0')}`;
          const holiday = data.holidays.find(h => h.date === date);
          return <div key={i} className={`calendar-cell${!valid ? ' outside' : ''}${i % 7 >= 5 ? ' weekend' : ''}`}><span className={date === today ? 'calendar-today' : ''}>{valid ? number : ''}</span>
            {valid && holiday && <button className="calendar-event" onClick={() => setDetails(holiday)}>{holiday.name}</button>}</div>;
        })}</div></div> : yearHolidays.length ? <Table headings={['Holiday', 'Date', 'Note', ...(ceo ? ['Actions'] : [])]}>{yearHolidays.map(h => <tr key={h.id}><td><strong>{h.name}</strong></td><td>{formatDate(h.date, { weekday: 'short' })}</td><td>{h.note || '—'}</td>{ceo && <td>{h.date >= today ? <div className="inline"><button className="icon-button" aria-label={`Edit ${h.name}`} onClick={() => setEditing(h)}><Pencil size={16} /></button><button className="icon-button danger-text" aria-label={`Remove ${h.name}`} onClick={() => setRemoving(h)}><Trash2 size={16} /></button></div> : <span className="muted">Read-only</span>}</td>}</tr>)}</Table> : <Empty title={`No Holidays for ${year}`} description="Use the arrows to change the year, or add a holiday." />}
    </Card>
    <div className="section-heading"><h2>Upcoming Days Off</h2><span className="muted">Company calendar · {data.settings.timezone}</span></div>
    <div className="holiday-cards">{[...data.holidays].filter(h => h.date >= today).sort((a, b) => a.date.localeCompare(b.date)).map(h => <button key={h.id} className="holiday-card" onClick={() => setDetails(h)}><CalendarDays size={21} /><strong>{h.name}</strong><span>{formatDate(h.date, { weekday: 'short' })}</span></button>)}</div>
    {editing !== undefined && <HolidayEditor holiday={editing} onClose={() => setEditing(undefined)} />}
    {details && <Modal title={details.name} onClose={() => setDetails(null)}><p><strong>{formatDate(details.date, { weekday: 'long' })}</strong></p><p>{details.note || 'Company-wide full-day holiday.'}</p>{details.date < today && <p className="muted">Past holidays are read-only.</p>}
      <div className="form-actions">{ceo && details.date >= today && <><Button variant="danger" onClick={() => { setRemoving(details); setDetails(null); }}>Remove holiday</Button><Button onClick={() => { setEditing(details); setDetails(null); }}>Edit holiday</Button></>}<Button variant="secondary" onClick={() => setDetails(null)}>Close</Button></div>
    </Modal>}
    {removing && <Confirm title="Remove This Holiday?" description={`${removing.name}: ${formatDate(removing.date)}. ${holidayImpact(data, [removing.date]).length} existing leave request(s) intersect this date. Existing leave snapshots will remain unchanged.`} reason danger confirmLabel="Remove holiday" onClose={() => setRemoving(null)} onConfirm={reason => perform({ type: 'holiday.remove', id: removing.id, reason, acknowledged: true })}>
      <label className="checkbox-field"><input type="checkbox" required />I acknowledge the calendar impact.</label>
    </Confirm>}
  </>;
}
