import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Empty, Field, LoadingSkeleton, Pagination } from '../components/ui';
import { api, ApiError, errorText, query } from './api';
import { useResource, useSession } from './state';
import type { Employee, Page } from './types';

const Busy = createContext<((value: boolean) => void) | null>(null);
export function Dialog({ title, children, close, wide = false }: {title: string; children: ReactNode; close: () => void; wide?: boolean}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { ref.current?.close(); before?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-labelledby={id}
    onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <div className="modal-heading"><div className="modal-header"><h2 id={id}>{title}</h2>
      <button type="button" className="icon-button" disabled={busy} onClick={close} aria-label="Close dialog"><X size={20} /></button></div></div>
    <div className="modal-body"><Busy.Provider value={setBusy}>{children}</Busy.Provider></div>
  </dialog>;
}
export function Failure({ error, retry }: {error: unknown; retry?: () => void}) {
  return <div role="alert" className="inline-alert error live-error"><p>{errorText(error)}</p>
    {error instanceof ApiError && error.requestId && <small>Request: {error.requestId}</small>}
    {retry && <Button variant="secondary" onClick={retry}>Reload records</Button>}</div>;
}
export function AsyncForm({ children, submit, label = 'Save changes', cancel, completed }: {
  children?: ReactNode; submit: (data: FormData) => Promise<unknown>; label?: string; cancel?: () => void; completed?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [failure, setFailure] = useState<{error: unknown} | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const dialogBusy = useContext(Busy);
  useEffect(() => { if (failure) errorRef.current?.focus(); }, [failure]);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const data = new FormData(event.currentTarget);
    busyRef.current = true; setBusy(true); dialogBusy?.(true); setFailure(null);
    try { await submit(data); completed?.(); }
    catch (error) { setFailure({error}); }
    finally { busyRef.current = false; setBusy(false); dialogBusy?.(false); }
  }
  return <form onSubmit={send} className="stack" aria-busy={busy}>
    {failure && <div ref={errorRef} tabIndex={-1}><Failure error={failure.error} retry={() => window.location.reload()} /></div>}
    <fieldset disabled={busy} className="live-fieldset stack">{children}
      <div className="form-actions">{cancel && <Button variant="secondary" onClick={cancel}>Cancel</Button>}
        <Button type="submit">{busy ? 'Please wait…' : label}</Button></div></fieldset>
  </form>;
}
export function Action({ title, path, payload, close, reason = false, children, done }: {
  title: string; path: string; payload: object; close: () => void; reason?: boolean; children?: ReactNode; done?: () => void;
}) {
  const { refresh, notify } = useSession();
  return <Dialog title={title} close={close}><AsyncForm label={title} cancel={close} submit={async data => {
    await api.request(path, 'POST', {...payload, ...(reason ? {reason: value(data, 'reason')} : {})});
    notify('Change saved.'); refresh(); close(); done?.();
  }}>{children}{reason && <Field label="Reason"><textarea name="reason" required maxLength={500} rows={3} /></Field>}</AsyncForm></Dialog>;
}
export function Loading() { return <LoadingSkeleton />; }
export function ResourceState({ loading, error, layout = 'rows' }: {loading: boolean; error?: unknown; layout?: 'rows' | 'dashboard'}) {
  const { refresh } = useSession();
  return loading ? <LoadingSkeleton layout={layout} /> : error ? <Failure error={error} retry={refresh} /> : null;
}
export function Pager({ page, change }: {page?: Page; change: (page: number) => void}) {
  return page ? <Pagination page={page.page} total={page.total} size={page.limit} onChange={change} /> : null;
}
export function EmployeePicker({ initial = '', active = true, required = true, name = 'employeeId' }: {
  initial?: string; active?: boolean; required?: boolean; name?: string;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(initial);
  const rows = useResource<Employee[]>(query('/employees', {search, status: active ? 'ACTIVE' : '', page, limit: 20}));
  const choice = useResource<Employee>(selected ? '/employees/' + selected : null);
  const options = rows.result?.data || [];
  return <div className="stack">
    <Field label="Search employee name or code"><input value={search} maxLength={100} onChange={e => {setSearch(e.target.value); setPage(1);}} /></Field>
    <Field label="Employee"><select required={required} name={name} value={selected} onChange={e => setSelected(e.target.value)}>
      <option value="">{required ? 'Choose an employee' : 'All employees'}</option>
      {selected && !options.some(e => e.id === selected) && <option value={selected}>{choice.result?.data.fullName || 'Selected employee'}</option>}
      {options.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
    </select></Field>
    <ResourceState loading={rows.loading} error={rows.error} />
    <Pager page={rows.result?.pagination} change={setPage} />
  </div>;
}
export const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
export const label = (state: string) => ({TODO: 'To do', IN_PROGRESS: 'In progress', IN_REVIEW: 'In review'}[state] || state.charAt(0).toUpperCase() + state.slice(1).toLowerCase());
export function EnumSelect({ title, options, value: selected, change }: {title: string; options: readonly string[]; value: string; change: (value: string) => void}) {
  return <Field label={title}><select value={selected} onChange={e => change(e.target.value)}><option value="">All</option>{options.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field>;
}
export function NoRows({ count }: {count: number}) { return count ? null : <Empty title="No Records Found" description="Try different filters or create the first record." />; }
export function PersonLink({ id }: {id: string}) {
  const {ceo, base} = useSession();
  const person = useResource<Employee>(ceo ? '/employees/' + id : null);
  return ceo ? <Link to={`${base}/employees/${id}`}>{person.result?.data.fullName || 'View employee'}</Link> : <span>My record</span>;
}
export function timestamp(instant: string | null) { return instant ? new Date(instant).toLocaleString() : '—'; }
export function companyDate(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year','month','day'].map(key => parts.find(p => p.type === key)!.value).join('-');
}
