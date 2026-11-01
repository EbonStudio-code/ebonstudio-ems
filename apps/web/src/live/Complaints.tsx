import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackLink, Badge, Button, Card, Field, PageHeader, Table } from '../components/ui';
import { api, query } from './api';
import { useResource, useSession } from './state';
import { Action, AsyncForm, Dialog, EnumSelect, label, NoRows, Pager, PersonLink, ResourceState, timestamp, value } from './components';
import type { Complaint, Message } from './types';
export default function Complaints() {
  const {id} = useParams();
  const {ceo,base,refresh,notify,session} = useSession();
  const navigate = useNavigate();
  const [page,setPage] = useState(1), [messagePage,setMessagePage] = useState(1), [state,setState] = useState(''), [category,setCategory] = useState('');
  const [create,setCreate] = useState(false), [action,setAction] = useState('');
  const rows = useResource<Complaint[]>(id ? null : query('/complaints',{page,limit:20,state,category}));
  const detail = useResource<Complaint>(id ? '/complaints/'+id : null);
  const messages = useResource<Message[]>(id ? query(`/complaints/${id}/messages`,{page:messagePage,limit:20}) : null);
  const row = detail.result?.data;
  return <>{id && <BackLink to={base+'/complaints'}>All complaints</BackLink>}<PageHeader title={id ? 'Private Complaint' : ceo ? 'Complaints' : 'My Complaints'} description="Named, not anonymous. Only the submitting employee and CEO can read this conversation." actions={!ceo && !id && <Button onClick={() => setCreate(true)}>Submit complaint</Button>} />
    {id ? <><ResourceState loading={detail.loading} error={detail.error} />{row && <>
      <Card title={row.subject}><Badge>{label(row.state)}</Badge><p>{label(row.category)} · <PersonLink id={row.employeeId} /></p><p className="live-text">{row.description}</p><div className="page-actions">
        {ceo && row.state === 'OPEN' && <Button onClick={() => setAction('IN_REVIEW')}>Start review</Button>}
        {ceo && row.state === 'IN_REVIEW' && <Button onClick={() => setAction('RESOLVED')}>Resolve complaint</Button>}
        {row.state === 'RESOLVED' && <><Button variant="secondary" onClick={() => setAction('IN_REVIEW')}>Reopen</Button><Button onClick={() => setAction('CLOSED')}>Close complaint</Button></>}
      </div></Card><Card title="Conversation"><ResourceState loading={messages.loading} error={messages.error} />
        {messages.result && <><NoRows count={messages.result.data.length} /><ol className="live-messages">{messages.result.data.map(m => <li key={m.id}><strong>{m.authorUserId === session?.userId ? 'You' : ceo ? 'Employee' : 'CEO'}{m.messageType === 'RESOLUTION' ? ' · Resolution' : ''}</strong><small>{timestamp(m.createdAt)}</small><p className="live-text">{m.text}</p></li>)}</ol><Pager page={messages.result.pagination} change={setMessagePage} /></>}
        {row.state !== 'CLOSED' ? <AsyncForm key={row.version} label="Send reply" submit={async form => {
          await api.request(`/complaints/${row.id}/messages`,'POST',{version:row.version,text:value(form,'text')});refresh();notify('Reply saved.');
        }}><Field label="Reply"><textarea name="text" required maxLength={5000} rows={4} /></Field></AsyncForm> : <p>Closed complaints are read-only.</p>}
      </Card>
      {action === 'RESOLVED' ? <Dialog title="Resolve complaint" close={() => setAction('')}><AsyncForm label="Resolve complaint" cancel={() => setAction('')} submit={async form => {
        await api.request(`/complaints/${row.id}/status`,'POST',{version:row.version,state:action,resolutionText:value(form,'resolutionText')});setAction('');refresh();notify('Resolution and status saved together.');
      }}><Field label="Resolution message"><textarea name="resolutionText" required maxLength={5000} rows={4} /></Field></AsyncForm></Dialog>
        : action && <Action title={action === 'CLOSED' ? 'Close complaint' : 'Move to review'} path={`/complaints/${row.id}/status`} payload={{version:row.version,state:action}} close={() => setAction('')}><p>Original submission and messages remain in immutable history.</p></Action>}
    </>}</> : <Card><div className="toolbar"><EnumSelect title="Complaint status" options={['OPEN','IN_REVIEW','RESOLVED','CLOSED']} value={state} change={v => {setState(v);setPage(1);}} />
      <EnumSelect title="Category" options={['WORKPLACE','PAY','TECHNICAL','OTHER']} value={category} change={v => {setCategory(v);setPage(1);}} /></div>
      <ResourceState loading={rows.loading} error={rows.error} />{rows.result && <><NoRows count={rows.result.data.length} /><Table headings={['Subject','Category','Status','Created']}>{rows.result.data.map(c => <tr key={c.id}><td><Link to={`${base}/complaints/${c.id}`}>{c.subject}</Link></td><td>{label(c.category)}</td><td><Badge>{label(c.state)}</Badge></td><td>{timestamp(c.createdAt)}</td></tr>)}</Table><Pager page={rows.result.pagination} change={setPage} /></>}</Card>}
    {create && <Dialog title="Submit complaint" close={() => setCreate(false)}><AsyncForm label="Submit complaint" cancel={() => setCreate(false)} submit={async form => {
      const result = await api.request<Complaint>('/complaints','POST',{subject:value(form,'subject'),category:value(form,'category'),description:value(form,'description')});
      setCreate(false);refresh();navigate(`${base}/complaints/${result.data.id}`);
    }}><p className="inline-alert info">Your identity and this conversation are visible to the CEO. There is no anonymous or independent-review channel here.</p>
      <Field label="Subject"><input name="subject" required maxLength={120} /></Field><Field label="Category"><select name="category">{['WORKPLACE','PAY','TECHNICAL','OTHER'].map(c => <option key={c} value={c}>{label(c)}</option>)}</select></Field>
      <Field label="Description"><textarea name="description" required maxLength={5000} rows={5} /></Field></AsyncForm></Dialog>}</>;
}
