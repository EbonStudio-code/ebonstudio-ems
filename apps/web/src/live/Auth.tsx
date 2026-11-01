import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Field } from '../components/ui';
import ThemeToggle from '../components/ThemeToggle';
import { usePageTitle } from '../core/usePageTitle';
import { api } from './api';
import { useSession } from './state';
import { AsyncForm, Failure, Loading, value } from './components';
import AuthStory from '../components/AuthStory';

export default function Auth({ mode = 'login', initialToken = '' }: {mode?: 'login' | 'forgot' | 'reset' | 'invitation'; initialToken?: string}) {
  const { session, authenticate, base, loading, error } = useSession();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [token, setToken] = useState(initialToken);
  const passwordFlow = mode === 'reset' || mode === 'invitation';
  const title = {login: 'Welcome to Your Workspace', forgot: 'Forgot Your Password?', reset: 'Choose a New Password', invitation: 'Set Up Your Account'}[mode];
  usePageTitle(title);
  if (loading) return <Loading />;
  if (error) return <Failure error={error} retry={() => void authenticate()} />;
  if (session && mode === 'login') return <Navigate to={base + '/dashboard'} replace />;
  return <div className="auth-layout"><AuthStory />
    <main className="auth-main"><div className="auth-card"><div className="auth-card-tools"><span className="preview-pill">TEAM MEMBER ACCESS</span><ThemeToggle /></div>
      <h1>{title}</h1><p className="muted">{passwordFlow ? 'Choose a private passphrase, 12–128 characters. This link can be used once.' : mode === 'forgot' ? 'We will send instructions if your account is eligible.' : 'Welcome back to Ebon Studio. Sign in with your invited work account.'}</p>
      {done ? <div className="success-panel"><h3>{mode === 'forgot' ? 'Request Received' : 'Password Saved'}</h3><p>{mode === 'forgot' ? 'If an eligible account exists, recovery instructions will be sent. Check with your administrator if delivery is unavailable.' : 'Sign in with your new password to continue.'}</p><Link className="button primary" to="/login">Back to sign in</Link></div>
        : passwordFlow && !token ? <div className="stack"><div role="alert" className="inline-alert warning">This setup link is missing or invalid. Reopen the full link from your email. Invitation links can be resent by the CEO.</div><Link to="/forgot-password">Request password recovery</Link><Link to="/login">Back to sign in</Link></div>
        : <AsyncForm label={mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Request recovery' : 'Save password'} submit={async form => {
          if (mode === 'login') {
            await api.request('/auth/login', 'POST', { email: value(form, 'email'), password: String(form.get('password')) });
            await authenticate(true); navigate('/', {replace: true});
          } else if (mode === 'forgot') {
            await api.request('/auth/forgot-password', 'POST', {email: value(form, 'email')}); setDone(true);
          } else {
            const password = String(form.get('password'));
            if (password.length < 12 || password.length > 128) throw new Error('Use a password with 12–128 characters.');
            if (password !== form.get('confirm')) throw new Error('Passwords do not match.');
            await api.request(mode === 'reset' ? '/auth/reset-password' : '/auth/accept-invitation', 'POST', {token, newPassword: password});
            api.clear(); setToken(''); setDone(true);
          }
        }}>
          {!passwordFlow && <Field label="Work email"><input name="email" type="email" autoComplete="username" placeholder="Your work email" required maxLength={254} /></Field>}
          {mode === 'login' && <Field label="Password"><input name="password" type="password" autoComplete="current-password" required maxLength={128} /></Field>}
          {passwordFlow && <><Field label="New password"><input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></Field>
            <Field label="Confirm password"><input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></Field></>}
        </AsyncForm>}
      <div className="auth-links">{mode === 'login' ? <Link to="/forgot-password">Forgot password?</Link> : <Link to="/login">Back to sign in</Link>}
        <a href="/preview/login">Open fictional demo</a></div>
      <p className="auth-disclaimer">Your browser stores only a protected session cookie, not account passwords or private records.</p>
    </div></main></div>;
}
export function Security() {
  const { authenticate, notify } = useSession();
  usePageTitle('Account Security');
  return <><h1>Account Security</h1><p className="muted">Changing your password signs out other sessions and rotates this one.</p>
    <div className="card"><div className="card-body"><AsyncForm label="Change password" submit={async form => {
      const password = String(form.get('newPassword'));
      if (password.length < 12 || password.length > 128) throw new Error('Use a password with 12–128 characters.');
      if (password !== form.get('confirm')) throw new Error('Passwords do not match.');
      await api.request('/auth/change-password', 'POST', {currentPassword: String(form.get('currentPassword')), newPassword: password});
      await authenticate(true); notify('Password changed. Other sessions were revoked.');
    }}>
      <Field label="Current password"><input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required /></Field>
      <Field label="New password"><input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></Field>
      <Field label="Confirm password"><input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></Field>
    </AsyncForm></div></div></>;
}
