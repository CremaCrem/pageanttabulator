# Scoring Logic — PageantTabulator

> **This document is the mathematical and algorithmic specification for all scoring in the PageantTabulator.**  
> All scoring computation happens **server-side in Rust** — `src-tauri/src/scoring/compute.rs` is the implementation file.  
> The React frontend may display a **live preview** of the weighted total as the judge types, but this is cosmetic. The server recomputes authoritatively on every score submission.  
> Reference: `Mr.Ms.IDSC_Official-Guidelines_Version-1.docx`

---

## 1. Competition Overview

The Mr. and Ms. IDSC 2026 competition is divided into two major rounds:

| Round | Description | Score Weight |
|-------|-------------|-------------|
| **Preliminary Round** | Four segments + Preliminary Q&A | 50% of Final Score |
| **Final Round** | Final Q&A (Top 5 only) | 50% of Final Score |

---

## 2. Score Entry Rules

- All criteria scores are entered on a **scale of 1 to 100** (integers only, no decimals at input).
- Judges enter **one score per criterion** per candidate per segment.
- The weighted score per criterion is computed automatically — judges do not enter weighted values.
- A score of `0` is **not valid** — minimum valid score is `1`.

---

## 3. Preliminary Round — Four Segments

Each of the four segments contributes **25%** to the candidate's preliminary round score.

### 3.1 Segment Weights

| Segment | Preliminary Weight |
|---------|-------------------|
| Production Number | 25% |
| School Uniform | 25% |
| Professional Attire | 25% |
| Modern Barong / Filipiniana | 25% |
| **Total** | **100%** |

### 3.2 Segment Criteria Breakdown

#### Segment 1: Production Number (25% of Preliminary)

| Criterion | Weight |
|-----------|--------|
| Stage Presence & Confidence | 40% |
| Energy & Performance Impact | 30% |
| Audience Engagement | 20% |
| Overall Appeal | 10% |
| **Total** | **100%** |

#### Segment 2: School Uniform (25% of Preliminary)

| Criterion | Weight |
|-----------|--------|
| Neatness & Proper Wearing of Uniform | 25% |
| Confidence, Bearing & Poise | 25% |
| Advocacy Statement / Message Impact | 25% |
| Overall Impact | 25% |
| **Total** | **100%** |

#### Segment 3: Professional Attire (25% of Preliminary)

| Criterion | Weight |
|-----------|--------|
| Elegance & Professionalism | 35% |
| Suitability of Attire | 25% |
| Confidence & Stage Presence | 20% |
| Overall Impact | 20% |
| **Total** | **100%** |

#### Segment 4: Modern Barong / Filipiniana (25% of Preliminary)

| Criterion | Weight |
|-----------|--------|
| Elegance & Poise | 35% |
| Suitability & Creativity of Attire | 25% |
| Confidence & Stage Presence | 20% |
| Overall Impact | 20% |
| **Total** | **100%** |

---

## 4. Preliminary Q&A Segment

> The Preliminary Q&A is used to **select the Top 5** per category. It uses the same criteria as the Final Q&A.

**Applies to:** All candidates (full roster)  
**Purpose:** Determines Top 5 Male and Top 5 Female

| Criterion | Weight |
|-----------|--------|
| Content & Substance of Answer | 40% |
| Clarity & Organization of Ideas | 25% |
| Confidence & Delivery | 20% |
| Relevance to the Question | 15% |
| **Total** | **100%** |

> **IMPORTANT:** As clarified by the organizing committee, the Preliminary Q&A score is the **sole determinant** for the Preliminary Round cumulative score, which is used to select the Top 5. The other 4 segments (Production, Uniform, Professional, Modern Barong) are evaluated entirely independently and are used *only* for determining the Special Awards ("Best in X"). They do not factor into the Top 5 selection or the Final Score.

---

## 5. Final Q&A Segment

**Applies to:** Top 5 per category (Male / Female) only  
**Purpose:** Determines the final ranking (Top 3 / winners)

| Criterion | Weight |
|-----------|--------|
| Content & Substance of Answer | 40% |
| Clarity & Organization of Ideas | 25% |
| Confidence & Delivery | 20% |
| Relevance to the Question | 15% |
| **Total** | **100%** |

---

## 6. Score Computation Formulas

### 6.1 Single Judge — Segment Score for One Candidate

```
SegmentScore(judge, candidate, segment) =
  Σ ( CriterionScore(n) × CriterionWeight(n) )
  for each criterion n in the segment
```

**Example — Production Number:**
```
Stage Presence score = 85  →  85 × 0.40 = 34.00
Energy score         = 78  →  78 × 0.30 = 23.40
Audience Engagement  = 80  →  80 × 0.20 = 16.00
Overall Appeal       = 82  →  82 × 0.10 =  8.20
                                          ──────
SegmentScore         =                    81.60
```

### 6.2 Multi-Judge Average — Segment Score

```
AvgSegmentScore(candidate, segment) =
  Σ SegmentScore(judge_i, candidate, segment)
  ─────────────────────────────────────────
           Number of Judges
```

### 6.3 Preliminary Round Score (For Top 5 Selection)

```
PreliminaryScore(candidate) = AvgSegmentScore(candidate, PreliminaryQA)
```
> *Note: The Preliminary Score used to select the Top 5 and used in the Championship 50/50 split is derived **exclusively** from the Preliminary Q&A segment.*

### 6.3.1 Special Awards Computation

The four other preliminary segments are computed independently to determine the "Best in X" special awards per category (Male/Female):
- Best in Production Number = Highest `AvgSegmentScore(candidate, ProductionNumber)`
- Best in School Uniform = Highest `AvgSegmentScore(candidate, SchoolUniform)`
- Best in Professional Attire = Highest `AvgSegmentScore(candidate, ProfessionalAttire)`
- Best in Modern Barong/Filipiniana = Highest `AvgSegmentScore(candidate, ModernBarong)`

### 6.4 Final Q&A Score

```
FinalQAScore(candidate) =
  Σ ( CriterionScore(n) × CriterionWeight(n) )
  for each criterion n in Final Q&A
  averaged across all judges
```

### 6.5 Final Overall Score (Championship Rule)

```
FinalScore(candidate) =
  ( PreliminaryScore(candidate) × 0.50 )
+ ( FinalQAScore(candidate)     × 0.50 )
```

---

## 7. Ranking & Selection Rules

### 7.1 Top 5 Selection (from Preliminary Round)

```
Top5Male   = Top 5 male candidates ranked by PreliminaryScore (descending)
Top5Female = Top 5 female candidates ranked by PreliminaryScore (descending)
```

- **Tie-breaking:** If two candidates have the same PreliminaryScore (to 2 decimal places), both advance (expand the Top 5 to Top 6 if needed) — flagged for manual admin review.
- Categories are always evaluated separately. Male and female rankings never mix.

### 7.2 Final Winners (from Final Round)

```
Winners = Top 3 from Top5 ranked by FinalScore (descending)

Rank 1 → Mr. / Ms. IDSC 2026 (Champion)
Rank 2 → 1st Runner-Up
Rank 3 → 2nd Runner-Up
```

---

## 8. TypeScript Interface Definitions

```typescript
// Score for a single criterion
interface ICriterionScore {
  criterionId: string;
  score: number;         // 1–100
  weight: number;        // 0.0–1.0 (e.g., 0.40 for 40%)
}

// Score from one judge for one segment
interface ISegmentScore {
  judgeId: string;
  candidateId: string;
  segmentId: string;
  criteria: ICriterionScore[];
  computedScore: number;   // Weighted total (computed, not entered)
  isSubmitted: boolean;
  submittedAt?: string;    // ISO timestamp
}

// Aggregate scores for one candidate
interface ICandidateScore {
  candidateId: string;
  segmentScores: Record<string, number>;    // segmentId → avg across judges
  preliminaryScore: number;                 // Weighted sum of all segment avgs
  finalQAScore?: number;                    // Only set after final round
  finalScore?: number;                      // Only set after championship rule applied
  rank?: number;                            // 1-indexed, per category
  category: 'male' | 'female';
}
```

---

## 9. Validation Rules

| Rule | Constraint |
|------|-----------|
| Minimum score | `score >= 1` |
| Maximum score | `score <= 100` |
| Type | Integer (no decimals) |
| Required | All criteria must be filled before submission |
| Completeness | All judges must submit before round can be locked |

---

## 10. Special Awards Scoring

Special awards are judged independently from the main competition.

| Award | Basis |
|-------|-------|
| Best in Production Number | Highest SegmentScore in Production Number segment |
| Best in School Uniform | Highest SegmentScore in School Uniform segment |
| Best in Professional Attire | Highest SegmentScore in Professional Attire segment |
| Best in Modern Barong / Filipiniana | Highest SegmentScore in Modern Barong segment |
| Best in Advocacy | Separate advocacy criterion from School Uniform segment |
| Mr./Ms. Spirit Award | Judged separately by committee — not computed |
| Mr./Ms. Photogenic | Selected separately — not scored in app |
| People's Choice Award | Based on Facebook reactions — entered manually |
| Mr./Ms. Congeniality | Selected by candidates themselves — entered manually |
| Best in Ramp | Judged separately — not computed |

- Special awards derived from segment scores are automatically determined from existing data.
- Manually awarded special awards are entered by admin in the Special Awards section.

---

## 11. Rounding Rules

- Intermediate calculations are carried to **4 decimal places** internally.
- Displayed scores are **rounded to 2 decimal places** for UI display.
- Rankings are determined using the **full precision (4 decimal)** value to minimize ties.
- All rounding uses **standard mathematical rounding** (round half up): `Math.round(value * 10000) / 10000`.

---

## 12. Implementation Reference

### Server-Side (Authoritative) — Rust

All formulas are implemented in:
```
src-tauri/src/scoring/compute.rs   ← SINGLE SOURCE OF TRUTH
src-tauri/src/scoring/ranking.rs   ← Ranking and Top 5 selection
```

Key Rust functions:

| Function | Description |
|----------|-------------|
| `compute_segment_score(entries)` | Computes weighted segment score from judge's criterion entries |
| `compute_avg_segment_score(judge_scores)` | Averages segment scores across all judges |
| `compute_preliminary_score(segment_avgs)` | Applies 25% segment weights to produce preliminary total |
| `compute_final_qa_score(entries)` | Computes Final Q&A weighted score |
| `compute_final_score(prelim, final_qa)` | Applies 50/50 championship rule |
| `rank_candidates(candidates, gender)` | Sorts candidates by score per gender category |
| `select_top5(candidates)` | Returns Top 5 male + Top 5 female from preliminary scores |

### Client-Side (Preview Only) — TypeScript

A lightweight preview function exists in the React frontend for live display:
```
src/utils/validation.ts → validateScoreRange(score)
src/utils/formatters.ts → formatScore(value) — rounds to 2 decimal places for display
```

> **Do NOT use client-side values for any ranking, selection, or reporting purpose.**  
> Client preview is for judge UX only. Always use the server's `computedScore` field from API responses.

---

*Scoring Logic Version: 2.0 — August 21, 2026 (Revised: Computation authority moved to Rust server; client-side is preview only)*  
*Source Document: Mr.Ms.IDSC_Official-Guidelines_Version-1.docx*
