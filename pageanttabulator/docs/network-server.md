# Network & Server — PageantTabulator

> Covers the embedded HTTP/WebSocket server, REST API contract, WebSocket event protocol, network setup, and deployment pipeline.

---

## 1. The Embedded Server

The admin's Tauri application spawns an **axum HTTP server** inside the same Rust process when the app starts. This server:

- Listens on `0.0.0.0:3000` (all network interfaces) — necessary for judge machines to reach it over WiFi
- Serves the React frontend build (static files) to any connecting browser
- Handles all REST API calls (score submission, candidate queries, round management)
- Manages WebSocket connections for real-time event broadcasting

The server runs as a Tokio async task spawned at startup. It shuts down when the Tauri window closes. There is no separate server process — it is part of the Tauri binary.

```
Tauri process (admin laptop)
├── Main thread       → Tauri window + admin UI
└── Tokio runtime     → axum server (HTTP + WebSocket)
    ├── Static files  → serves React build to browsers
    ├── /api/*        → REST routes
    └── /ws           → WebSocket upgrade
```

---

## 2. REST API Endpoints

All endpoints are prefixed with `/api`. Requests and responses use JSON.

### Event Configuration

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/event` | Get current event configuration |
| `POST` | `/api/event` | Create or update event config (admin only) |

### Candidates

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/candidates` | Get all candidates |
| `POST` | `/api/candidates` | Add a new candidate |
| `PATCH` | `/api/candidates/:id` | Update candidate details |
| `PATCH` | `/api/candidates/:id/disqualify` | Disqualify a candidate (admin only) |

### Judges & Sessions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/judges` | Get all configured judge slots |
| `POST` | `/api/judges/session` | Judge claims a slot (sets judgeId in session) |
| `DELETE` | `/api/judges/session/:judgeId` | Admin forcibly resets a judge session |
| `GET` | `/api/judges/status` | Get submission progress per judge per segment |

### Scores

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/scores` | Submit a judge's score for one candidate/segment |
| `GET` | `/api/scores/summary` | Get aggregate averages per candidate per segment |
| `GET` | `/api/scores/judge/:judgeId` | Get all scores submitted by a specific judge |

### Rounds

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/rounds` | Get status of all rounds/segments |
| `POST` | `/api/rounds/open` | Admin opens a segment for scoring |
| `POST` | `/api/rounds/lock` | Admin locks a segment (requires PIN header) |

### Results

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/results/preliminary` | Get current preliminary rankings (live) |
| `GET` | `/api/results/top5` | Get Top 5 per category (after prelim lock) |
| `GET` | `/api/results/final` | Get final results after 50/50 computation |
| `POST` | `/api/results/compute` | Trigger final score computation (admin only) |
| `GET` | `/api/awards` | Get all special award assignments |
| `POST` | `/api/awards` | Set a special award winner (admin only) |

### Admin Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/verify-pin` | Verify admin PIN for sensitive actions |

---

## 3. WebSocket Event Protocol

The WebSocket server runs at `/ws`. All clients (admin, judges, projector) connect to this endpoint on load and maintain a persistent connection.

### Connection

```
ws://[admin-ip]:3000/ws
```

On connection, the client sends an identification message:

```json
{ "type": "IDENTIFY", "role": "judge", "judgeId": "J2" }
{ "type": "IDENTIFY", "role": "admin" }
{ "type": "IDENTIFY", "role": "viewer" }
```

### Server → Client Events (Broadcasts)

The server broadcasts these events to ALL connected clients unless noted:

| Event Type | Payload | Description |
|-----------|---------|-------------|
| `SEGMENT_OPENED` | `{ segmentId, segmentLabel }` | Admin opened a segment for scoring |
| `SEGMENT_LOCKED` | `{ segmentId }` | Admin locked a segment — scores frozen |
| `SCORE_SUBMITTED` | `{ judgeId, candidateId, segmentId }` | A judge submitted a score (for progress tracking) |
| `JUDGE_CONNECTED` | `{ judgeId }` | A judge browser connected |
| `JUDGE_DISCONNECTED` | `{ judgeId }` | A judge browser disconnected |
| `RANKINGS_UPDATED` | `{ category, topCandidates[] }` | Rankings changed — sent after each score lock |
| `TOP5_ANNOUNCED` | `{ maleCandidates[], femaleCandidates[] }` | Prelim locked, Top 5 announced |
| `FINAL_RESULTS_READY` | `{ winners }` | Final scores computed, winners determined |
| `SYSTEM_MESSAGE` | `{ level, message }` | Admin broadcast message to all judge screens |

### Client → Server Events

| Event Type | Payload | Description |
|-----------|---------|-------------|
| `PING` | `{}` | Keepalive (every 30s) |
| `IDENTIFY` | `{ role, judgeId? }` | Identity declaration on connect |

Score submission is **not** done via WebSocket — it uses `POST /api/scores`. The WebSocket only carries lightweight event notifications.

---

## 4. Admin PIN Security

The admin PIN is a simple 4–6 digit number set during event setup. It is stored as a bcrypt hash in SQLite (overkill but correct practice).

The PIN is required for:
- Locking a segment (`POST /api/rounds/lock`)
- Computing final results (`POST /api/results/compute`)
- Forcibly resetting a judge session
- Disqualifying a candidate
- Overriding a submitted score

PIN verification is done by including an `X-Admin-PIN` header on the relevant API requests. The server rejects these requests with `403 Forbidden` if the PIN is absent or incorrect.

This is **not** a login system. The PIN is just a guard against accidental irreversible actions during a stressful live event.

---

## 5. Judge Session Management

Judge identity is **session-based** — it lives in the browser's `sessionStorage`, not in a server-side login session.

### Claiming a Judge Slot

1. Judge opens the browser and navigates to `http://[admin-ip]:3000`
2. The judge selection screen is shown (dynamically generated from configured judge count)
3. Judge clicks their number (e.g., "Judge 3")
4. Client calls `POST /api/judges/session` with `{ judgeId: "J3" }`
5. Server records J3 as active and timestamps the connection
6. `judgeId` is saved to `sessionStorage` on the judge's browser
7. On every subsequent API call, the judge browser includes `X-Judge-ID: J3` header

### Already-Claimed Slots

- If J3 is already active on another machine, the button shows a subtle "active" indicator
- The server does **not** block a second claim — an accidental double-claim is handled by admin resetting the duplicate session from the dashboard
- This is intentional: don't create friction in a live event over a minor edge case

### Session Expiry

- Sessions expire when the WebSocket connection drops and does not reconnect within 60 seconds
- Admin can manually reset any judge session via the dashboard
- On browser refresh, the `judgeId` is read from `sessionStorage` and re-sent to the server automatically

---

## 6. Network Setup — Day of Event

### Standard Setup (Venue WiFi)

1. Admin laptop connects to venue WiFi
2. Admin opens PageantTabulator → server starts on port 3000
3. Admin finds their local IP (displayed prominently in the app header)
4. Admin shares the URL with judges: e.g., `http://192.168.1.50:3000`
5. Judges type the URL into their browser — done

### Fallback Setup (Admin Laptop Hotspot)

If venue WiFi is unavailable or unstable:

1. Admin laptop creates a Windows mobile hotspot (built-in, no extra software)
2. Judge laptops connect to the hotspot's WiFi network
3. Admin laptop IP on the hotspot network is typically `192.168.137.1`
4. URL shared with judges: `http://192.168.137.1:3000`
5. Same flow as above

### What If the Network Drops Mid-Event?

- **Judge browser:** Score inputs are preserved in React local state while the judge is typing. If a submit fails due to network error, a "Retrying..." indicator appears and the form retries automatically every 5 seconds.
- **Admin dashboard:** Shows a "last seen" timestamp per judge — admin immediately knows if a judge drops off.
- **Data safety:** All submitted scores are already in SQLite. Nothing is lost if a judge disconnects. They reconnect, re-identify, and continue from where they left off.
- **Worst case:** Admin can manually enter a missing judge's score through the admin override panel.

---

## 7. Database Schema

The SQLite database file is stored at the Tauri app data directory (e.g., `%APPDATA%\pageanttabulator\data.db` on Windows).

```sql
-- Event configuration (one row)
CREATE TABLE event_config (
  id          INTEGER PRIMARY KEY DEFAULT 1,
  name        TEXT NOT NULL,
  subtitle    TEXT,
  event_date  TEXT,
  venue       TEXT,
  judge_count INTEGER NOT NULL DEFAULT 5,
  admin_pin   TEXT NOT NULL,  -- bcrypt hash
  created_at  TEXT NOT NULL
);

-- Candidates
CREATE TABLE candidates (
  id                    TEXT PRIMARY KEY,  -- e.g., "M01", "F01"
  candidate_number      TEXT NOT NULL UNIQUE,
  full_name             TEXT NOT NULL,
  nickname              TEXT,
  gender                TEXT NOT NULL CHECK(gender IN ('male', 'female')),
  department            TEXT NOT NULL,
  photo_path            TEXT,
  is_eligible           INTEGER NOT NULL DEFAULT 1,
  disqualification_note TEXT,
  created_at            TEXT NOT NULL
);

-- Judge slots
CREATE TABLE judges (
  id          TEXT PRIMARY KEY,  -- "J1", "J2", etc.
  name        TEXT,              -- optional real name
  is_active   INTEGER NOT NULL DEFAULT 0,
  last_seen   TEXT
);

-- Segment/round state
CREATE TABLE rounds (
  segment_id  TEXT PRIMARY KEY,  -- matches SegmentId enum
  status      TEXT NOT NULL DEFAULT 'not_started',
                                 -- 'not_started' | 'open' | 'locked'
  opened_at   TEXT,
  locked_at   TEXT
);

-- Scores (one row per judge × candidate × segment)
CREATE TABLE scores (
  id              TEXT PRIMARY KEY,  -- UUID
  judge_id        TEXT NOT NULL,
  candidate_id    TEXT NOT NULL,
  segment_id      TEXT NOT NULL,
  criteria_json   TEXT NOT NULL,     -- JSON array of { criterionId, score }
  computed_score  REAL NOT NULL,     -- server-computed weighted total
  submitted_at    TEXT NOT NULL,
  UNIQUE(judge_id, candidate_id, segment_id)
);

-- Computed results (populated after round locks)
CREATE TABLE results (
  candidate_id        TEXT NOT NULL,
  segment_id          TEXT,          -- NULL for overall preliminary score
  preliminary_score   REAL,
  final_qa_score      REAL,
  final_score         REAL,
  rank                INTEGER,
  is_top5             INTEGER NOT NULL DEFAULT 0,
  computed_at         TEXT NOT NULL,
  PRIMARY KEY (candidate_id, segment_id)
);

-- Special awards
CREATE TABLE special_awards (
  award_id          TEXT PRIMARY KEY,
  winner_male_id    TEXT,
  winner_female_id  TEXT,
  is_auto_computed  INTEGER NOT NULL DEFAULT 0,
  notes             TEXT,
  assigned_at       TEXT
);
```

---

## 8. Deployment Guide

### Prerequisites (Developer Machine — macOS)

1. Node.js >= 20
2. Rust stable toolchain (`rustup install stable`)
3. GitHub repository with Actions enabled

### GitHub Actions Workflow

The `.github/workflows/build.yml` file (to be created in Phase 1) uses Tauri's official CI action:

```
On push to main:
  1. Checkout code
  2. Install Node.js 20
  3. Install Rust stable
  4. npm install
  5. tauri build --target x86_64-pc-windows-msvc
  6. Upload .msi and .exe as GitHub release artifacts
```

> Tauri's official `tauri-apps/tauri-action` GitHub Action handles all of this with minimal configuration.

### Getting the Windows Installer

1. Push your latest code to the `main` branch on GitHub
2. Go to the GitHub repository → Actions tab → latest workflow run
3. Download the artifact named `PageantTabulator_x64-setup.exe` or `PageantTabulator_x64_en-US.msi`

### Installing on the Admin Laptop

1. Copy the installer to the admin's Windows laptop (USB drive recommended)
2. Run the installer — standard Windows installer flow
3. The app icon appears on the desktop
4. Open the app to verify it launches correctly before the event day

### Pre-Event Day Checklist

- [ ] App installed and launches on admin laptop
- [ ] Event config saved (event name, date, venue, judge count, admin PIN)
- [ ] All candidates registered (names, numbers, departments)
- [ ] Judge slots configured (how many judges are active today)
- [ ] WiFi credentials confirmed with venue/client
- [ ] Test: connect one judge laptop to WiFi and open the judge URL
- [ ] Test: verify score submission flow end-to-end with test data
- [ ] Backup: SQLite `.db` file copied to USB drive as insurance
- [ ] Projector URL confirmed and displayed correctly on TV

---

*Network & Server Version: 1.0 — August 21, 2026*
