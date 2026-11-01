import { useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, FormEvent, ReactNode } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Inbox, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemo } from '../core/store';
import { usePageTitle } from '../core/usePageTitle';

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return <button type="button" className={`button ${variant} ${className}`} {...props}>{children}</button>;
}
export function PageHeader({ title, description, actions, eyebrow }: { title: string; description: string; actions?: ReactNode; eyebrow?: string }) {
  usePageTitle(title);
  return <div className="page-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div><div className="page-actions">{actions}</div></div>;
}
export function Card({ children, title, action, className = '' }: { children: ReactNode; title?: string; action?: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{title && <div className="card-header"><h2>{title}</h2>{action}</div>}<div className="card-body">{children}</div></section>;
}
export function Badge({ children }: { children: ReactNode }) {
  const text = String(children);
  const positive = ['Active', 'Approved', 'Published', 'Done', 'Resolved', 'Closed', 'Checked out'];
  const warning = ['Pending', 'Draft', 'Invited', 'High', 'Open', 'Checked in'];
  const negative = ['Rejected', 'Voided', 'Inactive', 'Overdue'];
  const color = positive.includes(text) ? 'green' : warning.includes(text) ? 'amber' : negative.includes(text) ? 'red' : text === 'In progress' || text === 'In review' ? 'blue' : 'gray';
  return <span className={`badge ${color}`}><span className="badge-dot" />{children}</span>;
}
export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name.split(' ').slice(0, 2).map(s => s[0]).join('');
  const tone = name.charCodeAt(0) % 5;
  return <span aria-hidden="true" className={`avatar avatar-${tone}${large ? ' large' : ''}`}>{initials}</span>;
}
export function Person({ name, secondary }: { name: string; secondary?: string }) {
  return <div className="person"><Avatar name={name} /><div><strong>{name}</strong>{secondary && <small>{secondary}</small>}</div></div>;
}
export function Field({ label, children, hint, wide = false }: { label: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return <label className={`field${wide ? ' full' : ''}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function Empty({ title = 'Nothing here yet', description = 'New records will appear here.', action }: { title?: string; description?: string; action?: ReactNode }) {
  return <div className="empty"><Inbox size={30} strokeWidth={1.4} /><h3>{title}</h3><p>{description}</p>{action}</div>;
}
export function LoadingSkeleton({ layout = 'rows', label = 'Loading records…' }: { layout?: 'rows' | 'dashboard'; label?: string }) {
  return <div className={`loading-skeleton loading-skeleton-${layout}`} role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className={layout === 'dashboard' ? 'skeleton-grid' : 'skeleton-rows'}>
      {Array.from({length: layout === 'dashboard' ? 4 : 3}, (_, index) => <div className="skeleton-block" key={index}>
        <span className="skeleton-line" /><span className="skeleton-line skeleton-line-short" /><span className="skeleton-line" />
      </div>)}
    </div>
  </div>;
}
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const errorId = useId();
  const { notice, dismissNotice } = useDemo();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dismissNotice();
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  useEffect(() => {
    if (notice?.kind === 'error') {
      if (ref.current) ref.current.scrollTop = 0;
      errorRef.current?.focus({ preventScroll: true });
    }
  }, [notice]);
  return <dialog ref={ref} aria-labelledby={labelId} aria-describedby={notice?.kind === 'error' ? errorId : undefined} className={`modal${wide ? ' modal-wide' : ''}`} onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="modal-heading">
      <div className="modal-header"><h2 id={labelId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
      {notice?.kind === 'error' && <div ref={errorRef} id={errorId} className="inline-alert error modal-error" tabIndex={-1} role="alert">{notice.message}</div>}
    </div>
    <div className="modal-body">{children}</div>
  </dialog>;
}
export function Confirm({ title, description, onClose, onConfirm, reason = false, danger = false, children, confirmLabel = 'Confirm' }: {
  title: string; description: string; onClose: () => void; onConfirm: (reason: string) => boolean; reason?: boolean; danger?: boolean; children?: ReactNode; confirmLabel?: string;
}) {
  const [text, setText] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (onConfirm(text)) onClose(); }
  return <Modal title={title} onClose={onClose}><form onSubmit={submit}><p className="muted">{description}</p>{children}
    {reason && <Field label="Reason"><textarea required maxLength={500} value={text} onChange={e => setText(e.target.value)} rows={3} /></Field>}
    <div className="form-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant={danger ? 'danger' : 'primary'}>{confirmLabel}</Button></div>
  </form></Modal>;
}
export function FormActions({ onCancel, submitLabel = 'Save changes' }: { onCancel: () => void; submitLabel?: string }) {
  return <div className="form-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">{submitLabel}</Button></div>;
}
export function Stat({ title, value, caption, icon, to, progress }: { title: string; value: ReactNode; caption: string; icon: ReactNode; to?: string; progress?: {value: number; max: number} }) {
  const content = <><div className="stat-heading"><span>{title}</span><span className="stat-icon">{icon}</span></div><strong className="stat-value" data-numeric={typeof value === 'number'}>{value}</strong><span className="stat-caption">{caption}</span>
    {progress && progress.max > 0 && <span className="stat-progress" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(100,progress.value/progress.max*100))}%`}} /></span>}</>;
  return to ? <Link className="stat-card" to={to}>{content}</Link> : <div className="stat-card">{content}</div>;
}
export function CompactState({ title, description, to, action = 'View all' }: {title: string; description: string; to: string; action?: string}) {
  return <section className="compact-state"><div><h2>{title}</h2><p>{description}</p></div><Link className="text-link" to={to}>{action}<ArrowRight size={15} aria-hidden="true" /></Link></section>;
}
export function BackLink({ to, children = 'Back to list' }: { to: string; children?: ReactNode }) {
  return <Link className="back-link" to={to}><ChevronLeft size={16} />{children}</Link>;
}
export function Table({ headings, children }: { headings: string[]; children: ReactNode }) {
  return <div className="table-wrap" tabIndex={0} role="region" aria-label={`${headings.join(', ')} table`}><table><thead><tr>{headings.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
export function Pagination({ page, total, onChange, size = 8 }: { page: number; total: number; onChange: (page: number) => void; size?: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className="pagination"><span>{total === 0 ? '0 results' : `${(page - 1) * size + 1}-${Math.min(page * size, total)} of ${total} results`}</span>
    <div><Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></Button>
      <span>Page {page} of {pages}</span><Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={15} /></Button></div></div>;
}
export function usePagination<T>(items: T[], size = 8) {
  const [requestedPage, setPage] = useState(1);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(items.length / size)));
  return { rows: items.slice((page - 1) * size, page * size), page, setPage, total: items.length, size };
}
export function NotFound({ to = '/' }: { to?: string }) {
  usePageTitle('Page Not Available');
  return <div className="not-found"><h1>Page Not Available</h1><p>This page does not exist or is not available in your current preview role.</p><Link className="button primary" to={to}>Return to dashboard</Link></div>;
}
