import { UserRole, SegmentId, Gender } from './enums';
import { ICandidateResult } from './results';

// Direction: Client -> Server
export type WSClientMessage =
  | { type: 'IDENTIFY'; role: UserRole; judgeId?: string }
  | { type: 'PING' };

// Direction: Server -> Client
export type WSServerMessage =
  | { type: 'SEGMENT_OPENED';      segmentId: SegmentId; segmentLabel: string }
  | { type: 'SEGMENT_LOCKED';      segmentId: SegmentId }
  | { type: 'SCORE_SUBMITTED';     judgeId: string; candidateId: string; segmentId: SegmentId }
  | { type: 'JUDGE_CONNECTED';     judgeId: string }
  | { type: 'JUDGE_DISCONNECTED';  judgeId: string }
  | { type: 'SESSION_REVOKED';     judgeId: string }
  | { type: 'RANKINGS_UPDATED';    category: Gender; topCandidates: ICandidateResult[] }
  | { type: 'TOP3_ANNOUNCED';      male: ICandidateResult[]; female: ICandidateResult[] }
  | { type: 'FINAL_RESULTS_READY'; winners: ICandidateResult[] }
  | { type: 'SYSTEM_MESSAGE';      level: 'info' | 'warning'; message: string };
