import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, Plus, Printer, ReceiptText, Trash2 } from 'lucide-react';
import { BackLink, Badge, Button, Card, Confirm, Empty, Field, FormActions, Modal, NotFound, PageHeader, Pagination, Person, Table, usePagination } from '../../components/ui';
import { useWorkspace } from '../../core/store';
import type { SalaryLine, SalarySlip } from '../../core/models';
import { currencyDigits, dateKey, formatDate, money, toMinor } from '../../core/dates';
import { totals } from '../../core/domain';

type EditableLine = { label: string; amount: string };
function SlipEditor({ slip, onClose }: { slip: SalarySlip | null; onClose: () => void }) {
  const { data, perform, notify } = useWorkspace();
  const currency = data.settings.currency;
  const convert = (line: SalaryLine): EditableLine => ({ label: line.label, amount: (line.amountMinor / 10 ** currencyDigits(currency)).toFixed(currencyDigits(currency)) });
  const [earnings, setEarnings] = useState<EditableLine[]>(slip?.earnings.map(convert) ?? [{ label: 'Base salary', amount: '' }]);
  const [deductions, setDeductions] = useState<EditableLine[]>(slip?.deductions.map(convert) ?? []);
  const parse = (lines: EditableLine[]): SalaryLine[] => lines.map(l => ({ label: l.label.trim(), amountMinor: toMinor(l.amount, currency) }));
  let net: number | null = null;
  try { net = totals(parse(earnings), parse(deductions)).net; } catch { /* Incomplete draft input has no total yet. */ }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      if (perform({ type: 'slip.save', id: slip?.id, employeeId: slip?.employeeId ?? String(form.get('employeeId')),
        period: slip?.period ?? String(form.get('period')), earnings: parse(earnings), deductions: parse(deductions), note: String(form.get('note')) }, 'Demo salary draft saved. No payroll or payment was processed.')) onClose();
    } catch (error) { notify(error instanceof Error ? error.message : 'Check the entered amounts.', 'error'); }
  }
  function lineFields(label: string, lines: EditableLine[], update: (lines: EditableLine[]) => void) {
    return <div className="salary-lines"><div className="section-heading"><h3>{label}</h3><Button variant="ghost" disabled={lines.length >= 20} onClick={() => update([...lines, { label: '', amount: '' }])}><Plus size={14} />Add line</Button></div>
      {lines.map((line, index) => <div className="salary-line" key={index}><Field label={`${label} label ${index + 1}`}><input aria-label={`${label} label ${index + 1}`} required maxLength={80} value={line.label} onChange={e => update(lines.map((l, i) => i === index ? { ...l, label: e.target.value } : l))} /></Field>
        <Field label={`Amount (${currency})`}><input aria-label={`${label} amount ${index + 1}`} required inputMode="decimal" value={line.amount} placeholder="0.00" onChange={e => update(lines.map((l, i) => i === index ? { ...l, amount: e.target.value } : l))} /></Field>
        <button type="button" className="icon-button danger-text" aria-label={`Remove ${label.toLowerCase()} line ${index + 1}`} disabled={label === 'Earnings' && lines.length === 1} onClick={() => update(lines.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div>)}
      {!lines.length && <p className="muted">No deductions added.</p>}
    </div>;
  }
  return <Modal title={slip ? 'Edit Salary Draft' : 'Create Salary Draft'} onClose={onClose} wide><form onSubmit={submit}>
    <div className="inline-alert info">Manually entered sample figures only. No tax calculation, attendance deduction, or payment processing.</div>
    <div className="form-grid"><Field label="Employee"><select name="employeeId" required disabled={Boolean(slip)} defaultValue={slip?.employeeId}>{data.employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}</select></Field>
      <Field label="Salary month"><input name="period" type="month" required readOnly={Boolean(slip)} defaultValue={slip?.period ?? dateKey().slice(0, 7)} /></Field></div>
    {lineFields('Earnings', earnings, setEarnings)}{lineFields('Deductions', deductions, setDeductions)}
    <div className="net-preview"><span>Net salary preview</span><strong>{net === null ? 'Enter amounts' : money(net, currency)}</strong></div>
    <Field label="Note (optional)"><textarea name="note" maxLength={500} defaultValue={slip?.note ?? 'Fictional frontend preview. Not a payment record.'} rows={2} /></Field>
    <FormActions onCancel={onClose} submitLabel="Save draft" />
  </form></Modal>;
}

export default function Salary() {
  const { id } = useParams();
  const { data, ceo, base, perform } = useWorkspace();
  const [period, setPeriod] = useState('');
  const [employee, setEmployee] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<SalarySlip | null | undefined>();
  const [action, setAction] = useState<'publish' | 'void' | null>(null);
  const filtered = [...data.slips].filter(s => (!period || s.period === period) && (!employee || s.employeeId === employee) && (!status || s.status === status)).sort((a, b) => b.period.localeCompare(a.period) || b.revision - a.revision);
  const pagination = usePagination(filtered);
  const selected = data.slips.find(s => s.id === id);
  const editor = editing !== undefined && <SlipEditor slip={editing} onClose={() => setEditing(undefined)} />;
  if (id) {
    if (!selected) return <NotFound to={`${base}/salary-slips`} />;
    const person = data.employees.find(e => e.id === selected.employeeId)!;
    const snapshot = selected.snapshot ?? { name: person.name, code: person.code, jobTitle: person.jobTitle, department: person.department, company: data.settings.legalName, address: data.settings.address, currency: data.settings.currency };
    const summary = totals(selected.earnings, selected.deductions);
    return <><BackLink to={`${base}/salary-slips`}>All Salary Slips</BackLink>
      <PageHeader title="Salary Slips" description={`${formatDate(`${selected.period}-01`, { month: 'long', day: undefined })} · Revision ${selected.revision}`} actions={<><Button variant="secondary" onClick={() => window.print()}><Printer size={16} />Print / Save PDF</Button>
        {ceo && selected.status === 'Draft' && <><Button variant="secondary" onClick={() => setEditing(selected)}><Pencil size={16} />Edit draft</Button><Button onClick={() => setAction('publish')}>Publish slip</Button></>}
        {ceo && selected.status === 'Published' && <Button variant="danger" onClick={() => setAction('void')}>Void salary slip</Button>}</>} />
      <div className="inline-alert info">Use your browser’s print dialog to save a demo PDF. Secure server-generated PDFs will be added with the backend.</div>
      <article className="salary-document"><div className="statement-top"><div><span className="eyebrow">Sample Salary Slip</span><h2>{snapshot.company}</h2><p>{snapshot.address}</p></div><div className="statement-meta"><ReceiptText size={30} /><Badge>{selected.status}</Badge><small>Revision {selected.revision}</small></div></div>
        {selected.status !== 'Published' && <div className={`statement-status ${selected.status === 'Voided' ? 'void' : ''}`}>{selected.status === 'Voided' ? 'VOID · This statement is no longer valid' : 'DRAFT · Not issued to the employee'}</div>}
        <div className="statement-person"><div><small>ISSUED TO</small><strong>{snapshot.name}</strong><span>{snapshot.code} · {snapshot.jobTitle}</span><span>{snapshot.department}</span></div><div><small>SALARY PERIOD</small><strong>{formatDate(`${selected.period}-01`, { month: 'long', day: undefined })}</strong><span>Currency: {snapshot.currency}</span></div></div>
        <div className="statement-lines"><div><h3>Earnings</h3>{selected.earnings.map((line, i) => <div key={i}><span>{line.label}</span><strong>{money(line.amountMinor, snapshot.currency)}</strong></div>)}<div className="line-total"><strong>Gross earnings</strong><strong>{money(summary.gross, snapshot.currency)}</strong></div></div>
          <div><h3>Deductions</h3>{selected.deductions.length ? selected.deductions.map((line, i) => <div key={i}><span>{line.label}</span><strong>{money(line.amountMinor, snapshot.currency)}</strong></div>) : <div><span>No deductions</span><strong>{money(0, snapshot.currency)}</strong></div>}<div className="line-total"><strong>Total deductions</strong><strong>{money(summary.deducted, snapshot.currency)}</strong></div></div></div>
        <div className="net-pay"><div><span>NET SALARY</span><small>Gross earnings minus deductions</small></div><strong>{money(summary.net, snapshot.currency)}</strong></div>
        {selected.note && <p className="statement-note">{selected.note}</p>}{selected.voidReason && <p className="danger-text"><strong>Void reason:</strong> {selected.voidReason}</p>}
        <p className="statement-disclaimer">DEMO DOCUMENT · Fictional figures for frontend review. Not proof of payment or a statutory payslip.</p>
      </article>
      {action && <Confirm title={action === 'publish' ? 'Publish This Salary Slip?' : 'Void This Salary Slip?'} description={action === 'publish' ? 'The demo employee will see this statement. Financial values and employee/company snapshots become read-only.' : 'The employee retains the statement with a VOID label. Create a new draft revision to replace it.'} reason={action === 'void'} danger={action === 'void'} confirmLabel={action === 'publish' ? 'Publish demo slip' : 'Void salary slip'} onClose={() => setAction(null)} onConfirm={reason => perform(action === 'publish' ? { type: 'slip.publish', id: selected.id } : { type: 'slip.void', id: selected.id, reason }, action === 'publish' ? 'Demo statement published. No payment was made.' : 'Demo statement voided; history retained.')} />}{editor}
    </>;
  }
  return <><PageHeader title="Salary Slips" description={ceo ? 'Prepare and publish monthly salary slips, without a full payroll system.' : 'View your published salary slips and save a copy using browser print.'} actions={ceo && <Button onClick={() => setEditing(null)}><Plus size={17} />Create salary slip</Button>} />
    <div className="inline-alert info">Sample currency: {data.settings.currency}. Statements do not confirm salary payment. All figures are fictional.</div>
    <Card><div className="toolbar"><Field label="Salary month"><input type="month" value={period} onChange={e => { setPeriod(e.target.value); pagination.setPage(1); }} /></Field>
      {ceo && <Field label="Employee"><select value={employee} onChange={e => { setEmployee(e.target.value); pagination.setPage(1); }}><option value="">All employees</option>{data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>}
      <Field label="Status"><select value={status} onChange={e => { setStatus(e.target.value); pagination.setPage(1); }}><option value="">All statuses</option>{(ceo ? ['Draft', 'Published', 'Voided'] : ['Published', 'Voided']).map(s => <option key={s}>{s}</option>)}</select></Field>
      <Button variant="secondary" onClick={() => { setPeriod(''); setEmployee(''); setStatus(''); pagination.setPage(1); }}>Clear filters</Button></div>
      {filtered.length ? <Table headings={[...(ceo ? ['Employee'] : []), 'Month', 'Revision', 'Net amount', 'Status', 'Action']}>{pagination.rows.map(slip => <tr key={slip.id}>{ceo && <td><Person name={slip.snapshot?.name ?? data.employees.find(e => e.id === slip.employeeId)?.name ?? 'Employee'} /></td>}<td>{formatDate(`${slip.period}-01`, { month: 'long', day: undefined })}</td><td>#{slip.revision}</td><td><strong>{money(totals(slip.earnings, slip.deductions).net, slip.snapshot?.currency ?? data.settings.currency)}</strong></td><td><Badge>{slip.status}</Badge></td><td><Link className="text-link" to={`${base}/salary-slips/${slip.id}`}>View Salary Slip</Link></td></tr>)}</Table> : <Empty title="No Salary Slips Found" description="Published salary slips will appear here. Try another month or clear the filters." />}
      <Pagination {...pagination} onChange={pagination.setPage} />
    </Card>{editor}
  </>;
}
