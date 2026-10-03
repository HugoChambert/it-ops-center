import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, STATUSES, PRIORITIES } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import AiPanel from '../components/AiPanel.jsx';
import ReportPanel from '../components/ReportPanel.jsx';
import Field, { inputCls } from '../components/Field.jsx';
import SlaChip from '../components/SlaChip.jsx';

const fmt = (d) => new Date(d).toLocaleString();

function AddEntry({ label, onAdd }) {
  const [m, setM] = useState('');
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (await onAdd(m)) setM(''); }} className="flex gap-2">
      <input aria-label={label} placeholder={label} className={inputCls} value={m} onChange={(e) => setM(e.target.value)} />
      <button className="rounded border border-line bg-white px-3 py-2 text-sm whitespace-nowrap">Add</button>
    </form>
  );
}

export default function IncidentDetail() {
  const { id } = useParams();
  const [i, setI] = useState(null), [err, setErr] = useState(null), [resolution, setResolution] = useState('');
  useEffect(() => { api(`/incidents/${id}`).then((d) => { setI(d); setResolution(d.resolution || ''); }).catch((e) => setErr(e.message)); }, [id]);
  const run = async (path, opts) => {
    try { const d = await api(`/incidents/${id}${path}`, opts); setI(d); setErr(null); return true; }
    catch (e) { setErr(e.message); return false; }
  };
  const patch = (body) => run('', { method: 'PATCH', body });
  if (!i) return err ? <p role="alert" className="text-crit">{err} <Link className="underline" to="/incidents">Back to incidents</Link></p> : <p>Loading incident…</p>;
  const actions = i.events.filter((e) => e.type === 'action');
  const resolved = ['Resolved', 'Closed'].includes(i.status);
  return (
    <div className="space-y-6 max-w-4xl">
      <Link className="text-sm text-brand underline" to="/incidents">Back to incidents</Link>
      <div><h1 className="text-2xl font-semibold">INC-{i.id}: {i.title}</h1>
        <div className="mt-2 flex gap-2"><StatusBadge value={i.priority} /><StatusBadge value={i.status} /></div></div>
      {err && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-crit">{err}</p>}
      <section className="grid gap-4 rounded-lg border border-line bg-white p-4 sm:grid-cols-3">
        <Field label="Status"><select className={inputCls} value={i.status} onChange={(e) => patch({ status: e.target.value, resolution })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Priority"><select className={inputCls} value={i.priority} onChange={(e) => patch({ priority: e.target.value })}>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Assigned technician"><input className={inputCls} defaultValue={i.assignee || ''} onBlur={(e) => e.target.value !== (i.assignee || '') && patch({ assignee: e.target.value })} /></Field>
        <dl className="text-sm sm:col-span-3 grid gap-2 sm:grid-cols-4">
          <div><dt className="text-slate-600">Affected system</dt><dd>{i.system || '—'}</dd></div>
          <div><dt className="text-slate-600">Affected user</dt><dd>{i.affected_user || '—'}</dd></div>
          <div><dt className="text-slate-600">Created</dt><dd>{fmt(i.created_at)}</dd></div>
          <div><dt className="text-slate-600">Updated</dt><dd>{fmt(i.updated_at)}</dd></div>
          <div>
            <dt className="text-slate-600">SLA</dt>
            <dd className="mt-0.5">
              {i.sla
                ? <><SlaChip sla={i.sla} /><span className="ml-1 text-xs text-slate-500">{i.sla.target}</span></>
                : <span className="text-slate-400">—</span>}
            </dd>
          </div>
        </dl>
        {i.description && <p className="text-sm sm:col-span-3">{i.description}</p>}
      </section>
      <AiPanel incidentId={i.id} onRecord={(m) => run('/actions', { method: 'POST', body: { message: m } })} />
      <section className="space-y-2 rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">Resolution</h2>
        <textarea aria-label="Resolution" rows={3} className={inputCls} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="What fixed it?" />
        <button disabled={resolved} onClick={() => patch({ status: 'Resolved', resolution })} className="rounded bg-ok px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{resolved ? `Incident ${i.status.toLowerCase()}` : 'Resolve incident'}</button>
        {resolved && <Link to={`/knowledge/new?incident=${i.id}`} className="ml-3 text-sm text-brand underline">Create knowledge article from this incident</Link>}
      </section>
      <section className="space-y-3 rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">Troubleshooting actions</h2>
        {actions.length === 0 ? <p className="text-sm text-slate-600">No actions recorded yet.</p> : <ul className="list-disc pl-5 text-sm">{actions.map((a) => <li key={a.id}>{a.message}</li>)}</ul>}
        <AddEntry label="Record a troubleshooting action" onAdd={(m) => run('/actions', { method: 'POST', body: { message: m } })} />
      </section>
      <ReportPanel incidentId={i.id} onSaved={() => api(`/incidents/${id}`).then(setI)} />
      <section className="space-y-3 rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">Timeline</h2>
        <ol className="space-y-2 text-sm">{[...i.events].reverse().map((e) => (
          <li key={e.id} className="border-l-2 border-line pl-3"><div className="text-slate-600">{fmt(e.created_at)} · {e.author}</div>
            <div>{e.type === 'note' ? `Note: ${e.message}` : e.type === 'action' ? `Action: ${e.message}` : e.message}</div></li>))}</ol>
        <AddEntry label="Add a note" onAdd={(m) => run('/notes', { method: 'POST', body: { message: m } })} />
      </section>
    </div>
  );
}
