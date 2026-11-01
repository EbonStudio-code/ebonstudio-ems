import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackLink, Badge, Button, Card, Field, PageHeader, Table } from '../components/ui';
import { money, toMinor } from '../core/dates';
import { api, query } from './api';
import { useResource, useSession } from './state';
import { Action, AsyncForm, companyDate, Dialog, EmployeePicker, EnumSelect, label, NoRows, Pager, PersonLink, ResourceState, value } from './components';
import type { Salary as Slip, SalaryLine } from './types';

function Editor({slip,close}:{slip:Slip | null;close:()=>void}) {
  const {company,base,refresh,notify} = useSession();
  const navigate = useNavigate();
  const currency = slip?.currencyCode || company!.currencyCode;
  const digits = slip?.currencyMinorUnit ?? company!.currencyMinorUnit;
  const convert = (lines:SalaryLine[]) => lines.map(l => ({label:l.label,amount:(l.amountMinor/10**digits).toFixed(digits)}));
  const [earnings,setEarnings] = useState(convert(slip?.earnings || [{label:'',amountMinor:0}]));
  const [deductions,setDeductions] = useState(convert(slip?.deductions || []));
  const parse = (lines:typeof earnings) => lines.map(l => ({label:l.label.trim(),amountMinor:toMinor(l.amount,currency)}));
  let net:number | null = null;
  try { net=parse(earnings).reduce((sum,l)=>sum+l.amountMinor,0)-parse(deductions).reduce((sum,l)=>sum+l.amountMinor,0); } catch { /* Incomplete input is not a server total. */ }
  function lines(title:string,rows:typeof earnings,setRows:typeof setEarnings) {
    return <section className="salary-lines"><div className="section-heading"><h3>{title}</h3><Button variant="secondary" disabled={rows.length>=20} onClick={()=>setRows([...rows,{label:'',amount:''}])}>Add {title.toLowerCase()} line</Button></div>
      {rows.map((line,index)=><div key={index} className="salary-line"><Field label={`${title} label ${index+1}`}><input required maxLength={80} value={line.label} onChange={e=>setRows(rows.map((v,i)=>i===index?{...v,label:e.target.value}:v))}/></Field>
        <Field label={`${title} amount ${index+1} (${currency})`}><input required inputMode="decimal" value={line.amount} onChange={e=>setRows(rows.map((v,i)=>i===index?{...v,amount:e.target.value}:v))}/></Field>
        <Button variant="ghost" aria-label={`Remove ${title.toLowerCase()} line ${index+1}`} disabled={title==='Earnings'&&rows.length===1} onClick={()=>setRows(rows.filter((_,i)=>i!==index))}>Remove</Button></div>)}
      {!rows.length&&<p className="muted">No deductions.</p>}</section>;
  }
  return <Dialog title={slip?'Edit salary draft':'Create salary draft'} close={close} wide><AsyncForm cancel={close} label="Save draft" submit={async form=>{
    const payload={earnings:parse(earnings),deductions:parse(deductions),note:value(form,'note')};
    if(net===null||net<0)throw new Error('Enter valid amounts. Net cannot be negative.');
    const saved=await api.request<Slip>(slip?'/salary-slips/'+slip.id:'/salary-slips',slip?'PATCH':'POST',{
      ...payload,...(slip?{version:slip.version}:{employeeId:value(form,'employeeId'),period:value(form,'period')})});
    refresh();notify('Draft saved. No payment or payroll was processed.');close();navigate(`${base}/salary-slips/${saved.data.id}`);
  }}>
    {!slip?<><EmployeePicker active={false}/><Field label="Salary month"><input type="month" name="period" required defaultValue={companyDate(company!.timezone).slice(0,7)}/></Field></>:<p>{slip.period} · Revision {slip.revision}. Employee, period and currency cannot be changed.</p>}
    {lines('Earnings',earnings,setEarnings)}{lines('Deductions',deductions,setDeductions)}
    <div className="net-preview"><span>Calculated preview (server revalidates)</span><strong>{net===null?'Enter valid amounts':money(net,currency)}</strong></div>
    <Field label="Note (optional)"><textarea name="note" maxLength={1000} rows={3} defaultValue={slip?.note}/></Field>
  </AsyncForm></Dialog>;
}
export default function Salary() {
  const {id}=useParams();
  const {ceo,base,company}=useSession();
  const [page,setPage]=useState(1),[period,setPeriod]=useState(''),[state,setState]=useState('');
  const [editing,setEditing]=useState(false),[action,setAction]=useState('');
  const rows=useResource<Slip[]>(id?null:query('/salary-slips',{page,limit:20,period,state}));
  const detail=useResource<Slip>(id?'/salary-slips/'+id:null);
  const slip=detail.result?.data;
  return <>{id&&<BackLink to={base+'/salary-slips'}>All salary statements</BackLink>}<PageHeader title={id?'Salary Statement':ceo?'Salary Slips':'My Salary Slips'}
    description="Internal monthly statements, not proof of payment or statutory payroll compliance."
    actions={ceo&&(!id||slip?.state==='DRAFT')&&<Button onClick={()=>setEditing(true)}>{id?'Edit draft':'Create salary draft'}</Button>}/>
    {id?<><ResourceState loading={detail.loading} error={detail.error}/>{slip&&<>
      <Card><div className="page-actions"><AsyncForm label="Download PDF" submit={()=>api.download(slip.id,`salary-${slip.period}-r${slip.revision}-${slip.id}.pdf`)}/>
        {ceo&&slip.state==='DRAFT'&&<Button onClick={()=>setAction('publish')} disabled={!company?.salaryPublicationEnabled}>Publish statement</Button>}
        {ceo&&slip.state==='PUBLISHED'&&<Button variant="danger" onClick={()=>setAction('void')}>Void statement</Button>}</div>
        {ceo&&slip.state==='DRAFT'&&!company?.salaryPublicationEnabled&&<p className="inline-alert warning">Publication is disabled. Review company legal details and jurisdiction in <Link to="/ceo/settings">Company settings</Link>.</p>}</Card>
      <article className="salary-document"><div className="statement-top"><div><span className="eyebrow">INTERNAL SALARY STATEMENT</span><h2>{slip.companySnapshot?.legalName||company?.legalName||company?.displayName}</h2><p className="live-text">{slip.companySnapshot?.statementAddress||company?.statementAddress}</p></div><div className="statement-meta"><Badge>{label(slip.state)}</Badge><p>Revision {slip.revision}</p></div></div>
        {slip.state!=='PUBLISHED'&&<div className={`statement-status ${slip.state==='VOIDED'?'void':''}`}>{slip.state==='VOIDED'?'VOID · NOT CURRENT':'DRAFT · NOT PUBLISHED'}</div>}
        <div className="statement-person"><div><small>EMPLOYEE</small>{slip.employeeSnapshot?<><strong>{slip.employeeSnapshot.fullName}</strong><span>{slip.employeeSnapshot.employeeCode} · {slip.employeeSnapshot.jobTitle}</span><span>{slip.employeeSnapshot.department}</span></>:<PersonLink id={slip.employeeId}/>}</div><div><small>PERIOD</small><strong>{slip.period}</strong><span>{slip.currencyCode}</span></div></div>
        <div className="statement-lines">{([['Earnings',slip.earnings],['Deductions',slip.deductions]] as const).map(([title,lines])=><div key={title}><h3>{title}</h3>{lines.map((l,i)=><div key={i}><span>{l.label}</span><strong>{money(l.amountMinor,slip.currencyCode)}</strong></div>)}{!lines.length&&<p>None</p>}</div>)}</div>
        <p>Gross: {money(slip.grossMinor,slip.currencyCode)} · Total deductions: {money(slip.totalDeductionsMinor,slip.currencyCode)}</p>
        <div className="net-pay"><span>NET</span><strong>{money(slip.netMinor,slip.currencyCode)}</strong></div><p className="live-text">{slip.note}</p>
        {slip.voidReason&&<p className="danger-text">Void reason: {slip.voidReason}</p>}<p className="statement-disclaimer">Internal statement only. No tax calculation, payment transfer or compliance guarantee.</p></article>
      {action&&<Action title={action==='publish'?'Publish statement':'Void statement'} path={`/salary-slips/${slip.id}/${action}`} payload={{version:slip.version}} close={()=>setAction('')} reason={action==='void'}>
        <p>{action==='publish'?'The employee will be able to read and download this statement. Amounts and snapshots become immutable.':'The statement remains visible with a VOID label. Create a new draft revision for a replacement.'}</p></Action>}
    </>}</>:<Card><div className="toolbar"><Field label="Salary month"><input type="month" value={period} onChange={e=>{setPeriod(e.target.value);setPage(1);}}/></Field>
      <EnumSelect title="Statement status" options={ceo?['DRAFT','PUBLISHED','VOIDED']:['PUBLISHED','VOIDED']} value={state} change={v=>{setState(v);setPage(1);}}/></div>
      <ResourceState loading={rows.loading} error={rows.error}/>{rows.result&&<><NoRows count={rows.result.data.length}/><Table headings={[...(ceo?['Employee']:[]),'Period','Revision','Net','Status','Action']}>{rows.result.data.map(s=><tr key={s.id}>{ceo&&<td>{s.employeeSnapshot?.fullName||<PersonLink id={s.employeeId}/>}</td>}<td>{s.period}</td><td>{s.revision}</td><td>{money(s.netMinor,s.currencyCode)}</td><td><Badge>{label(s.state)}</Badge></td><td><Link to={`${base}/salary-slips/${s.id}`}>View statement</Link></td></tr>)}</Table><Pager page={rows.result.pagination} change={setPage}/></>}</Card>}
    {editing&&<Editor slip={slip||null} close={()=>setEditing(false)}/>}</>;
}
