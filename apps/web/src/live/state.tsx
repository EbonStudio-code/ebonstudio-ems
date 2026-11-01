import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError } from './api';
import type { Company, Reply, Session } from './types';

const Context = createContext<{
  session: Session | null; loading: boolean; error: unknown; company: Company | null; companyError: unknown;
  revision: number; refresh: () => void; authenticate: (broadcast?: boolean) => Promise<void>; logout: () => Promise<void>;
  notice: string; notify: (value: string) => void;
} | null>(null);
export function SessionProvider({ children }: {children: ReactNode}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyError, setCompanyError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [notice, notify] = useState('');
  const current = useRef(session); current.current = session;
  const channel = useRef<BroadcastChannel | null>(null);
  const sequence = useRef(0);
  const clear = useCallback(() => {
    sequence.current += 1; current.current = null; api.clear();
    setSession(null); setCompany(null); setCompanyError(null); notify('');
  }, []);
  const authenticate = useCallback(async (broadcast = false) => {
    const run = ++sequence.current;
    setLoading(!current.current); setError(null);
    try {
      const result = await api.request<Session>('/auth/session');
      if (sequence.current === run) {
        if (current.current && current.current.userId !== result.data.userId) {
          api.clear(); setCompany(null); setCompanyError(null); notify('');
        }
        current.current = result.data;
        setSession(result.data);
        if (broadcast) channel.current?.postMessage('account-change');
      }
    } catch (error) {
      if (sequence.current === run) {
        if (error instanceof ApiError && error.status === 401) { clear(); setLoading(false); }
        else { clear(); setError(error); setLoading(false); }
      }
    } finally { if (sequence.current === run) setLoading(false); }
  }, [clear]);
  useEffect(() => {
    void authenticate();
    const expired = () => { clear(); setLoading(false); };
    const focused = () => { if (document.visibilityState === 'visible' && current.current) void authenticate(); };
    window.addEventListener('ems:expired', expired);
    window.addEventListener('focus', focused);
    document.addEventListener('visibilitychange', focused);
    const restored = (event: PageTransitionEvent) => { if (event.persisted) { clear(); void authenticate(); } };
    window.addEventListener('pageshow', restored);
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('ems.account-change');
      channel.current.onmessage = () => { clear(); void authenticate(); };
    }
    return () => { sequence.current += 1; window.removeEventListener('ems:expired', expired); window.removeEventListener('focus', focused);
      document.removeEventListener('visibilitychange', focused); window.removeEventListener('pageshow', restored); channel.current?.close(); };
  }, [authenticate, clear]);
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    setCompanyError(null);
    api.request<Company>('/company', 'GET', undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setCompany(result.data); })
      .catch(error => { if (!controller.signal.aborted) { setCompany(null); setCompanyError(error); } });
    return () => controller.abort();
  }, [session?.userId, revision, session]);
  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (initial = false) => {
      clearTimeout(timer);
      const expiry = initial ? Date.parse(session.expiresAt) : Math.min(Date.now() + 30 * 60000, Date.parse(session.absoluteExpiresAt));
      timer = setTimeout(clear, Math.max(0, expiry - Date.now()));
    };
    const activity = () => schedule();
    schedule(true);
    window.addEventListener('ems:activity', activity);
    return () => { clearTimeout(timer); window.removeEventListener('ems:activity', activity); };
  }, [session, clear]);
  async function logout() {
    await api.request('/auth/logout', 'POST', {});
    clear(); channel.current?.postMessage('signed-out');
  }
  return <Context.Provider value={{ session, loading, error, company, companyError, revision,
    refresh: () => setRevision(value => value + 1), authenticate, logout, notice, notify }}>{children}</Context.Provider>;
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('Session provider missing');
  return { ...value, ceo: value.session?.role === 'CEO', base: value.session?.role === 'CEO' ? '/ceo' : '/employee' };
}
export function useResource<T>(path: string | null) {
  const { revision, session } = useSession();
  const key = `${session?.userId || 'anonymous'}:${revision}:${path}`;
  const [state, setState] = useState<{key: string; result?: Reply<T>; error?: unknown}>({key: ''});
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setState({key});
    api.request<T>(path, 'GET', undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setState({key, result}); })
      .catch(error => { if (!controller.signal.aborted) setState({key, error}); });
    return () => controller.abort();
  }, [key, path]);
  return state.key === key ? { ...state, loading: Boolean(path && !state.result && !state.error) }
    : { result: undefined, error: undefined, loading: Boolean(path) };
}
