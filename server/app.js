import express from 'express';
import { getDashboardStats } from './services/stats.js';
import * as inc from './services/incidents.js';
import * as kb from './services/articles.js';
import * as settings from './services/settings.js';
import * as reports from './services/reports.js';
import { getProvider } from './ai/index.js';

export function createApp(db, { ai = getProvider() } = {}) {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/dashboard', (_req, res) => res.json(getDashboardStats(db)));
  app.get('/api/systems', (_req, res) => res.json(db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM incidents i WHERE i.system_id = s.id
    AND i.status IN ('Open','Investigating','Pending')) AS open_incidents FROM systems s ORDER BY s.name`).all()));

  app.get('/api/incidents', (req, res) => res.json(inc.listIncidents(db, req.query)));
  app.post('/api/incidents', (req, res) => res.status(201).json(inc.createIncident(db, req.body)));
  app.get('/api/incidents/:id', (req, res) => res.json(inc.getIncident(db, Number(req.params.id))));
  app.patch('/api/incidents/:id', (req, res) => res.json(inc.updateIncident(db, Number(req.params.id), req.body)));
  app.post('/api/incidents/:id/notes', (req, res) => res.status(201).json(inc.addNote(db, Number(req.params.id), 'note', req.body)));
  app.post('/api/incidents/:id/actions', (req, res) => res.status(201).json(inc.addNote(db, Number(req.params.id), 'action', req.body)));

  app.post('/api/incidents/:id/troubleshoot', async (req, res, next) => {
    try {
    const incident = inc.getIncident(db, Number(req.params.id));
    const s = await ai.troubleshoot(incident);
    const articles = s.articleQuery ? kb.listArticles(db, { q: s.articleQuery }).map(({ id, title }) => ({ id, title })) : [];
    res.json({ ...s, relatedArticles: articles });
    } catch (e) { next(e); }
  });

  app.get('/api/incidents/:id/report', (req, res) => res.json(reports.getReport(db, Number(req.params.id))));
  app.post('/api/incidents/:id/report/draft', async (req, res, next) => {
    try { res.json(await ai.draftReport(inc.getIncident(db, Number(req.params.id)))); } catch (e) { next(e); }
  });
  app.put('/api/incidents/:id/report', (req, res) => res.json(reports.saveReport(db, Number(req.params.id), req.body)));

  const settingsView = () => ({
    settings: settings.getSettings(db),
    ai: { provider: ai.name, keyConfigured: Boolean(process.env.AI_API_KEY) }, // never return the key itself
    app: { version: '0.1.0' },
  });
  app.get('/api/settings', (_req, res) => res.json(settingsView()));
  app.put('/api/settings', (req, res) => { settings.updateSettings(db, req.body); res.json(settingsView()); });

  app.get('/api/articles', (req, res) => res.json(kb.listArticles(db, req.query)));
  app.post('/api/articles', (req, res) => res.status(201).json(kb.createArticle(db, req.body)));
  app.get('/api/articles/:id', (req, res) => res.json(kb.getArticle(db, Number(req.params.id))));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, _req, res, _next) => {
    if (err.expose) return res.status(err.status || 400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
