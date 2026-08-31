import { ISession, IEventConfig, IRoundState, SegmentId, WSServerMessage } from './index';


export interface UIState {
  session:         ISession | null;
  eventConfig:     IEventConfig | null;
  isServerReady:   boolean;
  activeSegmentId: SegmentId | null;
  roundStates:     IRoundState[];
}

export type UIAction =
  | { type: 'SET_SESSION';         payload: ISession | null }
  | { type: 'CLEAR_SESSION' }
  | { type: 'SET_EVENT_CONFIG';    payload: IEventConfig }
  | { type: 'SET_SERVER_READY';    payload: boolean }
  | { type: 'SET_ROUND_STATES';    payload: IRoundState[] }
  | { type: 'SET_ACTIVE_SEGMENT';  payload: SegmentId | null }
  | { type: 'APPLY_WS_EVENT';      payload: WSServerMessage };
