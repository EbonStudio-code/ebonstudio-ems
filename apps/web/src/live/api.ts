import type { Reply } from './types';

export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = 'NETWORK_ERROR', public requestId?: string) { super(message); }
}
type Fetcher = typeof fetch;
export function createApi(fetcher: Fetcher = (...args) => fetch(...args), event: (name: string) => void = name => window.dispatchEvent(new Event(name))) {
  let csrf: string | null = null;
  let pendingCsrf: Promise<string> | null = null;
  let generation = 0;
  function clear() { generation += 1; csrf = null; pendingCsrf = null; }
  function requireCurrent(epoch: number) {
    if (generation !== epoch) throw new ApiError('Account changed. Reload to continue.');
  }
  async function response(path: string, method: string, body: unknown, token?: string, signal?: AbortSignal) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    try {
      return await fetcher('/api/v1' + path, {
        method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json', ...(method !== 'GET' ? { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' } : {}) },
        ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {}),
      });
    } catch {
      if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
      throw new ApiError(method === 'GET' ? 'Could not reach the API. Check the connection and retry.' : 'The request could not be confirmed. Reload current records before trying again; it may have been saved.');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  async function error(result: Response, path: string, epoch: number): Promise<never> {
    const body = await result.json().catch(() => null);
    requireCurrent(epoch);
    if (result.status === 401 && !['/auth/login','/auth/change-password','/auth/session'].includes(path)) {
      clear(); event('ems:expired');
    }
    if (body?.error?.code === 'CSRF_FAILED') { csrf = null; pendingCsrf = null; }
    const message = body?.error?.code === 'CSRF_FAILED'
      ? 'Session protection changed. Reload this page before trying again.'
      : body?.error?.message || 'The API could not complete this request.';
    throw new ApiError(message, result.status, body?.error?.code || 'API_ERROR', body?.requestId);
  }
  async function token(): Promise<string> {
    if (csrf) return csrf;
    if (!pendingCsrf) {
      const epoch = generation;
      pendingCsrf = (async () => {
        const result = await response('/auth/csrf', 'GET', undefined);
        requireCurrent(epoch);
        if (!result.ok) return error(result, '/auth/csrf', epoch);
        const body = await result.json();
        requireCurrent(epoch);
        if (typeof body?.data?.csrfToken !== 'string') throw new ApiError('Invalid API response.');
        csrf = body.data.csrfToken;
        return csrf!;
      })().finally(() => { if (generation === epoch) pendingCsrf = null; });
    }
    return pendingCsrf!;
  }
  async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<Reply<T>> {
    const epoch = generation;
    const protection = method === 'GET' ? undefined : await token();
    requireCurrent(epoch);
    const result = await response(path, method, body, protection, signal);
    requireCurrent(epoch);
    if (!result.ok) return error(result, path, epoch);
    if (result.status === 204) return { data: undefined as T };
    const payload = await result.json().catch(() => { throw new ApiError('The API returned an invalid response.'); });
    requireCurrent(epoch);
    if (!payload || !('data' in payload)) throw new ApiError('The API returned an invalid response.');
    if (typeof payload.data?.csrfToken === 'string') csrf = payload.data.csrfToken;
    event('ems:activity');
    return payload as Reply<T>;
  }
  async function download(id: string, filename: string) {
    const epoch = generation;
    const result = await response(`/salary-slips/${encodeURIComponent(id)}/pdf`, 'GET', undefined);
    requireCurrent(epoch);
    if (!result.ok) return error(result, '/salary-slips/pdf', epoch);
    if (!result.headers.get('content-type')?.includes('application/pdf')) throw new ApiError('The API did not return a PDF.');
    const blob = await result.blob();
    if (generation !== epoch) throw new ApiError('Account changed. The download was cancelled.');
    event('ems:activity');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return { request, clear, download };
}
export const api = createApi();
export function query(path: string, values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') params.set(key, String(value));
  return path + (params.size ? '?' + params : '');
}
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'The operation could not be completed.';
}
export function tokenFromFragment(fragment: string) {
  if (!fragment.startsWith('#') || fragment.length > 200) return '';
  const token = new URLSearchParams(fragment.replace(/^#/, '')).get('token') || '';
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : '';
}
