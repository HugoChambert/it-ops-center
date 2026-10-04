# Bob Session Log

A factual record of tasks completed with Bob.

---

## 2026-10-03 — Visual polish: Stage 1 (dashboard, navigation, favicon)

**Asked:** Visual polish pass, Stage 1. No API changes, no new dependencies, no inline style attributes (except SVG presentation attributes which are CSP-safe), no existing tests edited.

**Changes:**

- **`index.html`** — Added SVG favicon as a `data:` URI `<link rel="icon">`. Design: dark `#172230` rounded square with a 2×2 grid of blue squares (a small monitoring/dashboard motif). `img-src 'self' data:` is already in the CSP so this is safe.

- **`src/components/Layout.jsx`** — Complete rewrite of the nav and header:
  - `LogoMark` component: a 20×20 inline SVG (2×2 grid of rounded rectangles using `currentColor`) placed beside the app name. The bottom-right cell has two stacked bars as a subtle activity indicator.
  - `Icon` component: a reusable wrapper for stroke-based SVG icons — `aria-hidden`, `focusable="false"`, `currentColor` stroke so they inherit the link's text colour.
  - Six nav items each have a distinct icon (house, clock, server, book, line-chart, gear).
  - Inactive links are `text-slate-300` → `hover:text-white` instead of the previous flat `hover:bg-white/10`, giving better contrast and a cleaner hover state.
  - `transition-colors` added for smooth hover transitions.
  - Skip-to-content link gains `focus:z-50` and `focus:text-brand` for better visibility.

- **`src/pages/Dashboard.jsx`** — Three improvements:
  1. **Stat cards:** each card now has an `icon` prop with a dedicated inline SVG (clock, triangle/alert, struck-through clock, check-circle, server, line-chart). Label is `text-xs uppercase tracking-wide` for visual hierarchy; value is `text-3xl font-semibold tabular-nums`. Icon and label share the same `tone` colour so Critical/Overdue cards are fully red, Resolved Today is green.
  2. **Trend chart:** viewBox expanded to `500×160` (wider, taller). Added horizontal grid lines with y-axis value labels; per-point value dots (3 px radius) and value labels above each dot (suppressed when 0 to avoid clutter); x-axis date labels (`MM-DD`) for all 7 days; legend with mini SVG line swatches. Grid max rounds up to nearest even number for clean ticks.
  3. **Data table:** a compact `text-xs` table below the chart showing the raw Created/Resolved values for each day — the screen-reader and keyboard source of truth.
  4. Recent incidents table: title column now links to the incident detail page. Heading colours changed from `text-slate-600` to `text-slate-500` for better hierarchy.
  5. All SVG colours use `var(--color-brand)`, `var(--color-ok)`, `var(--color-line)` — no hard-coded hex anywhere.

- **`src/pages/Performance.jsx`** — Replaced the 4 hard-coded hex values in the SVG trend chart (`#1f5fbf`, `#1b6b3a`, `#dde1e7`, `#57606a`) with `var(--color-brand)`, `var(--color-ok)`, `var(--color-line)`.

**Files modified:** `index.html`, `src/components/Layout.jsx`, `src/pages/Dashboard.jsx`, `src/pages/Performance.jsx`, `docs/BOB_LOG.md`

**No existing tests edited. No new dependencies.**

**Verified:** `npm test` — 142 tests, 13 files, all passed. `npm run build` — 50 modules, no warnings, built in 839ms. Committed as `d8e192e`.

---

## 2026-10-03 — Analytics: Stage 2 (frontend, seed data, docs)

**Asked:** Implement Stage 2 of the Performance analytics feature: `src/pages/Performance.jsx`, seed data additions (IDs 7–16), and `docs/architecture.md`. No changes to README or existing tests.

**Seed data (`server/db.js`):** 10 new rows (IDs 7–16) appended after the original 6. All Resolved or Closed. `resolved_at` is 32–140 h ago — clear of today's UTC boundary so the `resolvedToday + 1` test is unaffected. No "VPN" in any title or description. No new systems. Mix of within-SLA and outside-SLA resolutions across all four priorities, spread over multiple UTC days so the 7-day trend has non-trivial data.

**Frontend (`src/pages/Performance.jsx`):** New page at `/performance`.
- Three `<section>` cards: **MTTR table** (priority + count + mean time), **SLA compliance table** (priority + SLA window + resolved + within SLA + rate), **7-day trend** (dual-line SVG chart + data table).
- SVG chart uses the same `viewBox`/path approach as the existing Dashboard `<Trend>`. Solid blue = MTTR (hours), dashed green = compliance %. `role="img"` + `aria-label` on the SVG; the data table beneath is the screen-reader and keyboard source of truth.
- Empty state: when `data.empty === true`, renders only the message text — no empty charts or tables.
- No inline `style` attributes — all Tailwind classes. `overflow-x-auto` on all table wrappers for phone layout.

**Nav + routing:** "Performance" nav entry added between "Knowledge base" and "Settings" in `src/components/Layout.jsx`; `/performance` route registered in `src/App.jsx`.

**Files created:** `src/pages/Performance.jsx`

**Files modified:** `server/db.js` (10 new seed rows), `src/App.jsx` (route), `src/components/Layout.jsx` (nav entry), `docs/architecture.md` (Phase 11 section), `docs/BOB_LOG.md`

**No existing tests edited.**

**Verified:** `npm test` — 142 tests, 13 files, all passed. `npm run build` — 50 modules, no warnings, built in 770ms.

---

## 2026-10-03 — Analytics: Stage 1 (backend + tests)

**Asked:** Implement Stage 1 of the "Performance" analytics feature: `server/services/analytics.js`, `GET /api/analytics`, and tests with exact expected values. No frontend, no seed changes, no existing tests edited.

**Service (`server/services/analytics.js`):** Pure `getAnalytics(db, now?)` function — `now` is injectable for deterministic tests.
- **MTTR by priority:** mean of `(resolved_at − created_at)` for all resolved/closed incidents with `resolved_at` set. Returns `{ count, mttrMs, mttrHuman }` per priority and an `overall` bucket. Zero-data priorities return `{ count: 0, mttrMs: null, mttrHuman: "No data" }`.
- **SLA compliance:** uses `SLA_WINDOWS_MS` from `server/config/sla.js` (never duplicated). An incident is within SLA when `(resolved_at − created_at) ≤ SLA_WINDOWS_MS[priority]`, boundary inclusive. Returns `{ resolved, withinSla, rate }` per priority and `overall`; `rate` is `Math.round(withinSla / resolved * 100)` or `null` when `resolved === 0`.
- **7-day trend:** UTC-day buckets for the past 7 days. Each entry: `{ date, count, mttrMs, complianceRate }`. Empty days have `mttrMs: null` and `complianceRate: null` (never `NaN`).
- **Empty case:** when no resolved rows exist, the result includes `{ empty: true, message: "No resolved incidents yet." }` alongside all structural keys (so callers can always iterate `trend`, etc.).

**Endpoint:** `GET /api/analytics` registered in `server/app.js`. Covered by the existing `globalLimiter`. No `parseId` needed — no path parameter.

**Design note on empty sentinel:** originally returned early with `{ empty: true, message }` and no other keys. Changed to always compute full structure and attach `empty`/`message` as additional flags when `rows.length === 0`, so the trend tests (which iterate `result.trend`) and the structural tests (which access `complianceByPriority.overall`) work even on an empty DB. This is consistent with the frontend being able to always read the structure safely.

**Files created:** `server/services/analytics.js`, `tests/analytics.test.js`

**Files modified:** `server/app.js` (import + one route), `docs/BOB_LOG.md`

**No existing tests edited.**

**Verified:** `npm test` — 142 tests, 13 files, all passed.

---

## 2026-10-03 — Similar incidents: Stage 1 (backend + tests)

**Asked:** Implement Stage 1 of the "Similar incidents" feature: `server/services/similar.js`, the `GET /api/incidents/:id/similar` endpoint, and tests. No frontend, no seed changes, no existing tests edited.

**Algorithm (`server/services/similar.js`):** Weighted shared-keyword scoring — pure JS, zero new dependencies.
- `tokenise(text)` → `Set<string>`: lowercase, split on non-alphanumeric, drop ≤2-char tokens and stop words (~50 common English + domain words).
- `scorePair(qTokens, title, body, extra)` → `{ score, matchedWords }`: title match = weight 2, body match = weight 1. `matchedWords` is sorted alphabetically, capped at 8.
- `getSimilar(db, incident)`: queries `incidents WHERE status IN ('Resolved','Closed') AND id != ?` and all `articles`; scores each; drops score=0; returns top 3 per category sorted descending.
- Return shape: `{ disclaimer, incidents: [...], articles: [...] }`. Both arrays are always present (never `null`).

**Endpoint:** `GET /api/incidents/:id/similar` registered in `server/app.js`. Uses existing `parseId` (400 on bad ID) and `inc.getIncident` (404 guard). Covered by the existing `globalLimiter` on all `/api` routes.

**Files created:** `server/services/similar.js`, `tests/similar.test.js`

**Files modified:** `server/app.js` (import + one route), `docs/BOB_LOG.md`

**No existing tests edited.**

**Verified:** `npm test` — 110 tests, 12 files, all passed.

---

## 2026-10-03 — GitHub Actions CI workflow

**Asked:** Add a GitHub Actions workflow at `.github/workflows/ci.yml` that triggers on every push and pull request to `main`: checkout, set up Node 22, run `npm ci`, `npm test`, and `npm run build`. Add a status badge to `README.md`. Add a short CI section to `docs/architecture.md` and `docs/BOB_LOG.md`. No new dependencies.

**Files created:** `.github/workflows/ci.yml`

**Files modified:** `README.md` (status badge under the title), `docs/architecture.md` (CI section appended), `docs/BOB_LOG.md` (this entry)

---

## 2026-10-03 — Reverse-proxy trust, rate-limiter correctness, CSP audit (SEC-010)

**Asked:** Fix a production-only problem where Express was not trusting the Render reverse proxy, causing all rate limiters to treat every visitor as the same IP. Set `trust proxy` based on `NODE_ENV`/`TRUST_PROXY`. Add tests proving per-IP bucketing with XFF headers. Audit CSP against the production build. Update docs.

**Fixes applied:**

- **SEC-010** — `server/app.js`: added `app.set('trust proxy', trustProxy)` before all middleware. A new inner function `parseTrustProxy` converts the `TRUST_PROXY` env var from string to the correct type: `'0'`/`'false'` → `false`, numeric string → number, anything else → string (passed directly to Express as a named subnet, e.g. `'loopback'`). When `TRUST_PROXY` is unset, defaults to `1` in production, `false` in dev. Value `1` means "trust exactly one reverse proxy hop", which prevents clients from spoofing `X-Forwarded-For` while still resolving `req.ip` correctly.

**Tests added (`tests/trust-proxy.test.js` — new file, no existing tests edited):**

- **Trust proxy ON** (4 tests): forwarded IP gets its own 2-request bucket; the 3rd request from the same IP returns 429; a second IP is unaffected when the first is blocked; two distinct IPs each have independent budgets.
- **Trust proxy OFF** (2 tests): different `X-Forwarded-For` values do not create separate buckets (all map to loopback); mixed plain and forwarded requests all deplete the same single bucket.

**CSP audit findings:**

- **Systems page progress bars** (`style={{ width: \`${value}%\` }}`): React inline `style` props render as HTML `style` attributes, which require `style-src 'unsafe-inline'`. The existing policy already includes `"style-src 'self' 'unsafe-inline'"`. **No change needed.**
- **Dashboard `<Trend>` SVG chart**: inline SVG rendered by React DOM directly into the HTML, not loaded as an external resource. No `img-src` or special SVG allowances required. **No change needed.**
- **`script-src 'unsafe-inline'`** note: the Vite production build emits separate JS chunk files (not inline scripts), so `'unsafe-inline'` for scripts is more permissive than strictly necessary; however this is a tightening opportunity, not a blocking issue, and was left unchanged per the minimal-change principle.
- **Overall verdict: the existing CSP is already sufficient for the production build. No CSP changes were made.**

**Files created:** `tests/trust-proxy.test.js`

**Files modified:** `server/app.js`, `README.md`, `docs/architecture.md`, `docs/security-audit.md`, `docs/BOB_LOG.md`

**No existing tests edited.**

**Verified:** `npm test` — 84 tests, 11 files, all passed. `npm run build` — 49 modules, no warnings, built in 0.76s.

---

## 2026-10-03 — Security hardening: fix SEC-002, SEC-003, SEC-004, SEC-005, SEC-006, SEC-008

**Asked:** Fix the three to five highest-severity OWASP ASVS findings from `docs/security-audit.md` that are low-risk to fix, with no new npm dependencies. Add tests for each fix. Add a "Known Limitations" section to README for SEC-001 (authentication). Do not change existing tests.

**Fixes applied:**

- **SEC-003** — `express.json({ limit: '64kb' })` in `server/app.js` line 22. Caps request body at 64 KB; Express returns 413 for oversized bodies automatically.
- **SEC-004** — `server/middleware/security.js` *(new)* — `securityHeaders` middleware sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy` (with `frame-ancestors 'none'`), `Strict-Transport-Security`, and `X-Permitted-Cross-Domain-Policies`. Applied as the first middleware in `createApp`. Zero dependencies.
- **SEC-002** — `createRateLimiter({ windowMs, max })` in `server/middleware/security.js` — sliding-window in-process rate limiter backed by a `Map`. `globalLimiter` (120 req/60 s/IP) applied to all `/api` routes. Sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` headers. Returns 429 when exceeded.
- **SEC-005** — `aiLimiter` (10 req/60 s/IP) from the same module applied as route-level middleware on `POST /api/incidents/:id/troubleshoot` and `POST /api/incidents/:id/report/draft`.
- **SEC-006** — `parseId(raw)` helper in `server/app.js` throws `HttpError(400, 'Invalid ID')` for any `:id` that is not a positive integer. All nine `:id` route handlers updated.
- **SEC-008** — Error handler in `server/app.js` changed from `console.error(err)` to `console.error(\`[${req.method} ${req.path}]\`, err)`.

**SEC-001 (auth)** — deferred per instructions. "Known Limitations" section added to `README.md` explaining the intentional public demo and what a production deployment would require.

**Files created:** `server/middleware/security.js`, `tests/security.test.js`

**Files modified:** `server/app.js`, `README.md`, `docs/security-audit.md`, `docs/BOB_LOG.md`

**No existing tests edited.**

**Verified:** `npm test` — 78 tests, 10 files, all passed. `npm run build` — 49 modules, no warnings, built in 1.35s.

---

## 2026-10-03 — OWASP ASVS Level 1 Security Audit

**Asked:** Create a reusable security-audit skill at `.bob/skills/security-audit/` (with `SKILL.md` and `checklist.md`), then run it against the project and write `docs/security-audit.md`. No application code to be changed.

**Files read (audit evidence):** `server/app.js`, `server/index.js`, `server/db.js`, `server/services/incidents.js`, `server/services/articles.js`, `server/services/reports.js`, `server/services/settings.js`, `server/services/settingsStore.js`, `server/services/sla.js`, `server/ai/index.js`, `server/ai/mockProvider.js`, `src/api.js`, `package.json`, `.env.example`, `.gitignore`, `vite.config.js`.

**Files created:**
- `.bob/skills/security-audit/SKILL.md` — reusable skill with step-by-step ASVS Level 1 audit procedure.
- `.bob/skills/security-audit/checklist.md` — supporting reference checklist covering all six ASVS categories.
- `docs/security-audit.md` — full audit report: 9 findings (4 High, 3 Medium, 2 Low), positive findings, and priority-ordered remediation steps.

**Application code changed:** None.

**Verified:** `grep` searches confirmed no hard-coded secrets, no string-concatenated SQL, and no XSS sinks in any source file. All findings are grounded in specific file lines cited in the report.

---

## 2026-10-03 — README live demo link

**Asked:** Add a live demo link at the top of `README.md`, directly under the project title, pointing to `https://it-ops-center.onrender.com/`, with a note about free-tier cold-start and periodic data resets. Verify the Deployment section had no existing live link to deduplicate.

**Changes:**
- `README.md` — inserted a `**Live demo:**` line and a blockquote note on lines 4–5, immediately after the project description line. No other content changed.

**Verified:** No other files modified. Deployment section confirmed to have no prior live link; no duplication introduced.

---

## 2026-10-03 — Production deployment (Phase 9)

**Asked:** Make the app deployable as a single web service for Render/Docker, with a demo-reset interval, a build-time demo banner, static-file serving with SPA fallback, and full test coverage for the new behaviour.

**Changes:**

- `server/app.js` — `createApp` now accepts an optional `staticDir` option (default `null`). When provided, Express serves that directory with `express.static` and registers a `GET *` catch-all that sends `index.html`, so React Router deep-links work on refresh. Unknown `/api` routes still return the existing JSON 404 (the `/api` 404 middleware sits before the static handler). Existing tests are unaffected because they call `createApp(db)` without `staticDir`.

- `server/index.js` — resolves `../dist` relative to the server file and passes it as `staticDir` only when `NODE_ENV=production`. Adds `DEMO_RESET_HOURS` logic: when the env var is a positive number, a `setInterval` deletes all rows (in foreign-key dependency order) and calls `seed(db)` on that interval. When unset, nothing changes.

- `package.json` — added `"start": "NODE_ENV=production node server/index.js"` script and `"engines": { "node": ">=22.5" }` field.

- `Dockerfile` *(new)* — `node:22-alpine`, `WORKDIR /app`, `npm ci`, `npm run build`, `ENV NODE_ENV=production`, `EXPOSE 3000`, `CMD ["node","server/index.js"]`.

- `.dockerignore` *(new)* — excludes `node_modules`, `dist`, `data`, `.env`, `.git`.

- `src/components/Layout.jsx` — added a conditionally rendered amber banner (`bg-amber-50`) above the header, shown only when the Vite build-time variable `VITE_DEMO_BANNER === 'true'`. Zero runtime cost when not set.

- `tests/deploy.test.js` *(new)* — 7 tests across two describe blocks:
  - *static file serving*: serves an existing file (200), SPA fallback for unknown non-`/api` route (200 + `index.html` content), JSON 404 preserved for unknown `/api` routes, no fallback when `staticDir` not provided.
  - *demo reset*: wipe + reseed restores the same system count; data is gone after wipe before reseed; incidents are present after reseed.

- `tests/fixtures/static/` *(new)* — `index.html` (contains "SPA") and `hello.txt` used by the static-serving tests.

- `README.md` — Environment table updated with `DEMO_RESET_HOURS` and `VITE_DEMO_BANNER`; new **Deployment** section with Docker commands (build + run with named volume) and step-by-step Render instructions.

- `docs/architecture.md` — added **Phase 9: Deployment** section documenting all design decisions.

**Verified:** `npm test` — 61 tests, 9 files, all passed. `npm run build` — 49 modules, no warnings, built in 1.58s.

---

## 2026-10-03 — SLA demo data and docs (Stage 3)

**Asked:** Adjust seed data for a realistic SLA mix, update README.md and docs/architecture.md for the SLA feature. All existing tests must pass without editing them.

**Seed changes (`server/db.js`):**
- INC-3 (Medium, Pending): `created_at` changed from `ago(50)` to `ago(6)`, `updated_at` from `ago(10)` to `ago(1)`. Now sits within its 8-hour window (~2 h remaining at seed time) rather than being deeply overdue. INC-1 (Critical, 30 h old) and INC-2 (High, 20 h old) remain overdue. INC-4/5/6 are Resolved/Closed (`sla: null`). All test-pinned values preserved: 3 open incidents, 1 critical, 1 High+Open, incident IDs and systems unchanged.

**Docs changes:**
- `README.md` — added `server/config/sla.js` and `server/services/sla.js` to the Structure section; added a new **SLA** section explaining the deadline rule, API shape, and priority-shift behaviour; updated the Status line to include Phase 8.
- `docs/architecture.md` — added **Phase 8: SLA deadlines** section covering the config file, pure-function service, computed-not-stored design decision, per-row mapping, dashboard counter, frontend components, and seed data states.

**Verified:** `npm test` — 54 tests, 8 files, all passed. No test edits.

---


## 2026-10-03 — SLA frontend (Stage 2)

**Asked:** Implement the frontend half of the SLA feature: `SlaChip` component, SLA column in the incident list (table and mobile card layout), SLA row in the incident detail metadata, and an Overdue stat tile on the dashboard with a clean 6-tile responsive grid.

**Changes:**

- `src/components/SlaChip.jsx` *(new)* — stateless chip: renders `sla.label` as visible text (never colour alone); red tint when `overdue`, neutral otherwise; `title` attribute shows `sla.target`. Returns `null` when `sla` is `null` (Resolved/Closed).
- `src/pages/Incidents.jsx` — added `SlaChip` import; split the list into two layouts: mobile card list (`md:hidden`) with priority + status + SLA chip per card, and the existing table (now `hidden md:block`) with a new **SLA** column as the last header/cell.
- `src/pages/IncidentDetail.jsx` — added `SlaChip` import; added an **SLA** `<dt>/<dd>` entry in the metadata `<dl>`, showing the chip and `sla.target` text side-by-side for active incidents, `—` for Resolved/Closed.
- `src/pages/Dashboard.jsx` — added **Overdue** `<Stat>` tile (tone `text-crit`) after Critical; updated the section grid from `grid-cols-2 lg:grid-cols-5` to `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` so 6 tiles lay out evenly on phone (2×3), tablet (3×2), and desktop (6×1).

**Verified:** `npm test` — 54 tests, 8 files, all passed. `npm run build` — 49 modules, no warnings, built in 2.14s.

---


## 2026-09-30 — Codebase Review

**Asked:** Review the codebase and suggest improvements.

**Changes:** None (read-only review).

**Verified:** Full project explored across all source files in `src/`, `server/`, and `tests/`. Findings reported inline in chat.

---

## 2026-09-30 — Architecture Walkthrough

**Asked:** Explain the architecture in plain language, what each folder does, how a request flows from a button click to the database and back, where the dashboard numbers come from, which files to read first, and a step-by-step trace of resolving an incident.

**Changes:** None (read-only analysis).

**Verified:** Read `server/index.js`, `server/app.js`, `server/db.js`, `server/services/incidents.js`, `server/services/stats.js`, `src/App.jsx`, `src/api.js`, `src/pages/IncidentDetail.jsx`, `src/pages/Dashboard.jsx`. All claims grounded in file contents.

---

## 2026-09-30 — Architecture Diagrams

**Asked:** Create `docs/bob-architecture.md` with a Mermaid sequence diagram of the resolve-incident flow and a Mermaid component diagram of the whole project, each with a short explanation.

**Changes:** `docs/bob-architecture.md` (created).

**Verified:** No other files modified. Diagrams grounded in previously read source files (`server/app.js`, `server/services/incidents.js`, `src/api.js`, `src/pages/IncidentDetail.jsx`, `server/index.js`, `server/db.js`).

---

## 2026-10-03 — Fix "Resolved today" dashboard counter

**Asked:** Investigate why resolving an incident did not increment "Resolved today" on the dashboard. Fix the root cause without editing existing tests. Add a new regression test. 

**Root cause:** In [`server/services/incidents.js`](../server/services/incidents.js) line 59, `resolved_at` was only stamped when status became `'Closed'`; the `else` branch set it to `null` for all other statuses, including `'Resolved'`. The dashboard stat in [`server/services/stats.js`](../server/services/stats.js) line 11 queries `resolved_at >= startOfDay`, so incidents with `resolved_at = null` were never counted.

**Changes:**
- `server/services/incidents.js` — extended the `if` condition on line 59 to also stamp `resolved_at` when `next.status === 'Resolved'`.
- `tests/incidents.test.js` — added a new test *"stamps resolved_at when status is Resolved so the dashboard counter can match it"* inside the existing `dashboard consistency` describe block. The test creates a fresh incident, resolves it, and asserts both that `resolved_at` is a valid ISO timestamp and that `resolvedToday` is at least 1.

**Verified:** `npm test` — 33 tests, 7 test files, all passed.

---

## 2026-10-03 — SLA backend (Stage 1)

**Asked:** Implement the backend half of an SLA feature: per-priority response deadlines, a computed `sla` object on every incident API response, an `overdueIncidents` counter on the dashboard, and full test coverage. No frontend changes. Tests written before implementation.

**Changes:**

- `server/config/sla.js` *(new)* — single source of truth for the four SLA windows (`Critical 1h`, `High 4h`, `Medium 8h`, `Low 24h`) and their human-readable target strings.
- `server/services/sla.js` *(new)* — pure functions `getDeadline(incident)` and `getSlaStatus(incident, now)`. Returns `{ deadline, msRemaining, overdue, label, target }` for active incidents, `null` for Resolved/Closed. `now` is injectable for deterministic tests.
- `server/services/incidents.js` — both `listIncidents` and `getIncident` now attach a `sla` field to every returned row (one `map` pass, no extra DB query).
- `server/services/stats.js` — added `overdueIncidents` count to the dashboard payload; computed in JS via `getSlaStatus` so the deadline config stays in one place.
- `tests/sla.test.js` *(new)* — 18 tests covering: `getDeadline` for all four priorities and unknown priority; `getSlaStatus` labels (within window, overdue, exactly at deadline, <1 min, exactly 60 min, all target strings, ISO deadline); null for Resolved/Closed; integration tests for list/detail `sla` field shape, freshly created incident not overdue, sla → null after resolve, dashboard `overdueIncidents` present and decrements on resolve.
- `tests/incidents.test.js` — two new assertions: list endpoint has `sla` fields on active rows; detail endpoint returns `sla = null` after resolving.
- `tests/dashboard.test.js` — one new assertion: `overdueIncidents` is a non-negative number.

**Verified:** `npm test` — 54 tests, 8 test files, all passed.

---
