import { SegmentId, RoundStatus, SegmentCategory } from './enums';

export interface ICriterion {
  id:     string;
  label:  string;
  weight: number;
}

export interface ISegment {
  id:                 SegmentId;
  category:           SegmentCategory;
  label:              string;
  roundStatus:        RoundStatus;
  preliminaryWeight:  number;
  criteria:           ICriterion[];
}
