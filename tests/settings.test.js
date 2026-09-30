import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';
import { getProvider } from '../server/ai/index.js';

let app;
beforeEach(() => { const db = createDb(':memory:'); seed(db); app = createApp(db, { ai: getProvider({}) }); });

describe('settings', () => {
  it('returns defaults and the AI provider name', async () => {
    const { body } = await request(app).get('/api/settings').expect(200);
    expect(body.settings).toEqual({ technician_name: 'Hugo Chambert', default_priority: 'Medium' });
    expect(body.ai.provider).toBe('mock');
  });
  it('saves changes and validates input', async () => {
    const { body } = await request(app).put('/api/settings').send({ technician_name: ' Alex Kim ', default_priority: 'High' }).expect(200);
    expect(body.settings.technician_name).toBe('Alex Kim');
    expect((await request(app).get('/api/settings')).body.settings.default_priority).toBe('High');
    await request(app).put('/api/settings').send({ technician_name: '  ' }).expect(400);
    await request(app).put('/api/settings').send({ default_priority: 'Urgent' }).expect(400);
  });
  it('applies the default priority and name to new incidents', async () => {
    await request(app).put('/api/settings').send({ technician_name: 'Alex Kim', default_priority: 'Low' });
    const { body } = await request(app).post('/api/incidents').send({ title: 'Test' }).expect(201);
    expect(body.priority).toBe('Low');
    expect(body.events[0].author).toBe('Alex Kim');
  });
  it('never returns the API key', async () => {
    process.env.AI_API_KEY = 'secret-test-key';
    try {
      const res = await request(app).get('/api/settings');
      expect(res.body.ai.keyConfigured).toBe(true);
      expect(JSON.stringify(res.body)).not.toContain('secret-test-key');
    } finally { delete process.env.AI_API_KEY; }
  });
});
