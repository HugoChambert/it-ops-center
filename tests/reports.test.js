import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';
import { getProvider } from '../server/ai/index.js';

let db, app;
beforeEach(() => { db = createDb(':memory:'); seed(db); app = createApp(db, { ai: getProvider({}) }); });
const draft = (id = 1) => request(app).post(`/api/incidents/${id}/report/draft`);

describe('report draft', () => {
  it('builds all six sections from incident facts without saving', async () => {
    await request(app).post('/api/incidents/1/actions').send({ message: 'Checked VPN logs' });
    const { body } = await draft().expect(200);
    expect(body.problem).toMatch(/VPN/);
    expect(body.impact).toMatch(/VPN-01/);
    expect(body.investigation).toMatch(/Checked VPN logs/);
    expect(body.root_cause).toMatch(/confirmed by the technician/);
    expect((await request(app).get('/api/incidents/1/report')).body).toBeNull();
  });
  it('returns 404 for an unknown incident and 501 for an unimplemented provider', async () => {
    await draft(999).expect(404);
    const a = createApp(db, { ai: getProvider({ AI_PROVIDER: 'other' }) });
    await request(a).post('/api/incidents/1/report/draft').expect(501);
  });
});

describe('saving a report', () => {
  it('saves the edited text, not the draft, and overwrites on re-save', async () => {
    const { body: d } = await draft();
    await request(app).put('/api/incidents/1/report').send({ ...d, root_cause: 'Expired client certificate' }).expect(200);
    let saved = (await request(app).get('/api/incidents/1/report')).body;
    expect(saved.root_cause).toBe('Expired client certificate');
    await request(app).put('/api/incidents/1/report').send({ ...d, root_cause: 'Gateway outage' }).expect(200);
    saved = (await request(app).get('/api/incidents/1/report')).body;
    expect(saved.root_cause).toBe('Gateway outage');
  });
  it('requires a problem statement', async () => {
    const res = await request(app).put('/api/incidents/1/report').send({ problem: '  ' }).expect(400);
    expect(res.body.error).toMatch(/problem/i);
  });
  it('adds a timeline entry when saved', async () => {
    await request(app).put('/api/incidents/1/report').send({ problem: 'VPN down' });
    const { body } = await request(app).get('/api/incidents/1');
    expect(body.events.some((e) => e.message === 'Incident report saved')).toBe(true);
  });
  it('returns 404 when the incident does not exist', async () => {
    await request(app).put('/api/incidents/999/report').send({ problem: 'x' }).expect(404);
  });
});
