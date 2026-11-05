import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Field, PageHeader, Table } from '../components/ui';
import { api, query } from './api';
import { useResource, useSession } from './state';
import { AsyncForm, companyDate, Dialog, NoRows, Pager, ResourceState, value } from './components';
import type { Holiday, Impact } from './types';
function Editor({holiday,remove,close}:{holiday:Holiday | null;remove:boolean;close:()=>void}) {
  const {company,base,refresh,notify} = useSession();
  const [review,setReview] = useState<{impact:Impact;fields:Record<string,unknown>;reason:string} | null>(null);
  const operation = remove ? 'DELETE' : holiday ? 'UPDATE' : 'CREATE';
  return <Dialog title={remove ? 'Remove Holiday' : holiday ? 'Edit Holiday' : 'Add Holiday'} close={close} wide>{review ? <AsyncForm label="Confirm calendar change" cancel={() => setReview(null)} submit={async form => {
    if (form.get('acknowledge') !== 'on') throw new Error('Acknowledge the current impact before saving.');
    await api.request(holiday ? '/holidays/'+holiday.id : '/holidays',remove ? 'DELETE' : holiday ? 'PATCH' : 'POST',{
      ...review.fields,...(holiday ? {version:holiday.version,reason:review.reason} : {}),impactFingerprint:review.impact.impactFingerprint,acknowledgeImpact:true});
    refresh();notify('Holiday calendar updated. Existing leave and attendance snapshots are unchanged.');close();
  }}><div className="inline-alert warning"><strong>{review.impact.affectedCount} affected pending/approved requests</strong><p>Dates reviewed: {review.impact.affectedDates.join(', ')}. Existing snapshots remain unchanged.</p></div>
    <ul>{review.impact.affectedRequests.map(r => <li key={r.id}><Link to={`${base}/leave/${r.id}`}>{r.startDate} to {r.endDate} · {r.state} · {r.dayCount} days</Link></li>)}</ul>
    {review.impact.truncated && <p>Only the first 100 affected requests are shown. Review the leave list for the remaining requests.</p>}
    <label className="live-check"><input name="acknowledge" type="checkbox" required />I acknowledge this impact, including zero affected requests.</label></AsyncForm>
    : <AsyncForm label="Review calendar impact" cancel={close} submit={async form => {
      const fields = remove ? {} : {date:value(form,'date'),name:value(form,'name'),note:value(form,'note')};
      const impact = await api.request<Impact>('/holidays/impact-preview','POST',{operation,...fields,...(holiday ? {holidayId:holiday.id,version:holiday.version} : {})});
      setReview({fields,reason:value(form,'reason'),impact:impact.data});
    }}>{!remove && <><Field label="Holiday name"><input name="name" required maxLength={120} defaultValue={holiday?.name} /></Field>
      <Field label="Holiday date"><input name="date" type="date" required min={companyDate(company!.timezone)} defaultValue={holiday?.date} /></Field>
      <Field label="Note (optional)"><textarea name="note" maxLength={500} defaultValue={holiday?.note} rows={3} /></Field></>}
      {holiday && <Field label="Reason"><textarea name="reason" required maxLength={500} rows={3} /></Field>}
    </AsyncForm>}</Dialog>;
}
export default function Holidays() {
  const {ceo,company} = useSession();
  const [page,setPage] = useState(1), [year,setYear] = useState('');
  const [edit,setEdit] = useState<{holiday:Holiday | null;remove:boolean} | null>(null);
  const rows = useResource<Holiday[]>(query('/holidays',{page,limit:20,year}));
  return <><PageHeader title="Holidays" description={`Company-wide calendar in ${company?.timezone}. Past holidays are read-only.`} actions={ceo && <Button onClick={() => setEdit({holiday:null,remove:false})}>Add holiday</Button>} />
    <Card><Field label="Calendar year"><input type="number" min={1900} max={9999} value={year} onChange={e => {setYear(e.target.value);setPage(1);}} placeholder="All years" /></Field>
      <ResourceState loading={rows.loading} error={rows.error} />{rows.result && <><NoRows count={rows.result.data.length} /><Table headings={['Date','Holiday','Note',...(ceo ? ['Actions'] : [])]}>{rows.result.data.map(h => <tr key={h.id}><td>{h.date}</td><td>{h.name}</td><td className="live-text">{h.note || '—'}</td>{ceo && <td><div className="page-actions"><Button variant="secondary" disabled={h.date<companyDate(company!.timezone)} onClick={() => setEdit({holiday:h,remove:false})}>Edit</Button><Button variant="danger" disabled={h.date<companyDate(company!.timezone)} onClick={() => setEdit({holiday:h,remove:true})}>Remove</Button></div></td>}</tr>)}</Table><Pager page={rows.result.pagination} change={setPage} /></>}</Card>
    {edit && <Editor {...edit} close={() => setEdit(null)} />}</>;
}
