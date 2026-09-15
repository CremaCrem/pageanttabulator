import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { IRoundState, SegmentId, RoundStatus, ICandidate } from '../../types';
import { SEGMENTS } from '../../utils/constants';
import { useAppContext } from '../../context/AppContext';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export const DashboardPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<SegmentId | null>(null);
  const [tieBreakNeeded, setTieBreakNeeded] = useState<{ male: boolean; female: boolean; reason: string } | null>(null);

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

  const checkTiebreakerNeeded = async () => {
    try {
      const candidates: ICandidate[] = await fetchApi('/api/candidates');
      const flaggedCount = candidates.filter(c => c.isInTiebreak).length;
      
      if (flaggedCount > 0) {
        setTieBreakNeeded({
          male: true, // We don't distinguish by gender here, just if ANY are flagged
          female: true,
          reason: `Finals tie detected. ${flaggedCount} finalists are flagged.`
        });
      } else {
        setTieBreakNeeded({
          male: false,
          female: false,
          reason: 'No finals tie detected. Compute final results first. If a tie exists, finalists will be automatically flagged.'
        });
      }
    } catch {
      // Results not available yet
    }
  };

  useEffect(() => {
    loadRounds();
    checkTiebreakerNeeded();
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
        <Alert variant="error" className="mb-6">{error}</Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.values(SEGMENTS).filter(s => s.id !== SegmentId.BestAdvocacy && s.id !== SegmentId.BestInRamp).map(segment => {
          const state = roundsMap[segment.id];
          const status = state?.status || RoundStatus.NotStarted;
          
          return (
            <div key={segment.id} className={`bg-white p-6 rounded-xl shadow-panel border flex flex-col ${
              segment.id === SegmentId.TieBreakingQA ? 'border-amber-200 bg-amber-50/40' : 'border-neutral-100'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-neutral-800">{segment.label}</h3>
                  <div className="text-sm text-neutral-500 mt-1">
                    {segment.id === SegmentId.TieBreakingQA
                      ? 'Emergency segment — only if a Top-3 boundary tie exists'
                      : `Weight: ${segment.preliminaryWeight * 100}%`}
                  </div>
                </div>
                <div>
                  {status === RoundStatus.NotStarted && <span className="px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-xs font-bold uppercase tracking-wide">Not Started</span>}
                  {status === RoundStatus.Open && <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold uppercase tracking-wide animate-pulse">Live / Open</span>}
                  {status === RoundStatus.Locked && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wide">Completed</span>}
                </div>
              </div>

              {/* Tiebreak explainer banner */}
              {segment.id === SegmentId.TieBreakingQA && tieBreakNeeded && status === RoundStatus.NotStarted && (
                <Alert 
                  variant={(tieBreakNeeded.male || tieBreakNeeded.female) ? 'error' : 'info'}
                  title={(tieBreakNeeded.male || tieBreakNeeded.female) ? 'Boundary Tie Detected' : 'No Tie-Break Needed'}
                  className="mb-4"
                >
                  {(tieBreakNeeded.male || tieBreakNeeded.female) ? (
                    <>
                      <div>{tieBreakNeeded.reason}</div>
                      <div className="mt-1 text-xs opacity-80">You must tag the tied candidates in the Candidates page before opening this segment.</div>
                    </>
                  ) : (
                    <>
                      <div>{tieBreakNeeded.reason}</div>
                      <div className="mt-1 text-xs opacity-80">A tie-break is only required when 3rd and 4th place have the same preliminary rank sum. The Final Q&amp;A 50/50 formula resolves any ties within the top 3.</div>
                    </>
                  )}
                </Alert>
              )}

              <div className="flex-1" />

              <div className="mt-6 pt-4 border-t border-neutral-100">
                {status === RoundStatus.NotStarted && (() => {
                  const isTiebreak = segment.id === SegmentId.TieBreakingQA;
                  const tiebreakBlocked = isTiebreak && tieBreakNeeded && !tieBreakNeeded.male && !tieBreakNeeded.female;
                  const isDisabled = actionLoading !== null || hasOpenSegment || !!tiebreakBlocked;
                  return (
                    <Button
                      fullWidth
                      onClick={() => handleOpenRoundClick(segment.id)}
                      disabled={isDisabled}
                      isLoading={actionLoading === segment.id}
                      loadingText="Opening..."
                      title={hasOpenSegment ? 'Another segment is currently open. Please lock it first.' : ''}
                    >
                      Open Segment for Judging
                    </Button>
                  );
                })()}

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
                          <Button 
                            variant="destructive"
                            onClick={() => handleLockRound(segment.id)}
                            disabled={actionLoading === segment.id}
                            isLoading={actionLoading === segment.id}
                            loadingText="Locking..."
                            className="flex-1"
                          >
                            Confirm Lock
                          </Button>
                          <Button 
                            variant="secondary"
                            onClick={() => { setPinPrompt(null); setPin(''); setPinError(''); }}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        variant="ghost"
                        fullWidth
                        onClick={() => setPinPrompt(segment.id)}
                        className="!bg-red-50 !text-red-700 hover:!bg-red-100"
                      >
                        Lock Segment (Requires PIN)
                      </Button>
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
