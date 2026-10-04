/**
 * Trust-proxy + rate-limiter integration tests — covers SEC-010.
 *
 * When trust proxy is enabled (TRUST_PROXY=1), Express honours the
 * X-Forwarded-For header as req.ip, so each distinct forwarded address gets
 * its own rate-limit bucket.
 *
 * When trust proxy is disabled (default dev behaviour), X-Forwarded-For is
 * ignored and req.ip is the socket address — all supertest requests share the
 * same loopback-address bucket regardless of what the header says.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createDb, seed } from '../server/db.js';
import { createApp } from '../server/app.js';
import { createRateLimiter } from '../server/middleware/security.js';

// ---------------------------------------------------------------------------
// Helper: build an app with trust proxy controlled via TRUST_PROXY env var.
// We attach a /probe route with a tiny per-IP limiter (max 2 req / 60 s) so
// tests don't need to fire 120 requests to exhaust the real globalLimiter.
// ---------------------------------------------------------------------------
function buildApp(trustProxyValue) {
  const saved = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = String(trustProxyValue);

  const db = createDb(':memory:');
  seed(db);
  const app = createApp(db);

  if (saved === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = saved;

  // Dedicated probe route with a fresh tiny limiter (2 req / IP / 60 s).
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
  app.get('/probe', limiter, (_req, res) => res.json({ ok: true }));

  return app;
}

// ---------------------------------------------------------------------------
// Trust proxy ON: each forwarded IP is an independent rate-limit bucket
// ---------------------------------------------------------------------------
describe('SEC-010: trust proxy ON — X-Forwarded-For creates distinct buckets', () => {
  let app;
  beforeEach(() => { app = buildApp(1); });

  it('allows 2 requests from a forwarded IP without rate-limiting', async () => {
    for (let i = 0; i < 2; i++) {
      const res = await request(app)
        .get('/probe')
        .set('X-Forwarded-For', '10.0.0.1');
      expect(res.status).toBe(200);
    }
  });

  it('blocks the 3rd request from the same forwarded IP', async () => {
    for (let i = 0; i < 2; i++) {
      await request(app).get('/probe').set('X-Forwarded-For', '10.0.0.1');
    }
    const res = await request(app).get('/probe').set('X-Forwarded-For', '10.0.0.1');
    expect(res.status).toBe(429);
  });

  it('client-B is unaffected when client-A exhausts its own bucket', async () => {
    // Exhaust 10.0.0.1
    for (let i = 0; i < 2; i++) {
      await request(app).get('/probe').set('X-Forwarded-For', '10.0.0.1');
    }
    const blocked = await request(app).get('/probe').set('X-Forwarded-For', '10.0.0.1');
    expect(blocked.status).toBe(429);

    // 10.0.0.2 has its own fresh 2-request budget
    const res = await request(app).get('/probe').set('X-Forwarded-For', '10.0.0.2');
    expect(res.status).toBe(200);
  });

  it('two different forwarded IPs each have their own independent budget', async () => {
    for (const ip of ['192.168.1.10', '192.168.1.20']) {
      for (let i = 0; i < 2; i++) {
        const res = await request(app).get('/probe').set('X-Forwarded-For', ip);
        expect(res.status).toBe(200);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Trust proxy OFF: X-Forwarded-For is ignored; all requests share the socket
// address (loopback in supertest) and thus the same rate-limit bucket
// ---------------------------------------------------------------------------
describe('SEC-010: trust proxy OFF — X-Forwarded-For header is ignored', () => {
  let app;
  beforeEach(() => { app = buildApp('false'); });

  it('different X-Forwarded-For values do NOT create separate buckets', async () => {
    // Use up 2 requests with header claiming 10.0.0.1
    for (let i = 0; i < 2; i++) {
      await request(app).get('/probe').set('X-Forwarded-For', '10.0.0.1');
    }
    // A request with a completely different forwarded IP is still blocked
    // because req.ip resolves to the socket address (same loopback bucket)
    const res = await request(app).get('/probe').set('X-Forwarded-For', '10.0.0.99');
    expect(res.status).toBe(429);
  });

  it('mixes of forwarded and plain requests all deplete the same bucket', async () => {
    // One plain request, then one with a forwarded IP — both hit the same bucket
    await request(app).get('/probe');
    await request(app).get('/probe').set('X-Forwarded-For', '5.5.5.5');

    // Bucket is now exhausted (loopback address, regardless of header)
    const res = await request(app).get('/probe');
    expect(res.status).toBe(429);
  });
});
