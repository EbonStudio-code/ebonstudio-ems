import { lazy, Suspense } from 'react';
import LiveApp from './live/App';
import { tokenFromFragment } from './live/api';

const PreviewApp = import.meta.env.DEV ? lazy(() => import('./PreviewApp')) : null;
const preview = window.location.pathname === '/preview' || window.location.pathname.startsWith('/preview/');
const setupToken = !preview && ['/accept-invitation', '/reset-password'].includes(window.location.pathname) ? tokenFromFragment(window.location.hash) : '';
if (!preview && window.location.hash && ['/accept-invitation', '/reset-password'].includes(window.location.pathname)) {
  window.history.replaceState(window.history.state, '', window.location.pathname);
}
export default function App() {
  if (preview) return PreviewApp
    ? <Suspense fallback={<p role="status">Loading preview…</p>}><PreviewApp /></Suspense>
    : <main><h1>Page Not Available</h1><a href="/login">Sign in</a></main>;
  return <LiveApp token={setupToken} />;
}
