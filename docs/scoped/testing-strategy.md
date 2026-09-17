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

Fixtures for this phase will be added here once Phase 1 is merged.

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