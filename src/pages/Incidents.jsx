import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, STATUSES, PRIORITIES } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Field, { inputCls } from '../components/Field.jsx';

function NewIncident({ systems, onCancel }) {
  const nav = useNavigate();
  const [f, setF] = useState({ title: '', description: '', priority: 'Medium', system_id: '', affected_user: '', assignee: '' });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  useEffect(() => { api('/settings').then((d) => setF((p) => ({ ...p, priority: d.settings.default_priority }))).catch(() => {}); }, []);
  const submit = async (e) => {
    e.preventDefault();
    try { const i = await api('/incidents', { method: 'POST', body: { ...f, system_id: f.system_id ? Number(f.system_id) : null } }); nav(`/incidents/${i.id}`); }
    catch (x) { setErr(x.message); }
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-line bg-white p-4 max-w-2xl">
      <h2 className="font-semibold">New incident</h2>
      {err && <p role="alert" className="text-crit text-sm">{err}</p>}
      <Field label="Title"><input className={inputCls} value={f.title} onChange={set('title')} required /></Field>
      <Field label="Description"><textarea className={inputCls} rows={3} value={f.description} onChange={set('description')} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Priority"><select className={inputCls} value={f.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Affected system"><select className={inputCls} value={f.system_id} onChange={set('system_id')}><option value="">None</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Affected user"><input className={inputCls} value={f.affected_user} onChange={set('affected_user')} /></Field>
        <Field label="Assigned technician"><input className={inputCls} value={f.assignee} onChange={set('assignee')} /></Field>
      </div>
      <div className="flex gap-2">
        <button className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">Create incident</button>
        <button type="button" onClick={onCancel} className="rounded border border-line px-4 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

export default function Incidents() {
  const [rows, setRows] = useState(null), [systems, setSystems] = useState([]), [err, setErr] = useState(null);
  const [q, setQ] = useState(''), [status, setStatus] = useState(''), [priority, setPriority] = useState(''), [adding, setAdding] = useState(false);
  useEffect(() => { api('/systems').then(setSystems).catch(() => {}); }, []);
  useEffect(() => {
    const qs = new URLSearchParams(Object.entries({ q, status, priority }).filter(([, v]) => v)).toString();
    api(`/incidents${qs ? `?${qs}` : ''}`).then((d) => { setRows(d); setErr(null); }).catch((e) => setErr(e.message));
  }, [q, status, priority]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Incidents</h1>
        {!adding && <button onClick={() => setAdding(true)} className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">New incident</button>}</div>
      {adding && <NewIncident systems={systems} onCancel={() => setAdding(false)} />}
      <div className="flex flex-wrap gap-3">
        <input aria-label="Search incidents" placeholder="Search title or description" className={`${inputCls} sm:w-72`} value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filter by status" className={`${inputCls} sm:w-44`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Filter by priority" className={`${inputCls} sm:w-44`} value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">All priorities</option>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      {err && <p role="alert" className="text-crit">Could not load incidents: {err}</p>}
      {rows && <div className="overflow-x-auto rounded-lg border border-line bg-white"><table className="w-full text-left text-sm">
        <thead className="text-slate-600"><tr><th className="p-3">ID</th><th>Title</th><th>System</th><th>Assigned</th><th>Priority</th><th>Status</th></tr></thead>
        <tbody>{rows.map((i) => (<tr key={i.id} className="border-t border-line">
          <td className="p-3">INC-{i.id}</td><td><Link className="text-brand underline" to={`/incidents/${i.id}`}>{i.title}</Link></td>
          <td>{i.system || '—'}</td><td>{i.assignee || 'Unassigned'}</td><td><StatusBadge value={i.priority} /></td><td><StatusBadge value={i.status} /></td></tr>))}</tbody>
      </table>{rows.length === 0 && <p className="p-4 text-sm text-slate-600">No incidents match these filters. Clear a filter or create a new incident.</p>}</div>}
    </div>
  );
}
