# Data Models — PageantTabulator

> **This document defines all TypeScript types and interfaces (frontend) and the SQLite database schema (backend).**  
> All types must be imported from `src/types/` — never redeclare inline.  
> The SQLite schema is the authoritative data contract — TypeScript types mirror it.

---

## 0. Data Mapping & Casing Architecture

To guarantee type safety and prevent JSON deserialization mismatches across the full stack:

| Layer | Language / Storage | Casing Convention | Example |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | TypeScript / React | `camelCase` | `judgeId`, `candidateNumber`, `isEligible` |
| **Wire Protocol** | JSON (REST & WS) | `camelCase` | `{"judgeId": "J1", "isEligible": true}` |
| **Backend Memory** | Rust Structs | `snake_case` + Serde mapping | `pub judge_id: String` with `#[serde(rename_all = "camelCase")]` |
| **Database** | SQLite Table Columns | `snake_case` | `judge_id TEXT`, `candidate_number TEXT` |

> 📌 **Serde Mapping Contract:** All Rust data structures exposed to HTTP/WS must include `#[serde(rename_all = "camelCase")]` so Serde seamlessly translates between TypeScript's `camelCase` and Rust's `snake_case` without manual mapping code.

---

## 1. Enums

```typescript
// src/types/enums.ts

export enum Gender {
  Male   = 'male',
  Female = 'female',
}

export enum UserRole {
  Admin  = 'admin',   // Tauri desktop app — full control
  Judge  = 'judge',   // Browser — scoring only
  Viewer = 'viewer',  // Browser — read-only projection
}

export enum SegmentId {
  ProductionNumber   = 'production_number',
  SchoolUniform      = 'school_uniform',
  ProfessionalAttire = 'professional_attire',
  ModernBarong       = 'modern_barong',
  PreliminaryQA      = 'preliminary_qa',
  FinalQA            = 'final_qa',
  TieBreakingQA      = 'tie_breaking_qa',
  BestInAdvocacy     = 'best_in_advocacy',
  BestInRamp         = 'best_in_ramp',
}

export enum RoundStatus {
  NotStarted = 'not_started',
  Open       = 'open',       // Admin has opened this segment for scoring
  Locked     = 'locked',     // Admin locked — scores frozen
}

export enum SpecialAwardId {
  BestProductionNumber  = 'best_production_number',
  BestSchoolUniform     = 'best_school_uniform',
  BestProfessional      = 'best_professional',
  BestBarongFilipiniana = 'best_barong_filipiniana',
  BestAdvocacy          = 'best_advocacy',
  SpiritAward           = 'spirit_award',
  Photogenic            = 'photogenic',
  PeoplesChoice         = 'peoples_choice',
  Congeniality          = 'congeniality',
  BestInRamp            = 'best_in_ramp',
}
```

---

## 2. Domain Types

### Event Configuration
```typescript
// src/types/event.ts

export interface IEventConfig {
  id:          string;    // UUID identifying the event
  name:        string;    // "Mr. and Ms. IDSC 2026"
  subtitle:    string;    // "IDSC 18th Founding Anniversary Celebration"
  eventDate:   string;    // ISO date: "2026-09-10"
  venue:       string;    // "Ligao City Gymnasium"
  judgeCount:  number;    // How many judge slots are active today (1–10)
  createdAt:   string;    // ISO timestamp
}
```

### Candidate
```typescript
// src/types/candidate.ts

export interface ICandidate {
  eventId:              string;   // Links to IEventConfig.id
  id:                   string;   // "M01", "F01", etc.
  candidateNumber:      string;   // Same as id — official draw-lots number
  fullName:             string;
  nickname?:            string;
  gender:               Gender;
  department:           string;
  photoPath?:           string;   // Local file path (Tauri) or served URL
  isEligible:           boolean;
  isInTiebreak:         boolean;  // Auto-set by server when finalist has a tied final_score
  disqualificationNote?: string;
  createdAt:            string;
}
```

### Judge
```typescript
// src/types/judge.ts

export interface IJudge {
  id:           string;   // "J1" through "J10"
  name?:        string;   // Optional real name (admin can fill this in)
  photoPath?:   string;   // Optional photo URL (served by local backend)
  password?:    string;   // Plain text password for slot claim (intentional for LAN environment)
  isActive:     boolean;  // True when a browser has claimed this slot
  sessionToken?: string;  // Unique token used for localStorage auto-reconnect
  lastSeen?:    string;   // ISO timestamp of last WebSocket ping
}
```

> 📌 **Security Note:** Passwords for judges are deliberately stored as plain text. This is a closed, offline LAN system for volunteers, and adding crypto dependencies is an anti-goal. Do not add hashing.

### Segment & Criteria (Static — not from DB)
```typescript
// src/types/segment.ts

export interface ICriterion {
  id:     string;   // e.g., "stage_presence"
  label:  string;   // e.g., "Stage Presence & Confidence"
  weight: number;   // 0.0–1.0 (e.g., 0.40 for 40%)
}

export interface ISegment {
  id:                 SegmentId;
  label:              string;
  segmentCategory:    'preliminary' | 'final' | 'special_award' | 'tiebreak';
  roundStatus:        RoundStatus;  // Current status from server
  preliminaryWeight:  number;       // Weight in preliminary score (e.g., 0.20)
  criteria:           ICriterion[];
}
```

### Score
```typescript
// src/types/score.ts

export interface ICriterionEntry {
  criterionId: string;
  score:       number;   // 1–100 integer
}

export interface ISegmentScore {
  id:             string;            // UUID (server-assigned)
  eventId:        string;
  judgeId:        string;
  candidateId:    string;
  segmentId:      SegmentId;
  criteriaEntries: ICriterionEntry[];
  computedScore:  number;            // Server-computed weighted total
  submittedAt:    string;            // ISO timestamp
}
```

### Results
```typescript
// src/types/results.ts

export interface ISegmentRanking {
  segmentId:    SegmentId;
  rankSum:      number;   // Borda count sum of ranks across judges
  rawScoreSum:  number;   // Used for tie-breaking
  placement:    number;   // Final placement in this segment (1, 2, 3...)
}

export interface ICandidateResult {
  candidateId:       string;
  segmentId?:        string;
  preliminaryScore?: number;
  preliminaryRank?:  number;
  preliminaryStatus: 'advancing' | 'excluded' | 'pending_override' | 'pending';
  finalQaScore?:     number;
  finalScore?:       number;
  rank?:             number;
  computedAt:        string;
}
```

### Special Award
```typescript
// src/types/awards.ts

export interface ISpecialAward {
  awardId:          SpecialAwardId;
  label:            string;
  winnerMaleId?:    string;    // Candidate ID
  winnerFemaleId?:  string;    // Candidate ID
  isAutoComputed:   boolean;   // True if derived from segment scores
  notes?:           string;
}
```

### Session (Client-Side Only)
```typescript
// src/types/session.ts

export interface ISession {
  role:         UserRole;
  judgeId?:     string;   // Set only when role === UserRole.Judge
  sessionToken?: string;  // Unique token used for localStorage auto-reconnect
  startedAt:    string;
}
```

### Round State
```typescript
// src/types/round.ts

export interface IRoundState {
  eventId:    string;
  segmentId:  SegmentId;
  status:     RoundStatus;
  openedAt?:  string;
  lockedAt?:  string;
}
```

---

## 3. WebSocket Message Contracts

```typescript
// src/types/ws.ts

// Direction: Client → Server
export type WSClientMessage =
  | { type: 'IDENTIFY'; role: UserRole; judgeId?: string }
  | { type: 'PING' };

// Direction: Server → Client (broadcasts)
export type WSServerMessage =
  | { type: 'SEGMENT_OPENED';      segmentId: SegmentId; segmentLabel: string }
  | { type: 'SEGMENT_LOCKED';      segmentId: SegmentId }
  | { type: 'SCORE_SUBMITTED';     judgeId: string; candidateId: string; segmentId: SegmentId }
  | { type: 'JUDGE_CONNECTED';     judgeId: string }
  | { type: 'JUDGE_DISCONNECTED';  judgeId: string }
  | { type: 'SESSION_REVOKED';     judgeId: string }
  | { type: 'RANKINGS_UPDATED';    category: Gender; topCandidates: ICandidateResult[] }
  | { type: 'TOP3_ANNOUNCED';      male: ICandidateResult[]; female: ICandidateResult[] }
  | { type: 'TIE_BREAK_REQUIRED';  segmentId: SegmentId }
  | { type: 'FINAL_RESULTS_READY'; winners: ICandidateResult[] }
  | { type: 'SYSTEM_MESSAGE';      level: 'info' | 'warning'; message: string };
```

---

## 4. API Request / Response Shapes

These are the JSON shapes exchanged between the React frontend and the axum REST API.

```typescript
// src/types/api.ts

// Generic API error response
export interface IApiError {
  error:   string;   // Human-readable message
  code?:   string;   // Optional machine-readable code (e.g., "SCORE_ALREADY_SUBMITTED")
}

// POST /api/scores — request body
export interface ISubmitScoreRequest {
  judgeId:         string;
  candidateId:     string;
  segmentId:       SegmentId;
  criteriaEntries: ICriterionEntry[];
}

// POST /api/scores — response
export interface ISubmitScoreResponse {
  scoreId:       string;
  computedScore: number;   // Authoritative server-computed value
  submittedAt:   string;
}

// POST /api/judges/session — request body
export interface IClaimJudgeSessionRequest {
  judgeId: string;
  password?: string; // Checked against the DB plain text password if set
  deviceToken?: string; // If provided, attempts to re-claim an existing active session
}

// PATCH /api/judges/:id — request body
export interface IUpdateJudgeProfileRequest {
  name?: string;
  password?: string;
  photoPath?: string;
}

// POST /api/judges/session — response
export interface IClaimJudgeSessionResponse {
  status: string;
  sessionToken: string; // Used for auto-reconnect via localStorage
}

// POST /api/judges/session/verify — request body
export interface IVerifySessionRequest {
  judgeId: string;
  sessionToken: string;
}

// POST /api/judges/session/verify — response
export interface IVerifySessionResponse {
  valid: boolean;
}

// POST /api/rounds/open — request body
export interface IOpenRoundRequest {
  segmentId: SegmentId;
}

// POST /api/rounds/lock — request body (PIN required in X-Admin-PIN header)
export interface ILockRoundRequest {
  segmentId: SegmentId;
}

// POST /api/admin/resolve-tie — request body
export interface ICandidateResolution {
  candidateId: string;
  resolution:  string; // 'advancing' | 'excluded'
}

export interface IResolveTieRequest {
  pin:         string;
  stage:       string;
  resolutions: ICandidateResolution[];
}

// POST /api/results/compute — request body (PIN required)
export interface IComputeResultsRequest {
  round: 'preliminary' | 'final' | 'minor_awards';
}

// POST /api/admin/verify-pin — request body
export interface IVerifyPinRequest {
  pin: string;
}
export interface IVerifyPinResponse {
  valid: boolean;
}
```

---

## 5. React Context Shape (UI State Only)

The React Context holds **ephemeral UI state only** — not authoritative data.

```typescript
// src/context/AppContext.tsx

export interface UIState {
  session:         ISession | null;        // Who is currently using this instance
  eventConfig:     IEventConfig | null;    // Cached from GET /api/event
  isServerReady:   boolean;               // Has the embedded server responded?
  activeSegmentId: SegmentId | null;       // Which segment is currently open
  roundStates:     IRoundState[];          // Cached from GET /api/rounds
}

export type UIAction =
  | { type: 'SET_SESSION';         payload: ISession }
  | { type: 'CLEAR_SESSION' }
  | { type: 'SET_EVENT_CONFIG';    payload: IEventConfig }
  | { type: 'SET_SERVER_READY';    payload: boolean }
  | { type: 'SET_ROUND_STATES';    payload: IRoundState[] }
  | { type: 'APPLY_WS_EVENT';      payload: WSServerMessage };
```

---

## 6. Segment Constants (Hardcoded — Not from DB)

Segment definitions are **not stored in the database** — they are hardcoded constants derived directly from the official pageant guidelines. They never change at runtime.

```typescript
// src/utils/constants.ts

export const SEGMENT_DEFINITIONS = [
  {
    id: SegmentId.ProductionNumber,
    label: 'Production Number',
    preliminaryWeight: 0.25,
    criteria: [
      { id: 'stage_presence',    label: 'Stage Presence & Confidence',  weight: 0.40 },
      { id: 'energy',            label: 'Energy & Performance Impact',  weight: 0.30 },
      { id: 'audience_engagement', label: 'Audience Engagement',        weight: 0.20 },
      { id: 'overall_appeal',    label: 'Overall Appeal',               weight: 0.10 },
    ],
  },
  {
    id: SegmentId.SchoolUniform,
    label: 'School Uniform',
    preliminaryWeight: 0.25,
    criteria: [
      { id: 'neatness',          label: 'Neatness & Proper Wearing of Uniform',    weight: 0.25 },
      { id: 'confidence_bearing',label: 'Confidence, Bearing & Poise',             weight: 0.25 },
      { id: 'advocacy',          label: 'Advocacy Statement / Message Impact',     weight: 0.25 },
      { id: 'overall_impact',    label: 'Overall Impact',                           weight: 0.25 },
    ],
  },
  {
    id: SegmentId.ProfessionalAttire,
    label: 'Professional Attire',
    preliminaryWeight: 0.25,
    criteria: [
      { id: 'elegance_professionalism', label: 'Elegance & Professionalism', weight: 0.35 },
      { id: 'suitability',              label: 'Suitability of Attire',      weight: 0.25 },
      { id: 'confidence_stage',         label: 'Confidence & Stage Presence',weight: 0.20 },
      { id: 'overall_impact',           label: 'Overall Impact',             weight: 0.20 },
    ],
  },
  {
    id: SegmentId.ModernBarong,
    label: 'Modern Barong / Filipiniana (Green)',
    preliminaryWeight: 0.25,
    criteria: [
      { id: 'elegance_poise',       label: 'Elegance & Poise',                    weight: 0.35 },
      { id: 'suitability_creativity', label: 'Suitability & Creativity of Attire', weight: 0.25 },
      { id: 'confidence_stage',     label: 'Confidence & Stage Presence',         weight: 0.20 },
      { id: 'overall_impact',       label: 'Overall Impact',                       weight: 0.20 },
    ],
  },
  {
    id: SegmentId.PreliminaryQA,
    label: 'Preliminary Q&A',
    preliminaryWeight: 0,   // Weight TBD — included in prelim but weight to be confirmed with organizer
    criteria: [
      { id: 'content_substance',    label: 'Content & Substance of Answer',   weight: 0.40 },
      { id: 'clarity_organization', label: 'Clarity & Organization of Ideas', weight: 0.25 },
      { id: 'confidence_delivery',  label: 'Confidence & Delivery',           weight: 0.20 },
      { id: 'relevance',            label: 'Relevance to the Question',       weight: 0.15 },
    ],
  },
  {
    id: SegmentId.FinalQA,
    label: 'Final Q&A',
    preliminaryWeight: 0,
    criteria: [
      { id: 'content_substance',    label: 'Content & Substance of Answer',   weight: 0.40 },
      { id: 'clarity_organization', label: 'Clarity & Organization of Ideas', weight: 0.25 },
      { id: 'confidence_delivery',  label: 'Confidence & Delivery',           weight: 0.20 },
      { id: 'relevance',            label: 'Relevance to the Question',       weight: 0.15 },
    ],
  },
];

export const TOP_N_PRELIMINARY     = 3;     // Top 3 per category advance to finals
export const FINAL_PRELIM_WEIGHT   = 0.50;  // 50% of final score
export const FINAL_QA_WEIGHT       = 0.50;  // 50% of final score
export const MIN_SCORE             = 1;
export const MAX_SCORE             = 100;
export const MAX_JUDGES            = 10;
export const SERVER_PORT           = 3000;
export const WS_RECONNECT_DELAY_MS = 3000;  // How long before attempting WS reconnect
```

---

*Data Models Version: 2.0 — August 21, 2026 (Added: WebSocket types, API request/response types, UI context shape, server-side authority clarified)*
