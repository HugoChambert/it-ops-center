const tones = { Critical: 'crit', High: 'warn', Down: 'crit', Degraded: 'warn', Healthy: 'ok', Resolved: 'ok', Closed: 'ok' };
const cls = { crit: 'bg-red-50 text-crit border-red-200', warn: 'bg-amber-50 text-warn border-amber-200', ok: 'bg-green-50 text-ok border-green-200', neutral: 'bg-slate-100 text-slate-700 border-slate-200' };
export default function StatusBadge({ value }) {
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cls[tones[value] || 'neutral']}`}>{value}</span>;
}
