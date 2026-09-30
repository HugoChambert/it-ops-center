import { useEffect, useState } from 'react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

const level = (v) => (v >= 90 ? ['bg-crit', 'critical'] : v >= 75 ? ['bg-warn', 'high'] : ['bg-ok', 'normal']);

function Meter({ label, value, down }) {
  const [color, word] = level(value);
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span>{down ? '—' : `${value}%${word !== 'normal' ? ` (${word})` : ''}`}</span></div>
      <div className="mt-1 h-2 rounded bg-slate-200" role="img" aria-label={`${label} ${down ? 'not available' : `${value}%, ${word}`}`}>
        {!down && <div className={`h-2 rounded ${color}`} style={{ width: `${value}%` }} />}
      </div>
    </div>
  );
}
function ago(iso) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export default function Systems() {
  const [rows, setRows] = useState(null), [err, setErr] = useState(null), [status, setStatus] = useState('');
  useEffect(() => { api('/systems').then(setRows).catch((e) => setErr(e.message)); }, []);
  if (err) return <p role="alert" className="text-crit">Could not load systems: {err}</p>;
  if (!rows) return <p>Loading systems…</p>;
  const shown = status ? rows.filter((s) => s.status === status) : rows;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Systems</h1>
        <select aria-label="Filter by status" className="rounded border border-line bg-white px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option>Healthy</option><option>Degraded</option><option>Down</option>
        </select>
      </div>
      {shown.length === 0 && <p className="text-sm text-slate-600">No systems have this status.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((s) => (
          <section key={s.id} aria-label={s.name} className="space-y-3 rounded-lg border border-line bg-white p-4">
            <div className="flex items-start justify-between">
              <div><h2 className="font-semibold">{s.name}</h2><div className="text-sm text-slate-600">{s.type}</div></div>
              <StatusBadge value={s.status} />
            </div>
            <Meter label="CPU" value={s.cpu} down={s.status === 'Down'} />
            <Meter label="Memory" value={s.memory} down={s.status === 'Down'} />
            <Meter label="Disk" value={s.disk} />
            <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
              <div><dt className="text-slate-600">Uptime</dt><dd>{s.uptime_days} days</dd></div>
              <div><dt className="text-slate-600">Open incidents</dt><dd>{s.open_incidents}</dd></div>
              <div><dt className="text-slate-600">Last checked</dt><dd>{ago(s.last_checked)}</dd></div>
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
