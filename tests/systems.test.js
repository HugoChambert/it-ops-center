import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';

let app;
beforeEach(() => { const db = createDb(':memory:'); seed(db); app = createApp(db); });
const byName = async (n) => (await request(app).get('/api/systems')).body.find((s) => s.name === n);

describe('GET /api/systems', () => {
  it('returns systems with utilisation and open incident counts', async () => {
    const { body } = await request(app).get('/api/systems').expect(200);
    expect(body).toHaveLength(6);
    const vpn = body.find((s) => s.name === 'VPN-01');
    expect(vpn.status).toBe('Down');
    expect(vpn.open_incidents).toBe(1);
    expect(body.find((s) => s.name === 'WEB-01').open_incidents).toBe(0);
  });
  it('updates the open count when an incident is created and resolved', async () => {
    const { body: i } = await request(app).post('/api/incidents').send({ title: 'Slow pages', system_id: 1 });
    expect((await byName('WEB-01')).open_incidents).toBe(1);
    await request(app).patch(`/api/incidents/${i.id}`).send({ status: 'Resolved', resolution: 'Cache cleared' });
    expect((await byName('WEB-01')).open_incidents).toBe(0);
  });
});
