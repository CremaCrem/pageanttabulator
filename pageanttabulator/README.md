# PageantTabulator

**Official Tabulation System — Mr. and Ms. IDSC 2026**  
IDSC 18th Founding Anniversary Celebration · Pageant Day: September 10, 2026 · Ligao City Gymnasium

---

## What Is This?

PageantTabulator is a purpose-built, offline-capable desktop application for running the live tabulation of the Mr. and Ms. IDSC 2026 pageant. The admin's laptop acts as the hub — running a local HTTP and WebSocket server — while judges connect from their own Windows machines using any browser. No cloud, no accounts, no installation required for judges.

```
           Venue WiFi
                │
  ┌─────────────┼──────────────┐
  │             │              │
Admin Laptop  Judge PCs    Projector
Tauri App     Browser       Browser
(Server Hub)  (Scoring)    (/projection)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri v2 (Rust) |
| Embedded Server | Rust · axum · WebSocket |
| Database | SQLite (via rusqlite) |
| Frontend | React 19 · TypeScript · TailwindCSS v3 |
| Build Tool | Vite 7 |
| CI/CD | GitHub Actions → Windows installer |

---

## Documentation

Read documents in this order if you are building on this project:

| Document | Purpose |
|----------|---------|
| [`docs/ai-constitution.md`](./docs/ai-constitution.md) | **READ FIRST** — Behavioral rules and laws for any AI agent or developer |
| [`docs/architecture.md`](./docs/architecture.md) | System structure, network topology, folder layout, data flow |
| [`docs/network-server.md`](./docs/network-server.md) | Embedded HTTP/WebSocket server, API endpoints, deployment |
| [`docs/data-models.md`](./docs/data-models.md) | TypeScript types, DB schema, WebSocket message contracts |
| [`docs/scoring-logic.md`](./docs/scoring-logic.md) | Scoring formulas, segment weights, championship rule |
| [`docs/design-system.md`](./docs/design-system.md) | Colors, typography, components, Tailwind config |
| [`docs/pageant-rules.md`](./docs/pageant-rules.md) | Official IDSC pageant mechanics (ground truth for all rules) |

---

## Developer Setup

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Rust](https://rustup.rs/) (stable toolchain)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)

```bash
# Install dependencies
npm install

# Run in development mode (Tauri desktop window + hot reload)
npm run tauri dev

# Run frontend only in browser (useful for UI development)
npm run dev

# Type check
npx tsc --noEmit
```

### Building for Windows (Production)

This project is developed on macOS but targets **Windows** for the event. Cross-compilation is handled automatically via **GitHub Actions**:

1. Push code to `main` branch
2. GitHub Actions builds the Windows installer (`.msi` / `.exe`)
3. Download the artifact from the GitHub Actions run
4. Copy to USB → Install on admin's Windows laptop

See [`docs/network-server.md`](./docs/network-server.md) for the full deployment guide and day-of setup checklist.

---

## Key Rules (Do Not Violate)

- All scoring formulas are defined in [`docs/scoring-logic.md`](./docs/scoring-logic.md) — never deviate
- All score data is stored in **SQLite** on the admin's machine — never in localStorage as primary storage
- **No cloud deployment** — this app runs entirely on the local venue network
- All computation (averages, rankings, final scores) happens **server-side in Rust** — not in the browser

---

*Project Version: 0.1.0 · Last Updated: August 21, 2026*
