# Bob Session Log

A factual record of tasks completed with Bob.

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
