# Implementation Plan — Modular Segments & Criteria (Configurable Rulebook)

> **Status:** Proposed — not started.
> **Goal:** Make segments, criteria, weights, segment count, advance count, and the finals
> formula **configurable per pageant**, while keeping Borda Count as the ranking method and
> reproducing the Mr. & Ms. IDSC 2026 rulebook exactly as the default configuration.
>
> Related: `AGENTS.md` (§3, §7, §12), `docs/scoped/scoring-logic.md`,
> `docs/scoped/testing-strategy.md`, `docs/scoped/data-models.md`,
> `docs/scoped/network-server.md`, `docs/scoped/architecture.md`

---

## 0. Two Blockers To Clear First (human decisions)

### 0.1 Branch scope conflict

This work is **production logic**, and the current branch is `test/scoring-suite`.
`docs/scoped/testing-strategy.md` says:

- §1: *"Do not touch application logic while a task is scoped as 'add tests only'."*
- §2: *"A branch may only be merged into `main` when … the diff contains no unrelated
  changes to production logic."*

Doing Stages 1–3 here would make the test branch unmergeable under its own rule.

**Recommendation:**

1. Finish and commit the Phase 1 test work currently uncommitted in
   `src-tauri/src/scoring/compute.rs` and `src-tauri/src/scoring/ranking.rs`.
2. Tick Phase 1 in `testing-strategy.md` §3, merge `test/scoring-suite` → `main`.
3. Branch `feat/modular-criteria` off `main` and do this plan there.

The green fixture suite on `main` is the whole safety net for Stage 2. Landing it first is
what makes this refactor safe — it costs one merge and buys a regression guard.

**If you choose to proceed on `test/scoring-suite` anyway:** keep every Stage 1–3 commit
separate from the test commits and amend `testing-strategy.md` §2 in the same PR to record
the exception, so the rule and the repo don't disagree.

### 0.2 AGENTS.md formula-change approval

`AGENTS.md` §12 requires **explicit approval** for any formula or weight change, and §3
states several rules as absolutes that this feature turns into *defaults*:

| AGENTS.md §3 rule today | After this feature |
|---|---|
| "Preliminary Composite = 20% weighting of the 5 preliminary segments" | `Σ (rank × prelimWeight)` over N configured prelim segments; IDSC 2026 default = 5 × 0.20 |
| "Final winners (Top 3) use the **50/50 formula only**" | Weighted components; IDSC 2026 default = prelim 0.50 + Final Q&A 0.50 |
| "Top 3 selection is by composite preliminary ranking per gender" | `advanceCount` per division; IDSC 2026 default = 3 |
| "Scoring formulas must exactly match `scoring-logic.md`" | Formulas must match `scoring-logic.md`; **weights and segment sets come from the active config** |

**Nothing about Borda Count changes.** `rank_segment_scores` and
`consolidate_segment_ranks` are untouched by this plan.

**Required before Stage 1:** approve an amendment to `AGENTS.md` §3/§7 and
`scoring-logic.md` reframing the four rows above as the IDSC 2026 default config. Per §12,
that approval must be explicit and the docs must change in the same PR as the code.

---

## 1. Design Summary

### 1.1 Single source of truth

One `PageantConfig` object, stored in SQLite as versioned JSON, is the only place the
rulebook lives. `src/utils/constants.ts` is demoted from truth to *built-in default
template*.

### 1.2 Identity by role, never by id

The load-bearing change. Today code asks *"is this segment `final_qa`?"*. After this it
asks *"is this the finals segment?"* — via `config.roles` and `SegmentCategory`. Without
this, every new pageant needs someone to grep for string literals, and modularity is fake.

### 1.3 Hardcoding inventory (what this plan removes)

| # | Location | Baked-in assumption |
|---|---|---|
| 1 | `src/utils/constants.ts` | all 9 segments, criteria, weights, `preliminaryWeight` |
| 2 | `src/types/enums.ts:12-22, 37-48` | `SegmentId` / `SpecialAwardId` as closed enums |
| 3 | `src-tauri/src/scoring/compute.rs:3-49` | `get_criterion_weight` — duplicate of #1 |
| 4 | `src-tauri/src/scoring/compute.rs:81-91` | `get_segment_criteria_ids` — duplicate of #1 |
| 5 | `src-tauri/src/scoring/compute.rs:74` | `sum * 0.20` ⇒ exactly 5 equal-weight prelim segments |
| 6 | `src-tauri/src/scoring/compute.rs:78` | `prelim * 0.5 + final_qa * 0.5` |
| 7 | `src-tauri/src/scoring/ranking.rs:148-149` | `select_top3`, `target_slots = 3` |
| 8 | `src-tauri/src/server/admin_routes.rs:49-55, 415-418` | prelim + minor-award segment lists |
| 9 | `src-tauri/src/server/admin_routes.rs:181, 208, 324` | `"tie_breaking_qa"`, `"final_qa"` literals |
| 10 | `src-tauri/src/server/round_routes.rs:57-60, 112-115` | `school_uniform → best_advocacy` child coupling (duplicated in open + lock) |
| 11 | `src/pages/judge/ScoringPage.tsx:60, 81-83, 151-152, 198-199` | same coupling + finals/tiebreak literals |
| 12 | `src/components/admin/PrintReport.tsx:116` | `GENDER_AWARD_LABELS` per segment |
| 13 | `src/pages/admin/CriteriaPage.tsx:11-19` | explicit prelim/final segment lists |

### 1.4 Out of scope (deliberately)

**The male/female division axis stays hardcoded.** It is threaded through a SQLite `CHECK`
constraint, the `candidates` unique index, every compute path, and the report layout.
Making divisions configurable is a separate project. This plan assumes exactly two
divisions. Revisit only if a single-title or three-division pageant is actually needed.

---

## 2. Config Schema

`schemaVersion: 1`. Stored as JSON; Rust is the authority.

```jsonc
{
  "schemaVersion": 1,
  "segments": [
    {
      "id": "production_number",
      "label": "Production Number",
      "category": "preliminary",        // preliminary | finals | minor_award | tiebreak
      "prelimWeight": 0.20,             // 0.0 for non-preliminary segments
      "scoreMin": 1,
      "scoreMax": 100,
      "criteria": [
        { "id": "stage_presence", "label": "Stage Presence", "weight": 0.40 }
      ],
      "scoredAlongside": null           // parent segment id — replaces hardcoding #10/#11
    }
  ],
  "roles": {
    "finalsSegment":   "final_qa",
    "tiebreakSegment": "tie_breaking_qa"
  },
  "finals": {
    "advanceCount": 3,
    "components": [
      { "source": "preliminary", "weight": 0.50 },
      { "source": "segment", "id": "final_qa", "weight": 0.50 }
    ]
  },
  "minorAwards": [
    { "segmentId": "best_advocacy", "labels": { "male": "Best in Advocacy", "female": "Best in Advocacy" } },
    { "segmentId": "modern_barong", "labels": { "male": "Best in Modern Barong", "female": "Best in Filipiniana" } }
  ]
}
```

### 2.1 Rust types — `src-tauri/src/scoring/config.rs` (new)

All DTOs get `#[serde(rename_all = "camelCase")]` per `AGENTS.md` §5.2.

```rust
pub struct PageantConfig {
    pub schema_version: u32,
    pub segments: Vec<SegmentConfig>,
    pub roles: RoleMap,
    pub finals: FinalsConfig,
    pub minor_awards: Vec<MinorAwardConfig>,
}

pub struct SegmentConfig {
    pub id: String,
    pub label: String,
    pub category: SegmentCategory,      // enum, serde lowercase
    pub prelim_weight: f64,
    pub score_min: u32,
    pub score_max: u32,
    pub criteria: Vec<CriterionConfig>,
    pub scored_alongside: Option<String>,
}

pub struct CriterionConfig { pub id: String, pub label: String, pub weight: f64 }
pub struct RoleMap { pub finals_segment: Option<String>, pub tiebreak_segment: Option<String> }
pub struct FinalsConfig { pub advance_count: usize, pub components: Vec<FinalComponent> }

#[serde(tag = "source", rename_all = "camelCase")]
pub enum ComponentSource { Preliminary, Segment { id: String } }
pub struct FinalComponent { #[serde(flatten)] pub source: ComponentSource, pub weight: f64 }
```

### 2.2 Lookup API (replaces every string literal in routes)

```rust
impl PageantConfig {
    pub fn segment(&self, id: &str) -> Option<&SegmentConfig>;
    pub fn preliminary_segments(&self) -> Vec<&SegmentConfig>;   // kills #8
    pub fn minor_award_segments(&self) -> Vec<&SegmentConfig>;   // kills #8
    pub fn finals_segment(&self) -> Option<&SegmentConfig>;      // kills #9
    pub fn tiebreak_segment(&self) -> Option<&SegmentConfig>;    // kills #9
    pub fn children_of(&self, parent: &str) -> Vec<&SegmentConfig>; // kills #10, #11
    pub fn criterion_weight(&self, seg: &str, crit: &str) -> Option<f64>;
    pub fn default_idsc_2026() -> Self;                          // the current rulebook
}
```

### 2.3 Validation — the safety net, and it lives in Rust

`pub fn validate(&self) -> Result<(), Vec<ConfigError>>` where
`ConfigError { code: String, path: String, message: String }`. The UI mirrors these for
live feedback, but **the server verdict is the only one that counts** (`AGENTS.md` §10,
two-layer validation).

| Code | Rule |
|---|---|
| `E_SCHEMA_VERSION` | `schemaVersion` is a version this build understands |
| `E_BAD_ID_FORMAT` | every id matches `^[a-z][a-z0-9_]{1,40}$` |
| `E_DUP_SEGMENT_ID` | segment ids unique |
| `E_DUP_CRITERION_ID` | criterion ids unique **within** a segment (reuse across segments is fine and already happens) |
| `E_NO_CRITERIA` | every segment has ≥ 1 criterion |
| `E_NEGATIVE_WEIGHT` | no weight < 0 |
| `E_CRITERIA_WEIGHT_SUM` | per segment, `abs(Σ criterion.weight − 1.0) ≤ 1e-6` |
| `E_PRELIM_WEIGHT_SUM` | `abs(Σ prelimWeight over preliminary segments − 1.0) ≤ 1e-6` |
| `E_NO_PRELIM_SEGMENTS` | ≥ 1 preliminary segment |
| `E_FINALS_WEIGHT_SUM` | `abs(Σ finals.components.weight − 1.0) ≤ 1e-6` |
| `E_ADVANCE_COUNT` | `advanceCount ≥ 1` |
| `E_SCORE_RANGE` | `scoreMin ≥ 1` and `scoreMin < scoreMax` |
| `E_UNKNOWN_ROLE_REF` | `roles.*` point at existing segments |
| `E_UNKNOWN_COMPONENT_REF` | `finals.components[].id` points at an existing segment |
| `E_UNKNOWN_PARENT_REF` | `scoredAlongside` points at an existing segment |
| `E_CHILD_IS_PRELIM` | a `scoredAlongside` child is **not** itself `preliminary` (would double-count into the composite) |
| `E_CYCLE` | no `scoredAlongside` cycle |

**Bonus fix this unlocks:** `get_criterion_weight` currently returns `0.0` for an
unrecognized criterion id (`compute.rs:47`), so a malformed submission silently scores low
instead of being rejected. Stage 3 makes `submit_score` reject any payload whose criterion
id set doesn't exactly match the configured set, and whose scores fall outside
`[scoreMin, scoreMax]` — satisfying `AGENTS.md` §10 ("a partial or invalid score must never
be saved").

---

## 3. Stage 1 — Config module, no behavior change

**Branch:** `feat/modular-criteria`. **Nothing outside `scoring/` changes.**

| Step | File | Action |
|---|---|---|
| 1.1 | `src-tauri/src/scoring/config.rs` | new — types from §2.1 |
| 1.2 | same | `validate()` per §2.3 |
| 1.3 | same | lookup helpers per §2.2 |
| 1.4 | same | `default_idsc_2026()` — transcribed from `constants.ts` and cross-checked against `docs/reference/pageant-rules.md` |
| 1.5 | `src-tauri/src/scoring/mod.rs` | `pub mod config;` |

**Tests (Stage 1 owns these — new, not fixture-derived):**

- `default_idsc_2026().validate()` is `Ok`.
- Round-trip: `serde_json::to_string` → `from_str` → equals original.
- One negative test per error code in §2.3 (16 cases).
- `default_idsc_2026()` reproduces `get_criterion_weight` for **every** `(segment, criterion)`
  pair in the current match arms — assert the old function and the new lookup agree. This
  is the proof the transcription in 1.4 is faithful. Delete the old function only after
  this test is green.

**Verify:** `cargo check` and `cargo test` (`--manifest-path src-tauri/Cargo.toml`).

---

## 4. Stage 2 — Config-driven formulas

The highest-risk stage. The Phase 1 golden fixtures are the guard.

### 4.1 Signature changes

```rust
// compute.rs
pub fn compute_segment_score(segment: &SegmentConfig, entries: &[CriterionEntry]) -> f64
pub fn compute_preliminary_score(weighted_ranks: &[(f64, f64)]) -> f64   // (rank, weight)
pub fn compute_final_score(components: &[(f64, f64)]) -> f64             // (value, weight)

// ranking.rs
pub fn select_advancing(                                  // was select_top3
    candidates: &mut [CandidateResult],
    slots: usize,
    overrides: &HashMap<String, String>,
) -> bool
```

`rank_segment_scores`, `consolidate_segment_ranks`, `rank_candidates`, and
`compute_avg_segment_score` are **unchanged**.

### 4.2 ⚠ Mandatory: round to 4 dp at every formula boundary

Replacing `sum(ranks) * 0.20` with `Σ (rank × weight)` **changes the floating-point result**
and breaks fixture PC-1. Verified:

```
ranks = [1, 2, 1, 3, 2]
sum(ranks) * 0.20        = 1.8                  == 1.8  ✅  (today)
Σ (rank × 0.20)          = 1.8000000000000003   != 1.8  ❌  (naive refactor)
round4(Σ rank × 0.20)    = 1.8                  == 1.8  ✅  (with 4 dp rounding)
```

So Stage 2 must add and use:

```rust
#[inline]
fn round4(v: f64) -> f64 { (v * 10_000.0).round() / 10_000.0 }
```

applied to the return value of `compute_segment_score`, `compute_preliminary_score`, and
`compute_final_score`. This is not a workaround — `AGENTS.md` §7 already requires
"intermediate values: 4 decimal places", and the current code doesn't honor it. The
refactor is the moment to start.

Note `compute_segment_score` is the value persisted to `scores.computed_score`, so
introducing `round4` there is itself a (tiny) behavior change on raw scores. Confirm RS-1/2/3
still pass — they do, since 84.5, 100.0 and 1.0 are all exact at 4 dp — and record the
change in `scoring-logic.md`.

### 4.3 Fixture call-site migration — values stay locked

`testing-strategy.md` §1 forbids editing a fixture value to make a test pass. These edits
change **call syntax only**; every expected output is byte-identical.

| Fixture | Old call | New call | Expected |
|---|---|---|---|
| RS-1 | `compute_segment_score("best_advocacy", &e)` | `compute_segment_score(cfg.segment("best_advocacy").unwrap(), &e)` | 84.5 (unchanged) |
| RS-2 | same | same | 100.0 (unchanged) |
| RS-3 | same | same | 1.0 (unchanged) |
| PC-1 | `compute_preliminary_score(&[1.,2.,1.,3.,2.])` | `compute_preliminary_score(&[(1.,0.2),(2.,0.2),(1.,0.2),(3.,0.2),(2.,0.2)])` | 1.8 (unchanged — needs §4.2) |
| CS-1 | `compute_final_score(1.8, 1.0)` | `compute_final_score(&[(1.8,0.5),(1.0,0.5)])` | 1.4 (unchanged) |
| BT-1 | `select_top3(&mut c, &ov)` | `select_advancing(&mut c, 3, &ov)` | `pending_override` (unchanged) |
| RC-1, BC-1, TB-1, MA-1, FT-1 | — | untouched | unchanged |

### 4.4 New fixtures — human-authored expected values required

`testing-strategy.md` §1: *"Never write both the test's input and its expected output in
the same step. Expected outputs come from this document, written by a human, before any
test code exists."*

So a human must add these rows to `testing-strategy.md` §4 **and fill in the expected
values**, in a separate commit, before Stage 2 test code is written. Inputs proposed;
outputs intentionally blank:

| Fixture | Input | Expected | Verified by / date |
|---|---|---|---|
| PC-2 | 4 prelim segments, weights 0.25 each, ranks = [1, 2, 3, 4] | _(to fill)_ | |
| PC-3 | 4 prelim segments, uneven weights [0.40, 0.30, 0.20, 0.10], ranks = [1, 2, 3, 4] | _(to fill)_ | |
| PC-4 | 6 prelim segments, weights ≈0.1667 each, ranks = [1, 1, 2, 2, 3, 3] | _(to fill)_ | |
| CS-2 | finals components: prelim 0.60 @ rank 2.0, final Q&A 0.40 @ rank 1.0 | _(to fill)_ | |
| CS-3 | three components: 0.4 @ 1.0, 0.4 @ 2.0, 0.2 @ 3.0 | _(to fill)_ | |
| BT-2 | `advanceCount = 5`, 7 candidates, no boundary tie | _(to fill)_ | |
| BT-3 | `advanceCount = 1`, boundary tie between 2 candidates | _(to fill)_ | |
| RS-4 | 6 criteria, weights [0.3,0.2,0.2,0.1,0.1,0.1], scores [100,90,80,70,60,50] | _(to fill)_ | |

**Verify:** `cargo test` — all pre-existing fixtures green with unedited values.

---

## 5. Stage 3 — Rewire call sites (still no persistence)

Config comes from `PageantConfig::default_idsc_2026()` at this stage. Behavior must be
identical; this is pure de-hardcoding.

| Step | File | Change |
|---|---|---|
| 3.1 | `admin_routes.rs:49-55` | `prelim_segments` vec → `config.preliminary_segments()` |
| 3.2 | `admin_routes.rs:415-418` | `minor_segments` vec → `config.minor_award_segments()` |
| 3.3 | `admin_routes.rs:181, 208` | `"tie_breaking_qa"` → `config.tiebreak_segment()` |
| 3.4 | `admin_routes.rs:324` | `"final_qa"` → `config.finals_segment()` |
| 3.5 | `admin_routes.rs:139-176` | prelim composite: build `(rank, prelimWeight)` pairs; `select_top3` → `select_advancing(.., config.finals.advance_count, ..)` |
| 3.6 | `admin_routes.rs:366-374` | finals: build component vec from `config.finals.components` |
| 3.7 | `round_routes.rs:57-60, 112-115` | both copies → `config.children_of(&payload.segment_id)`; extract the shared open/lock child-sync into one helper (it is currently duplicated) |
| 3.8 | `score_routes.rs:45-48` | look up `SegmentConfig`; **reject** unknown segment, mismatched criterion set, or out-of-range score with `{ error, code }` |
| 3.9 | `score_routes.rs:88-90` | `"tie_breaking_qa"` / `"final_qa"` → role lookups |

**3.10 — Where does the config come from at runtime?**
Add `pub config: Arc<RwLock<PageantConfig>>` to `AppState` (`db/mod.rs:20`), loaded once at
startup. Stage 3 seeds it with `default_idsc_2026()`; Stage 4 loads it from SQLite.
Routes read it; the Stage 6 editor takes the write lock. This keeps handlers thin per
`AGENTS.md` §5.2 (no math in routes — they only select which values to feed `scoring/`).

**Verify:** `cargo test`, plus a manual end-to-end pass — seed candidates, submit scores as
2–3 judges via `cargo run --bin pageant-server`, compute all three rounds, and diff the
`results` table against a pre-refactor run of the same inputs. **Identical output is the
acceptance criterion for Stage 3.**

---

## 6. Stage 4 — Persistence & API

| Step | File | Change |
|---|---|---|
| 4.1 | `db/schema.rs` | `CREATE TABLE IF NOT EXISTS pageant_config (id INTEGER PRIMARY KEY DEFAULT 1, version INTEGER NOT NULL, config_json TEXT NOT NULL, locked_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)` |
| 4.2 | `db/schema.rs` | `ALTER TABLE scores ADD COLUMN config_version INTEGER` (additive migration, matching the existing `let _ = conn.execute("ALTER TABLE …")` idiom) |
| 4.3 | `db/schema.rs` | `ALTER TABLE past_events ADD COLUMN config_json TEXT` — so archived reports render against the criteria actually used |
| 4.4 | `db/pageant_config.rs` | new — `get`, `upsert`, `lock`, `is_locked` |
| 4.5 | `server/config_routes.rs` | new — `GET /api/config`, `PUT /api/config` (PIN-gated, validated), `GET /api/config/templates` |
| 4.6 | `server/mod.rs` | register routes |
| 4.7 | `db/schema.rs` | on first run with no row, seed `default_idsc_2026()` |
| 4.8 | `event_routes.rs` save-close | snapshot active `config_json` into `past_events` |

### 6.1 Editing after scores exist — the decision that matters most

`scores.criteria_json` **already stores the raw per-criterion scores**
(`db/schema.rs:91`), so recomputation from source data is always possible. Use that:

1. **Weight-only edits stay legal.** At compute time, recompute each
   `scores.computed_score` from `criteria_json` + the active config rather than trusting the
   stored value. A corrected weight then applies retroactively and correctly.
2. **Structural edits lock once scoring starts.** Adding/removing/renaming a segment or
   criterion, or changing `scoreMin`/`scoreMax`, is rejected with
   `{ code: "E_CONFIG_LOCKED" }` once any round has left `not_started`. Set `locked_at` in
   `round_routes::open_round`.
3. **Escape hatch:** an explicit PIN-gated "reset event and edit rulebook" that clears
   `scores` + `results` first, with an audit-log entry (`AGENTS.md` §3).
4. Stamp `config_version` on every inserted score so a mismatch is detectable and
   diagnosable after the fact.

Without rule 2, a mid-event criteria edit silently invalidates already-submitted scores.
This is the failure mode most likely to bite on event day.

**Verify:** `cargo test`; integration test that a locked config rejects a structural edit
but accepts a weight edit; restart the server and confirm the config survives.

---

## 7. Stage 5 — Frontend consumes the config

| Step | File | Change |
|---|---|---|
| 5.1 | `src/types/enums.ts` | `SegmentId` enum → `export type SegmentId = string`. Keep `SegmentCategory` (a closed set). Keep the old enum temporarily as `LEGACY_SEGMENT_IDS` if it eases migration, then delete. |
| 5.2 | `src/types/segment.ts` | extend `ISegment` to mirror §2 (`scoreMin/Max`, `scoredAlongside`); add `IPageantConfig`, `IFinalsConfig`, `IConfigError` |
| 5.3 | `src/api/config.ts` | new — `getConfig()`, `updateConfig()`, `getTemplates()` (all `fetch` in `src/api/` per `AGENTS.md` §5.1) |
| 5.4 | `src/context/AppContext.tsx` | add `pageantConfig: IPageantConfig \| null` + `SET_PAGEANT_CONFIG`; fetch at boot alongside `eventConfig` |
| 5.5 | `src/utils/segments.ts` | new — pure selectors: `preliminarySegments`, `minorAwardSegments`, `finalsSegment`, `tiebreakSegment`, `childrenOf`, `segmentById`. **Selectors only — no scoring math** (`AGENTS.md` §11) |
| 5.6 | `src/utils/constants.ts` | `SEGMENTS` → `IDSC_2026_TEMPLATE`, exported only as a seed/template |
| 5.7 | `ScoringPage.tsx:60,81-83,151-152,198-199` | literals → selectors |
| 5.8 | `DashboardPage.tsx:147` | exclusion by hardcoded ids → `category !== 'minor_award'` |
| 5.9 | `CriteriaPage.tsx:11-19` | explicit lists → selectors; the "Preliminary (50%)" tab label derives from `finals.components` |
| 5.10 | `ResultsPage.tsx`, `ReportsPage.tsx`, `ManualScoreEntryPage.tsx`, `JudgeShell.tsx`, `PrintBlankScoreSheets.tsx` | `SEGMENTS[...]` → `segmentById(config, id)` |
| 5.11 | `PrintReport.tsx:116-118` | `GENDER_AWARD_LABELS` → `config.minorAwards[].labels` |
| 5.12 | `ScoringPage.tsx:384` | `Object.keys(SEGMENTS).length` → `config.segments.length` |

**Guard:** all 31 `SegmentId.*` references live in only three files
(`constants.ts`, `DashboardPage.tsx`, `CriteriaPage.tsx`), and there are **zero**
`SpecialAwardId.*` references — so this stage is far smaller than it looks.

**Verify:** `npx tsc --noEmit`, `npm run build`, and a manual judge-flow click-through. No
`any` (`AGENTS.md` §11).

---

## 8. Stage 6 — Rulebook editor UI

`CriteriaPage.tsx` becomes read/write; 2-column bento per `AGENTS.md` §9 (form + live
preview).

- Add / remove / reorder segments; set label, category, `prelimWeight`, score range.
- Add / remove / reorder criteria; set label and weight.
- Weight editors show a live **"sums to 100%"** indicator; save disabled while invalid.
- `advanceCount` and finals component weights editable.
- `scoredAlongside` as a parent-segment picker.
- Lock state visible and explained ("scoring has started — weights only").
- Save is PIN-gated; server validation errors render against the offending `path`.
- Broadcast `CONFIG_UPDATED` over WS so judge clients refetch (`AGENTS.md` §5.3).

**Verify:** `npx tsc --noEmit`, `npm run build`, manual edit → save → reopen → persisted.

---

## 9. Stage 7 — Templates, import/export, archive

- `src-tauri/src/scoring/templates/` — `idsc_2026.json` plus a minimal 4-segment starter,
  embedded via `include_str!` (no network, `AGENTS.md` §11).
- Setup wizard: "start from template" / "import `.json`" / "start blank".
- Export the active config as `.json` — Rust/Tauri-side only (`AGENTS.md` §11: no frontend
  exports).
- Import validates before applying; refuses on any error.
- `EventHistoryPage` renders archived events against their snapshotted `config_json`.

---

## 10. Stage 8 — Documentation (same PR as the code, per §12)

| Doc | Update |
|---|---|
| `AGENTS.md` §3, §7 | reframe the four rows in §0.2 as IDSC 2026 defaults; keep Borda Count as an absolute |
| `docs/scoped/scoring-logic.md` | generalized formulas + the `round4` rule; IDSC 2026 as worked example |
| `docs/scoped/data-models.md` | `pageant_config` table, `scores.config_version`, `past_events.config_json`, new TS types |
| `docs/scoped/network-server.md` | `GET/PUT /api/config`, `GET /api/config/templates`, `CONFIG_UPDATED` WS event |
| `docs/scoped/architecture.md` | `scoring/config.rs`, `db/pageant_config.rs`, `server/config_routes.rs`, `utils/segments.ts` |
| `docs/scoped/testing-strategy.md` | new fixture rows (human-authored, separate commit) |
| `docs/current-state.md` | feature status |

---

## 11. Sequencing & Risk

| Stage | Scope | Risk | Gate to next stage |
|---|---|---|---|
| 0 | Branch + AGENTS.md approval | — | human sign-off |
| 1 | `config.rs` + validation | Low | old/new weight-parity test green |
| 2 | Config-driven formulas | **High** | all Phase 1 fixtures green, values unedited |
| 3 | Rewire call sites | **High** | `results` table byte-identical to pre-refactor run |
| 4 | Persistence + API | Medium | config survives restart; lock rules enforced |
| 5 | Frontend consumption | Medium | `tsc --noEmit` clean; judge flow works |
| 6 | Editor UI | Low | manual round-trip |
| 7 | Templates / import / export | Low | import rejects invalid config |
| 8 | Docs | — | §12 table satisfied |

**Stages 2 and 3 carry essentially all the risk, and both are guarded by tests rather than
by review.** That is the reason §0.1 recommends landing the fixture suite on `main` first.

Stages 1–3 are one PR ("config-driven scoring engine, no behavior change"). Stages 4–5 are
a second. Stages 6–7 can ship incrementally afterward.

### Rollback

Stages 1–3 are behavior-preserving, so `git revert` of that PR is safe. After Stage 4, a
rollback must also drop the `pageant_config` row — the additive `ALTER TABLE` columns are
harmless if left in place.
