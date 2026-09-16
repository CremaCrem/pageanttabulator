import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useAppContext } from '../../context/AppContext';
import { fetchApi, getApiBaseUrl } from '../../api/client';
import { ICandidate, ISubmitScoreRequest, UserRole, IRoundState, RoundStatus, Gender } from '../../types';
import { useToast } from '../../context/ToastContext';
import { SEGMENTS } from '../../utils/constants';
import { Modal } from '../../components/ui/Modal';

export const ScoringPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { success } = useToast();
  const navigate = useNavigate();

  const [allCandidates, setAllCandidates] = useState<ICandidate[]>([]);
  const [candidates, setCandidates] = useState<ICandidate[]>([]);
  const [top3Ids, setTop3Ids] = useState<Set<string>>(new Set());
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  
  // Phase 3: drafts[candidateId][criterionId]
  const [drafts, setDrafts] = useState<Record<string, Record<string, number | ''>>>({});
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completedCandidates, setCompletedCandidates] = useState<Set<string>>(new Set());
  const [submittedScores, setSubmittedScores] = useState<Record<string, Record<string, number>>>({});
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
        // Sort by gender then number
        const sorted = data.sort((a, b) => {
          if (a.gender !== b.gender) {
            return a.gender === Gender.Male ? -1 : 1;
          }
          return a.candidateNumber.localeCompare(b.candidateNumber);
        });
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
            if (r.preliminaryStatus === 'advancing') top3.add(r.candidateId);
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
    setDrafts({});
    setError('');
    // optionally select first candidate again
    if (candidates.length > 0) {
      setSelectedCandidateId(candidates[0].id);
    }

    // Fetch already submitted scores to populate checkmarks and read-only values
    const fetchSubmittedScores = async () => {
      if (!state.activeSegmentId || !state.session?.judgeId) return;
      try {
        const scores: any[] = await fetchApi(`/api/scores/judge/${state.session.judgeId}`);
        const segmentScores = scores.filter(s => s.segmentId === state.activeSegmentId);
        
        const completed = new Set<string>();
        const fetchedScores: Record<string, Record<string, number>> = {};

        segmentScores.forEach(s => {
          completed.add(s.candidateId);
          try {
            const parsed = JSON.parse(s.criteriaJson);
            if (!fetchedScores[s.candidateId]) {
              fetchedScores[s.candidateId] = {};
            }
            parsed.forEach((entry: any) => {
              fetchedScores[s.candidateId][`${s.segmentId}_${entry.criterionId}`] = entry.score;
            });
          } catch (e) {
            console.error("Failed to parse criteriaJson", e);
          }
        });
        
        // Also check if there's a secondary segment and grab its scores too
        if (state.activeSegmentId === 'school_uniform' || state.activeSegmentId === 'modern_barong') {
            const secSegId = state.activeSegmentId === 'school_uniform' ? 'best_advocacy' : 'best_in_ramp';
            const secScores = scores.filter(s => s.segmentId === secSegId);
            secScores.forEach(s => {
                completed.add(s.candidateId);
                try {
                  const parsed = JSON.parse(s.criteriaJson);
                  if (!fetchedScores[s.candidateId]) {
                    fetchedScores[s.candidateId] = {};
                  }
                  parsed.forEach((entry: any) => {
                    fetchedScores[s.candidateId][`${s.segmentId}_${entry.criterionId}`] = entry.score;
                  });
                } catch (e) {
                  console.error("Failed to parse secondary criteriaJson", e);
                }
            });
        }

        setCompletedCandidates(completed);
        setSubmittedScores(fetchedScores);
      } catch (err) {
        console.error("Failed to load existing scores", err);
      }
    };

    fetchSubmittedScores();
  }, [state.activeSegmentId, state.session?.judgeId, candidates]);

  // Phase 5: Prevent accidental closure if drafts exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasDrafts = Object.values(drafts).some(candidateDraft => 
        Object.values(candidateDraft).some(val => val !== '' && val !== undefined)
      );
      if (hasDrafts) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [drafts]);

  const activeSegment = state.activeSegmentId ? SEGMENTS[state.activeSegmentId] : null;

  const secondarySegment = useMemo(() => {
    if (state.activeSegmentId === 'school_uniform') return SEGMENTS['best_advocacy'];
    if (state.activeSegmentId === 'modern_barong') return SEGMENTS['best_in_ramp'];
    return null;
  }, [state.activeSegmentId]);

  // Derivation
  const currentScores = useMemo(() => {
    if (!selectedCandidateId) return {};
    if (completedCandidates.has(selectedCandidateId)) {
        return submittedScores[selectedCandidateId] || {};
    }
    return drafts[selectedCandidateId] || {};
  }, [drafts, submittedScores, selectedCandidateId, completedCandidates]);

  // Calculate live preview
  const currentTotal = useMemo(() => {
    if (!activeSegment) return 0;
    return activeSegment.criteria.reduce((total, crit) => {
      const val = currentScores[`${activeSegment.id}_${crit.id}`] || 0;
      return total + (Number(val) * crit.weight);
    }, 0);
  }, [currentScores, activeSegment]);

  const secondaryTotal = useMemo(() => {
    if (!secondarySegment) return 0;
    return secondarySegment.criteria.reduce((total, crit) => {
      const val = currentScores[`${secondarySegment.id}_${crit.id}`] || 0;
      return total + (Number(val) * crit.weight);
    }, 0);
  }, [currentScores, secondarySegment]);

  const handleScoreChange = (segmentId: string, criterionId: string, val: string) => {
    if (!selectedCandidateId) return;
    const key = `${segmentId}_${criterionId}`;
    
    setDrafts(prev => {
      const candidateDraft = prev[selectedCandidateId] || {};
      if (val === '') {
        return { ...prev, [selectedCandidateId]: { ...candidateDraft, [key]: '' } };
      }
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        return { ...prev, [selectedCandidateId]: { ...candidateDraft, [key]: num } };
      }
      return prev;
    });
  };

  const handleSubmit = async () => {
    if (!activeSegment || !selectedCandidateId || !state.session?.judgeId) return;

    // Validate
    let firstInvalidId: string | null = null;
    let newErrors: Record<string, string> = {};

    const allSegments = secondarySegment ? [activeSegment, secondarySegment] : [activeSegment];

    allSegments.forEach(seg => {
      seg.criteria.forEach(crit => {
        const key = `${seg.id}_${crit.id}`;
        const val = currentScores[key];
        if (val === undefined || val === '') {
          newErrors[key] = 'Score is required';
          if (!firstInvalidId) firstInvalidId = key;
        } else if (Number(val) < 1 || Number(val) > 100) {
          newErrors[key] = 'Score must be 1-100';
          if (!firstInvalidId) firstInvalidId = key;
        }
      });
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

    executeSubmit();
  };

  const executeSubmit = async () => {
    if (!activeSegment || !selectedCandidateId || !state.session?.judgeId) return;

    try {
      setSubmitting(true);
      setError('');
      setFieldErrors({});

      const primaryEntries = activeSegment.criteria.map(c => ({
        criterionId: c.id,
        score: Number(currentScores[`${activeSegment.id}_${c.id}`])
      }));

      const primaryPayload: ISubmitScoreRequest = {
        judgeId: state.session.judgeId,
        candidateId: selectedCandidateId,
        segmentId: activeSegment.id,
        criteriaEntries: primaryEntries
      };

      const requests = [
        fetchApi('/api/scores', {
          method: 'POST',
          body: JSON.stringify(primaryPayload)
        })
      ];

      if (secondarySegment) {
        const secondaryEntries = secondarySegment.criteria.map(c => ({
          criterionId: c.id,
          score: Number(currentScores[`${secondarySegment.id}_${c.id}`])
        }));
        
        const secondaryPayload: ISubmitScoreRequest = {
          judgeId: state.session.judgeId,
          candidateId: selectedCandidateId,
          segmentId: secondarySegment.id,
          criteriaEntries: secondaryEntries
        };
        
        requests.push(
          fetchApi('/api/scores', {
            method: 'POST',
            body: JSON.stringify(secondaryPayload)
          })
        );
      }

      await Promise.all(requests);
      
      success(`Score submitted successfully for ${selectedCandidate?.fullName}`);

      // Mark completed
      setCompletedCandidates(prev => {
        const next = new Set(prev);
        next.add(selectedCandidateId);
        return next;
      });

      setSubmittedScores(prev => ({
        ...prev,
        [selectedCandidateId]: { ...(currentScores as Record<string, number>) }
      }));

      // Phase 5: Do NOT clear drafts on submit. It safely becomes redundant because currentScores will map to submittedScores.

      // Auto-advance to next candidate
      const currentIndex = candidates.findIndex(c => c.id === selectedCandidateId);
      if (currentIndex >= 0 && currentIndex < candidates.length - 1) {
        const nextCandidate = candidates[currentIndex + 1];
        setSelectedCandidateId(nextCandidate.id);
      }

    } catch (err: any) {
      setError('Submission could not be completed. Your draft has been preserved. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Phase 3 Navigation Logic
  const currentIndex = candidates.findIndex(c => c.id === selectedCandidateId);
  const totalCandidates = candidates.length;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= totalCandidates - 1;

  const handlePrev = () => {
    if (!isFirst) {
      const prev = candidates[currentIndex - 1];
      setSelectedCandidateId(prev.id);
    }
  };

  const handleNext = () => {
    if (!isLast) {
      const next = candidates[currentIndex + 1];
      setSelectedCandidateId(next.id);
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

  const activeRoundState = state.roundStates.find(r => r.segmentId === state.activeSegmentId);
  const isSegmentLocked = activeRoundState?.status === RoundStatus.Locked;

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);
  const isCompleted = completedCandidates.has(selectedCandidateId || '');
  const isReadOnly = isCompleted || isSegmentLocked;

  return (
    <PageWrapper className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-neutral-50 p-4 gap-6">


      {/* Main Scoring Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden relative min-w-0">
        {!selectedCandidate ? (
          <div className="flex-1 bg-white rounded-xl shadow-panel flex items-center justify-center text-neutral-400 font-medium text-lg">
            Select a candidate to begin scoring
          </div>
        ) : (
          <>
            {/* Candidate Identity Panel */}
            <div className="w-full lg:w-1/3 xl:w-1/4 flex-shrink-0 bg-white rounded-xl shadow-panel flex flex-col overflow-hidden border-t-4 border-primary-600">
              <div className="p-6 text-center bg-neutral-900 text-white relative flex-shrink-0">
                <div className="text-xs font-semibold text-gold-500 uppercase tracking-widest mb-1">Contestant</div>
                <div className="text-6xl font-black text-white mb-2 leading-none">{selectedCandidate.candidateNumber}</div>
                <h2 className="text-2xl font-bold leading-tight">{selectedCandidate.fullName}</h2>
                <div className="text-sm text-neutral-400 mt-1">{selectedCandidate.department}</div>
              </div>
              <div className="flex-1 bg-neutral-100 flex items-center justify-center relative min-h-[250px] p-4 lg:p-6 overflow-hidden">
                {selectedCandidate.photoPath ? (
                  <img src={`${getApiBaseUrl()}${selectedCandidate.photoPath}`} alt={selectedCandidate.fullName} className="w-full h-full object-contain rounded-lg bg-white shadow-sm" />
                ) : (
                  <div className="text-neutral-400 flex flex-col items-center">
                    <svg className="w-12 h-12 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-sm font-medium">No Photo Available</span>
                  </div>
                )}
              </div>
            </div>

            {/* Scoring Form Area */}
            <div className="flex-1 bg-white rounded-xl shadow-panel flex flex-col overflow-hidden relative border border-neutral-100">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-2xl mx-auto">
                  {isSegmentLocked && (
                    <div className="mb-5 p-4 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium border border-neutral-200 flex items-center gap-2">
                      <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      Scoring for this segment is locked.
                    </div>
                  )}

                  {isCompleted && !isSegmentLocked && (
                    <div className="mb-5 p-4 bg-green-50 text-green-800 rounded-lg text-sm font-medium border border-green-200 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Scores successfully submitted.
                    </div>
                  )}

                  {!isCompleted && !isSegmentLocked && error && (
                    <div className="mb-5 p-4 bg-red-50 text-red-800 rounded-lg text-sm font-medium border border-red-200 flex items-start gap-2">
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <div>{error}</div>
                    </div>
                  )}

                      {secondarySegment ? (
                        /* ── DUAL-SEGMENT: Responsive columns ── */
                        <div className="flex flex-col xl:flex-row gap-6 mb-6 items-stretch">

                          {/* Primary Segment Panel */}
                          <div className="flex-1 rounded-2xl border border-neutral-200 overflow-hidden flex flex-col">
                            {/* Panel header */}
                            <div className="flex items-center gap-3 px-5 py-4 bg-primary-900 shrink-0">
                              <div className="w-2 h-2 rounded-full bg-primary-300 flex-shrink-0" />
                              <span className="text-sm font-bold text-white uppercase tracking-widest">{activeSegment.label}</span>
                            </div>

                            {/* Criteria rows */}
                            <div className="divide-y divide-neutral-100 flex-1">
                              {activeSegment.criteria.map((crit, idx) => {
                                const key = `${activeSegment.id}_${crit.id}`;
                                const hasError = !!fieldErrors[key];
                                return (
                                  <div
                                    key={key}
                                    className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                                      hasError ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/60'
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <label htmlFor={`input-${key}`} className={`font-semibold text-sm leading-snug ${hasError ? 'text-red-800' : 'text-neutral-800'}`}>
                                        {crit.label}
                                      </label>
                                      <div className="text-xs text-neutral-400 mt-0.5">Weight: {crit.weight * 100}%</div>
                                      {hasError && (
                                        <div id={`error-${key}`} className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                          {fieldErrors[key]}
                                        </div>
                                      )}
                                    </div>

                                    {/* Score input */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <input
                                        id={`input-${key}`}
                                        ref={el => { inputRefs.current[key] = el; }}
                                        type="number"
                                        min="1"
                                        max="100"
                                        disabled={isReadOnly || submitting}
                                        readOnly={isReadOnly}
                                        aria-invalid={hasError}
                                        aria-errormessage={hasError ? `error-${key}` : undefined}
                                        value={currentScores[key] === undefined ? '' : currentScores[key]}
                                        onChange={(e) => handleScoreChange(activeSegment.id, crit.id, e.target.value)}
                                        className={`w-[4.5rem] h-12 text-center text-xl font-black border-2 rounded-xl outline-none transition-all ${
                                          isReadOnly
                                            ? 'bg-neutral-100 border-neutral-200 text-neutral-500 cursor-not-allowed'
                                            : hasError
                                            ? 'border-red-400 focus:border-red-600 focus:ring-4 focus:ring-red-100 text-red-800 bg-red-50'
                                            : 'border-neutral-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 bg-white'
                                        }`}
                                        placeholder="—"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Primary total bar */}
                            <div className={`flex items-center justify-between px-5 py-4 border-t shrink-0 ${isReadOnly ? 'bg-neutral-200 border-neutral-300' : 'bg-neutral-100 border-neutral-200'}`}>
                              <span className="text-neutral-500 text-xs font-bold uppercase tracking-widest">{isCompleted ? 'Submitted Total' : 'Draft Total'}</span>
                              <span className="text-2xl font-black text-neutral-800 tracking-wide">{currentTotal.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Secondary Segment Panel */}
                          <div className="flex-1 rounded-2xl border border-amber-200 overflow-hidden flex flex-col">
                            {/* Panel header */}
                            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-600 to-yellow-500 shrink-0">
                              <div className="w-2 h-2 rounded-full bg-yellow-200 flex-shrink-0" />
                              <span className="text-sm font-bold text-yellow-900 uppercase tracking-widest">{secondarySegment.label}</span>
                              <span className="ml-auto text-[10px] font-bold text-yellow-900 bg-yellow-200 px-2 py-0.5 rounded uppercase tracking-wider">Minor</span>
                            </div>

                            {/* Criteria rows */}
                            <div className="divide-y divide-amber-100 flex-1">
                              {secondarySegment.criteria.map((crit, idx) => {
                                const key = `${secondarySegment.id}_${crit.id}`;
                                const hasError = !!fieldErrors[key];
                                return (
                                  <div
                                    key={key}
                                    className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                                      hasError ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/40'
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <label htmlFor={`input-${key}`} className={`font-semibold text-sm leading-snug ${hasError ? 'text-red-800' : 'text-neutral-800'}`}>
                                        {crit.label}
                                      </label>
                                      <div className="text-xs text-neutral-400 mt-0.5">Weight: {crit.weight * 100}%</div>
                                      {hasError && (
                                        <div id={`error-${key}`} className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                          {fieldErrors[key]}
                                        </div>
                                      )}
                                    </div>

                                    {/* Score input */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <input
                                        id={`input-${key}`}
                                        ref={el => { inputRefs.current[key] = el; }}
                                        type="number"
                                        min="1"
                                        max="100"
                                        disabled={isReadOnly || submitting}
                                        readOnly={isReadOnly}
                                        aria-invalid={hasError}
                                        aria-errormessage={hasError ? `error-${key}` : undefined}
                                        value={currentScores[key] === undefined ? '' : currentScores[key]}
                                        onChange={(e) => handleScoreChange(secondarySegment.id, crit.id, e.target.value)}
                                        className={`w-[4.5rem] h-12 text-center text-xl font-black border-2 rounded-xl outline-none transition-all ${
                                          isReadOnly
                                            ? 'bg-neutral-100 border-neutral-200 text-neutral-500 cursor-not-allowed'
                                            : hasError
                                            ? 'border-red-400 focus:border-red-600 focus:ring-4 focus:ring-red-100 text-red-800 bg-red-50'
                                            : 'border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 bg-white'
                                        }`}
                                        placeholder="—"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Secondary total bar */}
                            <div className={`flex items-center justify-between px-5 py-4 border-t shrink-0 ${isReadOnly ? 'bg-amber-100 border-amber-300' : 'bg-amber-50 border-amber-200'}`}>
                              <span className="text-amber-700 text-xs font-bold uppercase tracking-widest">{isCompleted ? 'Submitted Total' : 'Draft Total'}</span>
                              <span className="text-2xl font-black text-amber-900 tracking-wide">{secondaryTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                      ) : (
                        /* ── SINGLE-SEGMENT: Unified layout ── */
                        <div className="mb-6 rounded-2xl border border-neutral-200 overflow-hidden flex flex-col">
                          <div className="flex items-center gap-3 px-5 py-4 bg-primary-900 shrink-0">
                            <div className="w-2 h-2 rounded-full bg-primary-300 flex-shrink-0" />
                            <span className="text-sm font-bold text-white uppercase tracking-widest">{activeSegment.label}</span>
                          </div>
                          
                          <div className="divide-y divide-neutral-100 flex-1">
                            {activeSegment.criteria.map((crit, idx) => {
                              const key = `${activeSegment.id}_${crit.id}`;
                              const hasError = !!fieldErrors[key];
                              return (
                                <div
                                  key={key}
                                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                                    hasError ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/60'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <label htmlFor={`input-${key}`} className={`font-semibold text-sm leading-snug ${hasError ? 'text-red-800' : 'text-neutral-800'}`}>
                                      {crit.label}
                                    </label>
                                    <div className="text-xs text-neutral-400 mt-0.5">Weight: {crit.weight * 100}%</div>
                                    {hasError && (
                                      <div id={`error-${key}`} className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        {fieldErrors[key]}
                                      </div>
                                    )}
                                  </div>

                                  {/* Score input */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <input
                                      id={`input-${key}`}
                                      ref={el => { inputRefs.current[key] = el; }}
                                      type="number"
                                      min="1"
                                      max="100"
                                      disabled={isReadOnly || submitting}
                                      readOnly={isReadOnly}
                                      aria-invalid={hasError}
                                      aria-errormessage={hasError ? `error-${key}` : undefined}
                                      value={currentScores[key] === undefined ? '' : currentScores[key]}
                                      onChange={(e) => handleScoreChange(activeSegment.id, crit.id, e.target.value)}
                                      className={`w-[4.5rem] h-12 text-center text-xl font-black border-2 rounded-xl outline-none transition-all ${
                                        isReadOnly
                                          ? 'bg-neutral-100 border-neutral-200 text-neutral-500 cursor-not-allowed'
                                          : hasError
                                          ? 'border-red-400 focus:border-red-600 focus:ring-4 focus:ring-red-100 text-red-800 bg-red-50'
                                          : 'border-neutral-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 bg-white'
                                      }`}
                                      placeholder="—"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Primary total bar */}
                          <div className={`flex items-center justify-between px-5 py-4 border-t shrink-0 ${isReadOnly ? 'bg-neutral-200 border-neutral-300' : 'bg-neutral-100 border-neutral-200'}`}>
                            <span className="text-neutral-500 text-xs font-bold uppercase tracking-widest">{isCompleted ? 'Submitted Total' : 'Draft Total'}</span>
                            <span className="text-2xl font-black text-neutral-800 tracking-wide">{currentTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                </div>
              </div>

              {/* Action Area Structure */}
              <div className="bg-white border-t border-neutral-200 p-4 sm:p-6 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row items-center justify-between gap-4 z-10 shrink-0">
                {/* Navigation */}
                <div className="flex w-full sm:w-auto justify-between gap-2">
                  <button 
                    onClick={handlePrev}
                    disabled={isFirst}
                    aria-label="Previous Candidate"
                    className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 focus:ring-4 focus:ring-neutral-200 focus:outline-none border border-neutral-200 rounded-lg text-neutral-700 font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    <span className="hidden sm:inline">Prev</span>
                  </button>

                  {/* Jump To Candidate Button */}
                  <button
                    onClick={() => setShowCandidateModal(true)}
                    aria-label="Jump to Candidate"
                    className="px-4 py-2.5 bg-white border border-neutral-200 hover:border-primary-500 hover:text-primary-600 focus:ring-4 focus:ring-primary-100 focus:outline-none rounded-lg text-neutral-700 font-medium text-sm transition-colors flex items-center gap-2"
                  >
                    <span>{currentIndex + 1} of {totalCandidates}</span>
                    <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  <button 
                    onClick={handleNext}
                    disabled={isLast}
                    aria-label="Next Candidate"
                    className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 focus:ring-4 focus:ring-neutral-200 focus:outline-none border border-neutral-200 rounded-lg text-neutral-700 font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                
                {/* Submit Button */}
                <div className="flex w-full sm:flex-1 justify-end">
                  {!isReadOnly && (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      aria-label="Submit Score"
                      className="w-full sm:w-auto px-8 py-3.5 bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-lg flex items-center justify-center gap-3 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-primary-300"
                    >
                      {submitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        'Submit Score'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showCandidateModal}
        onClose={() => setShowCandidateModal(false)}
        title="Jump to Candidate"
      >
        <div className="space-y-8">
          {[Gender.Male, Gender.Female].map((genderGroup) => (
            <div key={genderGroup}>
              <h3 className="font-bold text-neutral-800 mb-4 flex items-center gap-2 text-lg">
                <div className={`w-3 h-3 rounded-full ${genderGroup === Gender.Male ? 'bg-blue-500' : 'bg-pink-500'}`}></div> 
                {genderGroup === Gender.Male ? 'Male Candidates' : 'Female Candidates'}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {candidates.filter(c => c.gender === genderGroup).map(candidate => {
                  const isDone = completedCandidates.has(candidate.id);
                  const draftValues = drafts[candidate.id] || {};
                  const hasDraft = Object.values(draftValues).some(v => v !== '' && v !== undefined);
                  const isActive = candidate.id === selectedCandidateId;

                  let statusColor = 'bg-neutral-100 text-neutral-600 border-neutral-200';
                  let statusLabel = 'Not Started';
                  let StatusIcon = () => <div className="w-2 h-2 rounded-full bg-neutral-300"></div>;

                  if (isSegmentLocked) {
                    statusColor = 'bg-neutral-200 text-neutral-800 border-neutral-300 opacity-75';
                    statusLabel = 'Locked';
                    StatusIcon = () => <svg className="w-3.5 h-3.5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
                  } else if (isDone) {
                    statusColor = 'bg-green-50 text-green-700 border-green-200';
                    statusLabel = 'Submitted';
                    StatusIcon = () => <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>;
                  } else if (hasDraft) {
                    statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
                    statusLabel = 'Draft';
                    StatusIcon = () => <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>;
                  }

                  if (isActive) {
                    statusColor = 'bg-primary-50 text-primary-800 border-primary-500 ring-2 ring-primary-200 shadow-sm';
                  }

                  return (
                    <button
                      key={candidate.id}
                      onClick={() => {
                        setSelectedCandidateId(candidate.id);
                        setShowCandidateModal(false);
                      }}
                      aria-label={`Select candidate ${candidate.candidateNumber}: ${candidate.fullName}. Status: ${statusLabel}`}
                      className={`text-left p-4 rounded-xl border flex flex-col items-center justify-center transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-primary-300 ${statusColor}`}
                    >
                      <div className="text-3xl font-black mb-1">{candidate.candidateNumber}</div>
                      <div className="text-xs font-semibold text-center truncate w-full px-1 mb-3">{candidate.fullName}</div>
                      <div className="flex items-center gap-1.5 bg-white/70 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider w-full justify-center shadow-sm">
                        <StatusIcon />
                        <span className="truncate">{statusLabel}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </PageWrapper>
  );
};
