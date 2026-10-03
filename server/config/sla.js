/**
 * SLA response deadlines by priority.
 *
 * The deadline for an incident is always: created_at + window for its CURRENT priority.
 * If priority is changed after creation the deadline shifts immediately — this is intentional
 * (changing to Critical on an old incident will show it overdue right away).
 *
 * Values are in milliseconds. Keep all four entries; adding a future priority here is enough
 * to make it take effect everywhere (service, tests, UI chip).
 *
 * Note: SLA status is computed at request time (not persisted). The label goes stale between
 * page loads. Add server-sent events or polling if a live countdown is needed in future.
 */
export const SLA_WINDOWS_MS = {
  Critical: 1 * 60 * 60 * 1000,   //  1 hour
  High:     4 * 60 * 60 * 1000,   //  4 hours
  Medium:   8 * 60 * 60 * 1000,   //  8 hours
  Low:      24 * 60 * 60 * 1000,  // 24 hours
};

/** Human-readable targets shown in the API response and UI chip. */
export const SLA_TARGETS = {
  Critical: '1 hour',
  High:     '4 hours',
  Medium:   '8 hours',
  Low:      '24 hours',
};
