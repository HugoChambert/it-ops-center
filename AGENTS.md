# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands

```bash
npm run dev          # starts both processes: Express API (port 3001) + Vite client (port 5173)
npm run dev:server   # API only
npm run dev:client   # Vite only
npm test             # all tests (vitest)
npx vitest run tests/incidents.test.js   # single test file
npx vitest run tests/incidents.test.js -t "status changes"  # single describe block
```

## Architecture (non-obvious)

- **Two separate processes** — Express and Vite run side-by-side via `concurrently`. Vite proxies `/api/*` to `localhost:3001`.
- **SQLite via Node's built-in** — uses `process.getBuiltinModule('node:sqlite')`, not a npm package. Do not add `better-sqlite3` or similar.
- **DB is passed everywhere as a parameter** — `createDb()` returns the db, `createApp(db)` takes it. Tests create a fresh `:memory:` db in `beforeEach` and pass it to `createApp`. Never import db as a singleton.
- **All API routes live in one file** — [`server/app.js`](server/app.js). 58 lines. All routes here, business logic in `server/services/`.
- **`HttpError` is the only error type** — defined in `server/services/incidents.js`, imported by all other services. Errors with `expose: true` are returned to the client; others become 500.

## Code Patterns

- **`text(v)` helper** — every service file has `const text = (v) => (typeof v === 'string' ? v.trim() : '')`. Use this pattern for all string inputs from request bodies.
- **`now()`** — `const now = () => new Date().toISOString()` is the standard for timestamps. Never use `Date.now()` or non-ISO formats.
- **`addEvent(db, id, type, message)`** — the only correct way to log incident timeline entries. `type` must be `'status'`, `'note'`, or `'action'` (enforced by DB CHECK constraint).
- **Settings** — all settings go through `settingsStore.js`. DEFAULTS are `{ technician_name: 'Hugo Chambert', default_priority: 'Medium' }`. `getSetting` falls back to DEFAULTS; no need to seed settings table.
- **AI provider interface** — any real provider must implement `{ name, troubleshoot(incident), draftReport(incident) }`. Both methods are async. Set `AI_PROVIDER` env var to select; default is `mock`.

## Frontend Patterns

- **`api(path, opts)`** in `src/api.js` — sole HTTP client. Prepends `/api`, throws `Error` on non-ok status. Never use `fetch` directly.
- **`inputCls`** — exported from `src/components/Field.jsx`. Use for all `<input>`, `<select>`, `<textarea>` elements to keep styling consistent.
- **`STATUSES` / `PRIORITIES`**  — defined in both `src/api.js` (frontend) and `server/services/incidents.js` (backend). Update both if values change.
- **`useOutletContext`** — `Layout` passes `{ setTechnician }` via Outlet context. `Settings.jsx` uses this to update the header name after save.

## Testing

- Test files are in `tests/` (not co-located), configured via `vite.config.js` `test.include`.
- Each test file creates its own `createDb(':memory:')` + `seed(db)` + `createApp(db)`. No shared state.
- Tests use `supertest` against the Express app directly — no network port needed.
- Seed data is 6 systems and 6 incidents with known IDs (1–6). Tests that reference specific IDs (e.g. incident 2) rely on seed stability.

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Express listen port |
| `DATABASE_PATH` | `./data/itops.db` | SQLite file path |
| `AI_PROVIDER` | `mock` | AI provider name |
| `AI_API_KEY` | — | Key for real providers; never returned by API |

See `.env.example` for reference.
