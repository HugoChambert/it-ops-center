import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';

let app;
beforeEach(() => { const db = createDb(':memory:'); seed(db); app = createApp(db); });
const create = (b = {}) => request(app).post('/api/incidents').send({ title: 'Printer offline', ...b });

describe('incident creation', () => {
  it('creates an Open incident with a timeline entry', async () => {
    const { body } = await create({ priority: 'High' }).expect(201);
    expect(body.status).toBe('Open');
    expect(body.priority).toBe('High');
    expect(body.events[0].message).toBe('Incident created');
  });
  it('rejects a missing title and invalid priority', async () => {
    const a = await request(app).post('/api/incidents').send({}).expect(400);
    expect(a.body.error).toMatch(/title/i);
    await create({ priority: 'Urgent' }).expect(400);
  });
});

describe('status changes', () => {
  it('records the change on the timeline', async () => {
    const { body: i } = await create();
    const { body } = await request(app).patch(`/api/incidents/${i.id}`).send({ status: 'Investigating' }).expect(200);
    expect(body.status).toBe('Investigating');
    expect(body.events.some((e) => e.message.includes('Open to Investigating'))).toBe(true);
  });
  it('requires a resolution to resolve, then sets resolved_at', async () => {
    const { body: i } = await create();
    await request(app).patch(`/api/incidents/${i.id}`).send({ status: 'Resolved' }).expect(400);
    const { body } = await request(app).patch(`/api/incidents/${i.id}`).send({ status: 'Resolved', resolution: 'Restarted spooler' }).expect(200);
    expect(body.resolved_at).toBeTruthy();
  });
  it('rejects invalid status and unknown incident', async () => {
    const { body: i } = await create();
    await request(app).patch(`/api/incidents/${i.id}`).send({ status: 'Done' }).expect(400);
    await request(app).patch('/api/incidents/9999').send({ status: 'Open' }).expect(404);
  });
});

describe('notes and actions', () => {
  it('adds a troubleshooting action', async () => {
    const { body: i } = await create();
    const { body } = await request(app).post(`/api/incidents/${i.id}/actions`).send({ message: 'Checked VPN logs' }).expect(201);
    expect(body.events.at(-1).type).toBe('action');
    await request(app).post(`/api/incidents/${i.id}/notes`).send({ message: '  ' }).expect(400);
  });
});

describe('dashboard consistency', () => {
  it('moves an incident from open to resolved-today when resolved', async () => {
    const before = (await request(app).get('/api/dashboard')).body;
    await request(app).patch('/api/incidents/2').send({ status: 'Resolved', resolution: 'Replica caught up' }).expect(200);
    const after = (await request(app).get('/api/dashboard')).body;
    expect(after.openIncidents).toBe(before.openIncidents - 1);
    expect(after.resolvedToday).toBe(before.resolvedToday + 1);
  });

  it('stamps resolved_at when status is Resolved so the dashboard counter can match it', async () => {
    // Create a fresh incident so this test is independent of seed state.
    const { body: i } = await create({ priority: 'Low' });
    expect(i.resolved_at).toBeNull();

    const { body: resolved } = await request(app)
      .patch(`/api/incidents/${i.id}`)
      .send({ status: 'Resolved', resolution: 'Fixed' })
      .expect(200);

    // resolved_at must be set to a date string — without this the stats
    // query `resolved_at >= startOfDay` can never match and resolvedToday stays 0.
    expect(resolved.resolved_at).toBeTruthy();
    expect(resolved.resolved_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // The dashboard counter must reflect the new resolution immediately.
    const { body: dash } = await request(app).get('/api/dashboard');
    expect(dash.resolvedToday).toBeGreaterThanOrEqual(1);
  });
});
