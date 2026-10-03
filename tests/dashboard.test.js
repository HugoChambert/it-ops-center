import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';

let app;
beforeEach(() => { const db = createDb(':memory:'); seed(db); app = createApp(db); });

describe('GET /api/dashboard', () => {
  it('counts active incidents and critical incidents', async () => {
    const { body } = await request(app).get('/api/dashboard').expect(200);
    expect(body.openIncidents).toBe(3);
    expect(body.criticalIncidents).toBe(1);
    expect(body.systemsMonitored).toBe(6);
  });
  it('includes overdueIncidents as a non-negative integer', async () => {
    const { body } = await request(app).get('/api/dashboard').expect(200);
    expect(typeof body.overdueIncidents).toBe('number');
    expect(body.overdueIncidents).toBeGreaterThanOrEqual(0);
  });
  it('returns a 7-day trend', async () => {
    const { body } = await request(app).get('/api/dashboard');
    expect(body.trend).toHaveLength(7);
  });
});
describe('GET /api/incidents', () => {
  it('filters by status and priority', async () => {
    const { body } = await request(app).get('/api/incidents?status=Open&priority=High');
    expect(body).toHaveLength(1);
  });
  it('searches by text', async () => {
    const { body } = await request(app).get('/api/incidents?q=VPN');
    expect(body).toHaveLength(1);
  });
});
describe('API errors', () => {
  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body.error).toBe('Not found');
  });
});
