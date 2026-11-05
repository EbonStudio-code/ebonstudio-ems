import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, LogOut, Menu, RotateCcw, X } from 'lucide-react';
import { modules } from '../core/modules';
import { useWorkspace } from '../core/store';
import { formatDate, dateKey } from '../core/dates';
import { Avatar, Button, Confirm, Modal } from './ui';
import ThemeToggle from './ThemeToggle';
import Brand from './Brand';

export default function Layout() {
  const { data, session, ceo, base, person, enter, demoPeople, notice, dismissNotice, reset } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const navigation = modules.filter(m => m.roles.includes(session!.role));
  const current = navigation.find(m => location.pathname.split('/')[2] === m.path);
  const name = ceo ? 'CEO' : person?.name ?? 'Employee';
  function changeRole(role: 'CEO' | 'Employee', employeeId = demoPeople[0]?.id ?? '') {
    enter({ role, employeeId });
    navigate(role === 'CEO' ? '/ceo/dashboard' : '/employee/dashboard');
  }
  function NavContent({ close }: { close?: () => void }) {
    return <nav aria-label="Main navigation">{(['Workspace', 'Administration'] as const).map(group =>
      <div className="nav-group" key={group}><span className="nav-label">{group}</span>
        {navigation.filter(m => (m.group ?? 'Workspace') === group).map(m =>
          <NavLink key={m.id} to={`${base}/${m.path}`} onClick={close} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <m.icon size={18} strokeWidth={1.8} /><span>{!ceo && m.employeeTitle ? m.employeeTitle : m.title}</span>
            {m.id === 'leave' && data.leaves.filter(l => l.status === 'Pending').length > 0 && <span className="nav-count">{data.leaves.filter(l => l.status === 'Pending').length}</span>}
          </NavLink>)}
      </div>)}</nav>;
  }
  return <div className="app-layout">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">
      <div className="brand"><Brand reversed /><span className="brand-caption">Employee Management</span></div>
      <NavContent />
      <div className="sidebar-footer"><small>Fictional records · preview only</small></div>
    </aside>
    <div className="app-main">
      <header className="topbar">
        <div className="topbar-title"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMenu(true)}><Menu size={21} /></button>
          <span className="breadcrumb"><span>{ceo ? 'CEO Workspace' : 'Employee Workspace'}</span><span aria-hidden="true">/</span><strong>{current?.title ?? 'Workspace'}</strong></span></div>
        <div className="topbar-actions">{current?.path !== 'dashboard' && <span className="today-label">{formatDate(dateKey(new Date(), data.settings.timezone), { weekday: 'short', year: undefined })}</span>}
          <ThemeToggle />
          <div className="account-identity"><Avatar name={name} /><div className="account-name"><strong>{name}</strong><small>{ceo ? 'Admin / CEO' : person?.jobTitle}</small></div></div>
          <button className="icon-button" aria-label="Sign out of preview" onClick={() => { enter(null); navigate('/login'); }}><LogOut size={18} /></button>
        </div>
      </header>
      <div className="demo-bar">
        <div><span className="demo-dot" /><strong>Demo mode</strong><span className="demo-explanation">Fictional data only. No backend or real sign-in.</span></div>
        <div className="demo-controls"><ArrowLeftRight size={15} /><select aria-label="Preview role" value={session?.role} onChange={e => changeRole(e.target.value as 'CEO' | 'Employee')}>
          <option value="CEO">CEO / Admin</option><option value="Employee">Employee</option></select>
          {!ceo && <select aria-label="Preview employee" value={session?.employeeId} onChange={e => changeRole('Employee', e.target.value)}>{demoPeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
          <button className="reset-button" onClick={() => setResetOpen(true)}><RotateCcw size={14} />Reset demo</button>
        </div>
      </div>
      <main id="main-content" tabIndex={-1}><Outlet /></main>
      <footer className="app-footer"><span>Frontend prototype. Do not enter real employee or salary data.</span><span>Sample settings: {data.settings.timezone} · {data.settings.currency}</span></footer>
    </div>
    {notice && <div className={`toast ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}><span>{notice.message}</span><button className="icon-button" aria-label="Dismiss message" onClick={dismissNotice}><X size={17} /></button></div>}
    {menu && <Modal title="Navigation" onClose={() => setMenu(false)}><NavContent close={() => setMenu(false)} /><Button variant="secondary" onClick={() => setMenu(false)}>Close navigation</Button></Modal>}
    {resetOpen && <Confirm title="Reset the Demo Workspace?" description="This removes only this prototype's browser-saved sample changes and restores the original fictional records." confirmLabel="Reset sample data" onClose={() => setResetOpen(false)} onConfirm={() => { reset(); navigate('/ceo/dashboard'); return true; }} />}
  </div>;
}
