import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { UIState, UIAction, RoundStatus } from '../types';

interface AppContextType {
  state: UIState;
  dispatch: React.Dispatch<UIAction>;
}

const initialState: UIState = {
  session: null,
  eventConfig: null,
  isServerReady: false,
  activeSegmentId: null,
  roundStates: [],
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, session: action.payload };
    case 'CLEAR_SESSION':
      localStorage.removeItem('judgeSessionToken');
      localStorage.removeItem('judgeId');
      return { ...state, session: null, activeSegmentId: null };
    case 'SET_EVENT_CONFIG':
      return { ...state, eventConfig: action.payload };
    case 'SET_SERVER_READY':
      return { ...state, isServerReady: action.payload };
    case 'SET_ROUND_STATES':
      return { ...state, roundStates: action.payload };
    case 'SET_ACTIVE_SEGMENT':
      return { ...state, activeSegmentId: action.payload };
    case 'APPLY_WS_EVENT':
      // Handle real-time updates based on WebSocket events
      const wsMsg = action.payload;
      switch (wsMsg.type) {
        case 'SEGMENT_OPENED': {
          const updatedRounds = state.roundStates.map(r => 
            r.segmentId === wsMsg.segmentId ? { ...r, status: RoundStatus.Open } : r
          );
          return { ...state, roundStates: updatedRounds, activeSegmentId: wsMsg.segmentId };
        }
        case 'SEGMENT_LOCKED': {
          const updatedRounds = state.roundStates.map(r => 
            r.segmentId === wsMsg.segmentId ? { ...r, status: RoundStatus.Locked } : r
          );
          let newActive = state.activeSegmentId;
          if (newActive === wsMsg.segmentId) {
            // Find another open segment to fallback to
            const fallback = updatedRounds.find(r => r.status === RoundStatus.Open);
            newActive = fallback ? fallback.segmentId : null;
          }
          return { ...state, roundStates: updatedRounds, activeSegmentId: newActive };
        }
        case 'SESSION_REVOKED':
          // If the revoked session is ours, log out immediately
          if (state.session?.judgeId === wsMsg.judgeId) {
            localStorage.removeItem('judgeSessionToken');
            localStorage.removeItem('judgeId');
            return { ...state, session: null, activeSegmentId: null };
          }
          return state;
        // Other events (like SCORE_SUBMITTED) might update specific pieces of state
        default:
          return state;
      }
    default:
      return state;
  }
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
