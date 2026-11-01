import { useState } from 'react';
import { Search } from 'lucide-react';
import { Card, Empty, PageHeader, Pagination, Table, usePagination } from '../../components/ui';
import { useWorkspace } from '../../core/store';
import { formatStamp } from '../../core/dates';
import { auditModuleLabel, auditModuleOptions, filterAuditHistory } from '../../core/audit';

export default function Audit() {
  const { data } = useWorkspace();
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('');
  const records = filterAuditHistory(data.audit, entity, search);
  const pagination = usePagination(records, 12);
  return <><PageHeader title="Audit History" description="A simple activity trail for the actions you try in this demo." />
    <div className="inline-alert info">Browser-only sample history, not a secure or tamper-proof audit log. Complaint text, salary amounts, and passwords are not recorded here.</div>
    <Card><div className="toolbar"><div className="search-field"><Search size={17} /><input aria-label="Search audit history" placeholder="Search actor or action..." value={search} onChange={e => { setSearch(e.target.value); pagination.setPage(1); }} /></div><select aria-label="Filter audit module" value={entity} onChange={e => { setEntity(e.target.value); pagination.setPage(1); }}><option value="">All modules</option>{auditModuleOptions(data.audit).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
      {records.length ? <Table headings={['When (UTC)', 'Actor', 'Action', 'Module']}>{pagination.rows.map(event => <tr key={event.id}><td>{formatStamp(event.at)}</td><td><strong>{event.actor}</strong></td><td>{event.action}</td><td><span className="module-label">{auditModuleLabel(event.entity)}</span></td></tr>)}</Table> : <Empty title="No matching activity" description="Try a demo action or adjust your filters." />}
      <Pagination {...pagination} onChange={pagination.setPage} />
    </Card>
  </>;
}
