import { SLA_WINDOWS_MS, SLA_TARGETS } from '../config/sla.js';

const DONE = new Set(['Resolved', 'Closed']);

/**
 * Format a positive millisecond duration into a human-readable string.
 * e.g. 3_900_000 → "1h 5m", 45_000 → "< 1m"
 */
function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return '< 1m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Compute the SLA deadline timestamp for an incident.
 * Returns a Date, or null if the priority is unrecognised.
 *
 * @param {{ priority: string, created_at: string }} incident
 * @returns {Date|null}
 */
export function getDeadline(incident) {
  const window = SLA_WINDOWS_MS[incident.priority];
  if (window == null) return null;
  return new Date(new Date(incident.created_at).getTime() + window);
}

/**
 * Compute the full SLA status object for an incident.
 *
 * Returns null for Resolved/Closed incidents (no timer shown).
 *
 * @param {{ priority: string, status: string, created_at: string }} incident
 * @param {Date} [now]  – injectable for tests; defaults to new Date()
 * @returns {{ deadline: string, msRemaining: number, overdue: boolean, label: string, target: string }|null}
 */
export function getSlaStatus(incident, now = new Date()) {
  if (DONE.has(incident.status)) return null;

  const deadline = getDeadline(incident);
  if (!deadline) return null;

  const msRemaining = deadline.getTime() - now.getTime();
  const overdue = msRemaining < 0;

  let label;
  if (msRemaining === 0) {
    label = 'Due now';
  } else if (overdue) {
    label = `Overdue by ${formatDuration(-msRemaining)}`;
  } else {
    label = `${formatDuration(msRemaining)} remaining`;
  }

  return {
    deadline: deadline.toISOString(),
    msRemaining,
    overdue,
    label,
    target: `Target: ${SLA_TARGETS[incident.priority]}`,
  };
}
