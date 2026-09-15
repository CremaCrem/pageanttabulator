import React, { useEffect, useState, useRef } from 'react';
import { fetchApi } from '../../api/client';
import { ICandidate, IJudge, IManualScoreEntryRequest } from '../../types';
import { useToast } from '../../context/ToastContext';
import { SEGMENTS } from '../../utils/constants';
import { useDirtyState } from '../../hooks/useDirtyState';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

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

  const [pendingChange, setPendingChange] = useState<{ type: 'segment' | 'candidate', id: string } | null>(null);

  const isDirty = React.useMemo(() => {
    return Object.values(scores).some(val => val !== undefined && val !== '');
  }, [scores]);

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
  }, [selectedSegmentId]);

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
      setScores({});
      
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
      <div className="p-6 max-w-sm mx-auto mt-12 bg-white rounded-xl shadow-panel text-center">
        <h2 className="text-xl font-bold mb-4">Manual Score Entry</h2>
        <p className="text-sm text-neutral-500 mb-6">Enter admin PIN to unlock.</p>
        <form onSubmit={handleUnlock} className="flex gap-2">
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg text-lg text-center tracking-widest outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            placeholder="PIN"
            autoFocus
          />
          <button
            type="submit"
            disabled={verifying || !pinInput}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {verifying ? '...' : 'Unlock'}
          </button>
        </form>
        {pinError && <p className="text-red-500 text-sm mt-3">{pinError}</p>}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-panel">
        <h1 className="text-2xl font-bold text-primary-900 mb-6">Manual Score Entry</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Judge</label>
            <select
              value={selectedJudgeId}
              onChange={e => setSelectedJudgeId(e.target.value)}
              className="w-full p-2 border border-neutral-300 rounded-lg outline-none focus:border-primary-500"
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
              className="w-full p-2 border border-neutral-300 rounded-lg outline-none focus:border-primary-500"
            >
              <option value="">-- Select Segment --</option>
              {Object.values(SEGMENTS).map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedSegmentId && candidates.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Candidate</label>
            <select
              value={selectedCandidateId}
              onChange={handleCandidateChange}
              className="w-full p-2 border border-neutral-300 rounded-lg outline-none focus:border-primary-500"
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
          <div className="text-sm text-neutral-500 italic mb-6">
            No eligible candidates for this segment.
          </div>
        )}

        {activeSegment && selectedCandidateId && (
          <form onSubmit={handleSubmit} className="mt-8 border-t border-neutral-100 pt-6">
            <h3 className="text-lg font-semibold mb-4">Criteria</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm border border-red-200">
                {error}
              </div>
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
                      className="w-20 text-center text-lg p-2 border border-neutral-300 rounded outline-none focus:border-primary-500"
                      placeholder="—"
                    />
                    <span className="text-sm text-neutral-400">/100</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedJudgeId}
              className="w-full py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Score'}
            </button>
          </form>
        )}
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
    </div>
  );
};
