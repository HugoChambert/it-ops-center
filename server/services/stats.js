// Dashboard statistics are computed here, from the incidents table only.
// Kept separate from the incident routes so the two can be reasoned about independently.
export function getDashboardStats(db) {
  const count = (where, ...args) => db.prepare(`SELECT COUNT(*) c FROM incidents WHERE ${where}`).get(...args).c;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const systems = db.prepare('SELECT status FROM systems').all();
  const up = systems.filter((s) => s.status !== 'Down').length;
  return {
    openIncidents: count("status IN ('Open','Investigating','Pending')"),
    criticalIncidents: count("priority = 'Critical' AND status IN ('Open','Investigating','Pending')"),
    resolvedToday: count("status IN ('Resolved','Closed') AND resolved_at >= ?", startOfDay.toISOString()),
    systemsMonitored: systems.length,
    uptimePercent: systems.length ? Number(((up / systems.length) * 100).toFixed(2)) : 100,
    recentIncidents: db.prepare(`SELECT i.id,i.title,i.priority,i.status,i.updated_at,s.name AS system
      FROM incidents i LEFT JOIN systems s ON s.id=i.system_id ORDER BY i.updated_at DESC LIMIT 5`).all(),
    activeAlerts: db.prepare("SELECT name,status,cpu,memory,disk FROM systems WHERE status != 'Healthy'").all(),
    trend: getTrend(db),
  };
}
function getTrend(db, days = 7) {
  const out = [];
  for (let d = days - 1; d >= 0; d--) {
    const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - d);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    const n = (col) => db.prepare(`SELECT COUNT(*) c FROM incidents WHERE ${col} >= ? AND ${col} < ?`).get(from.toISOString(), to.toISOString()).c;
    out.push({ date: from.toISOString().slice(0, 10), created: n('created_at'), resolved: n('resolved_at') });
  }
  return out;
}
