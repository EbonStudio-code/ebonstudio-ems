import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, Plus, Search } from 'lucide-react';
import { BackLink, Badge, Button, Card, Empty, Field, FormActions, Modal, NotFound, PageHeader, Pagination, Person, Table, usePagination } from '../../components/ui';
import { useWorkspace } from '../../core/store';
import { dateKey, formatDate } from '../../core/dates';
import { taskStatuses } from '../../core/models';
import type { Task } from '../../core/models';

function TaskEditor({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { data, perform } = useWorkspace();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (perform({ type: 'task.save', id: task?.id, values: {
      title: String(form.get('title')).trim(), description: String(form.get('description')).trim(),
      assigneeId: String(form.get('assigneeId')), priority: String(form.get('priority')) as Task['priority'], dueDate: String(form.get('dueDate')),
    } }, task ? 'Demo task updated.' : 'Demo task assigned.')) onClose();
  }
  return <Modal title={task ? 'Edit Task' : 'Assign a Task'} onClose={onClose}><form onSubmit={submit}><div className="form-grid">
    <Field label="Task title" wide><input name="title" required maxLength={120} defaultValue={task?.title} placeholder="What needs to be done?" /></Field>
    <Field label="Description" wide><textarea name="description" maxLength={5000} rows={4} defaultValue={task?.description} /></Field>
    <Field label="Assign to"><select name="assigneeId" required defaultValue={task?.assigneeId}>{data.employees.filter(e => e.status === 'Active').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
    <Field label="Priority"><select name="priority" defaultValue={task?.priority ?? 'Normal'}><option>Low</option><option>Normal</option><option>High</option></select></Field>
    <Field label="Due date (optional)" wide><input name="dueDate" type="date" defaultValue={task?.dueDate} /></Field>
  </div><FormActions onCancel={onClose} submitLabel={task ? 'Save task' : 'Assign task'} /></form></Modal>;
}

export default function Tasks() {
  const { id } = useParams();
  const { data, ceo, base, perform } = useWorkspace();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [editing, setEditing] = useState<Task | null | undefined>();
  const today = dateKey(new Date(), data.settings.timezone);
  const filtered = data.tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) && (!status || t.status === status) && (!priority || t.priority === priority));
  const pagination = usePagination(filtered);
  const selected = data.tasks.find(t => t.id === id);
  const editor = editing !== undefined && <TaskEditor task={editing} onClose={() => setEditing(undefined)} />;
  if (id) {
    if (!selected) return <NotFound to={`${base}/tasks`} />;
    return <><BackLink to={`${base}/tasks`}>All tasks</BackLink><PageHeader title={selected.title} description="Task details, ownership, and progress." actions={ceo && <Button variant="secondary" onClick={() => setEditing(selected)}><Pencil size={16} />Edit task</Button>} />
      <div className="two-column"><Card title="About This Task"><p className="preserve-lines">{selected.description || 'No description provided.'}</p><div className="divider" /><div className="inline"><Badge>{selected.status}</Badge><Badge>{selected.priority}</Badge></div></Card>
        <Card title="Assignment and Progress"><dl className="detail-grid"><dt>Assigned to</dt><dd>{data.employees.find(e => e.id === selected.assigneeId)?.name}</dd><dt>Due date</dt><dd>{selected.dueDate ? formatDate(selected.dueDate) : 'No due date'}</dd><dt>Priority</dt><dd>{selected.priority}</dd></dl>
          <Field label="Task status" hint={!ceo ? 'You can update progress, but not change the assignment.' : undefined}><select value={selected.status} disabled={!ceo && selected.status === 'Cancelled'} onChange={e => perform({ type: 'task.status', id: selected.id, status: e.target.value as Task['status'] }, 'Demo task status updated.')}>
            {taskStatuses.filter(s => ceo || s !== 'Cancelled' || selected.status === 'Cancelled').map(s => <option key={s}>{s}</option>)}</select></Field>
        </Card></div>{editor}
    </>;
  }
  return <><PageHeader title={ceo ? 'Tasks' : 'My Tasks'} description={ceo ? 'Keep work clear, assigned, and moving forward.' : 'Your assigned work and what to focus on next.'} actions={ceo && <Button onClick={() => setEditing(null)}><Plus size={17} />Assign task</Button>} />
    <div className="summary-strip">{taskStatuses.slice(0, 3).map(s => <span key={s}><strong>{data.tasks.filter(t => t.status === s).length}</strong>{s}</span>)}</div>
    <Card><div className="toolbar"><div className="search-field"><Search size={17} /><input aria-label="Search tasks" placeholder="Search tasks..." value={search} onChange={e => { setSearch(e.target.value); pagination.setPage(1); }} /></div>
      <select aria-label="Filter task status" value={status} onChange={e => { setStatus(e.target.value); pagination.setPage(1); }}><option value="">All statuses</option>{taskStatuses.map(s => <option key={s}>{s}</option>)}</select>
      <select aria-label="Filter task priority" value={priority} onChange={e => { setPriority(e.target.value); pagination.setPage(1); }}><option value="">All priorities</option><option>Low</option><option>Normal</option><option>High</option></select></div>
      {filtered.length ? <Table headings={['Task', ...(ceo ? ['Assigned to'] : []), 'Priority', 'Due date', 'Status', 'Action']}>{pagination.rows.map(task => <tr key={task.id}><td><Link className="table-title" to={`${base}/tasks/${task.id}`}>{task.title}</Link></td>
        {ceo && <td><Person name={data.employees.find(e => e.id === task.assigneeId)?.name ?? 'Employee'} /></td>}<td><Badge>{task.priority}</Badge></td><td>{task.dueDate ? formatDate(task.dueDate) : 'No date'}{task.dueDate && task.dueDate < today && !['Done', 'Cancelled'].includes(task.status) && <small className="danger-text">Overdue</small>}</td><td><Badge>{task.status}</Badge></td><td><Link className="text-link" to={`${base}/tasks/${task.id}`}>View task</Link></td></tr>)}</Table> : <Empty title="No Matching Tasks" description="Try changing the filters, or assign a new task." />}
      <Pagination {...pagination} onChange={pagination.setPage} />
    </Card>{editor}
  </>;
}
