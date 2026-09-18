# Testing Strategy — PageantTabulator (SSOT)

> **This is the Single Source of Truth for all test-related work.**
> AI agents and human contributors must treat the fixture tables in this document as
> locked constants. If a test fails against a fixture below, the bug is in the
> implementation — not the fixture — unless a human explicitly edits this document
> first, in a separate, clearly-labeled commit.
>
> Reference: `docs/scoped/scoring-logic.md` (the formulas), `AGENTS.md` (agent contract)

---

## 1. Golden Rule for Agents

- **Never modify a value in a fixture table below to make a test pass.**
- **Never write both the test's input and its expected output in the same step.** Expected
  outputs come from this document, written by a human, before any test code exists.
- If a fixture appears wrong, stop and flag it for human review instead of "fixing" it.
- Do not touch application logic while a task is scoped as "add tests only," unless
  explicitly instructed to fix a bug the tests revealed.

## 2. Branching & Merge Rules

- All test work happens on a branch named `test/<phase-name>` (e.g. `test/scoring-suite`).
- Never commit test work directly to `main`.
- A branch may only be merged into `main` when:
  1. `cargo test` passes locally and in CI (GitHub Actions).
  2. A human has compared every new assertion against this document's fixture tables.
  3. The diff contains no unrelated changes to production logic.
- `main` branch protection requires the CI test job to pass before merge.

## 3. Phase Plan & Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Rust unit tests — scoring math (`compute.rs`, `ranking.rs`) | ☑ Complete |
| 2 | Rust integration tests — API layer (simulated judge submissions) | ☑ Complete |
| 3 | Playwright UI smoke tests — event/candidate/judge setup flow | ☑ Complete |

Update the checkboxes as phases complete. Do not start Phase 2 work until Phase 1 is
merged to `main` and green in CI.

---

## 4. Phase 1 — Golden Fixtures (Scoring Engine)

Each fixture below must be hand-verified against `scoring-logic.md` by a human before
any test is written against it. Fill in the `Verified by / date` column when done.

### 4.1 Raw Score (Criterion Weighting)

**Rule:** `RawScore = Σ (CriterionScore × CriterionWeight)`

| Fixture | Input | Expected Output | Verified by / date |
|---|---|---|---|
| RS-1 | scores=[90,80,70,100], weights=[0.30,0.25,0.25,0.20] | 84.5 | Jeremy Zion Jamer 2026-09-17 |
| RS-2 | scores=[100,100,100,100], weights=[0.30,0.25,0.25,0.20] | 100.0 | Jeremy Zion Jamer 2026-09-17 |
| RS-3 | scores=[1,1,1,1], weights=[0.30,0.25,0.25,0.20] | 1.0 (minimum valid score boundary) | Jeremy Zion Jamer 2026-09-17 |

### 4.2 Rank Conversion (Per Judge)

**Rule:** Highest raw score in a segment = Rank 1, descending from there.

| Fixture | Input (judge's raw scores per candidate) | Expected Ranks | Verified by / date |
|---|---|---|---|
| RC-1 | A=88.0, B=95.0, C=72.0 | B=1, A=2, C=3 | Jeremy Zion Jamer 2026-09-17 |

### 4.3 Rank Sum / Borda Count (Segment Winner)

**Rule:** `RankSum(candidate) = Σ Rank(judge_i, candidate)`; lowest RankSum wins the segment.

| Fixture | Input (per-judge ranks) | Expected RankSum | Expected Winner | Verified by / date |
|---|---|---|---|---|
| BC-1 | J1: A=1,B=2 · J2: A=2,B=1 · J3: A=2,B=1 | A=5, B=4 | B | Jeremy Zion Jamer 2026-09-17 |

### 4.4 Segment Tie-Breaker (Equal RankSum)

**Rule:** If RankSum ties, higher `Σ RawScore` across all judges wins.

| Fixture | Input | Expected Winner | Verified by / date |
|---|---|---|---|
| TB-1 | A: RankSum=6, RawSum=250.0 · B: RankSum=6, RawSum=265.0 | B | Jeremy Zion Jamer 2026-09-17 |

### 4.5 Preliminary Composite Score

**Rule:** 5 segments weighted 20% each, applied to each segment's *rank* (not raw score).

| Fixture | Input (candidate's 5 segment ranks) | Expected PreliminaryScore | Verified by / date |
|---|---|---|---|
| PC-1 | ranks=[1,2,1,3,2] | (1+2+1+3+2)×0.20 = 1.8 | Jeremy Zion Jamer 2026-09-17 |

### 4.6 Preliminary Boundary Tie (Top 3 Cutoff)

**Rule:** Exact-tie PreliminaryScores at the 3rd-place cutoff must **flag for manual
override**, not auto-resolve.

| Fixture | Input | Expected Behavior | Verified by / date |
|---|---|---|---|
| BT-1 | 3rd and 4th place both score PreliminaryScore=2.4 | System sets tie-flag; does NOT pick a winner automatically | Jeremy Zion Jamer 2026-09-17 |

### 4.7 Championship Score (Top 3 Finalists)

**Rule:** `ChampionshipScore = (PreliminaryScore × 0.50) + (FinalQARank × 0.50)`

| Fixture | Input | Expected ChampionshipScore | Verified by / date |
|---|---|---|---|
| CS-1 | PreliminaryScore=1.8, FinalQARank=1 | (1.8×0.5)+(1×0.5) = 1.4 | Jeremy Zion Jamer 2026-09-17 |

### 4.8 Finals Tie-Break

**Rule:** Equal ChampionshipScore → `isInTiebreak=true` on all tied finalists; only tied
candidates are re-ranked via the Tie-Breaking Q&A.

| Fixture | Input | Expected Behavior | Verified by / date |
|---|---|---|---|
| FT-1 | Two finalists both score ChampionshipScore=1.4 | Both flagged `isInTiebreak=true`; third (non-tied) finalist untouched | Jeremy Zion Jamer 2026-09-17 |

### 4.9 Minor Award (Simple Average — NOT Borda)

**Rule:** `MinorAwardScore = Σ RawScore(judge_i) / Number of Judges`

| Fixture | Input | Expected Output | Verified by / date |
|---|---|---|---|
| MA-1 | raw scores = [88.0, 92.0, 79.5] | (88.0+92.0+79.5)/3 = 86.5 | Jeremy Zion Jamer 2026-09-17 |

> ⚠️ Confirm the implementation does **not** apply any rank-based logic here — this is
> the one engine in the app that must stay isolated from Borda Count.

---

## 5. Phase 2 — Integration Test Plan (API Layer)

Goal: simulate judge score submissions over HTTP/WebSocket without opening a browser.

| Scenario | What it proves |
|---|---|
| N fake judges submit scores for one segment via HTTP | Server computes the same RankSum as Phase 1's fixtures, end-to-end through the DB |
| A judge resubmits/edits a score before segment close | No duplicate rows; latest score wins |
| Manual Score Entry (PIN-protected) inserts a row | Row is indistinguishable from a judge-submitted row in downstream math (per `scoring-logic.md` §2) |

### 5.1 Test Harness Requirements

Integration tests live in `src-tauri/tests/` and drive the real axum router in-process
(no listening socket, no browser) via `tower::ServiceExt::oneshot`, so that requests pass
through real routing, real JSON deserialization (proving the `camelCase` DTO contract from
`AGENTS.md` §5.2), and the real SQLite layer.

Per-test isolation: each test builds its own `AppState` over a throwaway SQLite file via
the existing `db::schema::init_db_with_path`, so no test shares state with another.

Setup facts relevant to fixture design, confirmed against the implementation:

- `POST /api/scores` does **not** require the `judgeId` to exist as a judge row — the judge
  name lookup is optional. Fake judge ids (`j1`, `j2`, `j3`) are therefore valid inputs.
- `GET /api/results/breakdown` ranks candidates **within each gender separately**. Any two
  candidates intended to compete against each other in a fixture must share a gender.
- Candidates **must** exist in the `candidates` table, or the breakdown silently drops
  their scores.
- `POST /api/admin/manual-score-entry` requires an `event_config` row to exist, because it
  validates the submitted PIN against `event_config.admin_pin`.

### 5.2 Fixture Table

Implemented in `src-tauri/tests/api_integration.rs`.

Shared setup for API-1, API-3 and API-8 — segment `best_advocacy`, whose criterion weights
(`relevance_alignment` 0.30, `content_substance` 0.25, `clarity_organization` 0.25,
`delivery_impact` 0.20) are already locked by fixture RS-1.

Candidates: `A` and `B`, both `gender = male`, both eligible.

For API-1 and API-3 all four criteria receive the same score per candidate, so each judge's
RawScore equals that score:

| Judge | Candidate A (all 4 criteria) | Candidate B (all 4 criteria) |
|---|---|---|
| j1 | 90 | 80 |
| j2 | 80 | 90 |
| j3 | 70 | 85 |

#### API-1 — N judges submit one segment over HTTP

Six `POST /api/scores` calls, then `GET /api/results/breakdown`.

| Fixture | Input | Expected rankSum (A, B) | Expected finalRank (A, B) | Verified by / date |
|---|---|---|---|---|
| API-1 | the 6 submissions above | A=5, B=4 | A=2, B=1 (winner B) | _(inherited from BC-1)_ |

> Expected values are **inherited from Phase 1 fixture BC-1** (J1: A=1,B=2 · J2: A=2,B=1 ·
> J3: A=2,B=1 → A=5, B=4, winner B), not newly authored. The raw scores above reproduce
> BC-1's per-judge ranks.

#### API-2 — Judge resubmits a score for the same candidate + segment

Behavior decided by the document owner — see §5.3.

| Fixture | Input | Expected HTTP status | Expected `scores` row count | Expected stored score | Verified by / date |
|---|---|---|---|---|---|
| API-2 | j1 submits A = all 90, then j1 submits A = all 50 | 200 with an `error` body ("already submitted") | 1 | 90.0 — the **first** score survives | Jeremy Zion Jamer 2026-09-18 |

#### API-3 — Manual Score Entry mixes with judge submissions

Identical inputs to API-1, except judges `j2` and `j3` are entered through
`POST /api/admin/manual-score-entry` with a valid admin PIN, while `j1` uses
`POST /api/scores`. Proves `scoring-logic.md` §2's "strictly indistinguishable" claim.

| Fixture | Input | Expected rankSum (A, B) | Expected finalRank (A, B) | Verified by / date |
|---|---|---|---|---|
| API-3 | j1 via `/api/scores`; j2, j3 via manual entry | A=5, B=4 | A=2, B=1 (winner B) | _(must equal API-1)_ |

#### API-4 … API-7 — Manual Score Entry input validation

| Fixture | Input | Expected HTTP status | Expected error message | Verified by / date |
|---|---|---|---|---|
| API-4 | manual entry with a wrong admin PIN | 401 | `Invalid PIN` | Jeremy Zion Jamer 2026-09-18 |
| API-5 | manual entry with only 3 of the segment's 4 criteria | 400 | `All criteria are required for this segment` | Jeremy Zion Jamer 2026-09-18 |
| API-6 | manual entry with a criterion score of `0`, and separately `101` | 400 | `Scores must be between 1 and 100` | Jeremy Zion Jamer 2026-09-18 |
| API-7 | manual entry for a `segmentId` that does not exist | 400 | `Invalid segment` | Jeremy Zion Jamer 2026-09-18 |

Each of these also asserts that **no row is written** to `scores` when validation fails.

#### API-8 — Criterion weights are applied over HTTP

| Fixture | Input | Expected `computedScore` | Verified by / date |
|---|---|---|---|
| API-8 | `POST /api/scores` with RS-1's scores [90, 80, 70, 100] in criterion order | 84.5 | _(inherited from RS-1)_ |

> **Why this fixture exists.** API-1 and API-3 score every criterion identically, so RawScore
> scales uniformly and their rank sums are **blind to a mis-weighted criterion** — this was
> confirmed by mutation testing (changing `relevance_alignment` from 0.30 to 0.90 left
> API-1 passing). API-8 submits Phase 1 fixture RS-1's unequal scores over HTTP and asserts
> RS-1's locked output, which does fail under that mutation (138.5 ≠ 84.5).

### 5.3 Score Correction Policy — Resolved

The earlier draft of this section flagged that the Scenario 2 wording ("latest score wins")
contradicted the implementation. **Resolved by the document owner on 2026-09-18: the
implementation is correct.** The scenario table above is retained for history; the binding
rule is the one below.

**First score wins, and it is locked to the judge.** A judge cannot edit or overwrite their
own submission. Enforced in four places:

1. `server/score_routes.rs:33-39` — rejects the resubmission, keeps the original row.
2. `server/admin_routes.rs:753-762` — same rejection for Manual Score Entry.
3. `db/schema.rs:94` — `UNIQUE(judge_id, candidate_id, segment_id)`, and `db/scores.rs`
   exposes only `insert` plus readers.
4. `AGENTS.md` §3 — submitted scores are locked.

Locked by fixture **API-2**.

#### Approved correction workflow (Admin override)

There is deliberately **no judge-facing unlock**. Corrections follow this chain:

1. The judge notices the mistake and **requests a correction from the Admin** (tabulator).
   The judge takes no further action.
2. The Admin **consults the pageant coordinator and the auditor** and asks whether the
   correction is permitted.
3. If approved, the **Admin edits that judge's score directly in the admin client**, on the
   judge's behalf.
4. The correction is recorded in the system log.

> ⚠ **Implementation gap — step 3 does not exist yet.** Manual Score Entry
> (`server/admin_routes.rs:753-762`) *refuses* to write when a score already exists for
> that judge + candidate + segment, and `db/scores.rs` has no `update` and no `delete`. As
> of 2026-09-18 an Admin therefore has **no supported way to correct a submitted score** —
> the workflow above is policy, not yet capability. Closing this gap needs a PIN-protected
> admin edit path plus an audit-log entry, and is out of scope for Phase 2 (tests only).
>
> ⚠ **Related:** the judge-facing error text in `server/score_routes.rs:37` says *"Editing
> requires admin unlock."* No unlock feature exists, and per this policy none will. The
> wording should be changed to direct the judge to request an Admin correction.

## 6. Phase 3 — UI Smoke Test Plan (Playwright, browser mode only)

Kept intentionally minimal — do not duplicate Phase 1/2 coverage here.

| Test | Covers |
|---|---|
| Create event → add 1 candidate → add 1 judge | Basic setup flow doesn't crash |
| Judge submits one real score through the on-screen form | Form-to-server wiring works |

### 6.1 Test Harness Requirements

Implemented in `e2e/smoke.spec.ts`, configured by `playwright.config.ts` — Chromium only,
one worker, tests run in order because they deliberately share one server and one database.

- **Server under test.** The config builds the frontend and then runs the standalone
  `pageant-server` binary, which serves `dist/` and `/api/*` from one origin on `:3000` —
  the same single-origin setup judges get at the venue, not a Vite dev server.
- **Throwaway database.** The dev/test server binary honours a `PAGEANT_DB_PATH`
  environment variable, so the suite runs against `e2e/.tmp/smoke.db` and never touches the
  shared `.dev-data` database. That directory is wiped as part of the server command — not
  in `globalSetup` and not in the config body, because Playwright starts `webServer` before
  `globalSetup` and re-imports the config in every worker, so a wipe in either place
  deletes the database out from under the running server.
- **Admin mode in a browser.** `src/App.tsx` renders the admin shell only when
  `window.isTauri` is set, so the admin half of the suite sets that flag via
  `page.addInitScript`. No production code branches on the tests' behalf.
- **No new expected values.** These tests assert UI state and row existence only. Every
  scoring number stays locked to the Phase 1 and Phase 2 fixtures above, so Section 1's
  golden rule is untouched by this phase.

### 6.2 Fixture Table

| Fixture | Input | Expected | Verified by / date |
|---|---|---|---|
| UI-1 | Admin fills Event Setup with judge count 1 and submits, then adds candidate `01` on the Candidates page | Submit button flips from "Initialize Event" to "Update Event Details"; the candidate appears in the roster table | _(UI state only — no scoring value asserted)_ |
| UI-2 | `production_number` is opened via `POST /api/rounds/open` as a precondition; the judge claims slot J1, fills all four criteria and clicks Submit Score | Exactly one judge slot is offered (the configured count of 1); the page shows "Scores successfully submitted."; `GET /api/scores/judge/J1` returns exactly one row, for `production_number` | _(UI state only — no scoring value asserted)_ |

UI-1 and UI-2 run in order: UI-2 scores the candidate UI-1 created, and the judge row that
satisfies "add 1 judge" is created when UI-2 claims slot J1. There is no admin-side
judge-creation form by design — judge rows come into existence when a slot is claimed, and
the admin only configures how many slots exist and names them afterwards.

> **Mutation-tested.** Pointing the Candidates page's `POST` at a nonexistent endpoint
> fails UI-1 and only UI-1; doing the same to the scoring form's `POST` fails UI-2 and only
> UI-2. Neither test is vacuous.

### 6.3 Deliberately Not Covered

- **Not wired into CI.** `main` branch protection still gates on `cargo test` only. Running
  Playwright on a runner needs a browser download, which was left out of this phase; the
  suite is a local pre-merge check (`npm run test:e2e`) until someone decides otherwise.
- **No assertion on the live score preview.** The on-screen "Draft Total" is cosmetic per
  `AGENTS.md` §5.1, and the authoritative math is already locked by Phase 1 and Phase 2.

---

## 7. Audit Checklist (run before every merge to `main`)

- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes locally
- [ ] CI test job passes on the Pull Request
- [ ] Every new assertion's expected value matches this document exactly
- [ ] No fixture value in this document was edited in the same commit as test code
- [ ] Diff contains no unrelated production logic changes
- [ ] Phase status table (Section 3) updated

---

*Owner: Jeremy Zion Jamer. Last updated: 2026-9-17. This document supersedes any test expectation
implied by code comments or agent chat history.*