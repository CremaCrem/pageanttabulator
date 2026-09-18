# Scoring Logic — PageantTabulator

> **This document is the mathematical and algorithmic specification for all scoring in the PageantTabulator.**  
> All scoring computation happens **server-side in Rust** — `src-tauri/src/scoring/compute.rs` and `ranking.rs`.  
> The React frontend may display a **live preview** of raw scores as the judge types, but this is cosmetic. The server recomputes rankings authoritatively on every score submission.  
> Reference: `Mr_and_Ms_IDSC_2026_Official_Guidelines.md`

---

## 1. Competition Overview & Scoring Engine

The Mr. and Ms. IDSC 2026 competition uses **Ranking-Based Scoring (Borda Count)** for the main pageant. 
Minor awards use an isolated **Simple Average** engine.

| Round | Description | Core Engine | Score Weight |
|-------|-------------|-------------|-------------|
| **Preliminary Round** | Five segments | Ranking-Based | 50% of Final Score |
| **Final Round** | Final Q&A (Top 3 only) | Ranking-Based | 50% of Final Score |
| **Dynamic Tie-Break** | Triggered only on Top 3 tie | Ranking-Based | Tie-Breaker Only |
| **Minor Awards** | Advocacy & Ramp | Simple Average | Independent |

---

## 2. Score Entry Rules

- All criteria scores are entered on a **scale of 1 to 100** (integers only, no decimals at input).
- Judges enter **one score per criterion** per candidate per segment.
- A score of `0` is **not valid** — minimum valid score is `1`.
- **Manual Score Entry Note:** If the Admin uses the PIN-protected Manual Score Entry feature to input a judge's backup paper scores, the resulting database rows are strictly indistinguishable from scores submitted directly via the judge's browser. Therefore, all Borda Count math automatically handles manual entries with zero additional logic required downstream.

### 2.1 Score Locking & the Correction Workflow

**A submitted score is final and locked to the judge. The first score wins.** A judge can
never edit, overwrite, or withdraw their own submission — not before the segment closes,
not after. This is enforced at the route layer, at the Manual Score Entry layer, and by a
`UNIQUE(judge_id, candidate_id, segment_id)` constraint on the `scores` table.

The reason is accountability, not convenience: a judge who could revise a score after the
fact could adjust it in response to what other judges or the audience did.

**There is deliberately no judge-facing unlock feature, and none will be built.** When a
judge realises they made a mistake, the correction follows this chain:

1. **The judge requests a correction from the Admin (tabulator).** The judge takes no
   further action on their own device.
2. **The Admin consults the pageant coordinator and the auditor** and asks whether the
   correction is permitted.
3. **If approved, the Admin edits that judge's score directly in the admin client**, on the
   judge's behalf, protected by the admin PIN.
4. **The correction is written to the system log** so the change is auditable after the
   event.

**Implemented as of 2026-09-18.** The Admin performs step 3 on the *Manual Score Entry*
page: selecting a judge + segment + candidate that already has a submitted score switches
the form into correction mode, prefilled with what the judge originally entered. A written
reason is mandatory. Behind it, `POST /api/admin/correct-score` validates the admin PIN and
the 1-100 range, requires that a score already exists, rewrites that row **in place**
(preserving its id, so downstream Borda math still sees exactly one score per
judge/candidate/segment), and writes a `warn`-level log entry recording the previous score,
the new score, and the reason.

Manual Score Entry itself still *refuses* to overwrite — correcting an existing score is a
deliberately separate, reason-logged action, not a silent re-entry.

---

## 3. Main Pageant: Borda Count Logic (Ranking-Based)

The main pageant strictly evaluates candidates based on their **sum of ranks**, not their average raw score.

### 3.1 Step 1: Raw Score per Judge
For a single segment and a single judge, the judge's Raw Score for a candidate is:
```
RawScore(judge, candidate, segment) =
  Σ ( CriterionScore(n) × CriterionWeight(n) )
  for each criterion n in the segment
```

### 3.2 Step 2: Rank Conversion per Judge
Each judge's raw scores are sorted descending to determine *that judge's rankings* for the candidates in the segment.
- Highest RawScore = Rank 1
- Next Highest = Rank 2
- *(If a single judge gives the same raw score to two candidates, standard fractional ranking or competition ranking applies. Since raw scores have decimals internally due to weights, ties at this granular level are rare.)*

### 3.3 Step 3: Rank Consolidation (The Borda Count)
For a specific segment, the final placement is determined by the **sum of all judges' ranks** for a candidate.
```
RankSum(candidate, segment) = Σ Rank(judge_i, candidate, segment)
```
- **Lowest RankSum = 1st Place for the segment.**

#### Segment Tie-Breaker:
If two candidates have the exact same `RankSum` for a segment:
- **Tie-Breaker:** The candidate with the higher `Σ RawScore(judge_i)` across all judges wins the tie.

---

## 4. Preliminary Round — Composite Rank (Top 3 Selection)

The Preliminary Round score is a **composite of 5 segments, weighted equally at 20% each**.

| Segment | Preliminary Weight |
|---------|-------------------|
| Production Number | 20% |
| School Uniform | 20% |
| Professional Attire | 20% |
| Modern Barong / Filipiniana | 20% |
| Preliminary Q&A | 20% |
| **Total** | **100%** |

### 4.1 Preliminary Ranking Calculation
The official preliminary ranking is derived from the weighted segment ranks:
```
PreliminaryScore(candidate) = 
  (Rank of Production * 0.20) + 
  (Rank of School Uniform * 0.20) + 
  (Rank of Prof Attire * 0.20) + 
  (Rank of Modern Barong * 0.20) + 
  (Rank of Preliminary Q&A * 0.20)
```
- Candidates are sorted by lowest `PreliminaryScore` to highest.

### 4.2 Top 3 Cutoff & Preliminary Boundary Tie Handling

If two, three, or more candidates share an identical `PreliminaryScore` exactly at the Top 3 cutoff boundary:
- The system pauses and displays a **Preliminary Boundary Tie Override** panel on the Results page for all mathematically tied candidates.
- The judges confer offline to determine who advances.
- The admin uses the **"Advance to Top 3" override** (PIN-protected) to manually mark which candidates advance and which are excluded.
- This decision is saved permanently to the `stage_resolutions` table.
- No scoring segment is opened for preliminary ties.

---

## 5. Championship Rule (Final Winner)

Applies only to the Top 3 finalists.

```
ChampionshipScore(candidate) =
  ( PreliminaryScore * 0.50 )
+ ( Final QA Rank * 0.50 )
```
- **Rank 1 → Mr. / Ms. IDSC 2026 (Champion)**
- **Rank 2 → 1st Runner-Up**
- **Rank 3 → 2nd Runner-Up**

### 5.1 Finals Tie-Break

After the 50/50 formula is computed for the 3 finalists, if two or more finalists share an identical `ChampionshipScore` (`final_score`):
- The system automatically sets `isInTiebreak = true` on all tied finalists.
- The admin opens the **Tie-Breaking Q&A** segment from the Dashboard.
- Judges score **only the flagged finalists**.
- The tiebreak Q&A score (Borda-ranked among the tied candidates only) determines their final placement relative to each other.
- If the Tie-Breaking Q&A also ties: **Manual Admin Override** (admin picks winner with PIN).

---

## 6. Minor Awards (Simple Average)

Minor awards are **completely excluded** from the main Borda Count engine. They are evaluated using a Simple Average of raw scores.

- **Best in Advocacy:** Separate segment scheduled by admin. Simple Average scoring.
- **Best in Ramp:** Separate segment scheduled by admin. Simple Average scoring.

```
MinorAwardScore(candidate, segment) = 
  Σ RawScore(judge_i, candidate, segment) / Number of Judges
```
- If a tie occurs in a Minor Award, it uses raw score sum as a tie breaker. If it still ties, it goes to manual admin override.

---

## 7. Criteria Breakdown (For Raw Score Calculations)

### 7.1 Best in Advocacy (Minor Award)
| Criterion | Weight |
|-----------|--------|
| Relevance & Alignment | 30% |
| Content & Substance | 25% |
| Clarity & Organization | 25% |
| Delivery & Impact | 20% |

### 7.2 Best in Ramp (Minor Award)
| Criterion | Weight |
|-----------|--------|
| Poise & Posture | 30% |
| Confidence & Stage Presence | 30% |
| Runway Technique | 25% |
| Overall Impact | 15% |

### 7.3 Tie-Breaking Q&A (Dynamic Segment)
| Criterion | Weight |
|-----------|--------|
| Content & Substance | 40% |
| Clarity & Organization | 25% |
| Confidence & Delivery | 20% |
| Relevance | 15% |
