import { lazy, Suspense, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { CalendarCheck2, CalendarDays, Clock3, LayoutDashboard, ListTodo, LogOut, Menu, MessageSquareText, ReceiptText, ScrollText, Settings2, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import Brand from '../components/Brand';
import { Avatar, Button } from '../components/ui';
import { dateKey, formatDate } from '../core/dates';
import { ApiError } from './api';
import { SessionProvider, useSession } from './state';
import { Dialog, Failure, Loading } from './components';
import Auth, { Security } from './Auth';
import Settings, { AuditPage as Audit } from './Settings';
import './live.css';

const Dashboard=lazy(()=>import('./Dashboard'));
const Employees=lazy(()=>import('./Employees'));
type Module={id:string;path:string;title:string;ceoOnly?:boolean;employeeOnly?:boolean;Page:ComponentType;details?:boolean;core?:boolean};
const modules:Module[]=[
  {id:'dashboard',path:'dashboard',title:'Overview',Page:Dashboard,core:true},
  {id:'employees',path:'employees',title:'Employees',Page:Employees,ceoOnly:true,details:true,core:true},
  {id:'employees',path:'profile',title:'My Profile',Page:Employees,employeeOnly:true,core:true},
  {id:'attendance',path:'attendance',title:'Attendance',Page:lazy(()=>import('./Attendance')),details:true},
  {id:'leave',path:'leave',title:'Leave Requests',Page:lazy(()=>import('./Leave')),details:true},
  {id:'tasks',path:'tasks',title:'Tasks',Page:lazy(()=>import('./Tasks')),details:true},
  {id:'complaints',path:'complaints',title:'Complaints',Page:lazy(()=>import('./Complaints')),details:true},
  {id:'holidays',path:'holidays',title:'Holidays',Page:lazy(()=>import('./Holidays'))},
  {id:'salary-slips',path:'salary-slips',title:'Salary Slips',Page:lazy(()=>import('./Salary')),details:true},
  {id:'company',path:'settings',title:'Company Settings',Page:Settings,ceoOnly:true,core:true},
  {id:'audit',path:'audit',title:'Audit History',Page:Audit,ceoOnly:true,core:true},
  {id:'identity',path:'security',title:'Account Security',Page:Security,core:true},
];
const navigationIcons = {
  dashboard: LayoutDashboard, employees: Users, profile: UserRound, attendance: Clock3,
  leave: CalendarCheck2, tasks: ListTodo, complaints: MessageSquareText, holidays: CalendarDays,
  'salary-slips': ReceiptText, settings: Settings2, audit: ScrollText, security: ShieldCheck,
};
function Missing() {return <div className="not-found"><h1>Page Not Available</h1><p>The record or feature is unavailable for your account.</p><Link to="/">Return to workspace</Link></div>;}
function Guard({role,children}:{role:'CEO'|'EMPLOYEE';children:ReactNode}) {
  const {session,loading,error,authenticate}=useSession();
  if(loading)return <Loading/>;
  if(error)return <Failure error={error} retry={()=>void authenticate()}/>;
  if(!session)return <Navigate to="/login" replace/>;
  if(session.role!==role)return <Missing/>;
  return children;
}
function ModuleGuard({module}:{module:Module}) {
  const {session,ceo}=useSession();
  if((module.ceoOnly&&!ceo)||(module.employeeOnly&&ceo)||(!module.core&&!session?.enabledModules.includes(module.id)))return <Missing/>;
  const Page=module.Page;return <Page/>;
}
function Layout() {
  const {session,company,companyError,ceo,base,logout,notice,notify,refresh,error,loading}=useSession();
  const location=useLocation();
  const [menu,setMenu]=useState(false),[signingOut,setSigningOut]=useState(false),[logoutError,setLogoutError]=useState<unknown>(null);
  const navigation=modules.filter(m=>(!m.ceoOnly||ceo)&&(!m.employeeOnly||!ceo)&&(m.core||session!.enabledModules.includes(m.id)));
  const current=navigation.find(m=>location.pathname.split('/')[2]===m.path);
  const setup=companyError instanceof ApiError&&companyError.code==='COMPANY_NOT_CONFIGURED';
  const Nav=()=> <nav aria-label="Main navigation">{['Workspace','Administration'].map(group=>
    <div className="nav-group" key={group}><span className="nav-label">{group}</span>
      {navigation.filter(m=>(['settings','audit','security'].includes(m.path)?'Administration':'Workspace')===group).map(m=>{
        const Icon=navigationIcons[m.path as keyof typeof navigationIcons];
        return <NavLink key={m.path} to={`${base}/${m.path}`} className={({isActive})=>'nav-item'+(isActive?' active':'')} onClick={()=>setMenu(false)}>
          <Icon size={18} strokeWidth={1.8} aria-hidden="true"/><span>{m.title}</span></NavLink>;
      })}</div>)}</nav>;
  if(error)return <Failure error={error} retry={()=>window.location.reload()}/>;
  if(loading)return <Loading/>;
  return <div className="app-layout live-workspace"><a className="skip-link" href="#main-content">Skip to content</a><aside className="sidebar">
    <div className="brand"><Brand reversed/><span className="brand-caption">EMPLOYEE MANAGEMENT</span></div>
    <Nav/></aside>
    <div className="app-main"><header className="topbar"><div className="topbar-title"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={()=>setMenu(true)}><Menu size={21}/></button>
      <span className="breadcrumb">{ceo?'CEO':'Employee'} workspace<span>/</span><strong>{current?.title||'Workspace'}</strong></span></div>
      <div className="topbar-actions">{company&&current?.path!=='dashboard'&&<span className="today-label">{formatDate(dateKey(new Date(),company.timezone),{weekday:'short',year:undefined})}</span>}<ThemeToggle/>
        <div className="account-identity"><Avatar name={session?.displayName||'Team member'}/><div className="account-name"><strong>{session?.displayName}</strong><small>{ceo?'CEO / Admin':'Team member'}</small></div></div>
        <button className="icon-button" aria-label="Sign out" disabled={signingOut} onClick={async()=>{setSigningOut(true);setLogoutError(null);try{await logout();}catch(e){setLogoutError(e);}finally{setSigningOut(false);}}}><LogOut size={18}/></button></div></header>
      <main id="main-content" tabIndex={-1}>{Boolean(logoutError)&&<Failure error={logoutError}/>}
        {setup?(ceo?<Settings/>:<div className="inline-alert info">The CEO must finish company setup before work can begin.</div>):
          companyError?<Failure error={companyError} retry={refresh}/>:!company?<Loading/>:<Suspense fallback={<Loading/>}><Outlet key={session?.userId+':'+location.pathname}/></Suspense>}</main>
      <footer className="app-footer"><span>Ebon Studio EMS <span aria-hidden="true">/</span> Internal employee workspace</span><span>{company?.timezone} · {company?.currencyCode}</span></footer></div>
    {notice&&<div className="toast success" role="status"><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={()=>notify('')}><X size={17}/></button></div>}
    {menu&&<Dialog title="Navigation" close={()=>setMenu(false)}><Nav/><Button variant="secondary" onClick={()=>setMenu(false)}>Close navigation</Button></Dialog>}
  </div>;
}
function Home() {const {session,loading,error,authenticate,base}=useSession();return loading?<Loading/>:error?<Failure error={error} retry={()=>void authenticate()}/>:<Navigate to={session?base+'/dashboard':'/login'} replace/>;}
export default function LiveApp({token}:{token:string}) {
  return <SessionProvider><BrowserRouter><Suspense fallback={<Loading/>}><Routes><Route path="/" element={<Home/>}/>
    <Route path="/login" element={<Auth key="login"/>}/><Route path="/forgot-password" element={<Auth key="forgot" mode="forgot"/>}/>
    <Route path="/reset-password" element={<Auth key="reset" mode="reset" initialToken={token}/>}/><Route path="/accept-invitation" element={<Auth key="invitation" mode="invitation" initialToken={token}/>}/>
    <Route path="/session-expired" element={<Navigate to="/login" replace/>}/>
    {(['CEO','EMPLOYEE'] as const).map(role=><Route key={role} path={role==='CEO'?'/ceo':'/employee'} element={<Guard role={role}><Layout/></Guard>}>
      <Route index element={<Navigate to="dashboard" replace/>}/>{modules.map(m=><Route key={m.path} path={m.path+(m.details?'/:id?':'')} element={<ModuleGuard module={m}/>}/>)}<Route path="*" element={<Missing/>}/>
    </Route>)}<Route path="*" element={<Missing/>}/></Routes></Suspense></BrowserRouter></SessionProvider>;
}
