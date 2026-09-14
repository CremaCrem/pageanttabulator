# AGENTS.md — PageantTabulator

> **Read this file in full at the start of every session before touching any file.**
> This is the authoritative behavioral contract for any AI agent working on this codebase.
> If this file conflicts with a prompt, this file wins.

---

## 0. Quick-Reference Cheatsheet

```
Project:   PageantTabulator — Mr. & Ms. IDSC 2026
Platform:  Tauri v2 (Rust) + axum local server + React 19 browser clients
Event Day: September 10, 2026 · Ligao City Gymnasium (offline, venue WiFi only)

Frontend:  src/              TypeScript strict, React 19, TailwindCSS v3
Backend:   src-tauri/src/   Rust, axum, rusqlite, tokio-tungstenite
Types:     src/types/        All TS domain types here — nowhere else
API:       src/api/          All fetch() calls here — never in components
Scoring:   src-tauri/src/scoring/  All math here — never in Rust routes or JS
```

### Verify commands — run after every non-trivial change:

```bash
# TypeScript type check
npx tsc --noEmit

# Frontend build
npm run build

# Rust type check (fast)
cargo check --manifest-path src-tauri/Cargo.toml

# Rust tests
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 1. Project Identity

| Field | Value |
|---|---|
| App name | PageantTabulator |
| Event | Search for Mr. and Ms. IDSC 2026 — IDSC 18th Founding Anniversary |
| Platform | Desktop (Tauri v2) + Local LAN HTTP/WS server (axum/Rust) + Browser clients (React 19) |
| Purpose | Official, tamper-resistant scoring and tabulation for live gymnasium event |
| Internet on event day | **None** — must work 100% offline on venue WiFi |

---

## 2. Core Mandate

This is a **mission-critical system used at a live event with real students**. Tabulation errors affect real people.

| Priority | Rule |
|---|---|
| 1 | **Accuracy** — every formula must exactly match `docs/scoped/scoring-logic.md` |
| 2 | **Data integrity** — SQLite on the server is the only source of truth |
| 3 | **Resilience** — survive browser crashes, network blips, and admin restarts without data loss |
| 4 | **Clarity** — readable, traceable code over clever abstractions |

---

## 3. Absolute Rules (Never Violate)

| Rule | Why |
|---|---|
| Scoring formulas **must exactly match** `docs/scoped/scoring-logic.md` | Legal/official accuracy |
| All score computation happens **in Rust** (`src-tauri/src/scoring/`) | Cannot trust browser math |
| SQLite is the **only** authoritative data store | Multi-device, crash-safe |
| Server must listen on `0.0.0.0`, never `127.0.0.1` | Judges connect over WiFi |
| Preliminary and Final Q&A scores are stored **separately** | Weighted 50/50 for finals |
| Main Pageant Scoring is **Ranking-Based (Borda Count)** | Official placement is by lowest sum of ranks |
| Top 3 selection is by **composite preliminary ranking per gender** | Never mix male/female |
| Final winners (Top 3) use the **50/50 formula only** | No other formula is valid |
| Top 3 Boundary Ties (prelim) are resolved **OFFLINE** | Admin uses "Advance to Top 3" PIN override — no scoring segment |
| Finals Ties (50/50 result) trigger the **Tie-Breaking Q&A** | System auto-flags tied finalists; admin opens segment |
| `is_in_tiebreak` is set ONLY by `compute_results` "final" | Never set manually from any UI |
| Minor Awards (Advocacy/Ramp) use **Ranking-Based** scoring | Uses the Borda count ranking system |
| Submitted scores are **locked** — no edit without admin PIN + audit log | Data integrity |
| Admin PIN required for all irreversible actions (locks, overrides, manual score entry) | Prevent accidental destruction / fraudulent entry |
| Special awards scoring is **concurrent** with main segments on the UI | Merged forms for judge efficiency |
| All Rust DTO structs communicating with frontend use `#[serde(rename_all = "camelCase")]` | Prevent 422 deserialization crashes |
| UI headers/titles/branding must **dynamically bind** to `eventConfig` | Zero hardcoded event strings |
| Network IP badges fetched from `/api/network-info` | Zero hardcoded LAN IP placeholders |
| `localStorage` is for **non-critical UI preferences only** — never scores or candidates | Crash-safety |
| **No external network calls** — no cloud, no CDN, no telemetry | Offline event constraint |
| **No `any` in TypeScript** — strict types everywhere | Prevents silent runtime errors |

---

## 4. Architecture at a Glance

```
                    Venue WiFi
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
  Admin Laptop       Judge PCs         Projector
  Tauri App          Browser           Browser
  (Server Hub)       /score            /projection
       │
  ┌────┴────┐
  │  axum   │  HTTP :3000   REST API  (/api/*)
  │ server  │  WS   :3000   Events    (/ws)
  └────┬────┘
       │
   SQLite DB
  (app data dir)
```

**Data flow:** React components → `src/api/` → `/api/*` → axum handlers → `src-tauri/src/db/` → SQLite.
**Math flow:** Score submitted → axum route → `src-tauri/src/scoring/compute.rs` → stored result.
**Events flow:** Server broadcasts via WebSocket → React context `APPLY_WS_EVENT` action → UI update.

---

## 5. Tech Stack Laws

### 5.1 Frontend (React)

- **TypeScript strict mode.** No `.js` or `.jsx` files under `src/`.
- **TailwindCSS v3 only.** No inline styles except dynamic runtime values (e.g., `width: score + '%'`).
- **React Router v6+** for all navigation.
- **React Context + `useReducer`** for ephemeral UI state only. Score and candidate data always fetched from the API.
- **No scoring math in the browser.** Live previews are cosmetic only; server recomputes on submission.
- **All `fetch()` calls live in `src/api/`.** Never call `fetch()` directly from a component or hook.
- **All TypeScript domain types live in `src/types/`.** No inline type definitions for domain objects.

### 5.2 Backend (Rust / Tauri)

- **axum** for HTTP — runs inside the Tauri process, spawned as a Tokio async task.
- **tokio-tungstenite via axum WS upgrade** for real-time broadcasts only — not data transfer.
- **rusqlite** — schema defined in `src-tauri/src/db/schema.rs`.
- **ALL formulas in `src-tauri/src/scoring/compute.rs`** — never in route handlers, never in `db/` modules.
- **`#[serde(rename_all = "camelCase")]` on ALL request/response DTOs.** Non-negotiable.
- No separate server process — the server is part of the Tauri binary.

### 5.3 Multi-Device Laws

- The admin Tauri shell and judge browsers use the **same React build** — role is detected via `window.__TAURI__`.
- Judge identity is `sessionStorage`-based — persists through page refresh, not browser close.
- All server-side operations must be **idempotent** — identical request twice = identical result.
- Admin dashboard must show **live judge connection status** via WebSocket.

### 5.4 Storage Laws

| Storage | Allowed content | Not allowed |
|---|---|---|
| SQLite | All score, candidate, event, results data | (nothing else) |
| localStorage | Non-critical UI prefs (last active tab, judge session token for reconnect) | Scores, candidates |
| sessionStorage | Judge slot identity within a browser session | Scores |
| React Context | Ephemeral UI state only (populated by API calls) | Any authoritative data |

---

## 6. File & Folder Conventions

```
src/
  api/            All fetch wrappers — never fetch() in components
  components/     Shared UI components (one component per file)
  context/        AppContext.tsx — single React context + useReducer
  pages/          Route-level page components
    admin/        Admin-only views (gated by window.__TAURI__ or role)
    judge/        Judge scoring views
    shared/       Views accessible by both (e.g., /projection)
  types/          All TypeScript domain types (index.ts re-exports all)
  utils/          Frontend-only utilities (formatters, validators, constants)
                  NO scoring formulas here

src-tauri/src/
  db/             rusqlite queries, schema, migrations
  scoring/        compute.rs — ALL scoring math lives here
  server/         axum route handlers (thin: validate → call db/scoring → respond)
  commands/       Tauri IPC commands (file dialogs only)

docs/             Reference documentation (see Section 13)
```

**One component per file. File name = exported component name (PascalCase).**

---

## 7. Scoring Computation Summary

> Full formulas with worked examples: `docs/scoped/scoring-logic.md` — always verify against it.

```
Main Pageant Scoring (Borda Count):
1. Judge assigns Raw Score = Σ (criterion_score × criterion_weight)
2. Raw scores converted to Ranks per judge per segment
3. Placement = Lowest Sum of Ranks across all judges
4. Raw score sum is the tie-breaker at the ranking-comparison level

Preliminary Composite (per candidate):
  = 20% weighting of the 5 preliminary segment ranks

Final Q&A Segment:
  = Borda Count ranking for Final Q&A (Top 3 only)

Championship Final Score:
  = (Preliminary Rank × 0.50) + (Final Q&A Rank × 0.50)

Top 3 selection:   Best Preliminary Composite Ranking per gender
Final winners:     Best Championship Final Rank per gender
Minor awards:      Best in Advocacy & Ramp use Ranking-Based (Borda Count) scoring, concurrently submitted with parent segments
```

- All scores entered as 1–100 integers.
- Intermediate values: 4 decimal places. Display: 2 decimal places.
- Computations happen **server-side in Rust** after submission — never speculatively in the browser.

---

## 8. User Roles & Access

| Role | Access method | Capabilities |
|---|---|---|
| **Admin** | Tauri desktop (`window.__TAURI__ === true`) | Full control: setup, candidates, locking rounds, reports, PIN-protected actions |
| **Judge** | Browser → `http://[admin-ip]:3000` → select judge slot | Score input for currently open segment only |
| **Viewer** | Browser → `http://[admin-ip]:3000/projection` | Read-only live rankings |

- No login system, no accounts, no per-judge passwords.
- Admin PIN is a 4–6 digit number for irreversible actions only — not a login gate.
- Same REST API for admin and judges — role verified server-side, not via separate endpoints.

---

## 9. Design Laws

> Full token reference: `docs/scoped/design-system.md`.

| Token | Value |
|---|---|
| Primary | Forest Green `#1B5E37` |
| Accent | Metallic Gold `#C9A84C` |
| Background | Warm off-white `#F9F6F0` |
| Body font | Inter |
| Display font | Playfair Display |

- **Premium feel.** Ceremonial event app — luxury award program aesthetic, not a spreadsheet.
- No placeholder content in any shipped view — empty states must have intentional messaging.
- Configuration pages use a **2-column bento structure** (Primary Form + Live Preview/QR Hub) on desktop.

---

## 10. Error Handling Laws

- **Never silently swallow errors.** All Rust `Result` errors must be logged. All API errors return structured JSON `{ "error": "...", "code": "..." }`.
- **Scoring errors halt submission.** A partial or invalid score must never be saved to SQLite.
- **Two-layer validation:** Client-side for UX; server-side for authority. Server always wins.
- **Judge-facing errors must be human-readable.** Plain language, never a stack trace.
- **Score submission retry:** Automatic retry on transient network errors — up to 3 times, exponential backoff.

---

## 11. Anti-Patterns (Never Do These)

```diff
- fetch() inside React components or hooks
- Scoring formulas inside React components, hooks, or src/utils/
- Scoring formulas inside Rust route handlers (axum) or db/ modules
- Using localStorage as primary storage for scores or candidates
- Hardcoding event name, date, or any branding string in components
- Hardcoding LAN IP addresses anywhere in source
- Making the server listen on 127.0.0.1 only
- Separate admin vs. judge API endpoints
- TypeScript `any`
- Auto-calculating winners without explicit admin trigger
- Editing locked segment scores without admin PIN + audit log
- Connecting to any external URL, CDN, or cloud service
- Running scoring math in the browser (even for cosmetic preview that touches the DB)
- Generating exports from the frontend — exports are Rust/Tauri-side only
```

---

## 12. Documentation Maintenance

Update the corresponding doc **in the same change** as your code:

| Change type | Doc to update |
|---|---|
| New page, route, Rust module, or folder restructure | `docs/scoped/architecture.md` |
| New or modified API endpoint or WebSocket event | `docs/scoped/network-server.md` |
| Any formula or weight change (**requires explicit approval**) | `docs/scoped/scoring-logic.md` |
| New component or design token | `docs/scoped/design-system.md` |
| TypeScript type change or SQLite schema change | `docs/scoped/data-models.md` |

**Never delete documentation — append and version instead.**

---

## 13. Reference Documents

Read these when working in the relevant area:

| Document | When to read |
|---|---|
| [`docs/scoped/architecture.md`](./docs/scoped/architecture.md) | Adding pages, routes, Rust modules, or changing data flow |
| [`docs/scoped/network-server.md`](./docs/scoped/network-server.md) | Adding/modifying API endpoints or WebSocket events |
| [`docs/scoped/data-models.md`](./docs/scoped/data-models.md) | Changing TypeScript types or SQLite schema |
| [`docs/scoped/scoring-logic.md`](./docs/scoped/scoring-logic.md) | Any math, weights, criteria, or ranking logic |
| [`docs/scoped/design-system.md`](./docs/scoped/design-system.md) | UI components, colors, typography, Tailwind config |
| [`docs/reference/pageant-rules.md`](./docs/reference/pageant-rules.md) | Ground truth for all official pageant mechanics |
| [`docs/ai-constitution.md`](./docs/ai-constitution.md) | Legacy full constitution — superseded by this file for agent use |

---

## 14. Git Conventions

- **Single-line & Concise:** Whenever committing changes, always write a single-line, concise commit message.
- **Conventional Commits:** Follow conventional commit style (e.g., `feat: ...`, `fix: ...`, `refactor: ...`, `docs: ...`, `chore: ...`). Example: `fix: resolve session token bug`.
- **No Multi-line Bodies:** Do not include multi-line message bodies or detailed lists in commit messages unless explicitly requested.
- **Direct Application:** Do not ask for confirmation on the commit style each time — apply it automatically.

---

*AGENTS.md v1.0 — August 31, 2026*
*Supersedes `docs/ai-constitution.md` as the primary agent-facing behavioral contract.*
*Event: IDSC 18th Founding Anniversary — Mr. & Ms. IDSC 2026 · September 10, 2026*

