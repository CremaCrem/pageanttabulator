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
  preliminaryRank?:  number;
  preliminaryStatus: 'advancing' | 'excluded' | 'pending_override' | 'pending';
  finalQaScore?:     number;
  finalScore?:       number;
  rank?:             number;
  computedAt:        string;
}
