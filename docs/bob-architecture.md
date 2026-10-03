# Architecture Diagrams

## 1. Resolving an Incident — Sequence Diagram

```mermaid
sequenceDiagram
    actor Tech as Technician
    participant UI as IncidentDetail.jsx
    participant API as src/api.js
    participant Proxy as Vite Proxy
    participant Route as server/app.js
    participant Svc as services/incidents.js
    participant DB as SQLite

    Tech->>UI: Types resolution text
    Tech->>UI: Clicks "Resolve incident"
    UI->>UI: patch({ status: 'Resolved', resolution })
    UI->>API: api('/incidents/:id', { method: 'PATCH', body })
    API->>Proxy: fetch('/api/incidents/:id')
    Proxy->>Route: PATCH /api/incidents/:id (port 3001)

    Route->>Svc: updateIncident(db, id, body)
    Svc->>DB: SELECT incident + events (getIncident)
    DB-->>Svc: current row

    alt resolution field is blank
        Svc-->>Route: HttpError(400, 'A resolution is required')
        Route-->>API: 400 JSON { error }
        API-->>UI: throws Error
        UI->>UI: setErr(message) — shows alert
    else resolution provided
        Svc->>DB: UPDATE incidents SET status, resolution, resolved_at, updated_at
        Svc->>DB: INSERT INTO incident_events (type='status', message='Status changed…')
        Svc->>DB: UPDATE incidents SET updated_at (from addEvent)
        Svc->>DB: SELECT incident + events (getIncident re-fetch)
        DB-->>Svc: updated row with full event list
        Svc-->>Route: updated incident object
        Route-->>API: 200 JSON incident
        API-->>UI: resolved incident object
        UI->>UI: setI(d) — re-render
        UI->>Tech: Button disabled ("Incident resolved")
        UI->>Tech: New timeline entry visible
        UI->>Tech: "Create knowledge article" link appears
    end
```

When the technician clicks **Resolve incident**, the page calls `patch()` which is a thin wrapper around `api()` in [`src/api.js`](../src/api.js). The Vite dev server proxies `/api/*` to Express on port 3001. The route in [`server/app.js`](../server/app.js) delegates immediately to [`updateIncident()`](../server/services/incidents.js) in the incidents service. That function validates the status transition and enforces the rule that a resolution note is mandatory before marking an incident resolved. On success it writes three DB operations — an UPDATE on the incident row, an INSERT into `incident_events`, and a second UPDATE to `updated_at` — then re-fetches the full incident (with all events) and returns it. The response travels back through the same chain and React re-renders the page in place.

---

## 2. Project Component Diagram

```mermaid
graph TD
    subgraph Browser
        Main["main.jsx\n(React entry)"]
        Router["App.jsx\n(React Router)"]
        Layout["Layout.jsx\n(shell + nav)"]
        Pages["Pages\nDashboard · Incidents · IncidentDetail\nSystems · Knowledge · ArticleView\nArticleForm · Settings"]
        Components["Shared Components\nStatusBadge · Field · AiPanel · ReportPanel"]
        ApiClient["api.js\n(fetch wrapper)"]
    end

    subgraph ViteDev["Vite Dev Server"]
        Proxy["/api/* proxy"]
    end

    subgraph Express["Express (port 3001)"]
        AppJS["app.js\n(all routes)"]
        IncSvc["services/incidents.js\nCRUD · validation · events"]
        StatsSvc["services/stats.js\ndashboard aggregates"]
        ArticleSvc["services/articles.js\nknowledge base CRUD"]
        ReportSvc["services/reports.js\nreport draft + save"]
        SettingsSvc["services/settings.js + settingsStore.js\nkey-value preferences"]
        AI["ai/index.js\nprovider factory"]
        Mock["ai/mockProvider.js\nrule-based recommendations"]
    end

    subgraph Data["Data Layer"]
        DB["SQLite\ndata/itops.db\n\nsystems · incidents\nincident_events · articles\narticle_incidents · settings\nincident_reports"]
    end

    subgraph Boot["Server Bootstrap"]
        Index["server/index.js\nload .env · createDb · seed · listen"]
        DBInit["db.js\nschema creation + seed data"]
    end

    Main --> Router --> Layout --> Pages
    Pages --> Components
    Pages --> ApiClient
    Components --> ApiClient
    ApiClient --> Proxy --> AppJS

    AppJS --> IncSvc
    AppJS --> StatsSvc
    AppJS --> ArticleSvc
    AppJS --> ReportSvc
    AppJS --> SettingsSvc
    AppJS --> AI
    AI --> Mock

    IncSvc --> DB
    StatsSvc --> DB
    ArticleSvc --> DB
    ReportSvc --> DB
    SettingsSvc --> DB

    Index --> DBInit --> DB
    Index --> AppJS
```

The project is split into two independent processes. The **browser** side is a React SPA built with Vite — all navigation is client-side via React Router, and every network call goes through the single [`api.js`](../src/api.js) wrapper. In development, Vite proxies those calls to the **Express** server on port 3001; in a production deployment a real reverse proxy (e.g. nginx) would take that role. On the server, [`app.js`](../server/app.js) owns all route definitions and delegates immediately to one of five service modules — keeping route handlers trivial and business logic isolated. All services talk to a single SQLite file through Node's built-in `node:sqlite` module (no ORM, no npm driver). [`server/index.js`](../server/index.js) is the only entry point: it loads the environment, creates and seeds the database, then starts the Express app.
