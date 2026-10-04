import { useEffect, useState } from 'react';
import { api } from '../api.js';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({ title, children }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function MttrTable({ mttr }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-slate-600">
            <th className="py-1 pr-4 font-medium">Priority</th>
            <th className="py-1 pr-4 font-medium">Incidents resolved</th>
            <th className="py-1 font-medium">Mean time to resolve</th>
          </tr>
        </thead>
        <tbody>
          {PRIORITIES.map((p) => (
            <tr key={p} className="border-t border-line">
              <td className="py-2 pr-4">{p}</td>
              <td className="py-2 pr-4">{mttr[p].count}</td>
              <td className="py-2">{mttr[p].mttrHuman}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 font-medium">
            <td className="py-2 pr-4">Overall</td>
            <td className="py-2 pr-4">{mttr.overall.count}</td>
            <td className="py-2">{mttr.overall.mttrHuman}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ComplianceTable({ compliance }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-slate-600">
            <th className="py-1 pr-4 font-medium">Priority</th>
            <th className="py-1 pr-4 font-medium">SLA window</th>
            <th className="py-1 pr-4 font-medium">Resolved</th>
            <th className="py-1 pr-4 font-medium">Within SLA</th>
            <th className="py-1 font-medium">Compliance rate</th>
          </tr>
        </thead>
        <tbody>
          {PRIORITIES.map((p) => {
            const { resolved, withinSla, rate } = compliance[p];
            const slaWindows = { Critical: '1 hour', High: '4 hours', Medium: '8 hours', Low: '24 hours' };
            return (
              <tr key={p} className="border-t border-line">
                <td className="py-2 pr-4">{p}</td>
                <td className="py-2 pr-4 text-slate-500">{slaWindows[p]}</td>
                <td className="py-2 pr-4">{resolved}</td>
                <td className="py-2 pr-4">{withinSla}</td>
                <td className="py-2">
                  {rate === null ? (
                    <span className="text-slate-400">No data</span>
                  ) : (
                    <span className={rate >= 80 ? 'text-ok' : rate >= 50 ? 'text-warn' : 'text-crit'}>
                      {rate}%
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-slate-300 font-medium">
            <td className="py-2 pr-4">Overall</td>
            <td className="py-2 pr-4 text-slate-400">—</td>
            <td className="py-2 pr-4">{compliance.overall.resolved}</td>
            <td className="py-2 pr-4">{compliance.overall.withinSla}</td>
            <td className="py-2">
              {compliance.overall.rate === null ? (
                <span className="text-slate-400">No data</span>
              ) : (
                <span className={compliance.overall.rate >= 80 ? 'text-ok' : compliance.overall.rate >= 50 ? 'text-warn' : 'text-crit'}>
                  {compliance.overall.rate}%
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Render a dual-line SVG trend chart.
 * Line A: MTTR in hours (normalised to chart height).
 * Line B: SLA compliance % (0–100 normalised to chart height).
 * Both lines are accessible via the accompanying data table.
 */
function TrendChart({ trend }) {
  const W = 300, H = 120, PAD = 20, INNER_W = W - PAD * 2, INNER_H = H - PAD * 2;

  const mttrHours = trend.map((d) => (d.mttrMs != null ? d.mttrMs / 3_600_000 : null));
  const compliance = trend.map((d) => d.complianceRate);

  const maxMttr = Math.max(1, ...mttrHours.filter((v) => v != null));

  const xPos = (i) => PAD + i * (INNER_W / (trend.length - 1));
  const yMttr = (v) => PAD + INNER_H - (v / maxMttr) * INNER_H;
  const yComp = (v) => PAD + INNER_H - (v / 100) * INNER_H;

  // Build SVG path segments, skipping gaps where value is null
  function buildPath(values, yFn) {
    let d = '';
    for (let i = 0; i < values.length; i++) {
      if (values[i] == null) continue;
      const x = xPos(i), y = yFn(values[i]);
      d += d === '' ? `M${x},${y}` : `L${x},${y}`;
    }
    return d;
  }

  const mttrPath = buildPath(mttrHours, yMttr);
  const compPath = buildPath(compliance, yComp);

  // X-axis date labels (first and last only to avoid crowding)
  const first = trend[0].date.slice(5);   // MM-DD
  const last = trend[trend.length - 1].date.slice(5);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="7-day trend of mean time to resolve and SLA compliance rate"
      >
        {/* Baseline */}
        <line x1={PAD} y1={PAD + INNER_H} x2={W - PAD} y2={PAD + INNER_H} stroke="var(--color-line)" strokeWidth="1" />
        {/* MTTR line — solid blue */}
        {mttrPath && <path d={mttrPath} fill="none" stroke="var(--color-brand)" strokeWidth="2" />}
        {/* Compliance line — dashed green */}
        {compPath && <path d={compPath} fill="none" stroke="var(--color-ok)" strokeWidth="2" strokeDasharray="4 3" />}
        {/* X-axis labels */}
        <text x={PAD} y={H - 4} fontSize="9" fill="var(--color-line)">{first}</text>
        <text x={W - PAD} y={H - 4} fontSize="9" fill="var(--color-line)" textAnchor="end">{last}</text>
      </svg>
      <figcaption className="mt-1 text-xs text-slate-600">
        <span className="text-brand font-medium">Solid: MTTR (hours)</span>
        {' · '}
        <span className="text-ok font-medium">Dashed: SLA compliance (%)</span>
        {' · last 7 days (UTC)'}
      </figcaption>
    </figure>
  );
}

function TrendTable({ trend }) {
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-left text-sm" aria-label="7-day trend data">
        <thead>
          <tr className="text-slate-600">
            <th className="py-1 pr-4 font-medium">Date</th>
            <th className="py-1 pr-4 font-medium">Resolved</th>
            <th className="py-1 pr-4 font-medium">MTTR</th>
            <th className="py-1 font-medium">SLA compliance</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((d) => (
            <tr key={d.date} className="border-t border-line">
              <td className="py-1.5 pr-4">{d.date}</td>
              <td className="py-1.5 pr-4">{d.count}</td>
              <td className="py-1.5 pr-4">
                {d.mttrMs != null
                  ? formatMsHuman(d.mttrMs)
                  : <span className="text-slate-400">—</span>}
              </td>
              <td className="py-1.5">
                {d.complianceRate != null
                  ? `${d.complianceRate}%`
                  : <span className="text-slate-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility — format ms → human string (matches analytics service output)
// ---------------------------------------------------------------------------
function formatMsHuman(ms) {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return '< 1m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Performance() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api('/analytics').then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <p role="alert" className="text-crit">
        Could not load analytics: {err}.
      </p>
    );
  }
  if (!data) return <p>Loading performance data…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Performance</h1>

      {data.empty ? (
        <p className="rounded-lg border border-line bg-white p-4 text-sm text-slate-600">
          {data.message}
        </p>
      ) : (
        <>
          <SectionCard title="Mean time to resolve (MTTR)">
            <p className="mb-3 text-sm text-slate-600">
              Average time from incident creation to resolution, by priority.
            </p>
            <MttrTable mttr={data.mttrByPriority} />
          </SectionCard>

          <SectionCard title="SLA compliance">
            <p className="mb-3 text-sm text-slate-600">
              Percentage of resolved incidents closed within the SLA response window for their priority.
              Deadline = created time + priority window (Critical 1 h · High 4 h · Medium 8 h · Low 24 h).
            </p>
            <ComplianceTable compliance={data.complianceByPriority} />
          </SectionCard>

          <SectionCard title="7-day trend">
            <TrendChart trend={data.trend} />
            <TrendTable trend={data.trend} />
          </SectionCard>
        </>
      )}
    </div>
  );
}
