import React, { useEffect, useState, useRef } from 'react';
import { fetchApi } from '../../api/client';
import { ICandidate, IJudge, IManualScoreEntryRequest, IScoreCorrectionRequest } from '../../types';
import { useToast } from '../../context/ToastContext';
import { SEGMENTS } from '../../utils/constants';
import { useDirtyState } from '../../hooks/useDirtyState';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export const ManualScoreEntryPage: React.FC = () => {
  const { success } = useToast();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [verifiedPin, setVerifiedPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [judges, setJudges] = useState<IJudge[]>([]);
  const [allCandidates, setAllCandidates] = useState<ICandidate[]>([]);
  const [candidates, setCandidates] = useState<ICandidate[]>([]);
  const [top3Ids, setTop3Ids] = useState<Set<string>>(new Set());

  const [selectedJudgeId, setSelectedJudgeId] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  
  const [scores, setScores] = useState<Record<string, number | ''>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Correction mode: set when this judge already has a submitted score for this
  // candidate + segment. Judges can never edit their own score, so the Admin does it
  // on their behalf — see docs/scoped/scoring-logic.md §2.1.
  const [existingScoreId, setExistingScoreId] = useState<string | null>(null);
  const [originalScore, setOriginalScore] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [checkingExisting, setCheckingExisting] = useState(false);

  const [pendingChange, setPendingChange] = useState<{ type: 'segment' | 'candidate', id: string } | null>(null);

  // Snapshot of what was prefilled in correction mode, so untouched prefilled values
  // don't count as unsaved work and nag on every candidate switch.
  const [prefilled, setPrefilled] = useState<Record<string, number | ''> | null>(null);

  const isDirty = React.useMemo(() => {
    if (prefilled) {
      return JSON.stringify(scores) !== JSON.stringify(prefilled);
    }
    return Object.values(scores).some(val => val !== undefined && val !== '');
  }, [scores, prefilled]);

  useDirtyState(isDirty);

  // Unlock PIN
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput) return;
    setVerifying(true);
    setPinError('');
    try {
      const res: any = await fetchApi('/api/admin/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin: pinInput }),
      });
      if (res.valid) {
        setVerifiedPin(pinInput);
        setIsUnlocked(true);
      } else {
        setPinError('Invalid PIN');
      }
    } catch (err: any) {
      setPinError('Error verifying PIN');
    } finally {
      setVerifying(false);
    }
  };

  // Load basic data after unlock
  useEffect(() => {
    if (!isUnlocked) return;
    const loadData = async () => {
      try {
        const j: IJudge[] = await fetchApi('/api/judges');
        setJudges(j);
        const c: ICandidate[] = await fetchApi('/api/candidates');
        setAllCandidates(c.sort((a, b) => a.candidateNumber.localeCompare(b.candidateNumber)));
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    };
    loadData();
  }, [isUnlocked]);

  // Fetch results if final_qa
  useEffect(() => {
    if (!isUnlocked || selectedSegmentId !== 'final_qa') return;
    const loadResults = async () => {
      try {
        const res: any[] = await fetchApi('/api/results');
        const top3 = new Set<string>();
        res.forEach(r => {
          if (r.preliminaryStatus === 'advancing') top3.add(r.candidateId);
        });
        setTop3Ids(top3);
      } catch (err) {
        console.error("Failed to load results", err);
      }
    };
    loadResults();
  }, [isUnlocked, selectedSegmentId]);

  // Candidate filtering
  useEffect(() => {
    if (!selectedSegmentId) {
      setCandidates([]);
      return;
    }
    
    let eligible = allCandidates.filter(c => c.isEligible);

    if (selectedSegmentId === 'tie_breaking_qa') {
      eligible = eligible.filter(c => c.isInTiebreak);
    } else if (selectedSegmentId === 'final_qa') {
      eligible = eligible.filter(c => top3Ids.has(c.id));
    }

    setCandidates(eligible);
  }, [allCandidates, selectedSegmentId, top3Ids]);
  
  // Clear scores and candidate when segment changes
  useEffect(() => {
    setScores({});
    setSelectedCandidateId('');
    setError('');
    setExistingScoreId(null);
    setOriginalScore(null);
    setPrefilled(null);
    setReason('');
  }, [selectedSegmentId]);

  // Detect an already-submitted score for this judge + candidate + segment. If one
  // exists, switch the form into correction mode and prefill what the judge entered.
  useEffect(() => {
    if (!isUnlocked || !selectedJudgeId || !selectedSegmentId || !selectedCandidateId) {
      setExistingScoreId(null);
      setOriginalScore(null);
      setPrefilled(null);
      return;
    }
    let cancelled = false;
    const checkExisting = async () => {
      setCheckingExisting(true);
      try {
        const judgeScores: Array<{
          id: string;
          candidateId: string;
          segmentId: string;
          criteriaJson: string;
          computedScore: number;
        }> = await fetchApi(`/api/scores/judge/${selectedJudgeId}`);

        const match = judgeScores.find(
          s => s.candidateId === selectedCandidateId && s.segmentId === selectedSegmentId
        );

        if (cancelled) return;

        if (match) {
          setExistingScoreId(match.id);
          setOriginalScore(match.computedScore);
          try {
            const parsed: Array<{ criterionId: string; score: number }> = JSON.parse(match.criteriaJson);
            const prefilledScores: Record<string, number | ''> = {};
            parsed.forEach(e => { prefilledScores[e.criterionId] = e.score; });
            setScores(prefilledScores);
            setPrefilled(prefilledScores);
          } catch {
            setError('This score exists but its criteria could not be read. Correct it manually.');
          }
        } else {
          setExistingScoreId(null);
          setOriginalScore(null);
          setPrefilled(null);
        }
      } catch {
        if (!cancelled) setError('Could not check for an existing score.');
      } finally {
        if (!cancelled) setCheckingExisting(false);
      }
    };
    checkExisting();
    return () => { cancelled = true; };
  }, [isUnlocked, selectedJudgeId, selectedSegmentId, selectedCandidateId]);

  const handleSegmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value;
    if (isDirty) {
      setPendingChange({ type: 'segment', id: nextId });
    } else {
      setSelectedSegmentId(nextId);
    }
  };

  const handleCandidateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value;
    if (isDirty) {
      setPendingChange({ type: 'candidate', id: nextId });
    } else {
      setSelectedCandidateId(nextId);
      setScores({});
      setError('');
    }
  };

  const confirmDiscard = () => {
    if (pendingChange?.type === 'segment') {
      setSelectedSegmentId(pendingChange.id);
    } else if (pendingChange?.type === 'candidate') {
      setSelectedCandidateId(pendingChange.id);
      setScores({});
      setError('');
    }
    setPendingChange(null);
  };

  const cancelDiscard = () => {
    setPendingChange(null);
  };

  const activeSegment = selectedSegmentId ? SEGMENTS[selectedSegmentId as keyof typeof SEGMENTS] : null;
  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedCandidateId && activeSegment) {
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 0);
    }
  }, [selectedCandidateId, activeSegment]);

  const handleScoreChange = (criterionId: string, val: string) => {
    if (val === '') {
      setScores(prev => ({ ...prev, [criterionId]: '' }));
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setScores(prev => ({ ...prev, [criterionId]: num }));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSegment || !selectedCandidateId || !selectedJudgeId) return;

    // Validate
    let hasError = false;
    activeSegment.criteria.forEach((crit: any) => {
      const val = scores[crit.id];
      if (val === undefined || val === '') {
        hasError = true;
      } else if (Number(val) < 1 || Number(val) > 100) {
        hasError = true;
      }
    });

    if (hasError) {
      setError('Please ensure all criteria have a valid score between 1 and 100.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const criteriaEntries = activeSegment.criteria.map((c: any) => ({
        criterionId: c.id,
        score: Number(scores[c.id])
      }));

      if (existingScoreId) {
        // Correcting a locked score on the judge's behalf — a reason is mandatory
        // because it becomes the audit-log record of the override.
        if (!reason.trim()) {
          setError('A reason is required to correct a submitted score.');
          setSubmitting(false);
          return;
        }
        const correction: IScoreCorrectionRequest = {
          pin: verifiedPin,
          judgeId: selectedJudgeId,
          candidateId: selectedCandidateId,
          segmentId: activeSegment.id,
          criteriaEntries,
          reason: reason.trim()
        };
        await fetchApi('/api/admin/correct-score', {
          method: 'POST',
          body: JSON.stringify(correction)
        });
        success(`Score corrected for ${selectedCandidate?.fullName}`);
      } else {
        const payload: IManualScoreEntryRequest = {
          pin: verifiedPin,
          judgeId: selectedJudgeId,
          candidateId: selectedCandidateId,
          segmentId: activeSegment.id,
          criteriaEntries
        };

        await fetchApi('/api/admin/manual-score-entry', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        success(`Score successfully entered for ${selectedCandidate?.fullName}`);
      }

      setScores({});
      setReason('');
      setExistingScoreId(null);
      setOriginalScore(null);
      setPrefilled(null);
      
      const currentIndex = candidates.findIndex(c => c.id === selectedCandidateId);
      if (currentIndex >= 0 && currentIndex < candidates.length - 1) {
        setSelectedCandidateId(candidates[currentIndex + 1].id);
      } else {
        setSelectedCandidateId('');
      }
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to submit score');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isUnlocked) {
    return (
      <PageWrapper>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-heading-1 text-primary-900">Manual Score Entry</h1>
            <p className="text-neutral-500">Secure operator fallback and rapid data entry</p>
          </div>
        </div>
        <div className="p-6 max-w-sm mx-auto mt-12 bg-white rounded-xl shadow-panel text-center border border-neutral-100">
          <p className="text-sm text-neutral-500 mb-6">Enter admin PIN to unlock.</p>
          <form onSubmit={handleUnlock} className="flex gap-2">
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="flex-1 min-w-0 form-control text-center tracking-widest text-lg"
              placeholder="PIN"
              autoFocus
            />
            <Button
              type="submit"
              disabled={verifying || !pinInput}
              isLoading={verifying}
              loadingText="..."
            >
              Unlock
            </Button>
          </form>
          {pinError && <p className="text-red-500 text-sm mt-3">{pinError}</p>}
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-heading-1 text-primary-900">Manual Score Entry</h1>
          <p className="text-neutral-500">Secure operator fallback and rapid data entry</p>
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-panel overflow-hidden border border-neutral-100">
          
          {/* SCORING CONTEXT */}
          <div className="bg-neutral-50 p-6 border-b border-neutral-200">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Judge</label>
            <select
              value={selectedJudgeId}
              onChange={e => setSelectedJudgeId(e.target.value)}
              className="w-full form-control"
            >
              <option value="">-- Select Judge --</option>
              {judges.map(j => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Segment</label>
            <select
              value={selectedSegmentId}
              onChange={handleSegmentChange}
              className="w-full form-control"
            >
              <option value="">-- Select Segment --</option>
              {Object.values(SEGMENTS).map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

          {selectedSegmentId && candidates.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Candidate</label>
              <select
                value={selectedCandidateId}
                onChange={handleCandidateChange}
                className="w-full form-control text-lg font-semibold py-3"
              >
                <option value="">-- Select Candidate --</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.candidateNumber} - {c.fullName} ({c.gender})
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedSegmentId && candidates.length === 0 && (
            <div className="text-sm text-neutral-500 italic mt-4">
              No eligible candidates for this segment.
            </div>
          )}
        </div>

        {/* SCORE ENTRY */}
        {activeSegment && selectedCandidateId && (
          <div className="p-6">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-100">
                <h3 className="text-lg font-bold text-neutral-800">Criteria Scoring</h3>
                <div className="text-right">
                  <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Active Candidate</div>
                  <div className="text-sm font-semibold text-primary-700">
                    {selectedCandidate?.candidateNumber} - {selectedCandidate?.fullName}
                  </div>
                </div>
              </div>
            
            {error && (
              <Alert variant="error" className="mb-4">
                {error}
              </Alert>
            )}

            <div className="space-y-3 mb-6">
              {activeSegment.criteria.map((crit: any, i: number) => (
                <div key={crit.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div>
                    <div className="font-semibold">{crit.label}</div>
                    <div className="text-xs text-neutral-500">Weight: {crit.weight * 100}%</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={i === 0 ? firstInputRef : null}
                      type="number"
                      min="1"
                      max="100"
                      value={scores[crit.id] === undefined ? '' : scores[crit.id]}
                      onChange={(e) => handleScoreChange(crit.id, e.target.value)}
                      className="w-20 text-center form-control font-mono text-lg"
                      placeholder="—"
                    />
                    <span className="text-sm text-neutral-400">/100</span>
                  </div>
                </div>
              ))}
            </div>

            {existingScoreId && (
              <div className="mb-6 space-y-3">
                <Alert variant="warning">
                  <div className="font-semibold">Correcting a submitted score</div>
                  <div className="text-sm mt-1">
                    This judge already submitted
                    {originalScore !== null && <strong> {originalScore.toFixed(2)}</strong>} for this
                    candidate. Only proceed once the pageant coordinator and auditor have approved
                    the correction. The change is written to the audit log.
                  </div>
                </Alert>
                <div>
                  <label htmlFor="correction-reason" className="block text-sm font-medium text-neutral-700 mb-1">
                    Reason for correction <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="correction-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="w-full form-control"
                    placeholder="e.g. Judge transposed two scores; approved by coordinator and auditor"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || !selectedJudgeId || checkingExisting || (!!existingScoreId && !reason.trim())}
              isLoading={submitting}
              loadingText={existingScoreId ? 'Correcting...' : 'Submitting...'}
              className="w-full py-4 text-lg mt-2"
            >
              {existingScoreId ? 'Correct Score' : 'Submit Score'}
            </Button>
          </form>
        </div>
        )}
      </div>
      </div>

      <ConfirmModal
        isOpen={pendingChange !== null}
        title="Unsaved Scores"
        message="You have unsaved scores. Changing the candidate/segment will discard them."
        confirmText="Discard Scores"
        cancelText="Stay"
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
        variant="destructive"
      />
    </PageWrapper>
  );
};
