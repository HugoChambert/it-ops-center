import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

// ---------------------------------------------------------------------------
// Stat card icons — aria-hidden inline SVGs, currentColor strokes
// ---------------------------------------------------------------------------
const ICONS = {
  open: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v4l2.5 2.5" />
    </svg>
  ),
  critical: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3 2 17h16L10 3Z" />
      <path d="M10 9v4M10 15h.01" />
    </svg>
  ),
  overdue: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 6v5h4" />
      <path d="M3.5 3.5l13 13" />
    </svg>
  ),
  resolved: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8" />
      <path d="M7 10l2 2 4-4" />
    </svg>
  ),
  systems: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="16" height="10" rx="2" />
      <path d="M6 9h.01M6 11h.01M10 9h5M10 11h5" />
    </svg>
  ),
  uptime: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14l4-5 4 3 4-7 3 4" />
    </svg>
  ),
};

function Stat({ label, value, tone, icon }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${tone || 'text-slate-500'}`}>
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${tone || 'text-ink'}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend chart — enlarged, with grid, day labels, value dots, data table
// All colours reference CSS custom properties so no hard-coded hex here
// ---------------------------------------------------------------------------
function Trend({ data }) {
  const W = 500, H = 160, PAD_L = 28, PAD_R = 12, PAD_T = 12, PAD_B = 36;
  const IW = W - PAD_L - PAD_R;
  const IH = H - PAD_T - PAD_B;

  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.resolved]));
  // Round up to nearest 2 for clean gridlines
  const gridMax = Math.max(2, Math.ceil(max / 2) * 2);
  const GRID_STEPS = 4; // 0, 25%, 50%, 75%, 100%

  const x = (i) => PAD_L + i * (IW / (data.length - 1));
  const y = (v) => PAD_T + IH - (v / gridMax) * IH;

  const linePath = (key) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Incidents created and resolved over the last 7 days"
      >
        {/* Horizontal grid lines */}
        {Array.from({ length: GRID_STEPS + 1 }, (_, i) => {
          const val = (gridMax * i) / GRID_STEPS;
          const yPos = y(val);
          return (
            <g key={i}>
              <line x1={PAD_L} y1={yPos} x2={W - PAD_R} y2={yPos} stroke="var(--color-line)" strokeWidth="1" />
              <text x={PAD_L - 4} y={yPos + 3.5} fontSize="8" textAnchor="end" fill="var(--color-line)">
                {val}
              </text>
            </g>
          );
        })}

        {/* Created line */}
        <path d={linePath('created')} fill="none" stroke="var(--color-brand)" strokeWidth="2" />
        {/* Resolved line */}
        <path d={linePath('resolved')} fill="none" stroke="var(--color-ok)" strokeWidth="2" strokeDasharray="5 3" />

        {/* Value dots + labels on created line */}
        {data.map((d, i) => (
          <g key={`c-${i}`}>
            <circle cx={x(i)} cy={y(d.created)} r="3" fill="var(--color-brand)" />
            {d.created > 0 && (
              <text x={x(i)} y={y(d.created) - 6} fontSize="8.5" textAnchor="middle" fill="var(--color-brand)">
                {d.created}
              </text>
            )}
          </g>
        ))}

        {/* Value dots + labels on resolved line */}
        {data.map((d, i) => (
          <g key={`r-${i}`}>
            <circle cx={x(i)} cy={y(d.resolved)} r="3" fill="var(--color-ok)" />
            {d.resolved > 0 && (
              <text x={x(i)} y={y(d.resolved) - 6} fontSize="8.5" textAnchor="middle" fill="var(--color-ok)">
                {d.resolved}
              </text>
            )}
          </g>
        ))}

        {/* X-axis day labels */}
        {data.map((d, i) => (
          <text
            key={`l-${i}`}
            x={x(i)}
            y={H - PAD_B + 14}
            fontSize="8.5"
            textAnchor="middle"
            fill="var(--color-line)"
          >
            {d.date.slice(5)}
          </text>
        ))}

        {/* Baseline */}
        <line x1={PAD_L} y1={PAD_T + IH} x2={W - PAD_R} y2={PAD_T + IH} stroke="var(--color-line)" strokeWidth="1" />
      </svg>

      {/* Legend */}
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <svg aria-hidden="true" viewBox="0 0 20 4" className="h-1 w-5"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--color-brand)" strokeWidth="2" /></svg>
          <span className="text-brand font-medium">Created</span>
        </span>
        <span className="flex items-center gap-1.5">
          <svg aria-hidden="true" viewBox="0 0 20 4" className="h-1 w-5"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--color-ok)" strokeWidth="2" strokeDasharray="5 3" /></svg>
          <span className="text-ok font-medium">Resolved</span>
        </span>
        <span className="text-slate-400">· last 7 days</span>
      </figcaption>

      {/* Accessible data table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs" aria-label="Incident trend data">
          <thead>
            <tr className="text-slate-500">
              <th className="py-1 pr-3 font-medium">Date</th>
              {data.map((d) => <th key={d.date} className="py-1 pr-2 font-medium text-center">{d.date.slice(5)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line">
              <td className="py-1 pr-3 text-brand font-medium">Created</td>
              {data.map((d) => <td key={d.date} className="py-1 pr-2 text-center tabular-nums">{d.created}</td>)}
            </tr>
            <tr className="border-t border-line">
              <td className="py-1 pr-3 text-ok font-medium">Resolved</td>
              {data.map((d) => <td key={d.date} className="py-1 pr-2 text-center tabular-nums">{d.resolved}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const [s, setS] = useState(null), [err, setErr] = useState(null);
  useEffect(() => { api('/dashboard').then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <p role="alert" className="text-crit">Could not load the dashboard: {err}. Check that the API is running on port 3001.</p>;
  if (!s) return <p>Loading dashboard…</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Operations dashboard</h1>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Open"          value={s.openIncidents}      icon={ICONS.open}     />
        <Stat label="Critical"      value={s.criticalIncidents}  icon={ICONS.critical} tone="text-crit" />
        <Stat label="Overdue"       value={s.overdueIncidents}   icon={ICONS.overdue}  tone="text-crit" />
        <Stat label="Resolved today" value={s.resolvedToday}     icon={ICONS.resolved} tone="text-ok" />
        <Stat label="Systems"       value={s.systemsMonitored}   icon={ICONS.systems}  />
        <Stat label="Uptime"        value={`${s.uptimePercent}%`} icon={ICONS.uptime}  />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-line bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Recent incidents</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-2 font-medium">Title</th>
                  <th className="pr-2 font-medium">System</th>
                  <th className="pr-2 font-medium">Priority</th>
                  <th className="font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {s.recentIncidents.map((i) => (
                  <tr key={i.id} className="border-t border-line">
                    <td className="py-2 pr-2">
                      <Link className="text-brand underline" to={`/incidents/${i.id}`}>{i.title}</Link>
                    </td>
                    <td className="pr-2 text-slate-600">{i.system || '—'}</td>
                    <td className="pr-2"><StatusBadge value={i.priority} /></td>
                    <td><StatusBadge value={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-3 font-semibold">Active alerts</h2>
          {s.activeAlerts.length === 0
            ? <p className="text-sm text-slate-500">All systems are healthy.</p>
            : <ul className="space-y-2 text-sm">
                {s.activeAlerts.map((a) => (
                  <li key={a.name} className="flex items-center justify-between gap-2">
                    <span>{a.name}</span>
                    <StatusBadge value={a.status} />
                  </li>
                ))}
              </ul>
          }
        </section>
      </div>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="mb-4 font-semibold">Incident trend</h2>
        <Trend data={s.trend} />
      </section>
    </div>
  );
}
