# Architecture (Phase 1)
- **Frontend:** React SPA. `Layout` (sidebar + header) wraps routed pages. Pages fetch through `src/api.js`.
- **Backend:** `createApp(db)` builds the Express app from an injected database, so tests use `:memory:` SQLite.
- **Database:** tables `systems` and `incidents` (`server/db.js`). Statuses and priorities are enforced by CHECK constraints.
- **Dashboard statistics** are computed on request in `server/services/stats.js`, deliberately separate from incident routes. Incident state lives in the `incidents` table; the dashboard derives its numbers from it.
- **API:** `GET /api/dashboard`, `/api/incidents?status&priority&q`, `/api/systems`, `/api/health`. Errors return JSON `{ error }`.
- **Data flow:** browser → Vite proxy → Express → SQLite → JSON → React state.

## Phase 2: incidents
- `server/services/incidents.js` holds validation and state changes; routes in `app.js` are thin.
- `incident_events` stores the timeline (types: status, note, action). Resolving requires a resolution and sets `resolved_at`.
- API: `POST /api/incidents`, `GET|PATCH /api/incidents/:id`, `POST /api/incidents/:id/notes`, `POST /api/incidents/:id/actions`.
- Validation errors return `{ error }` with 400; unknown ids return 404.

## Phase 3: systems
- `GET /api/systems` returns each system with `open_incidents` (Open, Investigating or Pending incidents linked to it).
- The Systems page shows status, CPU, memory and disk utilisation, uptime and last check. Utilisation of 75% or more is flagged as high, 90% or more as critical, with text as well as colour.

## Phase 4: knowledge base
- Tables `articles` and `article_incidents` (many-to-many link to incidents). Logic in `server/services/articles.js`.
- API: `GET /api/articles?q=`, `GET /api/articles/:id` (includes `related_incidents`), `POST /api/articles` (optional `incident_id`).
- Create-from-incident: the form at `/knowledge/new?incident=ID` prefills from the incident (description, recorded actions, resolution); the technician edits before saving.

## Phase 5: AI troubleshooting
- `server/ai/index.js` chooses a provider from `AI_PROVIDER` (default `mock`). A provider is an object with `troubleshoot(incident)` returning `{ possibleCause, investigation[], commands[{label,command}], disclaimer, confidence, articleQuery }`.
- `mockProvider.js` is rule-based (keyword match on title and description) so the app works offline with no key. To add a real provider, implement the same interface in a new file, register it in `getProvider`, and read `AI_API_KEY` from the environment.
- `POST /api/incidents/:id/troubleshoot` calls the provider and adds related knowledge articles. It changes no data. An unimplemented provider returns 501 with a clear message.
- Suggestions are always labelled as recommendations, not a confirmed diagnosis. The UI can record a suggested step as a troubleshooting action.

## Phase 6: incident reports
- Table `incident_reports` (one per incident, keyed by `incident_id`, saved with an upsert). Logic in `server/services/reports.js`.
- Providers gained `draftReport(incident)`. The mock builds the draft from recorded facts only (description, system, user, actions, resolution) and leaves root cause and preventative action for the technician. A real provider can write these sections.
- API: `POST /api/incidents/:id/report/draft` (generates, saves nothing), `PUT /api/incidents/:id/report` (saves the edited text; `problem` required), `GET /api/incidents/:id/report` (saved report or `null`).
- Saving adds a timeline entry.

## Phase 7: settings
- Table `settings` (key/value). Defaults and reads live in `server/services/settingsStore.js`, which has no imports from the other services so `incidents.js` can use it without a circular dependency. Validation is in `settings.js`.
- Editable: `technician_name` (author on new timeline entries; earlier entries keep their stored author) and `default_priority` (used when a new incident has no priority).
- `GET|PUT /api/settings` also returns read-only `ai.provider`, `ai.keyConfigured` (boolean only; the key is never returned) and the app version. Provider and key are changed in `.env`, then restart.

## Phase 8: SLA deadlines
- Deadline windows live in `server/config/sla.js` (`SLA_WINDOWS_MS`, `SLA_TARGETS`). Changing a value there propagates everywhere automatically — service, dashboard counter, and UI chip.
- `server/services/sla.js` exports two pure functions: `getDeadline(incident)` → `Date|null` and `getSlaStatus(incident, now?)` → `{ deadline, msRemaining, overdue, label, target }|null`. `now` is injectable for deterministic tests.
- The `sla` object is **computed at request time, never stored**. Deadline = `created_at + window[current priority]`. Changing priority shifts the deadline immediately; upgrading an old incident to Critical surfaces it as overdue straight away.
- `listIncidents` and `getIncident` map the `sla` field onto every row in a single pass (no extra DB query per row). Resolved/Closed incidents return `sla: null`.
- `getDashboardStats` filters active incident rows in JS using `getSlaStatus` and exposes `overdueIncidents`.
- Frontend: `SlaChip` renders the label text + accessible `title` attribute. Status is always text, not colour alone. Incidents list has a mobile card layout (below `md`) and a table layout (`md` and up), both showing the chip. Incident detail shows the chip in the metadata section alongside `sla.target`. Dashboard has a sixth **Overdue** stat tile in a `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` grid.
- Seed data (non-persistent `:memory:` tests + the live DB at first run): INC-1 Critical 30 h old → overdue; INC-2 High 20 h old → overdue; INC-3 Medium 6 h old → ~2 h remaining; INC-4/5/6 resolved/closed → `sla: null`.

## Phase 9: Deployment

- **Static serving:** `createApp` accepts an optional `staticDir` option (default `null`). When set, Express serves that directory and falls back to `index.html` for every non-`/api` path, enabling React Router deep-links to work on refresh in production. Tests pass `staticDir = null` so they remain independent of a build artefact.
- **`npm start`:** sets `NODE_ENV=production`; `server/index.js` resolves `dist/` relative to the server file and passes it as `staticDir`. Dev mode (`npm run dev`) leaves `staticDir = null`.
- **`engines`:** `package.json` declares `"node": ">=22.5"` to document the `node:sqlite` requirement.
- **`Dockerfile`:** `node:22-alpine`, `npm ci`, `npm run build`, `EXPOSE 3000`, `CMD ["node","server/index.js"]`.
- **`.dockerignore`:** excludes `node_modules`, `dist`, `data`, `.env`, `.git`.
- **`DEMO_RESET_HOURS`:** when set to a positive number, a `setInterval` in `server/index.js` deletes all rows from every table (in dependency order) and calls `seed(db)` on the given interval. When unset, nothing changes.
- **`VITE_DEMO_BANNER`:** a build-time Vite env variable. When `"true"`, `Layout.jsx` renders an amber banner above the header: "Demo environment: data resets periodically". Absent or any other value → no banner, zero runtime cost.
- **Tests:** `tests/deploy.test.js` — static file served (200), SPA fallback for unknown non-`/api` path (200 + `index.html`), JSON 404 preserved for unknown `/api` routes, no fallback without `staticDir`; three reset-logic tests exercising the wipe-then-reseed sequence against an in-memory db.

## Phase 10: Reverse-proxy trust and rate-limiter correctness

- **Problem:** Render runs the app behind one reverse proxy. Without `app.set('trust proxy', 1)`, Express ignores `X-Forwarded-For` and uses the proxy's IP as `req.ip`. All visitors share a single rate-limit bucket, making the rate limiter useless for abuse prevention and trivially triggerable by any one client.
- **Fix:** `createApp` now calls `app.set('trust proxy', trustProxy)` before any middleware. The value is derived as follows:
  1. If `TRUST_PROXY` env var is set, parse it: `'0'`/`'false'` → `false`; numeric string → number (hop count); other string (e.g. `'loopback'`) → passed as-is to Express.
  2. Otherwise, default to `1` when `NODE_ENV === 'production'` and `false` in dev/test.
- **Why 1, not `true`:** Express's `trust proxy = true` trusts *all* proxies in the chain, which allows a client to spoof `X-Forwarded-For` entirely. `trust proxy = 1` trusts exactly one hop — only the last proxy (the Render edge) is trusted; any client-supplied XFF entries further left are not promoted to `req.ip`.
- **`TRUST_PROXY` override:** Useful for Docker deployments behind a different number of hops, or for local integration testing where a developer wants to simulate a proxied environment without setting `NODE_ENV=production`.
- **Tests:** `tests/trust-proxy.test.js` — 6 tests across two describe blocks: (1) trust proxy ON: each distinct `X-Forwarded-For` address gets its own rate-limit bucket; client-B is unaffected when client-A exhausts its bucket. (2) trust proxy OFF: different XFF headers do not create separate buckets; plain and forwarded requests all deplete the same loopback-address bucket.
- **CSP audit:** Audited the production Vite build against the existing `Content-Security-Policy`. The Systems page progress bars use React's `style={{ width: ... }}` prop (renders as an HTML `style` attribute), which is already covered by `style-src 'self' 'unsafe-inline'`. The Dashboard `<Trend>` component is inline SVG rendered by React DOM — no external resource fetch, no special CSP directive needed. No CSP changes required.

## CI

- **Workflow:** `.github/workflows/ci.yml` runs on every push and pull request to `main`.
- **Steps:** checkout → Node 22 setup (with npm cache) → `npm ci` → `npm test` → `npm run build`.
- **Badge:** `README.md` displays the live workflow status badge linked to the Actions run history.
