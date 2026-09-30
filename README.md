# IT Operations Center
Incident-management platform for IT support teams. Built for the IBM Bob hackathon (Explore → Fix → Build).

**Stack:** React + Vite + Tailwind (frontend), Express + SQLite via Node's built-in `node:sqlite` (backend), Vitest + Supertest.
Requires Node 22.5+.

## Run
    npm install
    npm run dev     # API on :3001, web on :5173 (hot reload, /api proxied)
    npm test

## Structure
- `server/db.js` schema and seed data · `server/app.js` routes · `server/services/stats.js` dashboard statistics
- `src/` React app: `pages/`, `components/`, `api.js`
- `tests/` API tests · `docs/architecture.md`

## Environment (`.env.example`)
`PORT`, `DATABASE_PATH`, `AI_PROVIDER`, `AI_API_KEY` (reserved for the AI phase).

## Status
Phase 1: shell and dashboard. Phase 2: incident create/view/search/filter/assign/prioritise/resolve, notes, troubleshooting actions, timeline. Phase 3: systems page. Phase 4: knowledge base. Phase 5: AI troubleshooting panel (mock provider). Phase 6: incident reports (editable draft, then save). Phase 7: settings. All features in the original brief are built. The seeded dashboard bug has intentionally not been introduced.
