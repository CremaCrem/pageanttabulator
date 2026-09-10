import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useAppContext } from '../../context/AppContext';
import { fetchApi, getApiBaseUrl } from '../../api/client';
import { IJudge, IEventConfig, UserRole } from '../../types';

export const JudgeSelectPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  const [judges, setJudges] = useState<IJudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passwordPrompt, setPasswordPrompt] = useState<{ isOpen: boolean; judgeId: string; }>({ isOpen: false, judgeId: '' });
  const [passwordInput, setPasswordInput] = useState('');

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

  const handleClaim = async (judgeId: string, providedPassword?: string) => {
    try {
      const existingToken = localStorage.getItem('judgeSessionToken');
      
      const res = await fetchApi('/api/judges/session', {
        method: 'POST',
        body: JSON.stringify({ 
          judgeId, 
          password: providedPassword,
          deviceToken: existingToken || undefined 
        })
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
      if (err.message && err.message.toLowerCase().includes('password')) {
        setError(err.message);
      } else {
        setError(err.message || 'Failed to claim judge slot');
      }
    }
  };

  const onJudgeClick = (judgeId: string) => {
    setError('');
    const targetJudge = judges.find(j => j.id === judgeId);
    if (targetJudge && targetJudge.password) {
      setPasswordPrompt({ isOpen: true, judgeId });
      setPasswordInput('');
    } else {
      handleClaim(judgeId);
    }
  };

  const judgeCount = state.eventConfig?.judgeCount || 5;

  return (
    <PageWrapper className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-neutral-50">
      <div className="bg-white p-8 rounded-xl shadow-panel max-w-xl w-full text-center">
        <h1 className="text-heading-2 mb-2 text-primary-900">Welcome, Judge</h1>
        <p className="text-neutral-500 mb-8">Please select your assigned judge number to begin scoring.</p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-neutral-400 animate-pulse">Loading event configuration...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: judgeCount }).map((_, i) => {
              const jId = `J${i + 1}`;
              const judge = judges.find(j => j.id === jId);
              const isClaimed = judge?.isActive;
              
              return (
                <button 
                  key={jId}
                  onClick={() => onJudgeClick(jId)}
                  className={`p-6 border-2 rounded-xl transition-all font-semibold flex flex-col items-center justify-center gap-3
                    ${isClaimed 
                      ? 'border-yellow-300 bg-yellow-50 hover:bg-yellow-100 hover:border-yellow-400' 
                      : 'border-neutral-200 hover:border-primary-500 hover:bg-primary-50 shadow-sm bg-white'}
                  `}
                >
                  {judge?.photoPath ? (
                    <img src={`${getApiBaseUrl()}${judge.photoPath}`} alt={judge?.name || jId} className="w-16 h-16 rounded-full object-cover border-2 border-neutral-200" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 font-bold border-2 border-neutral-300">
                      {jId}
                    </div>
                  )}
                  
                  <div className="text-center">
                    <div className={`text-lg ${isClaimed ? 'text-yellow-800' : 'text-neutral-800'}`}>
                      {judge?.name || `Judge ${i + 1}`}
                    </div>
                    {isClaimed && <div className="text-xs font-normal mt-1 text-yellow-600 opacity-80">(Already Active)</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {passwordPrompt.isOpen && (
        <div className="fixed inset-0 bg-neutral-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-100 bg-neutral-50">
              <h2 className="text-xl font-bold text-primary-900 text-center">Enter Password</h2>
              <p className="text-neutral-500 text-sm text-center mt-1">This judge slot requires a password.</p>
            </div>
            <div className="p-6">
              <input 
                type="password" 
                value={passwordInput} 
                onChange={e => setPasswordInput(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setPasswordPrompt({ isOpen: false, judgeId: '' });
                    handleClaim(passwordPrompt.judgeId, passwordInput);
                  }
                }}
                className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-center text-xl tracking-widest" 
                autoFocus
              />
              <div className="flex gap-3 justify-center mt-6">
                <button 
                  onClick={() => setPasswordPrompt({ isOpen: false, judgeId: '' })} 
                  className="px-5 py-2.5 text-neutral-600 font-medium hover:bg-neutral-100 rounded-lg transition-colors flex-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setPasswordPrompt({ isOpen: false, judgeId: '' });
                    handleClaim(passwordPrompt.judgeId, passwordInput);
                  }} 
                  className="px-5 py-2.5 bg-primary-600 text-white font-medium hover:bg-primary-700 rounded-lg transition-colors shadow-sm flex-1"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
};
