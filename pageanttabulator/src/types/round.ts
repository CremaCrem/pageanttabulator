import { SegmentId, RoundStatus } from './enums';

export interface IRoundState {
  segmentId:  SegmentId;
  status:     RoundStatus;
  openedAt?:  string;
  lockedAt?:  string;
}
