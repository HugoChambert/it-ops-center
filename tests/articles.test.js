import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';

let app;
beforeEach(() => { const db = createDb(':memory:'); seed(db); app = createApp(db); });

describe('knowledge base', () => {
  it('lists and searches articles', async () => {
    expect((await request(app).get('/api/articles')).body).toHaveLength(1);
    expect((await request(app).get('/api/articles?q=certificate')).body).toHaveLength(1);
    expect((await request(app).get('/api/articles?q=zzzz')).body).toHaveLength(0);
  });
  it('opens an article with its related incidents', async () => {
    const { body } = await request(app).get('/api/articles/1').expect(200);
    expect(body.title).toBe('VPN Certificate Troubleshooting');
    expect(body.related_incidents[0].id).toBe(1);
  });
  it('creates an article linked to a resolved incident', async () => {
    await request(app).patch('/api/incidents/2').send({ status: 'Resolved', resolution: 'Replica caught up' });
    const { body } = await request(app).post('/api/articles').send({ title: 'Replication lag', resolution: 'Replica caught up', incident_id: 2 }).expect(201);
    expect(body.related_incidents.map((i) => i.id)).toEqual([2]);
  });
  it('validates input and unknown ids', async () => {
    await request(app).post('/api/articles').send({ title: ' ' }).expect(400);
    await request(app).post('/api/articles').send({ title: 'X', incident_id: 999 }).expect(400);
    await request(app).get('/api/articles/999').expect(404);
  });
});
