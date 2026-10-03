/**
 * SlaChip — displays the computed SLA status from the API's `sla` field.
 *
 * Renders nothing when sla is null (Resolved / Closed incidents).
 * Status is always expressed as visible text, not colour alone.
 */
export default function SlaChip({ sla }) {
  if (!sla) return null;

  const cls = sla.overdue
    ? 'bg-red-50 text-crit border-red-200'
    : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cls}`}
      title={sla.target}
    >
      {sla.label}
    </span>
  );
}
