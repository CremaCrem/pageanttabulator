import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useAppContext } from '../../context/AppContext';
import { fetchApi } from '../../api/client';
import { ICandidate, ISubmitScoreRequest, UserRole, IRoundState, RoundStatus } from '../../types';
import { SEGMENTS } from '../../utils/constants';

export const ScoringPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  
  const [allCandidates, setAllCandidates] = useState<ICandidate[]>([]);
  const [candidates, setCandidates] = useState<ICandidate[]>([]);
  const [top3Ids, setTop3Ids] = useState<Set<string>>(new Set());
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number | ''>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completedCandidates, setCompletedCandidates] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Enforce session
  useEffect(() => {
    if (!state.session || state.session.role !== UserRole.Judge) {
      navigate('/');
    }
  }, [state.session, navigate]);

  // Fetch candidates
  useEffect(() => {
    const loadCandidates = async () => {
      try {
        const data: ICandidate[] = await fetchApi('/api/candidates');
        // Sort by number
        const sorted = data.sort((a, b) => a.candidateNumber.localeCompare(b.candidateNumber));
        setAllCandidates(sorted);
      } catch (err: any) {
        console.error("Failed to load candidates", err);
      }
    };
    loadCandidates();
  }, []);

  // Fetch Top 3 results if we are on final_qa
  useEffect(() => {
    if (state.activeSegmentId === 'final_qa') {
      const loadResults = async () => {
        try {
          const res: any[] = await fetchApi('/api/results');
          const top3 = new Set<string>();
          res.forEach(r => {
            if (r.isTop3) top3.add(r.candidateId);
          });
          setTop3Ids(top3);
        } catch (err) {
          console.error("Failed to load results for top 3 filtering", err);
        }
      };
      loadResults();
    }
  }, [state.activeSegmentId]);

  // Filter candidates based on active segment
  useEffect(() => {
    let eligible = allCandidates.filter(c => c.isEligible);
    
    if (state.activeSegmentId === 'tie_breaking_qa') {
      eligible = eligible.filter(c => c.isInTiebreak);
    } else if (state.activeSegmentId === 'final_qa') {
      eligible = eligible.filter(c => top3Ids.has(c.id));
    }
    
    setCandidates(eligible);
    
    // Auto-select first if none selected or current is invalid
    if (eligible.length > 0) {
      if (!selectedCandidateId || !eligible.find(c => c.id === selectedCandidateId)) {
        setSelectedCandidateId(eligible[0].id);
      }
    } else {
      setSelectedCandidateId(null);
    }
  }, [allCandidates, state.activeSegmentId, top3Ids]);

  // Fetch active round on mount if not already set
  useEffect(() => {
    const loadActiveRound = async () => {
      try {
        const rounds: IRoundState[] = await fetchApi('/api/rounds');
        dispatch({ type: 'SET_ROUND_STATES', payload: rounds });
        const openRound = rounds.find(r => r.status === RoundStatus.Open);
        if (openRound && state.activeSegmentId !== openRound.segmentId) {
          dispatch({ type: 'SET_ACTIVE_SEGMENT', payload: openRound.segmentId });
        }
      } catch (err) {
        console.error("Failed to load rounds on judge startup", err);
      }
    };
    loadActiveRound();
  }, [dispatch]);

  // Reset local form state and fetch existing scores when segment changes
  useEffect(() => {
    setScores({});
    setError('');
    // optionally select first candidate again
    if (candidates.length > 0) {
      setSelectedCandidateId(candidates[0].id);
    }
    
    // Fetch already submitted scores to populate checkmarks
    const fetchSubmittedScores = async () => {
      if (!state.activeSegmentId || !state.session?.judgeId) return;
      try {
        const scores: any[] = await fetchApi(`/api/scores/judge/${state.session.judgeId}`);
        const segmentScores = scores.filter(s => s.segmentId === state.activeSegmentId);
        const completed = new Set<string>();
        segmentScores.forEach(s => completed.add(s.candidateId));
        setCompletedCandidates(completed);
      } catch (err) {
        console.error("Failed to load existing scores", err);
      }
    };
    
    fetchSubmittedScores();
  }, [state.activeSegmentId, state.session?.judgeId, candidates]);

  const activeSegment = state.activeSegmentId ? SEGMENTS[state.activeSegmentId] : null;

  // Calculate live preview
  const currentTotal = useMemo(() => {
    if (!activeSegment) return 0;
    return activeSegment.criteria.reduce((total, crit) => {
      const val = scores[crit.id] || 0;
      return total + (Number(val) * crit.weight);
    }, 0);
  }, [scores, activeSegment]);

  const handleScoreChange = (criterionId: string, val: string) => {
    if (val === '') {
      setScores(prev => ({ ...prev, [criterionId]: '' }));
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      // Allow user to clear input temporarily or type, but we will validate on submit
      setScores(prev => ({ ...prev, [criterionId]: num }));
    }
  };

  const handleSubmit = async () => {
    if (!activeSegment || !selectedCandidateId || !state.session?.judgeId) return;
    
    // Validate
    let firstInvalidId: string | null = null;
    let newErrors: Record<string, string> = {};

    activeSegment.criteria.forEach(crit => {
      const val = scores[crit.id];
      if (val === undefined || val === '') {
        newErrors[crit.id] = 'Score is required';
        if (!firstInvalidId) firstInvalidId = crit.id;
      } else if (Number(val) < 1 || Number(val) > 100) {
        newErrors[crit.id] = 'Score must be 1-100';
        if (!firstInvalidId) firstInvalidId = crit.id;
      }
    });

    if (firstInvalidId) {
      setFieldErrors(newErrors);
      setError('Please fix the highlighted errors before submitting.');
      
      const el = inputRefs.current[firstInvalidId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
      }
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setFieldErrors({});
      
      const criteriaEntries = activeSegment.criteria.map(c => ({
        criterionId: c.id,
        score: Number(scores[c.id])
      }));

      const payload: ISubmitScoreRequest = {
        judgeId: state.session.judgeId,
        candidateId: selectedCandidateId,
        segmentId: activeSegment.id,
        criteriaEntries
      };

      await fetchApi('/api/scores', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Mark completed
      setCompletedCandidates(prev => {
        const next = new Set(prev);
        next.add(selectedCandidateId);
        return next;
      });

      // Auto-advance to next candidate
      const currentIndex = candidates.findIndex(c => c.id === selectedCandidateId);
      if (currentIndex >= 0 && currentIndex < candidates.length - 1) {
        setSelectedCandidateId(candidates[currentIndex + 1].id);
        setScores({}); // clear form for next candidate
      } else {
        // We reached the end
        setScores({});
      }

    } catch (err: any) {
      setError(err.message || 'Failed to submit score');
    } finally {
      setSubmitting(false);
    }
  };

  const isEventFinished = state.roundStates.length === Object.keys(SEGMENTS).length && 
    state.roundStates.every(r => r.status === RoundStatus.Locked);

  if (isEventFinished) {
    return (
      <PageWrapper className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-neutral-100">
        <div className="text-center p-12 bg-white rounded-xl shadow-panel max-w-lg w-full">
          <div className="mb-6 mx-auto w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-heading-1 mb-4 text-primary-900">Judging Complete</h2>
          <p className="text-neutral-500 mb-8">All segments have been locked. Thank you for your participation in the {state.eventConfig?.name}!</p>
          <div className="p-4 bg-primary-50 rounded-lg text-primary-800 text-sm font-medium">
            You may now close this window or hand the device back to the organizing team.
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (!state.activeSegmentId || !activeSegment) {
    return (
      <PageWrapper className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-neutral-100">
        <div className="text-center p-8 bg-white rounded-xl shadow-panel max-w-md w-full">
          <div className="mb-6 mx-auto w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <h2 className="text-heading-2 mb-2 text-primary-900">Waiting for Admin</h2>
          <p className="text-neutral-500">No segment is currently open for scoring. Please wait until the admin unlocks the next round.</p>
        </div>
      </PageWrapper>
    );
  }

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);
  const isCompleted = completedCandidates.has(selectedCandidateId || '');

  return (
    <PageWrapper className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-neutral-50 p-4 gap-6">
      
      {/* Sidebar - Candidate List */}
      <div className="w-full md:w-80 flex-shrink-0 bg-white rounded-xl shadow-panel flex flex-col overflow-hidden">
        <div className="p-4 bg-primary-900 text-white shadow-sm z-10">
          <h3 className="font-bold text-lg">Candidates</h3>
          <p className="text-primary-100 text-sm">Select to score</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {candidates.map(candidate => {
            const isDone = completedCandidates.has(candidate.id);
            const isActive = candidate.id === selectedCandidateId;
            return (
              <button
                key={candidate.id}
                onClick={() => {
                  setSelectedCandidateId(candidate.id);
                  if (candidate.id !== selectedCandidateId) setScores({});
                }}
                className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                  isActive 
                    ? 'bg-primary-50 border border-primary-200' 
                    : 'hover:bg-neutral-50 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    isActive ? 'bg-primary-600 text-white' : 'bg-neutral-200 text-neutral-700'
                  }`}>
                    {candidate.candidateNumber}
                  </div>
                  <div>
                    <div className={`font-semibold text-sm ${isActive ? 'text-primary-900' : 'text-neutral-700'}`}>
                      {candidate.fullName}
                    </div>
                  </div>
                </div>
                {isDone && (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Scoring Area */}
      <div className="flex-1 bg-white rounded-xl shadow-panel flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="px-8 py-6 border-b border-neutral-100 flex justify-between items-center bg-white z-10">
          <div>
            <div className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-1">
              Currently Scoring
            </div>
            <h2 className="text-heading-2 text-primary-900">{activeSegment.label}</h2>
          </div>
          {selectedCandidate && (
            <div className="text-right">
              <div className="text-sm text-neutral-500">Candidate No. {selectedCandidate.candidateNumber}</div>
              <div className="text-xl font-bold text-neutral-800">{selectedCandidate.fullName}</div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {!selectedCandidate ? (
            <div className="text-center text-neutral-400 py-12">Select a candidate to begin scoring</div>
          ) : (
            <div className="max-w-3xl mx-auto">
              
              {isCompleted ? (
                <div className="p-8 text-center bg-green-50 rounded-xl border border-green-100 mb-8">
                  <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <h3 className="text-xl font-bold text-green-900 mb-2">Score Submitted Successfully!</h3>
                  <p className="text-green-700">You have successfully scored {selectedCandidate.fullName} for this segment.</p>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <div className="flex justify-between items-end mb-4">
                      <h3 className="text-lg font-semibold text-neutral-800">Criteria</h3>
                      <div className="text-sm text-neutral-500">Rate from 1-100</div>
                    </div>
                    
                    {error && (
                      <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100">
                        {error}
                      </div>
                    )}

                    <div className="space-y-6">
                      {activeSegment.criteria.map(crit => (
                        <div key={crit.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border ${
                          fieldErrors[crit.id] ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-100'
                        }`}>
                          <div className="mb-3 sm:mb-0">
                            <div className="font-semibold text-neutral-800">{crit.label}</div>
                            <div className="text-sm text-neutral-500">Weight: {crit.weight * 100}%</div>
                            {fieldErrors[crit.id] && (
                              <div className="text-xs text-red-600 mt-1 font-medium">{fieldErrors[crit.id]}</div>
                            )}
                          </div>
                          <div className="flex items-center space-x-4">
                            <input
                              ref={el => { inputRefs.current[crit.id] = el; }}
                              type="number"
                              min="1"
                              max="100"
                              value={scores[crit.id] === undefined ? '' : scores[crit.id]}
                              onChange={(e) => handleScoreChange(crit.id, e.target.value)}
                              className={`w-24 text-center text-lg font-bold p-3 border-2 rounded-lg outline-none transition-all ${
                                fieldErrors[crit.id] 
                                  ? 'border-red-400 focus:border-red-600 focus:ring-2 focus:ring-red-200 text-red-900' 
                                  : 'border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200'
                              }`}
                              placeholder="0"
                            />
                            <div className="w-16 text-right font-medium text-neutral-400">
                              / 100
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer / Total Preview */}
                  <div className="mt-12 p-6 bg-primary-900 rounded-xl flex flex-col sm:flex-row items-center justify-between text-white shadow-lg">
                    <div>
                      <div className="text-primary-200 text-sm font-medium mb-1">Live Weighted Total</div>
                      <div className="text-4xl font-black display-font tracking-wider">
                        {currentTotal.toFixed(2)}
                      </div>
                    </div>
                    
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="mt-6 sm:mt-0 px-8 py-4 bg-gold-500 hover:bg-gold-400 text-primary-900 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-lg w-full sm:w-auto"
                    >
                      {submitting ? 'Submitting...' : 'Submit Score'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
};
