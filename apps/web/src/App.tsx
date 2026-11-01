import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DemoProvider, useDemo } from './core/store';
import { modules } from './core/modules';
import type { Role } from './core/models';
import Layout from './components/Layout';
import { LoadingSkeleton, NotFound } from './components/ui';
import Auth from './modules/auth/Auth';
import LiveApp from './live/App';
import { tokenFromFragment } from './live/api';

const preview = window.location.pathname === '/preview' || window.location.pathname.startsWith('/preview/');
const setupToken = !preview && ['/accept-invitation','/reset-password'].includes(window.location.pathname) ? tokenFromFragment(window.location.hash) : '';
if (!preview && window.location.hash && ['/accept-invitation','/reset-password'].includes(window.location.pathname)) {
  window.history.replaceState(window.history.state, '', window.location.pathname);
}

function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { session } = useDemo();
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) return <NotFound to={session.role === 'CEO' ? '/ceo/dashboard' : '/employee/dashboard'} />;
  return children;
}
function Home() {
  const { session } = useDemo();
  return <Navigate to={session ? session.role === 'CEO' ? '/ceo/dashboard' : '/employee/dashboard' : '/login'} replace />;
}
function AppRoutes() {
  return <Suspense fallback={<div className="loading-page"><LoadingSkeleton label="Loading workspace…" /></div>}><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Auth key="login" />} />
    <Route path="/forgot-password" element={<Auth key="forgot" mode="forgot" />} />
    <Route path="/reset-password" element={<Auth key="reset" mode="reset" />} />
    <Route path="/accept-invitation" element={<Auth key="invitation" mode="invitation" />} />
    <Route path="/session-expired" element={<Auth key="expired" mode="expired" />} />
    {(['CEO', 'Employee'] as const).map(role => <Route key={role} path={role === 'CEO' ? '/ceo' : '/employee'} element={<Guard role={role}><Layout /></Guard>}>
      <Route index element={<Navigate to="dashboard" replace />} />
      {modules.filter(m => m.roles.includes(role)).flatMap(m => {
        const Page = m.Page;
        return [<Route key={m.id} path={m.path} element={<Page />} />, ...(m.details ? [<Route key={`${m.id}-detail`} path={`${m.path}/:id`} element={<Page />} />] : [])];
      })}
      <Route path="*" element={<NotFound />} />
    </Route>)}
    <Route path="*" element={<NotFound />} />
  </Routes></Suspense>;
}
export default function App() {
  if (!preview) return <LiveApp token={setupToken} />;
  return <DemoProvider><BrowserRouter basename="/preview"><AppRoutes /></BrowserRouter></DemoProvider>;
}
