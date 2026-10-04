# IT Operations Center
Incident-management platform for IT support teams. Built for the IBM Bob hackathon (Explore → Fix → Build).

**Live demo:** [https://it-ops-center.onrender.com/](https://it-ops-center.onrender.com/)
> Hosted on a free tier, so the first load after a quiet period may take about a minute to wake up. Demo data resets periodically.

**Stack:** React + Vite + Tailwind (frontend), Express + SQLite via Node's built-in `node:sqlite` (backend), Vitest + Supertest.
Requires Node 22.5+.

## Run
    npm install
    npm run dev     # API on :3001, web on :5173 (hot reload, /api proxied)
    npm test

## Structure
- `server/db.js` schema and seed data · `server/app.js` routes · `server/services/stats.js` dashboard statistics
- `server/config/sla.js` SLA deadline windows · `server/services/sla.js` deadline/label computation
- `src/` React app: `pages/`, `components/` (includes `SlaChip`), `api.js`
- `tests/` API tests · `docs/architecture.md`

## Environment (`.env.example`)
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Express listen port |
| `DATABASE_PATH` | `./data/itops.db` | SQLite file path |
| `AI_PROVIDER` | `mock` | AI provider name |
| `AI_API_KEY` | — | Key for real providers; never returned by API |
| `DEMO_RESET_HOURS` | _(unset)_ | When set, wipes and reseeds data on that interval |
| `VITE_DEMO_BANNER` | _(unset)_ | Build-time flag; set to `true` to show the demo banner |

## Deployment

### Docker

```bash
# build
docker build -t it-ops-center .

# run (data persisted in a named volume)
docker run -p 3000:3000 \
  -v it-ops-data:/app/data \
  -e PORT=3000 \
  it-ops-center
```

The `npm start` script sets `NODE_ENV=production`; Express then serves the built frontend from `dist/` and falls back to `index.html` for any non-`/api` path (React Router deep-links work on refresh).

### Render

1. Connect the repository in the Render dashboard.
2. Choose **Web Service** → **Docker** (uses the `Dockerfile` in the repo root).
3. Set the **Port** to `3000` (or your `PORT` env var value).
4. Add a **Disk** (mount path `/app/data`, e.g. 1 GB) so the SQLite database survives deploys.
5. Optional env vars: `DEMO_RESET_HOURS`, and at build time `VITE_DEMO_BANNER=true` for the demo banner.
6. Click **Deploy**. First deploy runs `npm ci && npm run build` then `node server/index.js`.

## SLA
Each open incident has a response deadline based on priority: **Critical 1 h · High 4 h · Medium 8 h · Low 24 h**.

The deadline is computed from `created_at + current priority window` at request time (not stored). Every incident API response includes an `sla` field:

```json
{ "deadline": "…ISO…", "msRemaining": -3900000, "overdue": true,
  "label": "Overdue by 1h 5m", "target": "Target: 1 hour" }
```

Resolved and Closed incidents return `"sla": null`. The dashboard exposes `overdueIncidents`. Changing priority shifts the deadline immediately — intentional, so a Critical re-triage surfaces overdue status straight away.

## Known Limitations

### Authentication
This demo has **no authentication layer** — all API endpoints are publicly accessible to anyone who can reach the server. This is intentional for the demo deployment; the data resets periodically and contains no real personal information.

A production version would need:
- A login page (username + password with bcrypt hashing) or SSO via an identity provider (e.g. SAML, OIDC).
- Session management (e.g. `express-session` + a secure cookie) or signed JWTs with short expiry.
- Role-based access control separating read-only users from technicians and admins.
- HTTPS enforcement with HSTS (already set in the security headers, but TLS termination must be configured at the host or reverse proxy).

If you are deploying this for internal use rather than as a public demo, the simplest hardening step is to set an `API_TOKEN` environment variable and protect every `/api` route with a single bearer-token check, as documented in [`docs/security-audit.md`](docs/security-audit.md#sec-001).

---

## Status
Phase 1: shell and dashboard. Phase 2: incident create/view/search/filter/assign/prioritise/resolve, notes, troubleshooting actions, timeline. Phase 3: systems page. Phase 4: knowledge base. Phase 5: AI troubleshooting panel (mock provider). Phase 6: incident reports (editable draft, then save). Phase 7: settings. Phase 8: SLA deadlines and overdue tracking. All features in the original brief are built.
