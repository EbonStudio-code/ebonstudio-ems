import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button, Field } from '../../components/ui';
import { useDemo } from '../../core/store';
import type { Role } from '../../core/models';
import ThemeToggle from '../../components/ThemeToggle';
import { usePageTitle } from '../../core/usePageTitle';
import AuthStory from '../../components/AuthStory';

type Mode = 'login' | 'forgot' | 'reset' | 'invitation' | 'expired';
export default function Auth({ mode = 'login' }: { mode?: Mode }) {
  const { enter, demoPeople } = useDemo();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role>('CEO');
  const [employeeId, setEmployeeId] = useState(demoPeople[0]?.id ?? '');
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const isPassword = mode === 'reset' || mode === 'invitation';
  const validToken = params.get('token') === 'demo';
  const titles = { login: 'Welcome to Your Workspace', forgot: 'Forgot Your Password?', reset: 'Choose a New Password', invitation: 'You Are Invited', expired: 'Your Session Has Expired' };
  usePageTitle(titles[mode]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (mode === 'login') {
      enter({ role, employeeId });
      navigate(role === 'CEO' ? '/ceo/dashboard' : '/employee/dashboard');
    } else if (isPassword) {
      const fields = new FormData(event.currentTarget);
      if (String(fields.get('password')).length < 12) return setError('Use at least 12 characters for this form preview.');
      if (fields.get('password') !== fields.get('confirm')) return setError('Passwords do not match.');
      event.currentTarget.reset(); setDone(true);
    } else setDone(true);
  }
  return <div className="auth-layout"><AuthStory preview /><main className="auth-main"><div className="auth-card">
    <div className="auth-card-tools"><span className="preview-pill">INTERACTIVE FRONTEND DEMO</span><ThemeToggle /></div><h1>{titles[mode]}</h1>
    <p className="muted">{mode === 'login' ? 'Explore the Ebon Studio EMS with fictional records. Choose a role to get started.' : 'This is a visual flow preview. No account, email, session security, or password is changed.'}</p>
    {error && <div className="inline-alert error" role="alert">{error}</div>}
    {done ? <div className="success-panel"><CheckCircle2 size={32} /><h3>Form Preview Complete</h3><p>{mode === 'forgot' ? 'No recovery email was sent. Open the demo link below to review the reset form.' : 'No password was stored and no real account was changed.'}</p>
      {mode === 'forgot' && <Link className="button secondary" to="/reset-password?token=demo">Preview password reset</Link>}<Link className="text-link" to="/login">Back to sign in</Link></div>
      : mode === 'expired' ? <div className="stack"><p className="muted">In the connected application, you would sign in again. This screen demonstrates that state only.</p><Button onClick={() => { enter(null); navigate('/login'); }}>Return to sign in</Button></div>
      : isPassword && !validToken ? <div className="stack"><div className="inline-alert warning">This preview link is invalid or expired.</div><Link className="button secondary" to={mode === 'reset' ? '/reset-password?token=demo' : '/accept-invitation?token=demo'}>Open valid demo link</Link><Link to="/login">Back to sign in</Link></div>
      : <form onSubmit={submit} className="stack">
        {mode === 'login' && <>
          <Field label="Preview as"><select value={role} onChange={e => setRole(e.target.value as Role)}><option>CEO</option><option>Employee</option></select></Field>
          {role === 'Employee' && <Field label="Demo employee"><select value={employeeId} onChange={e => setEmployeeId(e.target.value)}>{demoPeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
          <Field label="Demo work email"><input type="email" readOnly value={role === 'CEO' ? 'ceo@example.test' : demoPeople.find(p => p.id === employeeId)?.email ?? ''} /></Field>
          <Field label="Password (visual preview only)" hint="Not validated or saved. Do not enter a real password."><div className="password-field"><input type={show ? 'text' : 'password'} placeholder="No password needed for the demo" autoComplete="off" /><button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></Field>
          <Link className="text-link" to="/forgot-password">Forgot password?</Link>
        </>}
        {mode === 'forgot' && <Field label="Demo work email"><input name="email" type="email" placeholder="name@example.test" required /></Field>}
        {isPassword && <><Field label="New demo password" hint="Use a made-up passphrase, at least 12 characters."><input type="password" name="password" minLength={12} maxLength={128} required autoComplete="off" /></Field><Field label="Confirm demo password"><input type="password" name="confirm" minLength={12} required autoComplete="off" /></Field></>}
        <Button type="submit" className="full-width">{mode === 'login' ? `Open ${role} preview` : mode === 'forgot' ? 'Preview recovery request' : 'Complete form preview'}<ArrowRight size={17} /></Button>
      </form>}
    <div className="auth-links">{mode === 'login' ? <><Link to="/accept-invitation?token=demo">Preview invitation</Link><Link to="/session-expired">Preview expired session</Link></> : <Link to="/login">Back to sign in</Link>}</div>
    <p className="auth-disclaimer">Demo records are saved in this browser. Role switching is for review only, not real access control.</p>
  </div></main></div>;
}
