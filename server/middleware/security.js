/**
 * Hand-rolled security middleware (no external dependencies).
 *
 * Covers:
 *   SEC-004 — security headers (CSP, X-Frame-Options, X-Content-Type-Options,
 *              Referrer-Policy, X-Permitted-Cross-Domain-Policies, HSTS)
 *   SEC-002 — global API rate limiter (120 req / 60 s per IP)
 *   SEC-005 — tighter AI-endpoint rate limiter (10 req / 60 s per IP)
 */

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

/**
 * Sets a conservative set of security-relevant HTTP response headers.
 * Applied globally to every response.
 */
export function securityHeaders(_req, res, next) {
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Block framing (clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');

  // Don't send the Referer header to third parties
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Minimal CSP: same-origin only for scripts and objects; styles/images relaxed for inline Tailwind
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",   // Vite prod bundles are inlined; tighten with hashes if you add a build step
      "style-src 'self' 'unsafe-inline'",    // Tailwind uses inline styles
      "img-src 'self' data:",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  );

  // Disable Flash / PDF cross-domain policies
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // HSTS (only meaningful over HTTPS; harmless over HTTP)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  next();
}

// ---------------------------------------------------------------------------
// In-process rate limiter
// ---------------------------------------------------------------------------

/**
 * Creates a simple token-bucket rate limiter middleware.
 *
 * @param {{ windowMs: number, max: number }} options
 *   windowMs — sliding window length in milliseconds
 *   max      — maximum requests allowed per IP per window
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter({ windowMs, max }) {
  // Map from IP → array of request timestamps (pruned each call)
  const store = new Map();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Retrieve and prune old timestamps
    const hits = (store.get(ip) || []).filter((t) => t > windowStart);

    if (hits.length >= max) {
      const retryAfter = Math.ceil((hits[0] - windowStart) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }

    hits.push(now);
    store.set(ip, hits);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(max - hits.length));

    next();
  };
}

/** Global limiter: 120 requests per IP per 60 s */
export const globalLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

/** AI limiter: 10 requests per IP per 60 s (cost-sensitive endpoints) */
export const aiLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
