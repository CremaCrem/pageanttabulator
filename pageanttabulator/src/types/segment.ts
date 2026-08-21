import { SegmentId, RoundStatus } from './enums';

export interface ICriterion {
  id:     string;
  label:  string;
  weight: number;
}

export interface ISegment {
  id:                 SegmentId;
  label:              string;
  roundStatus:        RoundStatus;
  preliminaryWeight:  number;
  criteria:           ICriterion[];
}
