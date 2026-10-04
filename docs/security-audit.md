# Security Audit — OWASP ASVS Level 1

| | |
|---|---|
| **Date** | 2026-10-03 |
| **Scope** | Full server and client source (`server/`, `src/`) |
| **Standard** | OWASP Application Security Verification Standard 4.0 — Level 1 |
| **Auditor** | Bob (AI-assisted code review) |
| **Application code changed** | No |

---

## Executive Summary

The IT Operations Center is an internal-facing single-page application without an authentication layer — a design choice that is acceptable for a locally-run or intranet tool but requires explicit documentation and hardening before any internet-facing deployment. The most impactful gaps are the complete absence of security headers, no request rate limiting or body-size cap, and the lack of any authentication or access control. Combined, these create a realistic path for an unauthenticated attacker to exhaust server resources, exfiltrate all incident and personnel data, or abuse the AI integration at the operator's cost. All findings are straightforward to fix with small, well-known middleware additions.

---

## Findings Summary

| ID | Severity | Category | Description |
|----|----------|----------|-------------|
| [SEC-001](#sec-001) | High | Authentication & Access Control | No authentication — all API endpoints are publicly accessible |
| [SEC-002](#sec-002) | High | Rate Limiting | No rate-limiter on any endpoint — **Fixed 2026-10-03** |
| [SEC-003](#sec-003) | High | Rate Limiting | `express.json()` has no body-size limit — **Fixed 2026-10-03** |
| [SEC-004](#sec-004) | High | Security Headers | No security headers (`Helmet` or equivalent) — **Fixed 2026-10-03** |
| [SEC-005](#sec-005) | Medium | Rate Limiting | AI endpoints have no additional throttling — **Fixed 2026-10-03** |
| [SEC-006](#sec-006) | Medium | Input Validation | Route `:id` parameters are not validated before use — **Fixed 2026-10-03** |
| [SEC-007](#sec-007) | Medium | Input Validation | No maximum-length enforcement on free-text fields |
| [SEC-008](#sec-008) | Low | Error Handling | Unexpected errors are logged but the log destination is stdout only — **Fixed 2026-10-03** |
| [SEC-009](#sec-009) | Low | Secrets Handling | `.env.example` ships with an empty `AI_API_KEY` — no strength guidance |

---

## Full Finding Details

---

### SEC-001

**Severity:** High
**Category:** V4 — Authentication & Access Control
**Status:** Open — intentionally deferred for the demo deployment. A "Known Limitations" section has been added to `README.md` documenting what a production version would require.
**Evidence:** [`server/app.js` line 10–65](../server/app.js) — `createApp` registers every route with no authentication middleware.

**Why it matters:**  
Every API endpoint (`/api/incidents`, `/api/articles`, `/api/settings`, `/api/systems`, AI endpoints) is callable by anyone who can reach the server. An unauthenticated user can read all incident records including affected user names, change incident status and priority, write arbitrary notes, trigger AI troubleshooting (which may consume paid API quota), and overwrite the technician's name in Settings. On a network-accessible deployment this is a direct data-exposure risk.

**Recommended fix:**  
For a minimal internal deployment, add a single bearer-token middleware before all `/api` routes:

```js
// In createApp, immediately after app.use(express.json())
const API_TOKEN = process.env.API_TOKEN;
if (API_TOKEN) {
  app.use('/api', (req, res, next) => {
    if (req.headers.authorization === `Bearer ${API_TOKEN}`) return next();
    res.status(401).json({ error: 'Unauthorised' });
  });
}
```

Set `API_TOKEN` in the environment. For multi-user deployments, use a proper session/JWT middleware (e.g. `express-session` + a login page, or an upstream reverse-proxy SSO).

---

### SEC-002

**Severity:** High
**Category:** V13 — Rate Limiting
**Status:** ✅ Fixed 2026-10-03 — hand-rolled sliding-window rate limiter in [`server/middleware/security.js`](../server/middleware/security.js). Applied as `globalLimiter` (120 req/60 s/IP) to all `/api` routes. No new dependencies.
**Evidence:** [`server/app.js` line 10–65](../server/app.js) — no rate-limiter middleware is imported or registered. The `package.json` ([`package.json` line 15](../package.json)) does not list `express-rate-limit`.

**Why it matters:**  
Without rate limiting, an attacker (or a misconfigured client) can flood every endpoint at full server speed. This enables brute-force enumeration of all incident IDs, DoS via CPU/SQLite contention, and abuse of the AI endpoints at the operator's API-key cost. In production (Render) the free tier has limited CPU, making this especially easy to trigger.

**Recommended fix:**  
```bash
npm install express-rate-limit
```
```js
import rateLimit from 'express-rate-limit';

// In createApp, after express.json()
app.use('/api', rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
```
Tune `max` to your expected concurrent user count. See SEC-005 for tighter limits on AI endpoints.

---

### SEC-003

**Severity:** High
**Category:** V13 — Request Constraints
**Status:** ✅ Fixed 2026-10-03 — changed to `express.json({ limit: '64kb' })` in [`server/app.js` line 22](../server/app.js).
**Evidence:** [`server/app.js` line 12](../server/app.js) — `app.use(express.json())` with no options.

**Why it matters:**  
Express's default body-size limit is 100 KB. A client can POST a multi-megabyte JSON body to any write endpoint, saturating RAM and blocking the event loop. For a single-process Node server backed by a synchronous SQLite driver this is a reliable DoS vector. Fields like `description`, `symptoms`, `causes`, and `diagnostic_steps` accept arbitrary strings with no server-side length cap.

**Recommended fix:**  
```js
app.use(express.json({ limit: '64kb' }));
```
This is a one-character change to an existing line. `64kb` is generous for all legitimate payloads in this application.

---

### SEC-004

**Severity:** High
**Category:** V14 — Security Headers
**Status:** ✅ Fixed 2026-10-03 — `securityHeaders` middleware added in [`server/middleware/security.js`](../server/middleware/security.js) and applied as the first middleware in `createApp`. Sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`, `Strict-Transport-Security`, and `X-Permitted-Cross-Domain-Policies`. No new dependencies.
**Evidence:** [`server/app.js` lines 11–13](../server/app.js) — no `helmet()` or any header middleware is present. `package.json` ([`package.json` line 15](../package.json)) does not list `helmet`.

**Why it matters:**  
Without security headers the browser applies the most permissive defaults:
- **No CSP** — any injected script (e.g. via a future XSS) runs without restriction.
- **No `X-Frame-Options`** — the app can be embedded in a hostile iframe (clickjacking).
- **No `X-Content-Type-Options`** — MIME-sniffing attacks are possible.
- **No `Referrer-Policy`** — full URL (including incident IDs) leaks in Referer headers to third-party resources.
- **No HSTS** — HTTPS connections can be downgraded on first visit in production.

All five of these are fixed by a single package and one line of code.

**Recommended fix:**  
```bash
npm install helmet
```
```js
import helmet from 'helmet';

// In createApp, as the very first middleware
app.use(helmet());
```
Review the CSP defaults that `helmet` sets and adjust `contentSecurityPolicy` if the React app loads any external fonts or scripts.

---

### SEC-005

**Severity:** Medium
**Category:** V13 — Rate Limiting
**Status:** ✅ Fixed 2026-10-03 — `aiLimiter` (10 req/60 s/IP) applied as route-level middleware on `POST .../troubleshoot` and `POST .../report/draft` in [`server/app.js`](../server/app.js).
**Evidence:** [`server/app.js` lines 25–32](../server/app.js) and lines 35–37 — `POST /api/incidents/:id/troubleshoot` and `POST /api/incidents/:id/report/draft` call `ai.troubleshoot()` and `ai.draftReport()` with no per-endpoint throttle.

**Why it matters:**  
If `AI_PROVIDER` is set to a real paid provider (e.g. OpenAI), a single unauthenticated client can call these endpoints in a tight loop and generate large API bills. Even with the global rate-limiter from SEC-002 in place, AI endpoints warrant a tighter budget limit (e.g. 5–10 requests/minute/IP) because each call has a monetary cost.

**Recommended fix:**  
Apply a stricter limiter specifically to the AI routes:
```js
const aiLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
app.post('/api/incidents/:id/troubleshoot', aiLimiter, async (req, res, next) => { … });
app.post('/api/incidents/:id/report/draft', aiLimiter, async (req, res, next) => { … });
```

---

### SEC-006

**Severity:** Medium
**Category:** V5 — Input Validation
**Status:** ✅ Fixed 2026-10-03 — `parseId(raw)` helper added in [`server/app.js`](../server/app.js); throws `HttpError(400, 'Invalid ID')` for non-positive-integers. All `:id` routes now use `parseId` instead of `Number`.
**Evidence:** [`server/app.js` lines 20–23, 27, 34, 36, 38, 50](../server/app.js) — every `:id` route passes `Number(req.params.id)` directly to service functions. `Number('abc')` returns `NaN`; `Number('')` returns `0`; `Number(-1)` returns `-1`. None of these are guarded at the route layer.

**Why it matters:**  
`NaN` propagates to the SQLite `WHERE id = ?` bind. SQLite coerces `NaN` to `NULL`, which matches no row and triggers a `404` — harmless but incorrect. `0` and negative integers are valid integer bindings that happen to find no row in the seed data today, but any future auto-increment gap could be exploited to retrieve or modify unexpected records. More importantly, passing invalid IDs to parameterised queries is a code smell that masks bugs and makes the intent unclear.

**Recommended fix:**  
Add a guard at the route layer before dispatching:
```js
function parseId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid ID');
  return n;
}
```
Use `parseId(req.params.id)` in place of `Number(req.params.id)` throughout [`server/app.js`](../server/app.js).

---

### SEC-007

**Severity:** Medium  
**Category:** V5 — Input Validation  
**Evidence:** [`server/services/incidents.js` lines 37–46](../server/services/incidents.js) (`createIncident`), [`server/services/articles.js` lines 20–31](../server/services/articles.js) (`createArticle`), [`server/services/reports.js` lines 10–19](../server/services/reports.js) (`saveReport`).

**Why it matters:**  
Free-text fields (`description`, `symptoms`, `causes`, `diagnostic_steps`, `resolution`, `preventative_action`, `investigation`) are accepted with no upper-bound length check. In the absence of a body-size cap (SEC-003), a caller can insert megabytes of text into the SQLite database, bloating the file on disk and slowing all subsequent queries that scan those columns. The `title` field is checked only for presence, not length.

**Recommended fix:**  
After fixing SEC-003 (which caps the entire body at 64 KB), also enforce per-field limits in service validation:
```js
const MAX_TITLE = 200;
const MAX_TEXT  = 10_000;
if (title.length > MAX_TITLE) throw new HttpError(400, 'Title must be 200 characters or fewer');
```
Apply analogous checks to all long-form fields. These limits are generous relative to real IT incident descriptions.

---

### SEC-008

**Severity:** Low
**Category:** V7 — Error Handling & Logging
**Status:** ✅ Fixed 2026-10-03 — error handler in [`server/app.js`](../server/app.js) now logs `[METHOD /path]` as the first argument to `console.error`, making log lines searchable by endpoint.
**Evidence:** [`server/app.js` line 61](../server/app.js) — `console.error(err)` is the only error logging; [`server/index.js` lines 14–16](../server/index.js) — stdout only, no structured logging.

**Why it matters:**  
`console.error` writes the full `Error` object (including stack trace) to stdout. On Render this goes to the service log, which is fine. However there is no structured logging, no request-ID correlation, and no distinction between "user did something bad" (4xx) and "server is broken" (5xx). In an incident-response tool, the inability to quickly identify server-side errors by correlation ID is an operational blind spot. This is Low severity because the stack trace is never returned to the client (the error handler returns a generic 500 message correctly).

**Recommended fix:**  
At minimum, log the request method and URL alongside the error:
```js
app.use((err, req, res, _next) => {
  if (err.expose) return res.status(err.status || 400).json({ error: err.message });
  console.error(`[${req.method} ${req.path}]`, err);
  res.status(500).json({ error: 'Internal server error' });
});
```
For a production deployment, consider `pino` for structured JSON logs.

---

### SEC-009

**Severity:** Low  
**Category:** V6 — Secrets Handling  
**Evidence:** [`.env.example` line 5](./.env.example) — `AI_API_KEY=` is present with an empty value and no guidance on key requirements.

**Why it matters:**  
The `.env.example` is the only documentation a new operator sees for secrets configuration. The absence of guidance means a developer might set a weak or shared key, reuse a key from another project, or not rotate it. This is Low severity because no key is hard-coded and `.env` is correctly in `.gitignore` ([`.gitignore` line 4](./.gitignore)).

**Recommended fix:**  
Add an inline comment in `.env.example`:
```
# AI_API_KEY: Required for real AI providers (e.g. OpenAI). Keep secret.
# Generate a dedicated key at platform.openai.com/api-keys. Never reuse keys across projects.
AI_API_KEY=
```

---

## What the Project Does Well

- **Parameterised SQL throughout** — every query uses `?` placeholders via the Node built-in `DatabaseSync` prepared statements. There is no string-concatenated SQL in any service file. LIKE queries also use bind parameters. SQL injection is not a viable attack vector.
- **Secrets never returned by the API** — [`server/app.js` line 42](../server/app.js) explicitly exposes only `keyConfigured: Boolean(process.env.AI_API_KEY)`, not the key value itself. The comment reinforces the intent.
- **`.env` correctly gitignored** — [`.gitignore` line 4](.gitignore) lists `.env`, so keys cannot accidentally be committed.
- **Error exposure is correctly gated** — the `HttpError.expose` flag ([`server/services/incidents.js` line 8](../server/services/incidents.js)) ensures only intentional error messages reach the client; all other exceptions return a generic 500 body.
- **Input trimming and type coercion are consistent** — the `text(v)` helper ([`server/services/incidents.js` line 11](../server/services/incidents.js)) is used uniformly across all service files to strip whitespace and guard against non-string inputs.
- **DB CHECK constraints as a second validation layer** — `priority` and `status` columns have `CHECK` constraints in [`server/db.js` lines 14–15](../server/db.js), providing a database-level backstop even if service validation were bypassed.
- **No hard-coded credentials** — `grep` across the entire codebase finds no passwords, tokens, or API keys embedded in source files.

---

## Recommended Next Steps (Priority Order)

1. **Add `Helmet`** (SEC-004) — one `npm install` and one line; fixes five header findings simultaneously. Highest effort-to-impact ratio.
2. **Cap the request body** (SEC-003) — one-character edit to `express.json({ limit: '64kb' })`. Zero risk of breaking anything.
3. **Add `express-rate-limit`** (SEC-002, SEC-005) — prevents resource exhaustion and AI cost abuse before the app is deployed publicly.
4. **Add authentication** (SEC-001) — required before any internet-facing deployment. A simple bearer-token check is enough for a single-operator tool; a full login page for multi-user.
5. **Validate `:id` parameters** (SEC-006) — small, isolated change with no test breakage.
6. **Add per-field length limits** (SEC-007) — pair with the body-size cap for defence in depth.
7. **Improve error logging** (SEC-008) — add request context to `console.error`; consider `pino` for production.
8. **Improve `.env.example` comments** (SEC-009) — documentation-only change, zero risk.
