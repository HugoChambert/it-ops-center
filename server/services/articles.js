import { HttpError } from './incidents.js';
const now = () => new Date().toISOString();
const text = (v) => (typeof v === 'string' ? v.trim() : '');

export function listArticles(db, { q } = {}) {
  if (!q) return db.prepare('SELECT * FROM articles ORDER BY updated_at DESC').all();
  const like = `%${q}%`;
  return db.prepare(`SELECT * FROM articles WHERE title LIKE ? OR symptoms LIKE ? OR causes LIKE ?
    OR diagnostic_steps LIKE ? OR resolution LIKE ? ORDER BY updated_at DESC`).all(like, like, like, like, like);
}

export function getArticle(db, id) {
  const a = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  if (!a) throw new HttpError(404, 'Article not found');
  a.related_incidents = db.prepare(`SELECT i.id, i.title, i.status FROM article_incidents ai
    JOIN incidents i ON i.id = ai.incident_id WHERE ai.article_id = ?`).all(id);
  return a;
}

export function createArticle(db, body = {}) {
  const title = text(body.title);
  if (!title) throw new HttpError(400, 'Title is required');
  if (body.incident_id && !db.prepare('SELECT id FROM incidents WHERE id = ?').get(body.incident_id))
    throw new HttpError(400, 'Linked incident does not exist');
  const t = now();
  const r = db.prepare('INSERT INTO articles (title,symptoms,causes,diagnostic_steps,resolution,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(title, text(body.symptoms), text(body.causes), text(body.diagnostic_steps), text(body.resolution), t, t);
  const id = Number(r.lastInsertRowid);
  if (body.incident_id) db.prepare('INSERT INTO article_incidents VALUES (?,?)').run(id, body.incident_id);
  return getArticle(db, id);
}
