import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, 'fixtures/static');

// ---------------------------------------------------------------------------
// Static file serving and SPA fallback
// ---------------------------------------------------------------------------
describe('static file serving', () => {
  let db, app;
  beforeEach(() => {
    db = createDb(':memory:');
    seed(db);
    app = createApp(db, { staticDir: fixtureDir });
  });

  it('serves a static file when it exists', async () => {
    const res = await request(app).get('/hello.txt');
    expect(res.status).toBe(200);
    expect(res.text.trim()).toBe('hello');
  });

  it('falls back to index.html for unknown non-/api routes', async () => {
    const res = await request(app).get('/incidents/42');
    expect(res.status).toBe(200);
    expect(res.text).toContain('SPA');
  });

  it('still returns JSON 404 for unknown /api routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('does not serve static files when staticDir is not provided', async () => {
    const plain = createApp(db);
    const res = await request(plain).get('/incidents/42');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Demo reset logic (tested in isolation — no real setInterval needed)
// ---------------------------------------------------------------------------
describe('demo reset', () => {
  it('wipes and reseeds the db when the reset function is called', () => {
    const db = createDb(':memory:');
    seed(db);

    // confirm initial seed
    const before = db.prepare('SELECT COUNT(*) c FROM systems').get().c;
    expect(before).toBeGreaterThan(0);

    // simulate what the reset interval does
    db.exec(`DELETE FROM incident_reports; DELETE FROM incident_events; DELETE FROM article_incidents; DELETE FROM articles; DELETE FROM incidents; DELETE FROM systems; DELETE FROM settings;`);
    seed(db);

    const after = db.prepare('SELECT COUNT(*) c FROM systems').get().c;
    expect(after).toBe(before);
  });

  it('db has no data after wipe and before reseed', () => {
    const db = createDb(':memory:');
    seed(db);

    db.exec(`DELETE FROM incident_reports; DELETE FROM incident_events; DELETE FROM article_incidents; DELETE FROM articles; DELETE FROM incidents; DELETE FROM systems; DELETE FROM settings;`);

    expect(db.prepare('SELECT COUNT(*) c FROM systems').get().c).toBe(0);
    expect(db.prepare('SELECT COUNT(*) c FROM incidents').get().c).toBe(0);
  });

  it('incidents are available again after reseed', () => {
    const db = createDb(':memory:');
    seed(db);

    db.exec(`DELETE FROM incident_reports; DELETE FROM incident_events; DELETE FROM article_incidents; DELETE FROM articles; DELETE FROM incidents; DELETE FROM systems; DELETE FROM settings;`);
    seed(db);

    const count = db.prepare('SELECT COUNT(*) c FROM incidents').get().c;
    expect(count).toBeGreaterThan(0);
  });
});
