import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useAppContext } from '../../context/AppContext';
import { fetchApi } from '../../api/client';
import { ICandidate, ISubmitScoreRequest, UserRole, IRoundState, RoundStatus } from '../../types';
import { SEGMENTS } from '../../utils/constants';

export const ScoringPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  
  const [candidates, setCandidates] = useState<ICandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number | ''>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completedCandidates, setCompletedCandidates] = useState<Set<string>>(new Set());

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
        // Only eligible candidates
        const eligible = data.filter(c => c.isEligible).sort((a, b) => 
          a.candidateNumber.localeCompare(b.candidateNumber)
        );
        setCandidates(eligible);
        if (eligible.length > 0 && !selectedCandidateId) {
          setSelectedCandidateId(eligible[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load candidates", err);
      }
    };
    loadCandidates();
  }, []);

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
    for (const crit of activeSegment.criteria) {
      const val = scores[crit.id];
      if (val === '' || val === undefined || Number(val) < 1 || Number(val) > 100) {
        setError(`Please enter a valid score (1-100) for ${crit.label}.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setError('');
      
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
                  <svg className="w-5 h-5 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="p-8 text-center bg-success-50 rounded-xl border border-success-100 mb-8">
                  <svg className="w-16 h-16 text-success-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <h3 className="text-xl font-bold text-success-900 mb-2">Score Submitted Successfully!</h3>
                  <p className="text-success-700">You have successfully scored {selectedCandidate.fullName} for this segment.</p>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <div className="flex justify-between items-end mb-4">
                      <h3 className="text-lg font-semibold text-neutral-800">Criteria</h3>
                      <div className="text-sm text-neutral-500">Rate from 1-100</div>
                    </div>
                    
                    {error && (
                      <div className="mb-6 p-4 bg-error-50 text-error-700 rounded-lg text-sm font-medium border border-error-100">
                        {error}
                      </div>
                    )}

                    <div className="space-y-6">
                      {activeSegment.criteria.map(crit => (
                        <div key={crit.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-100">
                          <div className="mb-3 sm:mb-0">
                            <div className="font-semibold text-neutral-800">{crit.label}</div>
                            <div className="text-sm text-neutral-500">Weight: {crit.weight * 100}%</div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={scores[crit.id] === undefined ? '' : scores[crit.id]}
                              onChange={(e) => handleScoreChange(crit.id, e.target.value)}
                              className="w-24 text-center text-lg font-bold p-3 border-2 border-neutral-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
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
