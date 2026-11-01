import { useState } from 'react';
import { Card, Field, PageHeader, Table } from '../components/ui';
import { api, query } from './api';
import { useResource, useSession } from './state';
import { AsyncForm, NoRows, Pager, ResourceState, timestamp, value } from './components';
import type { Audit } from './types';

export default function Settings() {
  const { company, refresh, notify, session } = useSession();
  const [currency, setCurrency] = useState(company?.currencyCode || '');
  return <><PageHeader title="Company Settings" description="Configure actual company values explicitly. Demo defaults are never imported." />
    <Card title={company ? 'Company Information and Policy' : 'First-Time Company Setup'}><AsyncForm key={company?.version ?? 'new'} submit={async form => {
      const code = value(form, 'currencyCode').toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) throw new Error('Choose a valid three-letter currency code.');
      const weekdays = form.getAll('weekday').map(Number);
      if (!weekdays.length) throw new Error('Select at least one working weekday.');
      const minor = new Intl.NumberFormat('en', {style:'currency', currency: code}).resolvedOptions().maximumFractionDigits;
      await api.request('/company', 'PATCH', {version: company?.version ?? 0, displayName:value(form,'displayName'),
        legalName:value(form,'legalName'), statementAddress:value(form,'statementAddress'), timezone:value(form,'timezone'),
        workingWeekdays: weekdays, currencyCode:code, currencyMinorUnit:minor,
        leaveTypes:value(form,'leaveTypes').split(',').map(v => v.trim()).filter(Boolean),
        salaryPublicationEnabled:form.get('publication') === 'on', salaryJurisdiction:value(form,'salaryJurisdiction')});
      refresh(); notify('Company settings saved.');
    }}>
      <div className="form-grid"><Field label="Company display name"><input name="displayName" defaultValue={company?.displayName} required maxLength={120} /></Field>
        <Field label="Legal name for statements"><input name="legalName" defaultValue={company?.legalName} maxLength={200} /></Field>
        <Field label="Company timezone" hint="IANA name, such as Asia/Kolkata. Locks after attendance or leave exists."><input name="timezone" defaultValue={company?.timezone} required maxLength={100} placeholder="Select your company timezone" list="timezones" />
          <datalist id="timezones">{Intl.supportedValuesOf('timeZone').map(zone => <option key={zone}>{zone}</option>)}<option>UTC</option></datalist></Field>
        <Field label="Currency code" hint="Locks after the first salary draft."><input name="currencyCode" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} required maxLength={3} list="currencies" />
          <datalist id="currencies">{Intl.supportedValuesOf('currency').map(c => <option key={c}>{c}</option>)}</datalist></Field>
        <Field label="Company statement address" wide><textarea name="statementAddress" defaultValue={company?.statementAddress} maxLength={500} rows={3} /></Field>
        <Field label="Leave labels, separated by commas" wide><input name="leaveTypes" defaultValue={company?.leaveTypes.join(', ')} required maxLength={1200} placeholder="Enter approved company leave labels" /></Field></div>
      <fieldset className="live-weekdays"><legend>Working weekdays</legend>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((name, i) =>
        <label key={name}><input name="weekday" type="checkbox" value={i} defaultChecked={company?.workingWeekdays.includes(i)} />{name}</label>)}</fieldset>
      <Field label="Reviewed salary jurisdiction"><input name="salaryJurisdiction" defaultValue={company?.salaryJurisdiction} maxLength={200} /></Field>
      <label className="live-check"><input name="publication" type="checkbox" defaultChecked={company?.salaryPublicationEnabled} />I have reviewed legal company metadata and jurisdiction requirements. Enable salary statement publication.</label>
      <div className="inline-alert warning">Internal statements only. This does not perform payroll, payments or statutory compliance validation.</div>
    </AsyncForm></Card><Card title="Enabled Capabilities"><p>{session?.enabledModules.join(', ')}</p><p className="muted">Enablement is server deployment configuration, not a client-side permission switch.</p></Card></>;
}
export function AuditPage() {
  const [page, setPage] = useState(1);
  const [module, setModule] = useState('');
  const records = useResource<Audit[]>(query('/audit-events', {page, limit:20, module}));
  return <><PageHeader title="Audit History" description="Append-only, redacted metadata. Private complaint bodies and salary amounts are not logged here." />
    <Card><Field label="Module"><select value={module} onChange={e => {setModule(e.target.value);setPage(1);}}><option value="">All modules</option>{['identity','company','employees','attendance','leave','tasks','complaints','holidays','salary-slips'].map(m => <option key={m}>{m}</option>)}</select></Field>
      <ResourceState loading={records.loading} error={records.error} />{records.result && <><NoRows count={records.result.data.length} />
        <Table headings={['Time','Module','Action','Reason','Request ID']}>{records.result.data.map(row => <tr key={row.id}><td>{timestamp(row.createdAt)}</td><td>{row.module}</td><td>{row.action}</td><td>{row.reason || '—'}</td><td className="muted">{row.requestId}</td></tr>)}</Table>
        <Pager page={records.result.pagination} change={setPage} /></>}</Card></>;
}
