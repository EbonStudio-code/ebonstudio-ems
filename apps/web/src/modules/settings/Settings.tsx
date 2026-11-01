import type { FormEvent } from 'react';
import { Check, LockKeyhole } from 'lucide-react';
import { Button, Card, Field, PageHeader } from '../../components/ui';
import { useWorkspace } from '../../core/store';
import { modules } from '../../core/modules';

export default function Settings() {
  const { data, perform } = useWorkspace();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    perform({ type: 'settings.save', name: String(form.get('name')).trim(), legalName: String(form.get('legalName')).trim(), address: String(form.get('address')).trim() }, 'Demo company settings updated. Published statements keep their existing snapshots.');
  }
  return <><PageHeader title="Company Settings" description="The shared details behind your employee workspace." />
    <div className="two-column"><Card title="Company Information"><form className="stack" onSubmit={submit}>
      <Field label="Company display name"><input name="name" required maxLength={120} defaultValue={data.settings.name} /></Field>
      <Field label="Legal name for statements"><input name="legalName" maxLength={200} defaultValue={data.settings.legalName} /></Field>
      <Field label="Company statement address" hint="Use a fictional business address in this preview."><textarea name="address" maxLength={500} rows={3} defaultValue={data.settings.address} /></Field>
      <Button type="submit">Save company details</Button>
    </form></Card><Card title="Business Calendar and Currency"><div className="stack">
      <Field label="Company timezone"><input value={data.settings.timezone} readOnly /></Field><Field label="Statement currency"><input value={`${data.settings.currency} (sample currency)`} readOnly /></Field><Field label="Working week"><input value="Monday to Friday" readOnly /></Field>
      <div className="inline-alert info"><LockKeyhole size={17} /><span>These sample settings are locked because demo attendance, leave, and salary history already exists. Your real settings will be confirmed before the backend is built.</span></div>
    </div></Card></div>
    <div className="section-heading"><h2>Workspace Modules</h2><span className="muted">All first-release features are enabled</span></div>
    <div className="module-cards">{modules.filter(m => m.roles.includes('CEO') && m.group !== 'Administration').map(module => <div className="module-card" key={module.id}><module.icon size={22} /><strong>{module.title}</strong><span><Check size={14} />Enabled in preview</span></div>)}</div>
    <p className="muted">Modules are registered independently in the frontend. There is no runtime module marketplace or live enable/disable control in this rough build.</p>
  </>;
}
