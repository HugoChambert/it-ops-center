import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';
import { getAnalytics } from '../server/services/analytics.js';

// ---------------------------------------------------------------------------
// Helpers — build a bare-schema DB with no seed data for exact-value tests
// ---------------------------------------------------------------------------
function freshDb() {
  const db = createDb(':memory:');
  return db;
}

/**
 * Insert a resolved incident directly. times are Date objects or ISO strings.
 * priority defaults to 'Medium', status to 'Resolved'.
 */
function insertResolved(db, { priority = 'Medium', status = 'Resolved', createdAt, resolvedAt, title = 'Test incident' }) {
  const c = createdAt instanceof Date ? createdAt.toISOString() : createdAt;
  const r = resolvedAt instanceof Date ? resolvedAt.toISOString() : resolvedAt;
  db.prepare(
    `INSERT INTO incidents (title,description,priority,status,assignee,affected_user,system_id,created_at,updated_at,resolved_at,resolution)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(title, '', priority, status, null, null, null, c, r, r, 'Fixed');
}

// ---------------------------------------------------------------------------
// Unit tests — pure function, hand-crafted rows, exact expected values
// ---------------------------------------------------------------------------

describe('getAnalytics — MTTR exact values', () => {
  it('single High incident resolved in exactly 4 hours → mttrMs = 14400000', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T10:00:00.000Z');
    const resolved = new Date('2024-06-01T14:00:00.000Z'); // exactly 4h later
    insertResolved(db, { priority: 'High', createdAt: base, resolvedAt: resolved });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.mttrByPriority.High.mttrMs).toBe(14_400_000);
    expect(result.mttrByPriority.High.count).toBe(1);
  });

  it('two Medium incidents with 7h and 9h resolution → mean = 8h = 28800000 ms', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    insertResolved(db, { priority: 'Medium', createdAt: base, resolvedAt: new Date(base.getTime() + 7 * 3600_000) });
    insertResolved(db, { priority: 'Medium', createdAt: base, resolvedAt: new Date(base.getTime() + 9 * 3600_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.mttrByPriority.Medium.mttrMs).toBe(28_800_000); // mean(7h, 9h) = 8h
    expect(result.mttrByPriority.Medium.count).toBe(2);
  });

  it('priority with no resolved incidents → count = 0, mttrMs = null, mttrHuman = "No data"', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    insertResolved(db, { priority: 'High', createdAt: base, resolvedAt: new Date(base.getTime() + 3 * 3600_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    // Critical has no rows
    expect(result.mttrByPriority.Critical.count).toBe(0);
    expect(result.mttrByPriority.Critical.mttrMs).toBeNull();
    expect(result.mttrByPriority.Critical.mttrHuman).toBe('No data');
  });

  it('overall MTTR is the mean across all priorities', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    // 2h High + 6h Low = mean 4h = 14400000 ms
    insertResolved(db, { priority: 'High', createdAt: base, resolvedAt: new Date(base.getTime() + 2 * 3600_000) });
    insertResolved(db, { priority: 'Low', createdAt: base, resolvedAt: new Date(base.getTime() + 6 * 3600_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.mttrByPriority.overall.mttrMs).toBe(14_400_000);
    expect(result.mttrByPriority.overall.count).toBe(2);
  });

  it('mttrHuman for 90 minutes returns "1h 30m"', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    insertResolved(db, { priority: 'Medium', createdAt: base, resolvedAt: new Date(base.getTime() + 90 * 60_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.mttrByPriority.Medium.mttrHuman).toBe('1h 30m');
  });

  it('mttrHuman for exactly 60 minutes returns "1h 0m"', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    insertResolved(db, { priority: 'Medium', createdAt: base, resolvedAt: new Date(base.getTime() + 60 * 60_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.mttrByPriority.Medium.mttrHuman).toBe('1h 0m');
  });

  it('mttrHuman for less than 1 minute returns "< 1m"', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    insertResolved(db, { priority: 'Medium', createdAt: base, resolvedAt: new Date(base.getTime() + 30_000) }); // 30 seconds
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.mttrByPriority.Medium.mttrHuman).toBe('< 1m');
  });

  it('mttrHuman for exactly 1 hour returns "1h 0m"', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    insertResolved(db, { priority: 'Critical', createdAt: base, resolvedAt: new Date(base.getTime() + 3_600_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.mttrByPriority.Critical.mttrHuman).toBe('1h 0m');
  });
});

describe('getAnalytics — SLA compliance exact values', () => {
  it('High incident resolved in 3h (window 4h) → withinSla = 1, rate = 100', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    insertResolved(db, { priority: 'High', createdAt: base, resolvedAt: new Date(base.getTime() + 3 * 3600_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.complianceByPriority.High.withinSla).toBe(1);
    expect(result.complianceByPriority.High.rate).toBe(100);
  });

  it('High incident resolved in 5h (window 4h) → withinSla = 0, rate = 0', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    insertResolved(db, { priority: 'High', createdAt: base, resolvedAt: new Date(base.getTime() + 5 * 3600_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.complianceByPriority.High.withinSla).toBe(0);
    expect(result.complianceByPriority.High.rate).toBe(0);
  });

  it('two High incidents: 3h (within) and 5h (outside) → rate = 50', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    insertResolved(db, { priority: 'High', createdAt: base, resolvedAt: new Date(base.getTime() + 3 * 3600_000) });
    insertResolved(db, { priority: 'High', createdAt: base, resolvedAt: new Date(base.getTime() + 5 * 3600_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.complianceByPriority.High.resolved).toBe(2);
    expect(result.complianceByPriority.High.withinSla).toBe(1);
    expect(result.complianceByPriority.High.rate).toBe(50);
  });

  it('priority with no resolved incidents → rate = null', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    insertResolved(db, { priority: 'High', createdAt: base, resolvedAt: new Date(base.getTime() + 3 * 3600_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.complianceByPriority.Low.rate).toBeNull();
    expect(result.complianceByPriority.Low.resolved).toBe(0);
  });

  it('overall compliance counts across all priorities', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    // High: within (3h of 4h window)
    insertResolved(db, { priority: 'High', createdAt: base, resolvedAt: new Date(base.getTime() + 3 * 3600_000) });
    // Medium: outside (10h of 8h window)
    insertResolved(db, { priority: 'Medium', createdAt: base, resolvedAt: new Date(base.getTime() + 10 * 3600_000) });
    // Low: within (20h of 24h window)
    insertResolved(db, { priority: 'Low', createdAt: base, resolvedAt: new Date(base.getTime() + 20 * 3600_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.complianceByPriority.overall.resolved).toBe(3);
    expect(result.complianceByPriority.overall.withinSla).toBe(2);
    expect(result.complianceByPriority.overall.rate).toBe(67); // round(2/3 * 100) = 67
  });

  it('incidents with resolved_at = null are excluded from all calculations', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    // Insert an active (open) incident — should be ignored
    db.prepare(
      `INSERT INTO incidents (title,description,priority,status,created_at,updated_at,resolved_at,resolution)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run('Open incident', '', 'High', 'Open', base.toISOString(), base.toISOString(), null, '');
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.complianceByPriority.overall.resolved).toBe(0);
  });

  it('High incident resolved at exactly the SLA deadline (4h) → withinSla = 1 (inclusive boundary)', () => {
    const db = freshDb();
    const base = new Date('2024-06-01T00:00:00.000Z');
    // resolved_at - created_at = exactly 4h = SLA window for High
    insertResolved(db, { priority: 'High', createdAt: base, resolvedAt: new Date(base.getTime() + 4 * 3600_000) });
    const result = getAnalytics(db, new Date('2024-06-02T00:00:00.000Z'));
    expect(result.complianceByPriority.High.withinSla).toBe(1);
    expect(result.complianceByPriority.High.rate).toBe(100);
  });
});

describe('getAnalytics — 7-day trend', () => {
  it('trend always has exactly 7 entries', () => {
    const db = freshDb();
    const now = new Date('2024-06-07T12:00:00.000Z');
    const result = getAnalytics(db, now);
    expect(result.trend).toHaveLength(7);
  });

  it('days with no resolved incidents have count = 0, mttrMs = null, complianceRate = null', () => {
    const db = freshDb();
    const now = new Date('2024-06-07T12:00:00.000Z');
    const result = getAnalytics(db, now);
    for (const day of result.trend) {
      expect(day.count).toBe(0);
      expect(day.mttrMs).toBeNull();
      expect(day.complianceRate).toBeNull();
    }
  });

  it('each trend entry has date, count, mttrMs, complianceRate', () => {
    const db = freshDb();
    const now = new Date('2024-06-07T12:00:00.000Z');
    const result = getAnalytics(db, now);
    for (const day of result.trend) {
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('count');
      expect(day).toHaveProperty('mttrMs');
      expect(day).toHaveProperty('complianceRate');
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('incident resolved exactly 25h before now falls in yesterday bucket, not today', () => {
    const db = freshDb();
    const now = new Date('2024-06-07T12:00:00.000Z');
    // resolved 25h before now = 2024-06-06T11:00:00Z → UTC day 2024-06-06
    const resolvedAt = new Date(now.getTime() - 25 * 3600_000);
    const createdAt = new Date(resolvedAt.getTime() - 2 * 3600_000); // 2h to resolve
    insertResolved(db, { priority: 'Medium', createdAt, resolvedAt });
    const result = getAnalytics(db, now);
    // today bucket = 2024-06-07, yesterday = 2024-06-06
    const today = result.trend.find((d) => d.date === '2024-06-07');
    const yesterday = result.trend.find((d) => d.date === '2024-06-06');
    expect(today.count).toBe(0);
    expect(yesterday.count).toBe(1);
  });

  it('incident resolved within UTC today lands in today bucket', () => {
    const db = freshDb();
    const now = new Date('2024-06-07T12:00:00.000Z');
    // resolved 2h before now = 2024-06-07T10:00:00Z → UTC day 2024-06-07
    const resolvedAt = new Date(now.getTime() - 2 * 3600_000);
    const createdAt = new Date(resolvedAt.getTime() - 1 * 3600_000);
    insertResolved(db, { priority: 'Medium', createdAt, resolvedAt });
    const result = getAnalytics(db, now);
    const today = result.trend.find((d) => d.date === '2024-06-07');
    expect(today.count).toBe(1);
    expect(today.mttrMs).toBe(3_600_000); // 1h
  });

  it('trend complianceRate is 0–100 integer or null', () => {
    const db = freshDb();
    const now = new Date('2024-06-07T12:00:00.000Z');
    // Add one incident within SLA for today
    const resolvedAt = new Date(now.getTime() - 1 * 3600_000);
    const createdAt = new Date(resolvedAt.getTime() - 3 * 3600_000); // 3h (High window = 4h → within)
    insertResolved(db, { priority: 'High', createdAt, resolvedAt });
    const result = getAnalytics(db, now);
    const today = result.trend.find((d) => d.date === '2024-06-07');
    expect(today.complianceRate).toBe(100);
  });
});

describe('getAnalytics — empty case', () => {
  it('returns { empty: true, message } when there are no resolved incidents', () => {
    const db = freshDb();
    const result = getAnalytics(db, new Date('2024-06-07T12:00:00.000Z'));
    expect(result.empty).toBe(true);
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('empty message is the canonical string', () => {
    const db = freshDb();
    const result = getAnalytics(db, new Date());
    expect(result.message).toBe('No resolved incidents yet.');
  });
});

// ---------------------------------------------------------------------------
// Integration tests — real seeded DB + HTTP
// ---------------------------------------------------------------------------

let app;
beforeEach(() => { const db = createDb(':memory:'); seed(db); app = createApp(db); });

describe('GET /api/analytics', () => {
  it('returns 200', async () => {
    await request(app).get('/api/analytics').expect(200);
  });

  it('response has mttrByPriority, complianceByPriority, trend (or empty sentinel)', async () => {
    const { body } = await request(app).get('/api/analytics').expect(200);
    if (body.empty) {
      expect(typeof body.message).toBe('string');
    } else {
      expect(body).toHaveProperty('mttrByPriority');
      expect(body).toHaveProperty('complianceByPriority');
      expect(body).toHaveProperty('trend');
    }
  });

  it('trend is an array of length 7', async () => {
    const { body } = await request(app).get('/api/analytics').expect(200);
    if (!body.empty) {
      expect(Array.isArray(body.trend)).toBe(true);
      expect(body.trend).toHaveLength(7);
    }
  });

  it('each trend entry has date, count, mttrMs, complianceRate', async () => {
    const { body } = await request(app).get('/api/analytics').expect(200);
    if (!body.empty) {
      for (const day of body.trend) {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('count');
        expect(day).toHaveProperty('mttrMs');
        expect(day).toHaveProperty('complianceRate');
      }
    }
  });

  it('mttrByPriority has keys for all four priorities plus overall', async () => {
    const { body } = await request(app).get('/api/analytics').expect(200);
    if (!body.empty) {
      for (const key of ['Critical', 'High', 'Medium', 'Low', 'overall']) {
        expect(body.mttrByPriority).toHaveProperty(key);
      }
    }
  });

  it('complianceByPriority has keys for all four priorities plus overall', async () => {
    const { body } = await request(app).get('/api/analytics').expect(200);
    if (!body.empty) {
      for (const key of ['Critical', 'High', 'Medium', 'Low', 'overall']) {
        expect(body.complianceByPriority).toHaveProperty(key);
      }
    }
  });

  it('compliance rate values are integers between 0 and 100 (or null)', async () => {
    const { body } = await request(app).get('/api/analytics').expect(200);
    if (!body.empty) {
      for (const key of ['Critical', 'High', 'Medium', 'Low', 'overall']) {
        const { rate } = body.complianceByPriority[key];
        if (rate !== null) {
          expect(Number.isInteger(rate)).toBe(true);
          expect(rate).toBeGreaterThanOrEqual(0);
          expect(rate).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('with seed data: seed has resolved incidents so response is not empty', async () => {
    // INC-4 (Low, Resolved), INC-5 (High, Resolved), INC-6 (Medium, Closed) all have resolved_at
    const { body } = await request(app).get('/api/analytics').expect(200);
    expect(body.empty).toBeUndefined();
    expect(body).toHaveProperty('mttrByPriority');
  });

  it('seed resolved incidents contribute to overall count', async () => {
    const { body } = await request(app).get('/api/analytics').expect(200);
    expect(body.mttrByPriority.overall.count).toBeGreaterThanOrEqual(3); // INC-4, 5, 6
  });
});
