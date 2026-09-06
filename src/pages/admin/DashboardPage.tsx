import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { IRoundState, SegmentId, RoundStatus } from '../../types';
import { SEGMENTS } from '../../utils/constants';
import { useAppContext } from '../../context/AppContext';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

export const DashboardPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<SegmentId | null>(null);

  // Pin verification state
  const [pinPrompt, setPinPrompt] = useState<SegmentId | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, segmentId: SegmentId | null}>({
    isOpen: false,
    segmentId: null
  });

  const loadRounds = async () => {
    try {
      const data: IRoundState[] = await fetchApi('/api/rounds');
      dispatch({ type: 'SET_ROUND_STATES', payload: data });
    } catch (err: any) {
      setError('Failed to load segment states');
    }
  };

  useEffect(() => {
    loadRounds();
  }, [dispatch]);

  const handleOpenRoundClick = (segmentId: SegmentId) => {
    setConfirmConfig({ isOpen: true, segmentId });
  };

  const handleOpenRoundConfirm = async () => {
    const { segmentId } = confirmConfig;
    if (!segmentId) return;
    
    setConfirmConfig({ ...confirmConfig, isOpen: false });
    setActionLoading(segmentId);
    setError('');
    try {
      await fetchApi('/api/rounds/open', {
        method: 'POST',
        body: JSON.stringify({ segmentId })
      });
      // The WebSocket will broadcast SEGMENT_OPENED, but we can also reload manually
      await loadRounds();
    } catch (err: any) {
      setError(err.message || 'Failed to open segment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLockRound = async (segmentId: SegmentId) => {
    if (!pin) {
      setPinError('PIN is required');
      return;
    }
    setActionLoading(segmentId);
    setPinError('');
    try {
      // 1. Verify PIN
      const verifyRes = await fetchApi('/api/admin/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin })
      });
      
      if (!verifyRes.valid) {
        setPinError('Invalid Admin PIN');
        setActionLoading(null);
        return;
      }

      // 2. Lock Round
      await fetchApi('/api/rounds/lock', {
        method: 'POST',
        body: JSON.stringify({ segmentId })
      });
      
      setPinPrompt(null);
      setPin('');
      await loadRounds();
    } catch (err: any) {
      setPinError(err.message || 'Failed to lock segment');
    } finally {
      setActionLoading(null);
    }
  };

  // Convert array to map for easy lookup
  const roundsMap = state.roundStates.reduce((acc, curr) => {
    acc[curr.segmentId] = curr;
    return acc;
  }, {} as Record<SegmentId, IRoundState>);

  const hasOpenSegment = state.roundStates.some(r => r.status === RoundStatus.Open);

  return (
    <PageWrapper>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-heading-1 text-primary-900">Live Dashboard</h1>
          <p className="text-neutral-500">Control the flow of the pageant and unlock segments for judges.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.values(SEGMENTS).map(segment => {
          const state = roundsMap[segment.id];
          const status = state?.status || RoundStatus.NotStarted;
          
          return (
            <div key={segment.id} className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-neutral-800">{segment.label}</h3>
                  <div className="text-sm text-neutral-500 mt-1">Weight: {segment.preliminaryWeight * 100}%</div>
                </div>
                <div>
                  {status === RoundStatus.NotStarted && <span className="px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-xs font-bold uppercase tracking-wide">Not Started</span>}
                  {status === RoundStatus.Open && <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold uppercase tracking-wide animate-pulse">Live / Open</span>}
                  {status === RoundStatus.Locked && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wide">Completed</span>}
                </div>
              </div>

              <div className="flex-1"></div>

              <div className="mt-6 pt-4 border-t border-neutral-100">
                {status === RoundStatus.NotStarted && (
                  <button 
                    onClick={() => handleOpenRoundClick(segment.id)}
                    disabled={actionLoading !== null || hasOpenSegment}
                    className={`w-full py-2 font-semibold rounded transition-colors disabled:opacity-50 ${
                      hasOpenSegment 
                        ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700 text-white'
                    }`}
                    title={hasOpenSegment ? 'Another segment is currently open. Please lock it first.' : ''}
                  >
                    {actionLoading === segment.id ? 'Opening...' : 'Open Segment for Judging'}
                  </button>
                )}

                {status === RoundStatus.Open && (
                  <div>
                    {pinPrompt === segment.id ? (
                      <div className="flex flex-col space-y-2">
                        <input 
                          type="password" 
                          placeholder="Admin PIN" 
                          value={pin}
                          autoFocus
                          onChange={e => setPin(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              handleLockRound(segment.id);
                            }
                          }}
                          className="w-full p-2 border border-neutral-300 rounded focus:border-red-500 outline-none"
                        />
                        {pinError && <div className="text-xs text-red-600 font-semibold">{pinError}</div>}
                        <div className="flex space-x-2">
                          <button 
                            type="button"
                            onClick={() => handleLockRound(segment.id)}
                            disabled={actionLoading === segment.id}
                            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded transition-colors disabled:opacity-50"
                          >
                            {actionLoading === segment.id ? 'Locking...' : 'Confirm Lock'}
                          </button>
                          <button 
                            type="button"
                            onClick={() => { setPinPrompt(null); setPin(''); setPinError(''); }}
                            className="flex-1 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-semibold rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setPinPrompt(segment.id)}
                        className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded transition-colors"
                      >
                        Lock Segment (Requires PIN)
                      </button>
                    )}
                  </div>
                )}

                {status === RoundStatus.Locked && (
                  <div className="text-center text-sm font-semibold text-neutral-500 py-2">
                    Scores Locked
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title="Open Segment"
        message="Are you sure you want to open this segment for scoring?"
        confirmText="Yes, Open Segment"
        onConfirm={handleOpenRoundConfirm}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />
    </PageWrapper>
  );
};
