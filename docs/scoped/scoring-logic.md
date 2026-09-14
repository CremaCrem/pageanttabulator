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

If 3rd and 4th place share an identical `PreliminaryScore` AND raw-score tiebreaker:
- The system displays a **Preliminary Boundary Tie Override** panel on the Results page.
- The judges confer offline to determine who advances.
- The admin uses the **"Advance to Top 3" override** (PIN-protected) to manually mark the winner.
- The other tied candidate is simultaneously removed from Top 3.
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

After the 50/50 formula is computed for the 3 finalists, if two finalists share an identical `final_score`:
- The system automatically sets `isInTiebreak = true` on those tied finalists.
- The admin opens the **Tie-Breaking Q&A** segment from the Dashboard.
- Judges score **only the flagged finalists**.
- The tiebreak Q&A score (Borda-ranked among tied candidates only) determines final placement.
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
