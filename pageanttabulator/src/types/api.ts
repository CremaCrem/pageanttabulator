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
