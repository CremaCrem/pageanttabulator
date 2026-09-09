import { SegmentId } from './enums';

export interface ISegmentAverage {
  segmentId:    SegmentId;
  avgScore:     number;
  judgeCount:   number;
}

export interface ISegmentBreakdown {
  candidateId:   string;
  segmentId:     string;
  rankSum:       number;
  rawScoreSum:   number;
  finalRank:     number;
}

export interface ICandidateResult {
  candidateId:       string;
  segmentId?:        string;
  preliminaryScore?: number;
  finalQaScore?:     number;
  finalScore?:       number;
  rank?:             number;
  isTop3:            boolean;
  computedAt:        string;
}
