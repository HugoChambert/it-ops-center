import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';
import { getProvider } from '../server/ai/index.js';

let db, app;
beforeEach(() => { db = createDb(':memory:'); seed(db); app = createApp(db, { ai: getProvider({}) }); });

describe('POST /api/incidents/:id/troubleshoot', () => {
  it('returns VPN recommendations, labelled as not a confirmed diagnosis', async () => {
    const { body } = await request(app).post('/api/incidents/1/troubleshoot').expect(200);
    expect(body.investigation).toHaveLength(5);
    expect(body.commands.some((c) => c.command.startsWith('Test-NetConnection vpn.company.local'))).toBe(true);
    expect(body.disclaimer).toMatch(/not a confirmed diagnosis/i);
    expect(body.confidence).not.toBe('certain');
    expect(body.relatedArticles[0].title).toMatch(/VPN/);
  });
  it('falls back to generic guidance for unrecognised problems', async () => {
    const { body: i } = await request(app).post('/api/incidents').send({ title: 'Strange beeping noise' });
    const { body } = await request(app).post(`/api/incidents/${i.id}/troubleshoot`).expect(200);
    expect(body.possibleCause).toMatch(/not clear/i);
  });
  it('returns 404 for an unknown incident', async () => {
    await request(app).post('/api/incidents/999/troubleshoot').expect(404);
  });
  it('returns 501 with a clear message for an unimplemented provider', async () => {
    const a = createApp(db, { ai: getProvider({ AI_PROVIDER: 'other' }) });
    const res = await request(a).post('/api/incidents/1/troubleshoot').expect(501);
    expect(res.body.error).toMatch(/not implemented/);
  });
});
