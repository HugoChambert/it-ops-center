import express from 'express';
import path from 'node:path';
import { getDashboardStats } from './services/stats.js';
import * as inc from './services/incidents.js';
import { HttpError } from './services/incidents.js';
import * as kb from './services/articles.js';
import * as settings from './services/settings.js';
import * as reports from './services/reports.js';
import { getProvider } from './ai/index.js';
import { securityHeaders, globalLimiter, aiLimiter } from './middleware/security.js';
import { getSimilar } from './services/similar.js';
import { getAnalytics } from './services/analytics.js';

// SEC-006: reject non-positive-integer :id params early, before hitting services
function parseId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid ID');
  return n;
}

export function createApp(db, { ai = getProvider(), staticDir = null } = {}) {
  const app = express();

  // SEC-010: trust exactly one reverse proxy in production so req.ip reflects the
  // real client address (from X-Forwarded-For) rather than the proxy's address.
  // Without this the rate limiters treat all visitors as one IP bucket.
  // TRUST_PROXY overrides NODE_ENV (useful for local testing or multi-hop setups).
  // Values: '1' / '2' / ... → numeric hop count; 'loopback' / 'linklocal' / 'uniquelocal'
  // → named subnet; '0' or 'false' → disabled; absent → use NODE_ENV default.
  function parseTrustProxy(raw) {
    if (raw === 'false' || raw === '0') return false;
    const n = Number(raw);
    if (!Number.isNaN(n)) return n;
    return raw; // named subnet string, e.g. 'loopback'
  }
  const trustProxy = process.env.TRUST_PROXY !== undefined
    ? parseTrustProxy(process.env.TRUST_PROXY)
    : process.env.NODE_ENV === 'production' ? 1 : false;
  app.set('trust proxy', trustProxy);

  app.use(securityHeaders);                    // SEC-004: security headers on every response
  app.use(express.json({ limit: '64kb' }));    // SEC-003: body-size cap
  app.use('/api', globalLimiter);             // SEC-002: global rate limit
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/analytics', (_req, res) => res.json(getAnalytics(db)));
  app.get('/api/dashboard', (_req, res) => res.json(getDashboardStats(db)));
  app.get('/api/systems', (_req, res) => res.json(db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM incidents i WHERE i.system_id = s.id
    AND i.status IN ('Open','Investigating','Pending')) AS open_incidents FROM systems s ORDER BY s.name`).all()));

  app.get('/api/incidents', (req, res) => res.json(inc.listIncidents(db, req.query)));
  app.post('/api/incidents', (req, res) => res.status(201).json(inc.createIncident(db, req.body)));
  app.get('/api/incidents/:id', (req, res) => res.json(inc.getIncident(db, parseId(req.params.id))));
  app.patch('/api/incidents/:id', (req, res) => res.json(inc.updateIncident(db, parseId(req.params.id), req.body)));
  app.post('/api/incidents/:id/notes', (req, res) => res.status(201).json(inc.addNote(db, parseId(req.params.id), 'note', req.body)));
  app.post('/api/incidents/:id/actions', (req, res) => res.status(201).json(inc.addNote(db, parseId(req.params.id), 'action', req.body)));

  app.post('/api/incidents/:id/troubleshoot', aiLimiter, async (req, res, next) => {  // SEC-005: AI rate limit
    try {
    const incident = inc.getIncident(db, parseId(req.params.id));
    const s = await ai.troubleshoot(incident);
    const articles = s.articleQuery ? kb.listArticles(db, { q: s.articleQuery }).map(({ id, title }) => ({ id, title })) : [];
    res.json({ ...s, relatedArticles: articles });
    } catch (e) { next(e); }
  });

  app.get('/api/incidents/:id/similar', (req, res) => {
    const incident = inc.getIncident(db, parseId(req.params.id));
    res.json(getSimilar(db, incident));
  });

  app.get('/api/incidents/:id/report', (req, res) => res.json(reports.getReport(db, parseId(req.params.id))));
  app.post('/api/incidents/:id/report/draft', aiLimiter, async (req, res, next) => {  // SEC-005: AI rate limit
    try { res.json(await ai.draftReport(inc.getIncident(db, parseId(req.params.id)))); } catch (e) { next(e); }
  });
  app.put('/api/incidents/:id/report', (req, res) => res.json(reports.saveReport(db, parseId(req.params.id), req.body)));

  const settingsView = () => ({
    settings: settings.getSettings(db),
    ai: { provider: ai.name, keyConfigured: Boolean(process.env.AI_API_KEY) }, // never return the key itself
    app: { version: '0.1.0' },
  });
  app.get('/api/settings', (_req, res) => res.json(settingsView()));
  app.put('/api/settings', (req, res) => { settings.updateSettings(db, req.body); res.json(settingsView()); });

  app.get('/api/articles', (req, res) => res.json(kb.listArticles(db, req.query)));
  app.post('/api/articles', (req, res) => res.status(201).json(kb.createArticle(db, req.body)));
  app.get('/api/articles/:id', (req, res) => res.json(kb.getArticle(db, parseId(req.params.id))));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  app.use((err, req, res, _next) => {                              // SEC-008: include request context
    if (err.expose) return res.status(err.status || 400).json({ error: err.message });
    console.error(`[${req.method} ${req.path}]`, err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
