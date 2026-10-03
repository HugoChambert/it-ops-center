import { useEffect, useState } from 'react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="text-sm text-slate-600">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${tone || ''}`}>{value}</div>
    </div>
  );
}
function Trend({ data }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.resolved]));
  const x = (i) => 20 + i * (260 / (data.length - 1)), y = (v) => 100 - (v / max) * 80;
  const line = (k) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[k])}`).join(' ');
  return (
    <figure>
      <svg viewBox="0 0 300 120" className="w-full" role="img" aria-label="Incidents created and resolved over the last 7 days">
        <path d={line('created')} fill="none" stroke="#1f5fbf" strokeWidth="2" />
        <path d={line('resolved')} fill="none" stroke="#1b6b3a" strokeWidth="2" strokeDasharray="4 3" />
      </svg>
      <figcaption className="text-xs text-slate-600"><span className="text-brand">Solid: created</span> · <span className="text-ok">Dashed: resolved</span> · last 7 days</figcaption>
    </figure>
  );
}
export default function Dashboard() {
  const [s, setS] = useState(null), [err, setErr] = useState(null);
  useEffect(() => { api('/dashboard').then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <p role="alert" className="text-crit">Could not load the dashboard: {err}. Check that the API is running on port 3001.</p>;
  if (!s) return <p>Loading dashboard…</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Operations dashboard</h1>
      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Open incidents" value={s.openIncidents} />
        <Stat label="Critical" value={s.criticalIncidents} tone="text-crit" />
        <Stat label="Overdue" value={s.overdueIncidents} tone="text-crit" />
        <Stat label="Resolved today" value={s.resolvedToday} tone="text-ok" />
        <Stat label="Systems monitored" value={s.systemsMonitored} />
        <Stat label="Uptime" value={`${s.uptimePercent}%`} />
      </section>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-line bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Recent incidents</h2>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="text-slate-600"><tr><th className="py-1">Title</th><th>System</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>{s.recentIncidents.map((i) => (
              <tr key={i.id} className="border-t border-line"><td className="py-2 pr-2">{i.title}</td><td>{i.system || '—'}</td>
                <td><StatusBadge value={i.priority} /></td><td><StatusBadge value={i.status} /></td></tr>))}</tbody>
          </table></div>
        </section>
        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-3 font-semibold">Active alerts</h2>
          {s.activeAlerts.length === 0 ? <p className="text-sm text-slate-600">No systems need attention.</p> :
            <ul className="space-y-2 text-sm">{s.activeAlerts.map((a) => (
              <li key={a.name} className="flex justify-between"><span>{a.name}</span><StatusBadge value={a.status} /></li>))}</ul>}
        </section>
      </div>
      <section className="rounded-lg border border-line bg-white p-4 max-w-xl"><h2 className="mb-3 font-semibold">Incident trend</h2><Trend data={s.trend} /></section>
    </div>
  );
}
