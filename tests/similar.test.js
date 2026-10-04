import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';
import { tokenise, scorePair, getSimilar } from '../server/services/similar.js';

// ---------------------------------------------------------------------------
// Unit tests — pure functions, no DB, no HTTP
// ---------------------------------------------------------------------------

describe('tokenise', () => {
  it('lowercases and splits on non-alphanumeric characters', () => {
    const tokens = tokenise('Hello, World! Foo-Bar');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
    expect(tokens).toContain('foo');
    expect(tokens).toContain('bar');
  });

  it('filters out tokens of 2 chars or fewer', () => {
    const tokens = tokenise('a ab abc abcd');
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('ab');
    expect(tokens).toContain('abc');
    expect(tokens).toContain('abcd');
  });

  it('filters out common stop words', () => {
    const tokens = tokenise('the user cannot connect to the server');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('user');
    expect(tokens).not.toContain('cannot');
    expect(tokens).not.toContain('connect');
    expect(tokens).toContain('server');
  });

  it('returns a Set (deduplicated)', () => {
    const tokens = tokenise('database database replication replication');
    expect(tokens).toBeInstanceOf(Set);
    expect([...tokens].filter((t) => t === 'database')).toHaveLength(1);
  });
});

describe('scorePair', () => {
  it('returns score 0 and empty matchedWords when there is no keyword overlap', () => {
    const qTokens = tokenise('network firewall outage');
    const result = scorePair(qTokens, 'Print queue stuck', '', '');
    expect(result.score).toBe(0);
    expect(result.matchedWords).toEqual([]);
  });

  it('weights title matches at 2 and body matches at 1', () => {
    const qTokens = tokenise('database replication lag');
    // title match on "replication" (weight 2) + body match on "database" (weight 1) = 3
    const result = scorePair(qTokens, 'Replication stopped', 'database upgrade caused issue', '');
    expect(result.score).toBe(3);
  });

  it('counts distinct matched words across title and body (no double-counting in matchedWords)', () => {
    const qTokens = tokenise('database replication lag');
    const result = scorePair(qTokens, 'Replication stopped', 'database replication issue', '');
    // "replication" in title + "database" in body + "replication" in body → unique matchedWords: [database, replication]
    expect(result.matchedWords).toHaveLength(2);
    expect(result.matchedWords).toContain('database');
    expect(result.matchedWords).toContain('replication');
  });

  it('matchedWords is sorted alphabetically', () => {
    const qTokens = tokenise('zebra apple mango');
    const result = scorePair(qTokens, 'mango zebra apple', '', '');
    expect(result.matchedWords).toEqual([...result.matchedWords].sort());
  });

  it('matchedWords is capped at 8 entries', () => {
    // Create a query with 10 unique meaningful tokens
    const qTokens = new Set(['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet']);
    const title = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet';
    const result = scorePair(qTokens, title, '', '');
    expect(result.matchedWords.length).toBeLessThanOrEqual(8);
  });
});

describe('getSimilar — with an in-memory DB', () => {
  let db;
  beforeEach(() => {
    db = createDb(':memory:');
    seed(db);
  });

  it('returns an object with incidents, articles, and disclaimer arrays/string', () => {
    // INC-1 is active; find similar based on its tokens
    const incident = db.prepare('SELECT * FROM incidents WHERE id = 1').get();
    const result = getSimilar(db, incident);
    expect(result).toHaveProperty('incidents');
    expect(result).toHaveProperty('articles');
    expect(result).toHaveProperty('disclaimer');
    expect(Array.isArray(result.incidents)).toBe(true);
    expect(Array.isArray(result.articles)).toBe(true);
    expect(typeof result.disclaimer).toBe('string');
  });

  it('disclaimer equals the required string', () => {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = 1').get();
    const { disclaimer } = getSimilar(db, incident);
    expect(disclaimer).toBe('Suggestions based on past incidents, not a confirmed diagnosis.');
  });

  it('returns at most 3 incidents', () => {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = 1').get();
    const { incidents } = getSimilar(db, incident);
    expect(incidents.length).toBeLessThanOrEqual(3);
  });

  it('returns at most 3 articles', () => {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = 1').get();
    const { articles } = getSimilar(db, incident);
    expect(articles.length).toBeLessThanOrEqual(3);
  });

  it('only returns Resolved or Closed incidents as candidates', () => {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = 1').get();
    const { incidents } = getSimilar(db, incident);
    for (const r of incidents) {
      const row = db.prepare('SELECT status FROM incidents WHERE id = ?').get(r.id);
      expect(['Resolved', 'Closed']).toContain(row.status);
    }
  });

  it('never returns the query incident itself', () => {
    // Resolve INC-1 so it becomes a candidate, then use INC-2 as the query
    db.prepare("UPDATE incidents SET status='Resolved', resolution='Fixed', resolved_at=datetime('now') WHERE id=1").run();
    const incident = db.prepare('SELECT * FROM incidents WHERE id = 2').get();
    const { incidents } = getSimilar(db, incident);
    expect(incidents.map((r) => r.id)).not.toContain(2);
  });

  it('each incident result has id, title, resolution, matchedWords, score', () => {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = 1').get();
    const { incidents } = getSimilar(db, incident);
    for (const r of incidents) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('resolution');
      expect(r).toHaveProperty('matchedWords');
      expect(r).toHaveProperty('score');
      expect(Array.isArray(r.matchedWords)).toBe(true);
      expect(typeof r.score).toBe('number');
    }
  });

  it('each article result has id, title, resolution, matchedWords, score', () => {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = 1').get();
    const { articles } = getSimilar(db, incident);
    for (const r of articles) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('resolution');
      expect(r).toHaveProperty('matchedWords');
      expect(r).toHaveProperty('score');
    }
  });

  it('returns empty arrays (not null) when nothing matches', () => {
    // Insert an incident with a unique nonsense word that no candidate contains
    db.prepare("INSERT INTO incidents (title,description,priority,status,assignee,affected_user,system_id,created_at,updated_at,resolved_at) VALUES (?,?,?,?,?,?,?,datetime('now'),datetime('now'),null)")
      .run('Zyx Qwvxz Pljk', '', 'Low', 'Open', null, null, null);
    const incident = db.prepare('SELECT * FROM incidents ORDER BY id DESC LIMIT 1').get();
    const { incidents, articles } = getSimilar(db, incident);
    expect(incidents).toEqual([]);
    expect(articles).toEqual([]);
  });

  it('results are sorted by score descending', () => {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = 1').get();
    const { incidents } = getSimilar(db, incident);
    for (let i = 1; i < incidents.length; i++) {
      expect(incidents[i - 1].score).toBeGreaterThanOrEqual(incidents[i].score);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration tests — HTTP via supertest
// ---------------------------------------------------------------------------

let app;
beforeEach(() => { const db = createDb(':memory:'); seed(db); app = createApp(db); });

describe('GET /api/incidents/:id/similar', () => {
  it('returns 200 with disclaimer, incidents, and articles for a valid incident', async () => {
    const { body } = await request(app).get('/api/incidents/1/similar').expect(200);
    expect(body).toHaveProperty('disclaimer');
    expect(body).toHaveProperty('incidents');
    expect(body).toHaveProperty('articles');
    expect(Array.isArray(body.incidents)).toBe(true);
    expect(Array.isArray(body.articles)).toBe(true);
  });

  it('returns 404 for an incident that does not exist', async () => {
    const { body } = await request(app).get('/api/incidents/9999/similar').expect(404);
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 400 for a non-integer id', async () => {
    const { body } = await request(app).get('/api/incidents/abc/similar').expect(400);
    expect(body.error).toMatch(/invalid id/i);
  });

  it('returns 400 for id = 0', async () => {
    await request(app).get('/api/incidents/0/similar').expect(400);
  });

  it('article 1 matches INC-1 because they share authentication-related keywords', async () => {
    // INC-1: "Unable to connect to corporate VPN" + "Users report authentication failures."
    // Article 1 (VPN Certificate Troubleshooting) contains "authentication" and "vpn"
    const { body } = await request(app).get('/api/incidents/1/similar').expect(200);
    const articleIds = body.articles.map((a) => a.id);
    expect(articleIds).toContain(1);
  });

  it('matched words on article result are a non-empty array of strings', async () => {
    const { body } = await request(app).get('/api/incidents/1/similar').expect(200);
    if (body.articles.length > 0) {
      const first = body.articles[0];
      expect(Array.isArray(first.matchedWords)).toBe(true);
      expect(first.matchedWords.length).toBeGreaterThan(0);
      for (const w of first.matchedWords) expect(typeof w).toBe('string');
    }
  });

  it('works for a resolved incident as the query (INC-4)', async () => {
    const { body } = await request(app).get('/api/incidents/4/similar').expect(200);
    expect(body).toHaveProperty('disclaimer');
    expect(Array.isArray(body.incidents)).toBe(true);
  });
});
