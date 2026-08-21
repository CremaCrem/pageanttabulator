import { Gender, SegmentId } from './enums';

export interface ISegmentAverage {
  segmentId:    SegmentId;
  avgScore:     number;
  judgeCount:   number;
}

export interface ICandidateResult {
  candidateId:       string;
  gender:            Gender;
  segmentAverages:   ISegmentAverage[];
  preliminaryScore:  number;
  isTop5:            boolean;
  finalQAScore?:     number;
  finalScore?:       number;
  rank?:             number;
  awardTitle?:       string;
}
