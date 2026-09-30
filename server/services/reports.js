import { HttpError, getIncident, addEvent } from './incidents.js';
export const FIELDS = ['problem', 'impact', 'investigation', 'root_cause', 'resolution', 'preventative_action'];
const text = (v) => (typeof v === 'string' ? v.trim() : '');

export function getReport(db, id) {
  getIncident(db, id); // 404 if the incident does not exist
  return db.prepare('SELECT * FROM incident_reports WHERE incident_id = ?').get(id) || null;
}

export function saveReport(db, id, body = {}) {
  getIncident(db, id);
  const v = Object.fromEntries(FIELDS.map((f) => [f, text(body[f])]));
  if (!v.problem) throw new HttpError(400, 'Problem is required');
  const t = new Date().toISOString();
  db.prepare(`INSERT INTO incident_reports (incident_id,${FIELDS.join(',')},created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(incident_id) DO UPDATE SET ${FIELDS.map((f) => `${f}=excluded.${f}`).join(',')}, updated_at=excluded.updated_at`)
    .run(id, ...FIELDS.map((f) => v[f]), t, t);
  addEvent(db, id, 'note', 'Incident report saved');
  return getReport(db, id);
}
