import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';
import { getSlaStatus, getDeadline } from '../server/services/sla.js';
import { SLA_WINDOWS_MS } from '../server/config/sla.js';

// ---------------------------------------------------------------------------
// Pure unit tests — no DB, no HTTP
// ---------------------------------------------------------------------------

describe('getDeadline', () => {
  const created_at = '2024-01-01T00:00:00.000Z';

  it('returns deadline = created_at + window for each priority', () => {
    for (const [priority, ms] of Object.entries(SLA_WINDOWS_MS)) {
      const deadline = getDeadline({ priority, created_at });
      expect(deadline).toBeInstanceOf(Date);
      expect(deadline.getTime()).toBe(new Date(created_at).getTime() + ms);
    }
  });

  it('returns null for an unrecognised priority', () => {
    expect(getDeadline({ priority: 'Urgent', created_at })).toBeNull();
  });
});

describe('getSlaStatus — active incidents', () => {
  const created_at = '2024-01-01T00:00:00.000Z'; // deadline for Critical = +1h

  it('returns overdue=false and a "remaining" label when within window', () => {
    const now = new Date('2024-01-01T00:30:00.000Z'); // 30 min in, 30 min left
    const sla = getSlaStatus({ priority: 'Critical', status: 'Open', created_at }, now);
    expect(sla).not.toBeNull();
    expect(sla.overdue).toBe(false);
    expect(sla.msRemaining).toBe(30 * 60 * 1000);
    expect(sla.label).toBe('30m remaining');
  });

  it('returns overdue=true and an "Overdue by" label when past deadline', () => {
    const now = new Date('2024-01-01T02:05:00.000Z'); // 1h 5m overdue
    const sla = getSlaStatus({ priority: 'Critical', status: 'Open', created_at }, now);
    expect(sla).not.toBeNull();
    expect(sla.overdue).toBe(true);
    expect(sla.msRemaining).toBeLessThan(0);
    expect(sla.label).toBe('Overdue by 1h 5m');
  });

  it('returns "Due now" when exactly at the deadline', () => {
    const now = new Date('2024-01-01T01:00:00.000Z'); // exactly at Critical deadline
    const sla = getSlaStatus({ priority: 'Critical', status: 'Open', created_at }, now);
    expect(sla).not.toBeNull();
    expect(sla.msRemaining).toBe(0);
    expect(sla.overdue).toBe(false);
    expect(sla.label).toBe('Due now');
  });

  it('returns "< 1m remaining" when less than 1 minute left', () => {
    const now = new Date('2024-01-01T00:59:30.000Z'); // 30 seconds left
    const sla = getSlaStatus({ priority: 'Critical', status: 'Open', created_at }, now);
    expect(sla.label).toBe('< 1m remaining');
  });

  it('formats hours and minutes correctly when exactly 60 minutes remaining', () => {
    // High window = 4h; now = 3h in → 1h remaining
    const now = new Date('2024-01-01T03:00:00.000Z');
    const sla = getSlaStatus({ priority: 'High', status: 'Investigating', created_at }, now);
    expect(sla.label).toBe('1h 0m remaining');
  });

  it('includes the correct target string for each priority', () => {
    const expectations = {
      Critical: 'Target: 1 hour',
      High:     'Target: 4 hours',
      Medium:   'Target: 8 hours',
      Low:      'Target: 24 hours',
    };
    const now = new Date('2024-01-01T00:01:00.000Z'); // well within any window
    for (const [priority, target] of Object.entries(expectations)) {
      const sla = getSlaStatus({ priority, status: 'Open', created_at }, now);
      expect(sla.target).toBe(target);
    }
  });

  it('contains deadline as an ISO string', () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const sla = getSlaStatus({ priority: 'Critical', status: 'Open', created_at }, now);
    expect(sla.deadline).toBe('2024-01-01T01:00:00.000Z');
  });
});

describe('getSlaStatus — resolved / closed incidents', () => {
  const incident = { priority: 'Critical', created_at: '2024-01-01T00:00:00.000Z' };

  it('returns null for Resolved', () => {
    expect(getSlaStatus({ ...incident, status: 'Resolved' })).toBeNull();
  });

  it('returns null for Closed', () => {
    expect(getSlaStatus({ ...incident, status: 'Closed' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration tests — real DB + HTTP via supertest
// ---------------------------------------------------------------------------

let app;
beforeEach(() => { const db = createDb(':memory:'); seed(db); app = createApp(db); });

const create = (b = {}) =>
  request(app).post('/api/incidents').send({ title: 'SLA test incident', ...b });

describe('GET /api/incidents — sla field', () => {
  it('each active incident row has a sla object with required fields', async () => {
    const { body } = await request(app).get('/api/incidents').expect(200);
    const active = body.filter((i) => !['Resolved', 'Closed'].includes(i.status));
    expect(active.length).toBeGreaterThan(0);
    for (const i of active) {
      expect(i.sla).not.toBeNull();
      expect(typeof i.sla.deadline).toBe('string');
      expect(typeof i.sla.msRemaining).toBe('number');
      expect(typeof i.sla.overdue).toBe('boolean');
      expect(typeof i.sla.label).toBe('string');
      expect(typeof i.sla.target).toBe('string');
      expect(i.sla.target).toMatch(/^Target:/);
    }
  });

  it('resolved and closed incidents have sla = null', async () => {
    const { body } = await request(app).get('/api/incidents').expect(200);
    const done = body.filter((i) => ['Resolved', 'Closed'].includes(i.status));
    for (const i of done) {
      expect(i.sla).toBeNull();
    }
  });

  it('a freshly created incident is not overdue', async () => {
    const { body: i } = await create({ priority: 'Low' }).expect(201);
    expect(i.sla).not.toBeNull();
    expect(i.sla.overdue).toBe(false);
  });
});

describe('GET /api/incidents/:id — sla field', () => {
  it('returns sla object for an active incident', async () => {
    const { body: i } = await create({ priority: 'Critical' }).expect(201);
    const { body } = await request(app).get(`/api/incidents/${i.id}`).expect(200);
    expect(body.sla).not.toBeNull();
    expect(body.sla.target).toBe('Target: 1 hour');
    expect(body.sla.overdue).toBe(false);
  });

  it('returns sla = null after resolving an incident', async () => {
    const { body: i } = await create({ priority: 'High' }).expect(201);
    await request(app)
      .patch(`/api/incidents/${i.id}`)
      .send({ status: 'Resolved', resolution: 'All good' })
      .expect(200);
    const { body } = await request(app).get(`/api/incidents/${i.id}`).expect(200);
    expect(body.sla).toBeNull();
  });
});

describe('GET /api/dashboard — overdueIncidents', () => {
  it('includes overdueIncidents as a non-negative integer', async () => {
    const { body } = await request(app).get('/api/dashboard').expect(200);
    expect(typeof body.overdueIncidents).toBe('number');
    expect(body.overdueIncidents).toBeGreaterThanOrEqual(0);
  });

  it('resolving an overdue incident decrements overdueIncidents', async () => {
    // All seed incidents were created in the past, so at least some are overdue.
    const before = (await request(app).get('/api/dashboard')).body;
    if (before.overdueIncidents === 0) return; // nothing to resolve — skip

    // Find an overdue active incident and resolve it.
    const incidents = (await request(app).get('/api/incidents')).body;
    const overdue = incidents.find((i) => i.sla?.overdue && !['Resolved', 'Closed'].includes(i.status));
    if (!overdue) return;

    await request(app)
      .patch(`/api/incidents/${overdue.id}`)
      .send({ status: 'Resolved', resolution: 'Fixed' })
      .expect(200);

    const after = (await request(app).get('/api/dashboard')).body;
    expect(after.overdueIncidents).toBe(before.overdueIncidents - 1);
  });
});
