# 🤖 AI Constitution — PageantTabulator (Mr. & Ms. IDSC 2026)

> **This file is the primary behavioral contract for any AI agent working on this codebase.**  
> Read this FIRST before touching any file. Every decision, every component, every line of code must be evaluated against these principles.

---

## 1. Project Identity

**Application Name:** PageantTabulator  
**Event:** Search for Mr. and Ms. IDSC 2026 — IDSC 18th Founding Anniversary Celebration  
**Platform:** Desktop app (Tauri v2) + Local LAN Web Server (axum/Rust) + Browser clients (React 19)  
**Purpose:** Official, tamper-resistant scoring and tabulation system for the pageant judges and tabulation committee at a live gymnasium event.

---

## 2. Core Mandate

You are building a **mission-critical scoring application used at a live event with real students**. Errors in tabulation directly affect real people. Therefore:

- **Accuracy over speed.** Every formula, every weighted computation, every ranking must be mathematically correct. Verify against `scoring-logic.md`.
- **Clarity over cleverness.** Code must be readable, predictable, and traceable. Avoid overly abstract patterns.
- **Data integrity above all.** All authoritative data lives in SQLite on the server. Never trust the client as the source of truth. Never mutate score data without explicit confirmation.
- **Resilience over features.** The app must survive a judge's browser crashing, a network blip, and the admin accidentally closing and reopening the app — without data loss.

---

## 3. Absolute Rules (Never Violate)

| Rule | Rationale |
|------|-----------|
| All scoring formulas must exactly match `scoring-logic.md` | Legal/official accuracy |
| All authoritative score computation happens **in Rust on the server** | Cannot trust browser math |
| SQLite is the **primary and only** data store — never localStorage | Multi-device, crash-safe |
| The server listens on `0.0.0.0` (all interfaces), not `127.0.0.1` | Judges must reach it over WiFi |
| Preliminary scores and Final Q&A scores are stored separately | They are weighted 50/50 for finals |
| Top 5 selection is based solely on cumulative preliminary score per category | Do not mix Male/Female |
| Final winners (Top 3) are determined only by the 50/50 formula | No other formula is valid |
| Submitted scores are locked and cannot be edited without admin PIN override | Data integrity |
| Admin PIN is required for all irreversible actions | Prevent accidental destruction |
| Special awards scoring is independent from main competition | Never combine them |
| The app must work with **zero internet** on event day | Venue reliability cannot be assumed |
| All JSON network payloads must be `camelCase` with Rust `#[serde(rename_all = "camelCase")]` | Prevent 422 deserialization crashes |

---

## 4. Tech Stack Laws

### Frontend (React)
- **Framework:** React 19 with TypeScript strict mode. No `.js` or `.jsx` files in `src/`.
- **Styling:** TailwindCSS v3 only. No inline styles except dynamic values (e.g., `width: score + '%'`). No other CSS frameworks.
- **Routing:** React Router v6+ for all navigation.
- **State:** React Context + `useReducer` for ephemeral UI state only. **No score or candidate data in React state** — always fetch from the API.
- **No scoring math in the browser.** The browser may show a live preview (not authoritative) — but the server recomputes on submission.

### Backend (Rust / Tauri)
- **HTTP Server:** `axum` — runs inside the Tauri process, spawned as a Tokio async task.
- **WebSocket:** `tokio-tungstenite` via axum's WebSocket upgrade — for real-time event broadcasts.
- **Database:** SQLite via `rusqlite`. Schema is defined in `src-tauri/src/db/schema.rs`.
- **Scoring Engine:** All formulas in `src-tauri/src/scoring/compute.rs`. This is the **single source of truth** for all score computation.
- **Serialization:** **MANDATORY** `#[serde(rename_all = "camelCase")]` on ALL Rust request/response DTOs communicating with the frontend.
- **No separate server process.** The server is part of the Tauri binary. It starts and stops with the app.

### Storage Laws
- `localStorage` may only be used for non-critical UI preferences (e.g., last active tab).
- `sessionStorage` is used on judge browsers for `judgeId` — it is ephemeral and safe for this purpose.
- All score data, candidate data, event config, and results live in **SQLite only**.
- React Context / component state is ephemeral UI state only — it is populated by API calls, not the primary store.

### API Communication & Data Mapping
- All data operations go through the REST API (`/api/*`) — not via Tauri IPC commands (except for file export dialogs).
- The admin Tauri shell uses the **same API** as the judge browsers — no special backdoor paths for the admin.
- WebSocket (`/ws`) is for real-time event notifications only — not for data transfer.
- **Wire Casing Standard:** The network contract is strictly `camelCase`. Every endpoint input/output struct in Rust must be decorated with `#[serde(rename_all = "camelCase")]`. Never accept or emit raw unmapped `snake_case` JSON keys.

---

## 5. Design Laws

> Refer to `design-system.md` for complete tokens and component specifications.

- **Primary color:** Forest Green `#1B5E37` — headers, primary buttons, active nav states, table headers.
- **Accent color:** Metallic Gold `#C9A84C` — champion badges, award accents, highlights.
- **Background:** Warm off-white `#F9F6F0` — never pure white, never pure black.
- **Fonts:** `Inter` for all UI text, `Playfair Display` for display headings and event titles.
- **The design must feel premium.** This is a ceremonial event app — it should look like a luxury award program, not a spreadsheet tool.
- **No placeholder content in any shipped view.** Empty states must have intentional messaging.

---

## 6. File & Folder Laws

Follow the structure in `architecture.md` exactly. Key rules:

- **One component per file.** File name = exported component name.
- **All Rust scoring logic lives in `src-tauri/src/scoring/`.** Never write formulas in route handlers.
- **All API calls originate from `src/api/`.** No `fetch()` calls inside components or hooks directly.
- **All TypeScript types live in `src/types/`.** No inline type definitions for domain objects.
- **The `src/utils/` folder contains frontend-only utilities** (formatters, client-side validators, constants). No scoring formulas here — those are in Rust.

---

## 7. Multi-Device Architecture Laws

This is **not** a single-user app. It is a local network hub-and-spoke system. Follow these rules:

- The server binds to `0.0.0.0` — never `localhost` or `127.0.0.1` (judges cannot reach localhost-only).
- The admin Tauri shell and the judge browsers use the **same React build** — context is detected via `window.__TAURI__`.
- Judge identity is `sessionStorage`-based — it persists through page refresh but not browser close.
- The admin dashboard must show **live judge connection status** — judges who drop off must be immediately visible.
- Any operation that locks or computes must be **idempotent** — if the server processes the same request twice, the result must be identical.

---

## 8. Scoring Computation Rules (Summary)

> Full formulas with examples are in `scoring-logic.md`. This is a summary of invariants only.

```
Segment Score (per judge, per candidate, per segment):
  = Σ (criterion_score × criterion_weight)

Preliminary Score (per candidate):
  = Σ (avg_segment_score × segment_weight)   [each of 4 segments = 25%]

Final Q&A Score (per candidate, Top 5 only):
  = Σ (criterion_score × criterion_weight)   [averaged across all judges]

Final Score (Championship Rule):
  = (Preliminary Score × 0.50) + (Final Q&A Score × 0.50)

Top 5 selection:   Top 5 per gender by Preliminary Score
Final winners:     Top 3 per gender by Final Score
```

- All scores entered on a 1–100 integer scale.
- All intermediate values carried to 4 decimal places; displayed to 2 decimal places.
- Computations happen in Rust after score submission — not speculatively in the browser.

---

## 9. User Roles & Access

| Role | How they access | Capabilities |
|------|----------------|-------------|
| **Admin** | Tauri desktop app (`window.__TAURI__` = true) | Full control: setup, candidates, locking rounds, reports, PIN-protected actions |
| **Judge** | Browser → `http://[admin-ip]:3000` → selects judge slot | Score input only for the currently open segment |
| **Viewer** | Browser → `http://[admin-ip]:3000/projection` | Read-only live ranking display |

- No login system. No accounts. No passwords stored per judge.
- Admin PIN is a 4–6 digit number for irreversible actions only — not a login gate.
- Judge identity is selected once per session on a self-service screen.

---

## 10. Error Handling Laws

- **Never silently swallow errors.** All Rust `Result` errors must be logged. All API errors must return structured JSON error responses.
- **Scoring errors must halt submission.** A partial or invalid score must never be saved to SQLite.
- **Two-layer validation:** Client-side validation for UX; server-side validation for authority. Server is always the final arbiter.
- **Judge-facing errors must be human readable.** "Score must be between 1 and 100" — not a stack trace.
- **Network retry on judge browsers:** Score submissions that fail due to transient network errors must retry automatically (up to 3 times, with exponential backoff).

---

## 11. Export & Report Laws

- **PDF export** is the primary format for official results — triggered from the admin Tauri app via file dialog.
- **CSV export** is available for raw score data (admin only).
- All exports must include: event name, event date, category, candidate number, name, department, all segment scores, preliminary score, final score (if applicable), and rank.
- Exports are generated by the Rust backend and saved via Tauri's file system API to a user-chosen path.

---

## 12. What NOT to Do

- Do NOT connect to any external URL or cloud service.
- Do NOT use `localStorage` as the primary data store for scores or candidates.
- Do NOT write scoring formulas in React components or frontend utils — Rust only.
- Do NOT allow score editing after a segment is locked without admin PIN + audit log entry.
- Do NOT use `any` in TypeScript — strict types at all times.
- Do NOT create separate API endpoints for admin vs. judge — same API, role is verified server-side.
- Do NOT auto-calculate winners — admin must explicitly trigger computation.
- Do NOT rename official segment names, criteria labels, or weight percentages without explicit approval.
- Do NOT make the server listen on `127.0.0.1` only — judges will not be able to connect.

---

## 13. Documentation Maintenance

When you add a new feature:
1. Update `architecture.md` if you add new pages, routes, Rust modules, or change the folder structure.
2. Update `network-server.md` if you add API endpoints or WebSocket events.
3. Update `scoring-logic.md` if **any** formula or weight changes — this requires explicit approval.
4. Update `design-system.md` if you add new components or design tokens.
5. Update `data-models.md` if TypeScript types or the SQLite schema changes.
6. Never delete documentation — append and version instead.

---

*AI Constitution Version: 2.0 — August 21, 2026 (Revised: Hub-and-spoke LAN, SQLite, axum server, multi-device)*  
*Event: IDSC 18th Founding Anniversary — Mr. & Ms. IDSC 2026*
