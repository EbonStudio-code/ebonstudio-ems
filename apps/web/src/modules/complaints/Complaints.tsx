import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LockKeyhole, Plus, Send } from 'lucide-react';
import { BackLink, Badge, Button, Card, Confirm, Empty, Field, FormActions, Modal, NotFound, PageHeader, Pagination, Person, Table, usePagination } from '../../components/ui';
import { useWorkspace } from '../../core/store';
import { formatDate, formatStamp } from '../../core/dates';
import { complaintStatuses } from '../../core/models';
import type { Complaint } from '../../core/models';

function ComplaintForm({ onClose }: { onClose: () => void }) {
  const { perform } = useWorkspace();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (perform({ type: 'complaint.create', values: { subject: String(form.get('subject')).trim(), category: String(form.get('category')) as Complaint['category'], description: String(form.get('description')).trim() } }, 'Demo complaint submitted. No external message was sent.')) onClose();
  }
  return <Modal title="Submit a complaint" onClose={onClose}><form className="stack" onSubmit={submit}>
    <div className="inline-alert info">Named, not anonymous. The intended access is you and the CEO only. This prototype stores fictional content in your browser.</div>
    <Field label="Subject"><input name="subject" required maxLength={120} placeholder="A short summary..." /></Field>
    <Field label="Category"><select name="category"><option>Workplace</option><option>Pay</option><option>Technical</option><option>Other</option></select></Field>
    <Field label="Description"><textarea name="description" required maxLength={5000} rows={5} placeholder="Describe the issue using fictional example details..." /></Field>
    <FormActions onCancel={onClose} submitLabel="Submit complaint" />
  </form></Modal>;
}

export default function Complaints() {
  const { id } = useParams();
  const { data, ceo, base, perform } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [transition, setTransition] = useState<Complaint['status'] | null>(null);
  const filtered = data.complaints.filter(c => (!status || c.status === status) && (!category || c.category === category));
  const pagination = usePagination(filtered);
  const selected = data.complaints.find(c => c.id === id);
  if (id) {
    if (!selected) return <NotFound to={`${base}/complaints`} />;
    const person = data.employees.find(e => e.id === selected.employeeId);
    function reply(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (perform({ type: 'complaint.reply', id: selected!.id, text: String(new FormData(event.currentTarget).get('reply') ?? '') }, 'Reply added to the demo thread.')) event.currentTarget.reset();
    }
    return <><BackLink to={`${base}/complaints`}>All complaints</BackLink><PageHeader title={selected.subject} description={`${selected.category} · Submitted ${formatDate(selected.createdAt.slice(0, 10))}`} actions={<Badge>{selected.status}</Badge>} />
      <div className="inline-alert info"><LockKeyhole size={17} />Private workflow preview: submitting employee and CEO. Do not enter sensitive information into this browser-only demo.</div>
      <div className="dashboard-columns"><Card title="Conversation"><div className="thread"><article className="message"><div className="message-meta"><Person name={person?.name ?? 'Employee'} /><time>{formatStamp(selected.createdAt)}</time></div><p className="preserve-lines">{selected.description}</p></article>
        {selected.messages.map(message => <article key={message.id} className={`message${message.author === 'CEO' ? ' from-ceo' : ''}`}><div className="message-meta"><Person name={message.author === 'CEO' ? 'CEO' : person?.name ?? 'Employee'} /><time>{formatStamp(message.at)}</time></div><p className="preserve-lines">{message.text}</p></article>)}
      </div>{selected.status !== 'Closed' ? <form onSubmit={reply} className="reply-form"><Field label="Your reply"><textarea name="reply" required maxLength={5000} rows={3} placeholder="Write a fictional reply..." /></Field><Button type="submit"><Send size={15} />Send demo reply</Button></form> : <div className="inline-alert info">This complaint is closed. The conversation is read-only.</div>}</Card>
        <div className="stack"><Card title="Complaint Details"><dl className="detail-grid"><dt>Submitted by</dt><dd>{person?.name}</dd><dt>Category</dt><dd>{selected.category}</dd><dt>Status</dt><dd><Badge>{selected.status}</Badge></dd></dl>
          <div className="stack">{ceo && selected.status === 'Open' && <Button onClick={() => setTransition('In review')}>Start review</Button>}{ceo && selected.status === 'In review' && <Button onClick={() => setTransition('Resolved')}>Mark resolved</Button>}
            {selected.status === 'Resolved' && <><Button onClick={() => setTransition('Closed')}>Close complaint</Button><Button variant="secondary" onClick={() => setTransition('In review')}>Reopen complaint</Button></>}
          </div></Card><div className="note-card"><LockKeyhole size={21} /><p>Replies are retained. There are no private CEO-only notes or attachments in this version.</p></div></div>
      </div>
      {transition && <Confirm title={`Mark complaint ${transition.toLowerCase()}?`} description={transition === 'Resolved' ? 'Add a resolution message. It will be visible to the employee.' : transition === 'Closed' ? 'Closing makes this thread read-only.' : 'This updates the review status of the complaint.'} reason={transition === 'Resolved'} onClose={() => setTransition(null)} onConfirm={reason => perform({ type: 'complaint.status', id: selected.id, status: transition, reason }, 'Demo complaint status updated.')} />}
    </>;
  }
  return <><PageHeader title={ceo ? 'Complaints' : 'My Complaints'} description={ceo ? 'A private space to listen, respond, and resolve.' : 'Raise an issue and follow the conversation with your CEO.'} actions={!ceo && <Button onClick={() => setCreating(true)}><Plus size={17} />Submit complaint</Button>} />
    <div className="inline-alert info"><LockKeyhole size={17} />These are named complaints, not anonymous reports. Employees see only their own threads in this preview.</div>
    <Card><div className="toolbar"><select aria-label="Filter complaint status" value={status} onChange={e => { setStatus(e.target.value); pagination.setPage(1); }}><option value="">All statuses</option>{complaintStatuses.map(s => <option key={s}>{s}</option>)}</select>
      <select aria-label="Filter complaint category" value={category} onChange={e => { setCategory(e.target.value); pagination.setPage(1); }}><option value="">All categories</option>{['Workplace', 'Pay', 'Technical', 'Other'].map(c => <option key={c}>{c}</option>)}</select></div>
      {filtered.length ? <Table headings={['Subject', ...(ceo ? ['Employee'] : []), 'Category', 'Submitted', 'Status', 'Action']}>{pagination.rows.map(c => <tr key={c.id}><td><Link className="table-title" to={`${base}/complaints/${c.id}`}>{c.subject}</Link></td>{ceo && <td><Person name={data.employees.find(e => e.id === c.employeeId)?.name ?? 'Employee'} /></td>}<td>{c.category}</td><td>{formatDate(c.createdAt.slice(0, 10))}</td><td><Badge>{c.status}</Badge></td><td><Link className="text-link" to={`${base}/complaints/${c.id}`}>Open thread</Link></td></tr>)}</Table> : <Empty title="No matching complaints" description="Any submitted complaints will appear here." />}
      <Pagination {...pagination} onChange={pagination.setPage} />
    </Card>{creating && <ComplaintForm onClose={() => setCreating(false)} />}
  </>;
}
