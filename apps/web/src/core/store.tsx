import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { DemoData, Session } from './models';
import { applyCommand, scopedData } from './domain';
import type { Command } from './domain';
import { createDemoData } from './seed';
import { DATA_KEY, loadDemoData } from './persistence';
import { DemoContext, useDemo } from './demo-context';
export { useDemo } from './demo-context';

const SESSION_KEY = 'ems.preview-session';
type Notice = { message: string; kind: 'success' | 'error' | 'info' } | null;
function initialSession(data: DemoData): Session | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as Session | null;
    if (value?.role === 'CEO') return { role: 'CEO', employeeId: 'emp-1' };
    if (value?.role === 'Employee' && data.employees.some(e => e.id === value.employeeId && e.status === 'Active' && e.account === 'Active'))
      return { role: 'Employee', employeeId: value.employeeId };
  } catch { /* Preview can function without session persistence. */ }
  return null;
}
function useStoreValue() {
  const [initial] = useState(loadDemoData);
  const [rawData, setRawData] = useState(initial.data);
  const dataRef = useRef(rawData);
  const [session, setSession] = useState<Session | null>(() => initialSession(initial.data));
  const [notice, setNotice] = useState<Notice>(initial.warning ? { kind: 'info', message: initial.warning } : null);
  const notify = (message: string, kind: NonNullable<Notice>['kind'] = 'success') => setNotice({ message, kind });
  function save(next: DemoData) {
    dataRef.current = next;
    setRawData(next);
    try { localStorage.setItem(DATA_KEY, JSON.stringify(next)); return true; }
    catch { return false; }
  }
  function perform(command: Command, message = 'Demo changes saved.') {
    try {
      const next = applyCommand(dataRef.current, session, command);
      const persisted = save(next);
      notify(persisted ? message : `${message} Browser storage is unavailable; changes last only for this tab.`, persisted ? 'success' : 'info');
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The demo action could not be completed.', 'error');
      return false;
    }
  }
  function enter(next: Session | null) {
    if (next?.role === 'Employee' && !dataRef.current.employees.some(e => e.id === next.employeeId && e.status === 'Active' && e.account === 'Active')) {
      notify('Choose an active demo employee.', 'error'); return;
    }
    setSession(next);
    setNotice(null);
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* In-memory session remains usable. */ }
  }
  function reset() {
    save(createDemoData());
    enter({ role: 'CEO', employeeId: 'emp-1' });
    notify('Sample data reset. No real employee records were affected.');
  }
  return { data: scopedData(rawData, session), session, enter, perform, notice, notify, dismissNotice: () => setNotice(null), reset,
    demoPeople: rawData.employees.filter(e => e.status === 'Active' && e.account === 'Active') };
}
export type DemoStore = ReturnType<typeof useStoreValue>;
export function DemoProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
export function useWorkspace() {
  const store = useDemo();
  const ceo = store.session?.role === 'CEO';
  const base = ceo ? '/ceo' : '/employee';
  const person = store.data.employees.find(e => e.id === store.session?.employeeId);
  return { ...store, ceo, base, person };
}
