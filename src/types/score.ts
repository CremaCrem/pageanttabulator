import { SegmentId } from './enums';

export interface ICriterionEntry {
  criterionId: string;
  score:       number;
}

export interface ISegmentScore {
  id:             string;
  judgeId:        string;
  judgeName?:     string;
  candidateId:    string;
  segmentId:      SegmentId;
  criteriaEntries: ICriterionEntry[];
  computedScore:  number;
  submittedAt:    string;
}

/**
 * Admin correction of a judge's already-submitted score, on the judge's behalf.
 * See docs/scoped/scoring-logic.md §2.1 — judges can never edit their own score.
 */
export interface IScoreCorrectionRequest {
  pin:             string;
  judgeId:         string;
  candidateId:     string;
  segmentId:       string;
  criteriaEntries: ICriterionEntry[];
  reason:          string;
}
