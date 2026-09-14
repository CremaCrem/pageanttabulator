import { SegmentId } from './enums';
import { ICriterionEntry } from './score';

export interface IApiError {
  error:   string;
  code?:   string;
}

export interface ISubmitScoreRequest {
  judgeId:         string;
  candidateId:     string;
  segmentId:       SegmentId;
  criteriaEntries: ICriterionEntry[];
}

export interface ISubmitScoreResponse {
  scoreId:       string;
  computedScore: number;
  submittedAt:   string;
}

export interface IClaimJudgeSessionRequest {
  judgeId: string;
  password?: string;
  deviceToken?: string;
}

export interface IUpdateJudgeProfileRequest {
  name?: string;
  photoPath?: string;
  password?: string;
}

export interface IOpenRoundRequest {
  segmentId: SegmentId;
}

export interface ILockRoundRequest {
  segmentId: SegmentId;
}

export interface IComputeResultsRequest {
  round: 'preliminary' | 'final';
}

export interface IVerifyPinRequest {
  pin: string;
}

export interface IVerifyPinResponse {
  valid: boolean;
}

export interface IAdvanceTop3Request {
  isTop3: boolean;
}
