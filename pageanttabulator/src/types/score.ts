import { SegmentId } from './enums';

export interface ICriterionEntry {
  criterionId: string;
  score:       number;
}

export interface ISegmentScore {
  id:             string;
  judgeId:        string;
  candidateId:    string;
  segmentId:      SegmentId;
  criteriaEntries: ICriterionEntry[];
  computedScore:  number;
  submittedAt:    string;
}
