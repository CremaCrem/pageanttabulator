# PageantTabulator: Current System State

This document explains how the core tabulation logic works "under the hood" as of the final architectural cleanup. If you've been away from the code for a while, read this to get re-oriented.

## 1. The Computation Engine (`admin_routes.rs`)
The `compute_results` function is the heart of the system. Instead of one massive block of code, it acts as a router that delegates to five strictly-focused helper functions:

- **`compute_preliminary_results`**: Pulls all judge scores for the first 5 segments, converts them to Borda ranks, assigns a `preliminary_rank`, and checks if a manual tie-breaker is needed to select the Top 3.
- **`compute_finals_results`**: Pulls the `preliminary_rank` and the Final Q&A scores. It combines them 50/50 to generate a `final_score`, assigns an overall `rank`, and detects if the top winners are perfectly tied.
- **`compute_tiebreak_results`**: If the top winners tie in the finals, this function applies the Tie-Breaking Q&A scores to strictly reorder them, ensuring there's only one Champion.
- **`compute_minor_awards_results`**: Ranks candidates based exclusively on the Best in Advocacy and Best in Ramp segments and saves the winners.
- **`save_computation_results`**: A shared helper that safely writes the calculated results to the SQLite database.

## 2. Ranks: Preliminary vs. Overall
In the database's `results` table, there are two distinct rank columns. This prevents them from overwriting each other when calculations are run multiple times:

- **`preliminary_rank`**: Stored exactly once during the Preliminary computation. It is the fixed, unchanging Borda rank (e.g., 1st, 2nd, 3rd) based on the first 5 segments.
- **`rank`**: The Final Overall Placement (e.g., Champion, 1st Runner-Up). It is generated during the Finals computation and is the *only* rank the audience and judges care about at the end of the night.

## 3. The `stage_resolutions` Table
This table acts as the system's memory for human decisions. 
When candidates perfectly tie at the boundary of the Top 3 (e.g., three candidates tie for 3rd place), the system stops and forces the Admin to manually pick who advances using their PIN. 
Once the Admin decides, that choice is saved in `stage_resolutions`. If the server crashes or the computation is re-run, the system looks at this table and *remembers* the human decision, ensuring the manual tie-breaker pop-up doesn't annoyingly appear again.

## 4. Understanding `preliminary_status`
Every candidate gets a `preliminary_status` that dictates what happens to them next. There are four possible values:

- **`pending`**: The default state. Scores are still coming in, or computation hasn't finished yet.
- **`advancing`**: The candidate safely made it into the Top 3 and will proceed to the Final Q&A.
- **`excluded`**: The candidate did not make the Top 3. Their journey ends here.
- **`pending_override`**: A mathematical tie occurred right at the Top 3 cutoff boundary. The system is paused and waiting for the Admin to use their PIN to manually `advance` or `exclude` them.
