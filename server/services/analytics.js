/**
 * Analytics service — MTTR, SLA compliance, and 7-day trend.
 *
 * All computation is pure: reads from the DB, returns a plain object.
 * The `now` parameter is injectable for deterministic tests.
 *
 * SLA windows are imported from server/config/sla.js — never duplicated here.
 */
import { SLA_WINDOWS_MS } from '../config/sla.js';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const EMPTY_MESSAGE = 'No resolved incidents yet.';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format a positive millisecond duration as a human-readable string.
 * Mirrors the format used by server/services/sla.js.
 * e.g. 5_400_000 → "1h 30m", 3_600_000 → "1h 0m", 30_000 → "< 1m"
 *
 * @param {number} ms  positive integer milliseconds
 * @returns {string}
 */
function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return '< 1m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Return the UTC midnight Date for the day containing `ts`.
 * @param {Date} ts
 * @returns {Date}
 */
function utcDayStart(ts) {
  return new Date(Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate()));
}

// ---------------------------------------------------------------------------
// Exported service function
// ---------------------------------------------------------------------------

/**
 * Compute MTTR, SLA compliance, and a 7-day trend from resolved incidents.
 *
 * @param {object} db   DatabaseSync instance
 * @param {Date}  [now] injectable clock (defaults to new Date())
 * @returns {object}
 */
export function getAnalytics(db, now = new Date()) {
  // Query all resolved/closed incidents that have a resolved_at timestamp.
  const rows = db.prepare(
    `SELECT priority, created_at, resolved_at
     FROM incidents
     WHERE status IN ('Resolved','Closed') AND resolved_at IS NOT NULL`
  ).all();

  const isEmpty = rows.length === 0;

  // --- MTTR ---
  // For each priority bucket, compute: count, sum of resolution time in ms.
  const mttrAccum = {};
  for (const p of PRIORITIES) mttrAccum[p] = { count: 0, sumMs: 0 };

  for (const r of rows) {
    const ms = new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime();
    if (mttrAccum[r.priority]) {
      mttrAccum[r.priority].count += 1;
      mttrAccum[r.priority].sumMs += ms;
    }
  }

  const mttrEntry = ({ count, sumMs }) => {
    if (count === 0) return { count: 0, mttrMs: null, mttrHuman: 'No data' };
    const mttrMs = sumMs / count;
    return { count, mttrMs, mttrHuman: formatDuration(mttrMs) };
  };

  const mttrByPriority = {};
  for (const p of PRIORITIES) mttrByPriority[p] = mttrEntry(mttrAccum[p]);
  const totalCount = rows.length;
  const totalSumMs = rows.reduce((s, r) => s + (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()), 0);
  mttrByPriority.overall = mttrEntry({ count: totalCount, sumMs: totalSumMs });

  // --- SLA compliance ---
  const compAccum = {};
  for (const p of PRIORITIES) compAccum[p] = { resolved: 0, withinSla: 0 };

  for (const r of rows) {
    const window = SLA_WINDOWS_MS[r.priority];
    if (window == null) continue; // unrecognised priority — skip
    const resolutionMs = new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime();
    compAccum[r.priority].resolved += 1;
    if (resolutionMs <= window) compAccum[r.priority].withinSla += 1;
  }

  const compEntry = ({ resolved, withinSla }) => ({
    resolved,
    withinSla,
    rate: resolved === 0 ? null : Math.round((withinSla / resolved) * 100),
  });

  const complianceByPriority = {};
  for (const p of PRIORITIES) complianceByPriority[p] = compEntry(compAccum[p]);
  const overallResolved = rows.length;
  const overallWithin = rows.filter((r) => {
    const window = SLA_WINDOWS_MS[r.priority];
    if (window == null) return false;
    return (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) <= window;
  }).length;
  complianceByPriority.overall = compEntry({ resolved: overallResolved, withinSla: overallWithin });

  // --- 7-day trend (UTC day buckets) ---
  // Build an array of 7 day-start timestamps: [6 days ago, ..., today] in UTC.
  const todayStart = utcDayStart(now);
  const days = [];
  for (let d = 6; d >= 0; d--) {
    const start = new Date(todayStart.getTime() - d * 86_400_000);
    const end = new Date(start.getTime() + 86_400_000);
    days.push({ date: start.toISOString().slice(0, 10), start, end });
  }

  const trend = days.map(({ date, start, end }) => {
    const dayRows = rows.filter((r) => {
      const t = new Date(r.resolved_at).getTime();
      return t >= start.getTime() && t < end.getTime();
    });

    if (dayRows.length === 0) {
      return { date, count: 0, mttrMs: null, complianceRate: null };
    }

    const dayMttrMs = dayRows.reduce((s, r) =>
      s + (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()), 0
    ) / dayRows.length;

    const dayWithin = dayRows.filter((r) => {
      const window = SLA_WINDOWS_MS[r.priority];
      if (window == null) return false;
      return (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) <= window;
    }).length;

    return {
      date,
      count: dayRows.length,
      mttrMs: dayMttrMs,
      complianceRate: Math.round((dayWithin / dayRows.length) * 100),
    };
  });

  const result = { mttrByPriority, complianceByPriority, trend };
  if (isEmpty) { result.empty = true; result.message = EMPTY_MESSAGE; }
  return result;
}
