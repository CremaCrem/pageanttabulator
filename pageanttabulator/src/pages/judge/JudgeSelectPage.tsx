import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useAppContext } from '../../context/AppContext';
import { fetchApi } from '../../api/client';
import { IJudge, IEventConfig, UserRole } from '../../types';

export const JudgeSelectPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  const [judges, setJudges] = useState<IJudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // If the judge is already in a session, redirect to scoring
    if (state.session?.role === UserRole.Judge && state.session.judgeId) {
      navigate('/score');
      return;
    }

    const checkExistingSession = async (): Promise<boolean> => {
      const storedToken = localStorage.getItem('judgeSessionToken');
      const storedJudgeId = localStorage.getItem('judgeId');
      if (storedToken && storedJudgeId) {
        try {
          const res = await fetchApi('/api/judges/session/verify', {
            method: 'POST',
            body: JSON.stringify({ judgeId: storedJudgeId, sessionToken: storedToken })
          });
          if (res.valid) {
            dispatch({
              type: 'SET_SESSION',
              payload: { role: UserRole.Judge, judgeId: storedJudgeId, sessionToken: storedToken, startedAt: new Date().toISOString() }
            });
            // We do not navigate here because state.session update will trigger this useEffect again and hit the block above
            return true;
          }
        } catch (e) {
          console.error("Session verification failed", e);
          // If invalid, clear it
          localStorage.removeItem('judgeSessionToken');
          localStorage.removeItem('judgeId');
        }
      }
      return false;
    };

    const loadData = async () => {
      try {
        setLoading(true);
        const hasSession = await checkExistingSession();
        if (hasSession) return; // Skip loading judge selection UI if we are auto-logging in
        
        // Fetch event config if not present
        if (!state.eventConfig) {
          const config: IEventConfig = await fetchApi('/api/event');
          if (config && config.id) {
             dispatch({ type: 'SET_EVENT_CONFIG', payload: config });
          }
        }
        
        // Fetch judges
        const judgeData: IJudge[] = await fetchApi('/api/judges');
        setJudges(judgeData);
      } catch (err: any) {
        setError(err.message || 'Failed to load setup data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [state.session, state.eventConfig, dispatch, navigate]);

  const handleClaim = async (judgeId: string) => {
    try {
      // Pass the existing deviceToken if we have one, to allow re-claiming
      const existingToken = localStorage.getItem('judgeSessionToken');
      
      const res = await fetchApi('/api/judges/session', {
        method: 'POST',
        body: JSON.stringify({ judgeId, deviceToken: existingToken || undefined })
      });
      
      // Save to localStorage
      localStorage.setItem('judgeSessionToken', res.sessionToken);
      localStorage.setItem('judgeId', judgeId);
      
      dispatch({ 
        type: 'SET_SESSION', 
        payload: { role: UserRole.Judge, judgeId, sessionToken: res.sessionToken, startedAt: new Date().toISOString() } 
      });
      
      navigate('/score');
    } catch (err: any) {
      setError(err.message || 'Failed to claim judge slot');
    }
  };

  const judgeCount = state.eventConfig?.judgeCount || 5;

  return (
    <PageWrapper className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-neutral-50">
      <div className="bg-white p-8 rounded-xl shadow-panel max-w-xl w-full text-center">
        <h1 className="text-heading-2 mb-2 text-primary-900">Welcome, Judge</h1>
        <p className="text-neutral-500 mb-8">Please select your assigned judge number to begin scoring.</p>
        
        {error && (
          <div className="mb-6 p-4 bg-error-50 text-error-700 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-neutral-400 animate-pulse">Loading event configuration...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: judgeCount }).map((_, i) => {
              const jId = `J${i + 1}`;
              const isClaimed = judges.some(j => j.id === jId && j.isActive);
              
              return (
                <button 
                  key={jId}
                  onClick={() => handleClaim(jId)}
                  className={`p-6 border-2 rounded-xl transition-all font-semibold text-lg
                    ${isClaimed 
                      ? 'border-warning-300 bg-warning-50 text-warning-700 hover:bg-warning-100 hover:border-warning-400' 
                      : 'border-neutral-200 hover:border-primary-500 hover:bg-primary-50 text-neutral-700 shadow-sm'}
                  `}
                >
                  <div className="text-xl">Judge {i + 1}</div>
                  {isClaimed && <div className="text-xs font-normal mt-1 text-warning-600 opacity-80">(Already Active)</div>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PageWrapper>
  );
};
