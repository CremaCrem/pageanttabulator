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
| 2 | Rust integration tests — API layer (simulated judge submissions) | ☐ Not started |
| 3 | Playwright UI smoke tests — event/candidate/judge setup flow | ☐ Not started |

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

### 5.2 Fixture Inputs — Awaiting Human-Authored Expected Values

> **⚠ NO PHASE 2 TEST CODE MAY BE WRITTEN UNTIL THE `Expected` COLUMNS BELOW ARE FILLED IN
> BY A HUMAN**, per §1 of this document. Inputs below were drafted by an agent; expected
> outputs must not be.

Shared setup for API-1 and API-3 — segment `best_advocacy`, whose criterion weights
(`relevance_alignment` 0.30, `content_substance` 0.25, `clarity_organization` 0.25,
`delivery_impact` 0.20) are already locked by fixture RS-1. All four criteria receive the
same score per candidate, so each judge's RawScore equals that score.

Candidates: `A` and `B`, both `gender = male`, both eligible.

| Judge | Candidate A (all 4 criteria) | Candidate B (all 4 criteria) |
|---|---|---|
| j1 | 90 | 80 |
| j2 | 80 | 90 |
| j3 | 70 | 85 |

#### API-1 — N judges submit one segment over HTTP

Three `POST /api/scores` calls per judge-candidate pair (6 total), then read
`GET /api/results/breakdown` for `segmentId = "best_advocacy"`.

| Fixture | Input | Expected rankSum (A, B) | Expected segment winner | Verified by / date |
|---|---|---|---|---|
| API-1 | the 6 submissions in the table above | _(to fill)_ | _(to fill)_ | |

> Cross-reference: this fixture is the over-HTTP restatement of Phase 1's **BC-1**
> (J1: A=1,B=2 · J2: A=2,B=1 · J3: A=2,B=1 → A=5, B=4, winner B). The human filling the
> `Expected` cells should confirm the raw scores above do in fact produce BC-1's per-judge
> ranks before reusing BC-1's rank sums.

#### API-2 — Judge resubmits a score for the same candidate + segment

See the **flagged discrepancy in §5.3 below** — this fixture cannot be authored until the
intended behavior is decided, because the current implementation contradicts the scenario
table above.

| Fixture | Input | Expected HTTP status | Expected row count in `scores` | Expected stored score | Verified by / date |
|---|---|---|---|---|---|
| API-2 | j1 submits A = all 90, then j1 submits A = all 50 for the same segment | _(blocked — see §5.3)_ | _(blocked)_ | _(blocked)_ | |

#### API-3 — Manual Score Entry mixes with judge submissions

Identical inputs to API-1, except judges `j2` and `j3` are entered through
`POST /api/admin/manual-score-entry` with a valid admin PIN, while `j1` submits through
`POST /api/scores`. Proves `scoring-logic.md` §2's claim that manually entered rows are
"strictly indistinguishable ... downstream".

| Fixture | Input | Expected rankSum (A, B) | Expected segment winner | Verified by / date |
|---|---|---|---|---|
| API-3 | j1 via `/api/scores`; j2, j3 via `/api/admin/manual-score-entry` | _(to fill)_ | _(to fill)_ | |

> The expected result should be **identical to API-1**. If it is not, either the claim in
> `scoring-logic.md` §2 or the implementation is wrong.

#### API-4 … API-7 — Manual Score Entry input validation (proposed additions)

These four are **beyond** the three scenarios originally listed in this section. They cover
validation branches that `manual_score_entry` already implements. Include them only if the
document owner agrees they belong in Phase 2.

| Fixture | Input | Expected HTTP status | Expected error message | Verified by / date |
|---|---|---|---|---|
| API-4 | manual entry with a wrong admin PIN | _(to fill)_ | _(to fill)_ | |
| API-5 | manual entry with only 3 of the segment's 4 criteria | _(to fill)_ | _(to fill)_ | |
| API-6 | manual entry with a criterion score of `0`, and separately `101` | _(to fill)_ | _(to fill)_ | |
| API-7 | manual entry for a `segmentId` that does not exist | _(to fill)_ | _(to fill)_ | |

### 5.3 ⚠ FLAGGED FOR HUMAN REVIEW — Scenario 2 contradicts the implementation

Per §1 ("If a fixture appears wrong, stop and flag it for human review instead of
'fixing' it"), this is flagged rather than silently corrected.

The scenario table in this section claims:

> | A judge resubmits/edits a score before segment close | No duplicate rows; **latest score wins** |

"Latest score wins" is not what the system does, and there is no code path by which it
could. Four independent points of contradiction:

1. `server/score_routes.rs:33-39` rejects a resubmission outright, returning
   `{"error": "Score already submitted for this candidate in this segment. Editing
   requires admin unlock."}` — the original row is kept, the new score is discarded.
2. `server/admin_routes.rs:753-762` (`manual_score_entry`, duplicate check) rejects the
   same case with HTTP 400.
3. `db/schema.rs:94` places `UNIQUE(judge_id, candidate_id, segment_id)` on `scores`, and
   `db/scores.rs` exposes only `insert` and readers — there is no `update` and no `delete`.
   Even with the route checks removed, a second insert would fail at the DB level.
4. `AGENTS.md` §3: "Submitted scores are **locked** — no edit without admin PIN + audit
   log."

So "no duplicate rows" is satisfied, but "latest score wins" is false — **earliest score
wins, and the resubmission is refused**.

A second, related gap: the error message in point 1 tells the judge that "editing requires
admin unlock," but **no admin unlock endpoint exists** anywhere in `server/`. The message
promises a recovery path the system does not implement. `AGENTS.md` §3's "no edit without
admin PIN + audit log" likewise describes a capability that is not built.

**Decision required from the document owner before API-2 can be authored:**

- **(a)** The implementation is correct and this document is wrong — amend Scenario 2 to
  "resubmission is rejected; the original score is preserved," and separately decide
  whether the misleading "admin unlock" wording in `score_routes.rs` should be corrected.
- **(b)** The document is correct and the implementation is wrong — "latest score wins" is
  the intended official behavior, making this a **production bug** that Phase 2 should
  expose, requiring an unlock/overwrite path plus an audit-log entry.

Option (b) changes scoring behavior and would require explicit approval under
`AGENTS.md` §12.

## 6. Phase 3 — UI Smoke Test Plan (Playwright, browser mode only)

Kept intentionally minimal — do not duplicate Phase 1/2 coverage here.

| Test | Covers |
|---|---|
| Create event → add 1 candidate → add 1 judge | Basic setup flow doesn't crash |
| Judge submits one real score through the on-screen form | Form-to-server wiring works |

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