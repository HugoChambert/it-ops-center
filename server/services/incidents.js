import { getSetting } from './settingsStore.js';
export const STATUSES = ['Open', 'Investigating', 'Pending', 'Resolved', 'Closed'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const DONE = ['Resolved', 'Closed'];

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; this.expose = true; }
}
const now = () => new Date().toISOString();
const text = (v) => (typeof v === 'string' ? v.trim() : '');

export function listIncidents(db, { status, priority, q } = {}) {
  const where = [], args = [];
  if (status) { where.push('i.status = ?'); args.push(status); }
  if (priority) { where.push('i.priority = ?'); args.push(priority); }
  if (q) { where.push('(i.title LIKE ? OR i.description LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  return db.prepare(`SELECT i.*, s.name AS system FROM incidents i LEFT JOIN systems s ON s.id=i.system_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.updated_at DESC`).all(...args);
}

export function getIncident(db, id) {
  const row = db.prepare('SELECT i.*, s.name AS system FROM incidents i LEFT JOIN systems s ON s.id=i.system_id WHERE i.id = ?').get(id);
  if (!row) throw new HttpError(404, 'Incident not found');
  row.events = db.prepare('SELECT * FROM incident_events WHERE incident_id = ? ORDER BY created_at, id').all(id);
  return row;
}

export function addEvent(db, incidentId, type, message, author) {
  db.prepare('INSERT INTO incident_events (incident_id,type,message,author,created_at) VALUES (?,?,?,?,?)').run(incidentId, type, message, author ?? getSetting(db, 'technician_name'), now());
  db.prepare('UPDATE incidents SET updated_at = ? WHERE id = ?').run(now(), incidentId);
}

export function createIncident(db, body = {}) {
  const title = text(body.title);
  if (!title) throw new HttpError(400, 'Title is required');
  const priority = body.priority || getSetting(db, 'default_priority');
  if (!PRIORITIES.includes(priority)) throw new HttpError(400, `Priority must be one of: ${PRIORITIES.join(', ')}`);
  const t = now();
  const r = db.prepare(`INSERT INTO incidents (title,description,priority,status,assignee,affected_user,system_id,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(title, text(body.description), priority, 'Open', text(body.assignee) || null,
    text(body.affected_user) || null, body.system_id || null, t, t);
  addEvent(db, r.lastInsertRowid, 'status', 'Incident created');
  return getIncident(db, Number(r.lastInsertRowid));
}

export function updateIncident(db, id, body = {}) {
  const cur = getIncident(db, id);
  const next = { ...cur };
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) throw new HttpError(400, `Priority must be one of: ${PRIORITIES.join(', ')}`);
    next.priority = body.priority;
  }
  if (body.assignee !== undefined) next.assignee = text(body.assignee) || null;
  if (body.resolution !== undefined) next.resolution = text(body.resolution);
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw new HttpError(400, `Status must be one of: ${STATUSES.join(', ')}`);
    if (body.status === 'Resolved' && !next.resolution) throw new HttpError(400, 'A resolution is required to resolve an incident');
    next.status = body.status;
    if (DONE.includes(next.status)) next.resolved_at = cur.resolved_at || now();
    else next.resolved_at = null; // reopened
  }
  db.prepare('UPDATE incidents SET priority=?, assignee=?, status=?, resolution=?, resolved_at=?, updated_at=? WHERE id=?')
    .run(next.priority, next.assignee, next.status, next.resolution || '', next.resolved_at, now(), id);
  if (next.status !== cur.status) addEvent(db, id, 'status', `Status changed from ${cur.status} to ${next.status}`);
  if (next.priority !== cur.priority) addEvent(db, id, 'status', `Priority changed from ${cur.priority} to ${next.priority}`);
  return getIncident(db, id);
}

export function addNote(db, id, type, body = {}) {
  getIncident(db, id);
  const message = text(body.message);
  if (!message) throw new HttpError(400, 'Message is required');
  addEvent(db, id, type, message);
  return getIncident(db, id);
}
