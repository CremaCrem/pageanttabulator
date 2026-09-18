# Architecture — PageantTabulator

> **Event:** Mr. and Ms. IDSC 2026 — IDSC 18th Founding Anniversary Celebration  
> **Stack:** Tauri v2 · React 19 · TypeScript · TailwindCSS v3 · axum · SQLite

---

## 1. System Overview

PageantTabulator follows a **local hub-and-spoke architecture**. The admin's Tauri desktop app is the hub — it runs a fully embedded HTTP and WebSocket server that all other devices on the venue network connect to. No cloud, no internet dependency, no external services.

```
                    Venue WiFi (provided by client)
                              │
           ┌──────────────────┴──────────────────────┐
           │                                         │
  ┌────────▼─────────┐                  ┌────────────▼──────────┐
  │   ADMIN LAPTOP   │                  │       Judge PC        │
  │  ┌─────────────┐ │                  │       Browser         │
  │  │  Tauri App  │ │                  │                       │
  │  │  (desktop)  │ │                  │       Connects        │
  │  └──────┬──────┘ │                  │       to :3000        │
  │         │        │                  │       /judge          │
  │  ┌──────▼──────┐ │                  └───────────────────────┘
  │  │ HTTP Server │ │
  │  │ WS Server   │ │
  │  │  (axum)     │ │
  │  └──────┬──────┘ │
  │         │        │
  │  ┌──────▼──────┐ │
  │  │   SQLite    │ │
  │  │  Database   │ │
  │  └─────────────┘ │
  └──────────────────┘
```

### Key Principle
The admin laptop is **both** the desktop app the admin uses **and** the server that serves the judge web interface. When the admin closes the Tauri app, the server stops. Everything is self-contained.

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Desktop Shell | Tauri | v2 | Native window, system tray, installer bundling |
| HTTP Server | axum (Rust) | latest | REST API served from within the Tauri process |
| WebSocket | axum + tokio-tungstenite | latest | Real-time bidirectional events |
| Database | SQLite via rusqlite | latest | Persistent, crash-safe score storage |
| Frontend | React | 19 | Component-based UI for both admin and judge views |
| Language | TypeScript | ~5.8 | Type safety across the entire frontend |
| Styling | TailwindCSS | v3 | Utility-first CSS framework |
| Build Tool | Vite | ^7 | Frontend bundler; Vite dev server in development |
| Routing | React Router | v6+ | Client-side routing |
| CI/CD | GitHub Actions | — | Cross-compiles Windows installer from macOS dev machine |

---

## 3. Frontend Context Detection — One App, Two Modes

Rather than maintaining two separate frontend codebases, the React app **detects its own runtime context** and adapts:

```typescript
const isAdminMode = Boolean(window.__TAURI__);
// → true  when running inside the Tauri shell (admin desktop app)
// → false when accessed via browser (judge or viewer)
```

| Runtime | Who uses it | What they see |
|---------|------------|---------------|
| Tauri shell (`window.__TAURI__` = true) | Admin / Tabulator | Full dashboard, candidate management, round controls, reports |
| Browser (HTTP, judge route) | Judges (up to 10) | "Who are you?" selection → scoring interface |

This means there is **one** React build output that is:
- Served by the Tauri shell for the admin
- Served by the embedded axum HTTP server for judges

---

## 4. Project Directory Structure

```
pageanttabulator/
├── src/                              # React frontend source
│   ├── main.tsx                      # App entry point
│   ├── App.tsx                       # Root component + Router + context detection
│   ├── App.css                       # Global styles (Tailwind imports + base tokens)
│   │
│   ├── types/                        # TypeScript domain types
│   │   ├── candidate.ts              # ICandidate, Gender enum
│   │   ├── judge.ts                  # IJudge, UserRole enum
│   │   ├── score.ts                  # ISegmentScore, IScoreMap
│   │   ├── segment.ts                # ISegment, ICriterion
│   │   ├── event.ts                  # IEventConfig
│   │   ├── results.ts                # ICandidateResult, ISpecialAward
│   │   ├── enums.ts                  # All enums (SegmentId, RoundId, etc.)
│   │   └── ws.ts                     # WebSocket message contracts (IWSMessage)
│   │
│   ├── api/                          # HTTP client — all server calls go here
│   │   ├── client.ts                 # Base fetch wrapper (base URL, error handling)
│   │   ├── candidates.ts             # GET/POST/PATCH candidates
│   │   ├── judges.ts                 # GET/POST judges, session management
│   │   ├── scores.ts                 # POST scores, GET score summaries
│   │   ├── rounds.ts                 # POST lock round, GET round status
│   │   └── results.ts                # GET rankings, GET final results
│   │
│   ├── ws/                           # WebSocket client
│   │   ├── wsClient.ts               # Singleton WS connection manager
│   │   └── wsEvents.ts               # Event type handlers (score submitted, round locked, etc.)
│   │
│   ├── context/                      # React global state (UI state only — not score data)
│   │   ├── AppContext.tsx            # Root context: event config, session
│   │   ├── appReducer.ts             # Reducer for local UI state
│   │   └── SessionContext.tsx        # Current user role, judgeId
│   │
│   ├── pages/                        # Route-level page components
│   │   ├── admin/
│   │   │   ├── DashboardPage.tsx     # Admin overview, live rankings, quick actions
│   │   │   ├── SetupPage.tsx         # Event config, candidate registration, judge count
│   │   │   ├── CandidatesPage.tsx    # Full candidate roster management
│   │   │   ├── CriteriaPage.tsx      # Read-only segment criteria reference
│   │   │   ├── JudgeStatusPage.tsx   # Live judge submission progress
│   │   │   └── ReportsPage.tsx       # Final results, winner reveal, PDF/CSV export
│   │   └── judge/
│   │       ├── JudgeSelectPage.tsx   # "Who are you?" judge identity selection
│   │       └── ScoringPage.tsx       # Candidate navigator + criteria scoring form
│   │
│   ├── components/                   # Reusable UI building blocks
│   │   ├── layout/
│   │   │   ├── AdminShell.tsx        # Admin sidebar + header layout
│   │   │   ├── JudgeShell.tsx        # Judge minimal layout (header only)
│   │   │   └── PageWrapper.tsx       # Content area wrapper
│   │   ├── candidates/
│   │   │   ├── CandidateCard.tsx
│   │   │   ├── CandidateTable.tsx
│   │   │   └── CandidateForm.tsx
│   │   ├── scoring/
│   │   │   ├── ScoreInput.tsx        # Single criterion input (1–100)
│   │   │   ├── ScoreSheet.tsx        # Full criteria table for one candidate
│   │   │   └── ScoreSummary.tsx      # Live weighted total preview
│   │   ├── results/
│   │   │   ├── RankingTable.tsx
│   │   │   ├── WinnerBadge.tsx
│   │   │   └── SpecialAwardCard.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       ├── Badge.tsx
│   │       ├── Spinner.tsx
│   │       ├── ConnectionStatus.tsx  # WiFi/server connection indicator
│   │       └── Tooltip.tsx
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useSession.ts             # Current role/judgeId from SessionContext
│   │   ├── useWebSocket.ts           # Subscribe to WS events
│   │   ├── useCandidates.ts          # Fetch/cache candidates from API
│   │   ├── useRankings.ts            # Fetch/subscribe to live rankings
│   │   └── useExport.ts             # Trigger Tauri PDF/CSV export commands
│   │
│   └── utils/                        # Pure utility functions (UI-only)
│       ├── formatters.ts             # Score display, name formatting
│       ├── validation.ts             # Client-side input validation (1–100 range)
│       └── constants.ts             # SEGMENT_WEIGHTS, MAX_JUDGES, etc.
│
├── src-tauri/                        # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs                   # Tauri app entry — starts server, opens window
│   │   ├── lib.rs                    # Tauri command bindings
│   │   ├── server/
│   │   │   ├── mod.rs                # axum router setup, server spawn
│   │   │   ├── routes/
│   │   │   │   ├── candidates.rs     # /api/candidates CRUD
│   │   │   │   ├── judges.rs         # /api/judges + /api/session
│   │   │   │   ├── scores.rs         # /api/scores POST + GET
│   │   │   │   ├── rounds.rs         # /api/rounds lock/unlock
│   │   │   │   └── results.rs        # /api/results rankings + finals
│   │   │   └── ws.rs                 # WebSocket upgrade handler + broadcast
│   │   ├── db/
│   │   │   ├── mod.rs                # DB connection pool init
│   │   │   ├── schema.rs             # SQL table definitions + migrations
│   │   │   ├── candidates.rs         # DB queries for candidates
│   │   │   ├── judges.rs             # DB queries for judges
│   │   │   ├── scores.rs             # DB queries for scores
│   │   │   └── results.rs            # DB queries for computed results
│   │   └── scoring/
│   │       ├── mod.rs
│   │       ├── compute.rs            # All scoring formulas (SINGLE SOURCE OF TRUTH)
│   │       └── ranking.rs            # Ranking and Top 5 selection
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── docs/                             # Developer documentation
│   ├── ai-constitution.md
│   ├── architecture.md               # This file
│   ├── network-server.md             # Embedded server, API, WebSocket, deployment
│   ├── design-system.md
│   ├── scoring-logic.md
│   ├── pageant-rules.md
│   └── data-models.md
│
├── .github/
│   └── workflows/
│       └── build.yml                 # GitHub Actions: builds Windows installer on push
│
├── e2e/                              # Playwright UI smoke tests (testing-strategy.md Phase 3)
│   ├── smoke.spec.ts                 # Admin setup flow + judge score submission
│   └── .tmp/                         # Throwaway test database (gitignored, wiped per run)
│
├── public/
├── index.html
├── vite.config.ts
├── playwright.config.ts              # Builds dist + boots pageant-server as the test server
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 5. Application Routes

### Admin Routes (Tauri shell only — `window.__TAURI__` = true)

| Route | Page | Description |
|-------|------|-------------|
| `/` | `SetupPage` | Event configuration, candidate registration, judge count |
| `/dashboard` | `DashboardPage` | Live overview: rankings, judge progress, quick actions |
| `/candidates` | `CandidatesPage` | Add, edit, manage all candidates |
| `/criteria` | `CriteriaPage` | Read-only criteria and weights reference |
| `/judges` | `JudgeStatusPage` | Per-judge scoring progress matrix |
| `/results` | `ResultsPage` | Event context, tie resolution status, championship/Top 3/minor awards presentation, detailed official results |
| `/reports` | `ReportsPage` | Final results, winner determination, export |
| `/history` | `EventHistoryPage` | View past events and create new ones |
| `/diagnostics`| `DiagnosticsPage`| System health, logs, and connection status |

### Judge Routes (Browser, served by axum)

| Route | Page | Description |
|-------|------|-------------|
| `/` | `JudgeSelectPage` | "Who are you?" — judge identity selection |
| `/score` | `ScoringPage` | Candidate navigator + scoring form (Also renders **ThankYouView** when all segments locked, and uses **ErrorBoundary** for crashes) |


---

## 6. Data Storage Strategy

### Primary Storage: SQLite (Server-Side)
All authoritative data lives in a single SQLite `.db` file on the admin's laptop:
- Candidates, judges, event config
- All submitted scores (with timestamps)
- Round lock states
- Computed results

### UI State: React Context (Client-Side, Ephemeral)
- Current user session (role, judgeId) — stored in `sessionStorage` in browser
- Admin UI state (selected segment, active filters) — in-memory React state only
- No score data lives in React state — it always comes from the server via API

### Why NOT localStorage as Primary Storage
The original plan used `localStorage` as primary persistence. This is **wrong** for a multi-device setup:
- `localStorage` is per-browser, per-origin — judge browsers cannot see admin data
- The server (SQLite) is the single source of truth
- `localStorage` may only be used for non-critical UI preferences (e.g., last selected segment tab)

---

## 7. Scoring Computation: Where It Happens

> **All scoring computations happen in Rust on the server — not in the browser.**

| Computation | Location | Reason |
|-------------|---------|--------|
| Raw score per judge | Rust (`scoring/compute.rs`) | Authoritative, not trust-dependent |
| Rank aggregation across judges | Rust | Same |
| Preliminary rank composite (20% × 5 segments) | Rust | Same |
| Top 3 selection and Tie-break flow | Rust | Same |
| Final rank (50/50 rule) | Rust | Same |
| Input validation (1–100 range) | React (client) + Rust (server) | Two-layer: UX first, then authoritative |

The browser only performs **live preview** of the weighted total as the judge types — this is a convenience display, not an authoritative calculation. The server recomputes on submission.

---

## 8. Real-Time Data Flow

### Score Submission Flow

```
Judge enters criteria scores in browser
        ↓
Client-side preview: weighted total updates live (React, not authoritative)
        ↓
Judge clicks "Submit Final Score"
        ↓
Confirmation modal: "This cannot be changed. Confirm?"
        ↓
POST /api/scores  →  axum server
        ↓
Rust validates: range 1–100, round is open, not already submitted
        ↓
Rust computes authoritative weighted score → saves to SQLite
        ↓
Server broadcasts WebSocket event: SCORE_SUBMITTED { judgeId, candidateId, segmentId }
        ↓
Admin dashboard receives WS event → updates judge progress live
        ↓
Judge browser: score locked for this candidate/segment, advances to next
```

### Round Lock Flow

```
Admin verifies all judges show 100% completion for current segment
        ↓
Admin clicks "Lock Segment" (PIN confirmation required)
        ↓
POST /api/rounds/lock  →  axum server
        ↓
Rust marks round as locked in SQLite
Rust computes rankings and rank-sums for all candidates for this segment
        ↓
Server broadcasts WS event: SEGMENT_LOCKED { segmentId }
        ↓
Judge browsers: scoring form for this segment becomes read-only
Admin dashboard: segment shows locked status, rankings displayed
```

### Admin Opens Next Segment

```
Admin clicks "Open Segment: [Next Segment]"
        ↓
POST /api/rounds/open  →  axum server
        ↓
Server broadcasts WS event: SEGMENT_OPENED { segmentId }
        ↓
Judge browsers: UI automatically updates to show new segment
```

---

## 9. Network Configuration

| Setting | Value |
|---------|-------|
| Server host | `0.0.0.0` (all interfaces — necessary for LAN access) |
| Server port | `3000` (configurable) |
| Network | Venue WiFi (admin laptop hotspot as fallback) |
| Judge access URL | `http://[admin-laptop-IP]:3000` |
| Max concurrent clients | 12 (10 judges + admin browser) — trivial load |

The admin laptop's local IP is displayed prominently in the Tauri app so the admin can share it with judges easily.

---

## 10. Deployment Pipeline

> Full guide in [`network-server.md`](./network-server.md).

```
Developer (macOS)
    │
    └── Push to GitHub (main branch)
              │
              └── GitHub Actions triggers
                        │
                        ├── Builds Windows .msi installer
                        ├── Builds Windows .exe installer
                        └── Uploads as release artifacts
                                  │
                                  └── Download → USB drive → Admin laptop
                                                  │
                                                  └── Install once
                                                      Double-click to run on event day
```

---

## 11. Window Configuration

| Property | Value |
|----------|-------|
| Initial State | Maximized |
| Min Width | 1280px |
| Min Height | 800px |
| Resizable | Yes |
| Title | "PageantTabulator — Mr. & Ms. IDSC 2026" |
| Decorations | Yes (native Windows chrome) |

*Note: 1280x800 is the supported native Admin window minimum. CSS breakpoints (such as `1024px`) found in the design system represent responsive layout boundaries for web views, not necessarily supported native desktop window sizes.*

---

## 12. Development Commands

```bash
# Install dependencies
npm install

# Run in development mode (Tauri window + hot reload)
npm run tauri dev

# Run frontend only in browser (useful for judge UI development)
npm run dev

# Type check
npx tsc --noEmit

# Rust test suite (scoring unit tests + API integration tests)
cargo test --manifest-path src-tauri/Cargo.toml

# Playwright UI smoke tests (builds dist and boots its own server on :3000)
npm run test:e2e

# Build production Windows app (run on Windows or via GitHub Actions)
npm run tauri build
```

---

*Architecture Version: 2.0 — August 21, 2026 (Revised: Hub-and-spoke LAN architecture, SQLite, embedded axum server)*
