import { useState } from 'react';
import type { FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Card, Field, PageHeader } from '../../components/ui';
import { useWorkspace } from '../../core/store';

export default function Security() {
  const { ceo, person } = useWorkspace();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    if (form.get('newPassword') !== form.get('confirmPassword')) return setError('The new passwords do not match.');
    event.currentTarget.reset();
    setMessage('Form preview completed. No password was stored or changed, and no sessions were revoked.');
  }
  return <><PageHeader title="Account Security" description="Review the account and password-management screens." />
    <div className="two-column"><Card title="Change Password"><div className="inline-alert info">Frontend only. Use made-up values. Current passwords cannot be verified without the backend.</div>
      <form className="stack" onSubmit={submit}>{error && <p role="alert" className="field-error">{error}</p>}{message && <p role="status" className="inline-alert success">{message}</p>}
        <Field label="Current demo password"><input type="password" name="currentPassword" required autoComplete="off" /></Field>
        <Field label="New demo password" hint="At least 12 characters. Never enter your real password here."><input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="off" /></Field>
        <Field label="Confirm new demo password"><input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="off" /></Field>
        <Button type="submit">Preview password update</Button>
      </form></Card>
      <div className="stack"><Card title="Your Preview Account"><div className="detail-grid"><span>Name</span><strong>{ceo ? 'CEO' : person?.name}</strong><span>Role</span><strong>{ceo ? 'CEO / Admin' : 'Employee'}</strong><span>Email</span><strong>{ceo ? 'ceo@example.test' : person?.email}</strong></div></Card>
      <Card title="Backend Security Comes Next"><ShieldCheck className="feature-icon" size={30} /><p className="muted">Secure sessions, password hashing, account recovery, rate limits, and server-side permissions are planned. None are implemented by this frontend preview.</p></Card></div>
    </div></>;
}
