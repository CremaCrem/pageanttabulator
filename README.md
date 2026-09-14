# PageantTabulator

**Official Tabulation System — Mr. and Ms. IDSC 2026**  
IDSC 18th Founding Anniversary Celebration · Held September 10, 2026 · Ligao City Gymnasium

---

## What Is This?

PageantTabulator is a purpose-built, offline-capable desktop application for running the live tabulation of the Mr. and Ms. IDSC 2026 pageant. The admin's laptop acts as the hub — running a local HTTP and WebSocket server — while judges connect from their own machines using any browser. No cloud, no accounts, no installation required for judges.

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

> **AI agents:** Read [`AGENTS.md`](./AGENTS.md) first — it is your behavioral contract for every session.

| Document | Purpose |
|----------|---------|
| [`AGENTS.md`](./AGENTS.md) | **Agent contract** — standing rules, commands, conventions, anti-patterns (read every session) |
| [`docs/scoped/architecture.md`](./docs/scoped/architecture.md) | System structure, network topology, folder layout, data flow |
| [`docs/scoped/network-server.md`](./docs/scoped/network-server.md) | Embedded HTTP/WebSocket server, API endpoints, deployment |
| [`docs/scoped/data-models.md`](./docs/scoped/data-models.md) | TypeScript types, DB schema, WebSocket message contracts |
| [`docs/scoped/scoring-logic.md`](./docs/scoped/scoring-logic.md) | Scoring formulas, segment weights, championship rule |
| [`docs/scoped/design-system.md`](./docs/scoped/design-system.md) | Colors, typography, components, Tailwind config |
| [`docs/reference/pageant-rules.md`](./docs/reference/pageant-rules.md) | Official IDSC pageant mechanics (ground truth for all rules) |

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

# Rust type check
cargo check --manifest-path src-tauri/Cargo.toml
```

### Building for Windows (Production)

This project is developed on macOS but targets **Windows** for the event. Cross-compilation is handled automatically via **GitHub Actions**:

1. Push code to `main` branch
2. GitHub Actions builds the Windows installer (`.msi` / `.exe`)
3. Download the artifact from the GitHub Actions run
4. Copy to USB → Install on admin's Windows laptop

See [`docs/scoped/network-server.md`](./docs/scoped/network-server.md) for the full deployment guide and day-of setup checklist.

---

## Key Rules (Do Not Violate)

- All scoring formulas are defined in [`docs/scoped/scoring-logic.md`](./docs/scoped/scoring-logic.md) — never deviate
- All score data is stored in **SQLite** on the admin's machine — never in localStorage as primary storage
- **No cloud deployment** — this app runs entirely on the local venue network
- All computation (Borda count rankings, tie-breakers, minor award averages) happens **server-side in Rust** — not in the browser

---

*Project Version: 0.1.0 · Last Updated: August 31, 2026*
