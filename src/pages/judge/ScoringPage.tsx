import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useAppContext } from '../../context/AppContext';
import { fetchApi, getApiBaseUrl } from '../../api/client';
import { ICandidate, ISubmitScoreRequest, UserRole, IRoundState, RoundStatus, Gender } from '../../types';
import { useToast } from '../../context/ToastContext';
import { SEGMENTS } from '../../utils/constants';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

export const ScoringPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { success } = useToast();
  const navigate = useNavigate();

  const [allCandidates, setAllCandidates] = useState<ICandidate[]>([]);
  const [candidates, setCandidates] = useState<ICandidate[]>([]);
  const [top3Ids, setTop3Ids] = useState<Set<string>>(new Set());
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [activeGenderTab, setActiveGenderTab] = useState<Gender>(Gender.Male);
  const [scores, setScores] = useState<Record<string, number | ''>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
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
        setActiveGenderTab(eligible[0].gender);
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

  const secondarySegment = useMemo(() => {
    if (state.activeSegmentId === 'school_uniform') return SEGMENTS['best_advocacy'];
    if (state.activeSegmentId === 'modern_barong') return SEGMENTS['best_in_ramp'];
    return null;
  }, [state.activeSegmentId]);

  // Calculate live preview
  const currentTotal = useMemo(() => {
    if (!activeSegment) return 0;
    return activeSegment.criteria.reduce((total, crit) => {
      const val = scores[`${activeSegment.id}_${crit.id}`] || 0;
      return total + (Number(val) * crit.weight);
    }, 0);
  }, [scores, activeSegment]);

  const secondaryTotal = useMemo(() => {
    if (!secondarySegment) return 0;
    return secondarySegment.criteria.reduce((total, crit) => {
      const val = scores[`${secondarySegment.id}_${crit.id}`] || 0;
      return total + (Number(val) * crit.weight);
    }, 0);
  }, [scores, secondarySegment]);

  const handleScoreChange = (segmentId: string, criterionId: string, val: string) => {
    const key = `${segmentId}_${criterionId}`;
    if (val === '') {
      setScores(prev => ({ ...prev, [key]: '' }));
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setScores(prev => ({ ...prev, [key]: num }));
    }
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
        const val = scores[key];
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

    setConfirmSubmit(true);
  };

  const executeSubmit = async () => {
    if (!activeSegment || !selectedCandidateId || !state.session?.judgeId) return;

    try {
      setSubmitting(true);
      setError('');
      setFieldErrors({});

      const primaryEntries = activeSegment.criteria.map(c => ({
        criterionId: c.id,
        score: Number(scores[`${activeSegment.id}_${c.id}`])
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
          score: Number(scores[`${secondarySegment.id}_${c.id}`])
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

      // Auto-advance to next candidate
      const currentIndex = candidates.findIndex(c => c.id === selectedCandidateId);
      if (currentIndex >= 0 && currentIndex < candidates.length - 1) {
        const nextCandidate = candidates[currentIndex + 1];
        setSelectedCandidateId(nextCandidate.id);
        setActiveGenderTab(nextCandidate.gender);
        setScores({}); // clear form for next candidate
      } else {
        // We reached the end
        setScores({});
      }

    } catch (err: any) {
      setError(err.message || 'Failed to submit score');
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
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
          <p className="text-primary-100 text-sm mb-3">Select to score</p>
          
          {/* Gender Tabs */}
          <div className="flex bg-primary-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setActiveGenderTab(Gender.Male)}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                activeGenderTab === Gender.Male ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-100 hover:text-white hover:bg-primary-700'
              }`}
            >
              Male
            </button>
            <button
              onClick={() => setActiveGenderTab(Gender.Female)}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                activeGenderTab === Gender.Female ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-100 hover:text-white hover:bg-primary-700'
              }`}
            >
              Female
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {candidates.filter(c => c.gender === activeGenderTab).map(candidate => {
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
                <div className="flex items-center space-x-3 truncate pr-2">
                  {candidate.photoPath ? (
                    <img src={`${getApiBaseUrl()}${candidate.photoPath}`} alt={candidate.fullName} className={`flex-shrink-0 w-10 h-10 rounded-full object-cover border-2 ${isActive ? 'border-primary-500' : 'border-neutral-200'}`} />
                  ) : (
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                      isActive ? 'bg-primary-600 text-white border-primary-500' : 'bg-neutral-200 text-neutral-700 border-neutral-200'
                    }`}>
                      {candidate.candidateNumber}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className={`font-semibold text-sm truncate ${isActive ? 'text-primary-900' : 'text-neutral-700'}`}>
                      {candidate.fullName}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {candidate.department}
                    </div>
                  </div>
                </div>
                {isDone && (
                  <svg className="flex-shrink-0 w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                )}
              </button>
            );
          })}
          {candidates.filter(c => c.gender === activeGenderTab).length === 0 && (
            <div className="p-4 text-center text-sm text-neutral-400">
              No candidates in this category.
            </div>
          )}
        </div>
      </div>

      {/* Main Scoring Area */}
      <div className="flex-1 bg-white rounded-xl shadow-panel flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="px-8 py-6 border-b border-neutral-100 flex justify-between items-center bg-white z-10 flex-shrink-0">
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
              <div className="text-sm font-medium text-primary-600">{selectedCandidate.department}</div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {!selectedCandidate ? (
            <div className="w-full text-center text-neutral-400 py-12 m-auto">Select a candidate to begin scoring</div>
          ) : (
            <>
              {/* Scoring Form (Left Column) */}
              <div className="flex-1 overflow-y-auto p-8 border-r border-neutral-100">
                <div className="max-w-2xl mx-auto">
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
                      {error && (
                        <div className="mb-5 p-4 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100">
                          {error}
                        </div>
                      )}

                      {secondarySegment ? (
                        /* ── DUAL-SEGMENT: Two stacked panels, full-width rows ── */
                        <div className="space-y-8 mb-6">

                          {/* Primary Segment Panel */}
                          <div className="rounded-2xl border border-neutral-200 overflow-hidden">
                            {/* Panel header */}
                            <div className="flex items-center gap-3 px-5 py-4 bg-primary-900">
                              <div className="w-2 h-2 rounded-full bg-primary-300 flex-shrink-0" />
                              <span className="text-sm font-bold text-white uppercase tracking-widest">{activeSegment.label}</span>
                            </div>

                            {/* Criteria rows */}
                            <div className="divide-y divide-neutral-100">
                              {activeSegment.criteria.map((crit, idx) => {
                                const key = `${activeSegment.id}_${crit.id}`;
                                const hasError = !!fieldErrors[key];
                                return (
                                  <div
                                    key={key}
                                    className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                                      hasError ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/60'
                                    }`}
                                  >
                                    {/* Index dot */}
                                    <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                      {idx + 1}
                                    </div>

                                    {/* Label + weight */}
                                    <div className="flex-1 min-w-0">
                                      <div className={`font-semibold text-sm leading-snug ${hasError ? 'text-red-800' : 'text-neutral-800'}`}>
                                        {crit.label}
                                      </div>
                                      <div className="text-xs text-neutral-400 mt-0.5">Weight: {crit.weight * 100}%</div>
                                      {hasError && (
                                        <div className="text-xs text-red-600 font-medium mt-0.5">{fieldErrors[key]}</div>
                                      )}
                                    </div>

                                    {/* Score input */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <input
                                        ref={el => { inputRefs.current[key] = el; }}
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={scores[key] === undefined ? '' : scores[key]}
                                        onChange={(e) => handleScoreChange(activeSegment.id, crit.id, e.target.value)}
                                        className={`w-20 text-center text-xl font-black p-2 border-2 rounded-xl outline-none transition-all ${
                                          hasError
                                            ? 'border-red-400 focus:border-red-600 focus:ring-2 focus:ring-red-100 text-red-800 bg-red-50'
                                            : 'border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 bg-white'
                                        }`}
                                        placeholder="—"
                                      />
                                      <span className="text-xs text-neutral-400 w-10">/100</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Primary total bar */}
                            <div className="flex items-center justify-between px-5 py-4 bg-primary-900">
                              <span className="text-primary-300 text-xs font-bold uppercase tracking-widest">Weighted Total</span>
                              <span className="text-3xl font-black text-white display-font tracking-wide">{currentTotal.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Secondary Segment Panel */}
                          <div className="rounded-2xl border border-amber-200 overflow-hidden">
                            {/* Panel header */}
                            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-600 to-yellow-500">
                              <div className="w-2 h-2 rounded-full bg-yellow-200 flex-shrink-0" />
                              <span className="text-sm font-bold text-yellow-900 uppercase tracking-widest">{secondarySegment.label}</span>
                              <span className="ml-auto text-xs font-semibold text-yellow-800 bg-yellow-200 px-2 py-0.5 rounded-full">Minor Award</span>
                            </div>

                            {/* Criteria rows */}
                            <div className="divide-y divide-amber-100">
                              {secondarySegment.criteria.map((crit, idx) => {
                                const key = `${secondarySegment.id}_${crit.id}`;
                                const hasError = !!fieldErrors[key];
                                return (
                                  <div
                                    key={key}
                                    className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                                      hasError ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/40'
                                    }`}
                                  >
                                    {/* Index dot */}
                                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                      {idx + 1}
                                    </div>

                                    {/* Label + weight */}
                                    <div className="flex-1 min-w-0">
                                      <div className={`font-semibold text-sm leading-snug ${hasError ? 'text-red-800' : 'text-neutral-800'}`}>
                                        {crit.label}
                                      </div>
                                      <div className="text-xs text-neutral-400 mt-0.5">Weight: {crit.weight * 100}%</div>
                                      {hasError && (
                                        <div className="text-xs text-red-600 font-medium mt-0.5">{fieldErrors[key]}</div>
                                      )}
                                    </div>

                                    {/* Score input */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <input
                                        ref={el => { inputRefs.current[key] = el; }}
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={scores[key] === undefined ? '' : scores[key]}
                                        onChange={(e) => handleScoreChange(secondarySegment.id, crit.id, e.target.value)}
                                        className={`w-20 text-center text-xl font-black p-2 border-2 rounded-xl outline-none transition-all ${
                                          hasError
                                            ? 'border-red-400 focus:border-red-600 focus:ring-2 focus:ring-red-100 text-red-800 bg-red-50'
                                            : 'border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 bg-white'
                                        }`}
                                        placeholder="—"
                                      />
                                      <span className="text-xs text-neutral-400 w-10">/100</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Secondary total bar */}
                            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-600 to-yellow-500">
                              <span className="text-yellow-900 text-xs font-bold uppercase tracking-widest">Weighted Total</span>
                              <span className="text-3xl font-black text-yellow-900 display-font tracking-wide">{secondaryTotal.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Shared Submit button */}
                          <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="w-full py-4 bg-primary-700 hover:bg-primary-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-lg flex items-center justify-center gap-3 active:scale-[0.99]"
                          >
                            {submitting ? (
                              <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                                Submitting…
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Submit Both Scores
                              </>
                            )}
                          </button>
                        </div>

                      ) : (
                        /* ── SINGLE-SEGMENT: Original single-column layout ── */
                        <>
                          <div className="mb-6">
                            <div className="flex justify-between items-end mb-4">
                              <h3 className="text-lg font-semibold text-neutral-800">{activeSegment.label} Criteria</h3>
                              <div className="text-sm text-neutral-400">Rate 1–100</div>
                            </div>
                            <div className="space-y-4">
                              {activeSegment.criteria.map(crit => {
                                const key = `${activeSegment.id}_${crit.id}`;
                                return (
                                  <div key={key} className={`flex items-center justify-between p-4 rounded-lg border ${fieldErrors[key] ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-100'}`}>
                                    <div>
                                      <div className="font-semibold text-neutral-800">{crit.label}</div>
                                      <div className="text-sm text-neutral-500">Weight: {crit.weight * 100}%</div>
                                      {fieldErrors[key] && (
                                        <div className="text-xs text-red-600 mt-1 font-medium">{fieldErrors[key]}</div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                      <input
                                        ref={el => { inputRefs.current[key] = el; }}
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={scores[key] === undefined ? '' : scores[key]}
                                        onChange={(e) => handleScoreChange(activeSegment.id, crit.id, e.target.value)}
                                        className={`w-20 text-center text-lg font-bold p-3 border-2 rounded-lg outline-none transition-all ${fieldErrors[key]
                                            ? 'border-red-400 focus:border-red-600 focus:ring-2 focus:ring-red-200 text-red-900'
                                            : 'border-neutral-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200'
                                          }`}
                                        placeholder="0"
                                      />
                                      <span className="text-neutral-400 font-medium w-12">/ 100</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Footer total + submit */}
                          <div className="mt-8 p-6 bg-primary-900 rounded-xl flex flex-col sm:flex-row items-center justify-between text-white shadow-lg gap-4">
                            <div>
                              <div className="text-primary-200 text-sm font-medium mb-1">Live Weighted Total</div>
                              <div className="text-4xl font-black display-font tracking-wider">{currentTotal.toFixed(2)}</div>
                            </div>
                            <button
                              onClick={handleSubmit}
                              disabled={submitting}
                              className="px-8 py-4 bg-gold-500 hover:bg-gold-400 text-primary-900 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-lg w-full sm:w-auto"
                            >
                              {submitting ? 'Submitting...' : 'Submit Score'}
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Photo View (Right Column) */}
              <div className="hidden lg:flex w-[350px] xl:w-[450px] flex-shrink-0 bg-neutral-900 flex-col relative overflow-hidden">
                {selectedCandidate.photoPath ? (
                  <img 
                    src={`${getApiBaseUrl()}${selectedCandidate.photoPath}`} 
                    alt={selectedCandidate.fullName} 
                    className="w-full h-full object-contain p-6"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 p-6">
                    <div className="w-32 h-32 rounded-full border-4 border-neutral-700 flex items-center justify-center font-bold text-4xl mb-4">
                      {selectedCandidate.candidateNumber}
                    </div>
                    <span className="text-sm">No photo available</span>
                  </div>
                )}
                
                {/* Overlay candidate info at the bottom of the photo */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-24 pointer-events-none">
                  <div className="flex items-end gap-4">
                    <div className="text-5xl font-black text-gold-500 leading-none">
                      {selectedCandidate.candidateNumber}
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white mb-1">{selectedCandidate.fullName}</div>
                      <div className="text-sm font-medium text-neutral-300">{selectedCandidate.department}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmSubmit}
        title="Submit Scores?"
        message={`Are you sure you want to submit your score for ${selectedCandidate?.fullName}? This action cannot be undone.`}
        confirmText="Yes, Submit Score"
        onConfirm={executeSubmit}
        onCancel={() => setConfirmSubmit(false)}
        loading={submitting}
        isDestructive={false}
      />
    </PageWrapper>
  );
};
