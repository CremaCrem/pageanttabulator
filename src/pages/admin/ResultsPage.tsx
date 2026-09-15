import React, { useEffect, useState, useMemo } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { ICandidate, ICandidateResult, ISegmentBreakdown } from '../../types';
import { SEGMENTS } from '../../utils/constants';
import { PageLoader } from '../../components/ui/PageLoader';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export const ResultsPage: React.FC = () => {
  const [candidates, setCandidates] = useState<ICandidate[]>([]);
  const [results, setResults] = useState<ICandidateResult[]>([]);
  const [breakdown, setBreakdown] = useState<ISegmentBreakdown[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [overridePin, setOverridePin] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [candRes, resRes, brkRes] = await Promise.all([
          fetchApi('/api/candidates'),
          fetchApi('/api/results'),
          fetchApi('/api/results/breakdown')
        ]);
        setCandidates(candRes);
        setResults(resRes);
        setBreakdown(brkRes);
      } catch (err: any) {
        setError('Failed to load results data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getCandidateData = (gender: 'male' | 'female') => {
    return candidates
      .filter(c => c.gender === gender)
      .map(c => {
        const result = results.find(r => r.candidateId === c.id);
        const cBreakdown = breakdown.filter(b => b.candidateId === c.id);
        return {
          candidate: c,
          result,
          breakdown: cBreakdown
        };
      })
      .sort((a, b) => {
        // Sort by final rank if available, else preliminary score (rank sum)
        if (a.result?.rank && b.result?.rank) return a.result.rank - b.result.rank;
        const aPrelim = a.result?.preliminaryScore || 9999;
        const bPrelim = b.result?.preliminaryScore || 9999;
        return aPrelim - bPrelim; // lower rank sum is better
      });
  };

  const maleData = useMemo(() => getCandidateData('male'), [candidates, results, breakdown]);
  const femaleData = useMemo(() => getCandidateData('female'), [candidates, results, breakdown]);

  if (loading) {
    return <PageWrapper><PageLoader label="Loading Data..." /></PageWrapper>;
  }

  const renderTable = (title: string, data: any[]) => (
    <div className="bg-white rounded-xl shadow-panel overflow-hidden border border-neutral-100 mb-8">
      <div className="p-6 border-b border-neutral-100 bg-neutral-50">
        <h2 className="text-xl font-bold text-neutral-800">{title}</h2>
        <p className="text-sm text-neutral-500">Borda Count: Lowest rank sum wins.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-100/50">
              <th className="p-4 font-semibold text-neutral-600 border-b whitespace-nowrap">Candidate</th>
              {Object.values(SEGMENTS).filter(s => s.category !== 'minor_award').map(seg => (
                <th key={seg.id} className="p-4 font-semibold text-neutral-600 border-b text-center whitespace-nowrap">{seg.label} (Rank)</th>
              ))}
              <th className="p-4 font-semibold text-primary-700 border-b text-center whitespace-nowrap bg-primary-50/50">Prelim Rank Sum</th>
              <th className="p-4 font-semibold text-primary-900 border-b text-center">Placement</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr 
                key={row.candidate.id} 
                className={`border-b border-neutral-50 hover:bg-gold-50 transition-colors ${row.result?.preliminaryStatus === 'advancing' ? 'bg-green-50/30' : (row.result?.preliminaryStatus === 'excluded' ? 'bg-red-50/10' : (i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'))}`}
              >
                <td className="p-4 font-medium text-neutral-800 whitespace-nowrap">
                  <span className="text-primary-600 font-bold mr-2">#{row.candidate.candidateNumber}</span>
                  {row.candidate.fullName}
                  {row.result?.preliminaryStatus === 'advancing' && <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-bold">Top 3</span>}
                  {row.result?.preliminaryStatus === 'excluded' && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Excluded</span>}
                </td>
                {Object.values(SEGMENTS).filter(s => s.category !== 'minor_award').map(seg => {
                  const b = row.breakdown.find((x: any) => x.segmentId === seg.id);
                  return (
                    <td key={seg.id} className="p-4 text-center text-neutral-600 whitespace-nowrap">
                      {b ? (
                        <div>
                          <div className="font-bold text-neutral-800">{b.finalRank}</div>
                          <div className="text-xs text-neutral-400">Sum: {b.rankSum}</div>
                        </div>
                      ) : '-'}
                    </td>
                  );
                })}
                <td className="p-4 text-center font-bold text-primary-700 text-lg bg-primary-50/30">
                  {row.result?.preliminaryScore !== undefined ? row.result.preliminaryScore.toFixed(2) : '-'}
                </td>
                <td className="p-4 text-center font-black text-primary-900 text-xl">
                  {row.result?.rank ? `#${row.result.rank}` : '-'}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-neutral-400">No candidates found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <PageWrapper>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-heading-1 text-primary-900">Official Results (Borda Count)</h1>
          <p className="text-neutral-500">Verified rankings and composite scores based on judge rank sums.</p>
        </div>
        <Button 
          onClick={async () => {
            setLoading(true);
            setError('');
            try {
              await fetchApi('/api/results/compute', { method: 'POST', body: JSON.stringify({ round: 'preliminary' }) });
              await fetchApi('/api/results/compute', { method: 'POST', body: JSON.stringify({ round: 'final' }) });
              await fetchApi('/api/results/compute', { method: 'POST', body: JSON.stringify({ round: 'minor_awards' }) });
              // Refresh state in-place instead of full page reload
              const [candRes, resRes, brkRes] = await Promise.all([
                fetchApi('/api/candidates'),
                fetchApi('/api/results'),
                fetchApi('/api/results/breakdown')
              ]);
              setCandidates(candRes);
              setResults(resRes);
              setBreakdown(brkRes);
            } catch (err) {
              setError('Failed to compute results');
            } finally {
              setLoading(false);
            }
          }}
        >
          Recompute All Results
        </Button>
      </div>
      
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {/* Finals Tie Banner */}
      {candidates.some(c => c.isInTiebreak) && (
        <Alert variant="error" title="Finals Tie Detected — Tie-Breaking Q&A" className="mb-8">
          Tied finalists have been auto-flagged. Go to the Dashboard and open the Tie-Breaking Q&A segment.
        </Alert>
      )}

      {/* Preliminary Tie Overrides */}
      {[
        { title: 'Male', data: maleData },
        { title: 'Female', data: femaleData }
      ].map(group => {
        const pendingCandidates = group.data.filter(row => row.result?.preliminaryStatus === 'pending_override');
        if (pendingCandidates.length === 0) return null;

        const tiedNumbers = pendingCandidates.map(r => `#${r.candidate.candidateNumber}`).join(', ');

        const handleAdvance = async (advanceId: string, retreatIds: string[]) => {
          setOverrideLoading(true);
          setOverrideError('');
          try {
            const resolutions = [
              { candidateId: advanceId, resolution: 'advance' },
              ...retreatIds.map(id => ({ candidateId: id, resolution: 'exclude' }))
            ];
            
            await fetchApi('/api/admin/resolve-tie', {
              method: 'POST',
              body: JSON.stringify({ pin: overridePin, stage: 'preliminary_boundary', resolutions })
            });

            // Recompute results immediately
            await fetchApi('/api/results/compute', { method: 'POST', body: JSON.stringify({ round: 'preliminary' }) });
            await fetchApi('/api/results/compute', { method: 'POST', body: JSON.stringify({ round: 'final' }) });
            
            setOverridePin('');
            const [candRes, resRes, brkRes] = await Promise.all([
              fetchApi('/api/candidates'),
              fetchApi('/api/results'),
              fetchApi('/api/results/breakdown')
            ]);
            setCandidates(candRes);
            setResults(resRes);
            setBreakdown(brkRes);
          } catch (err: any) {
            setOverrideError(err.message || 'Failed to apply override');
          } finally {
            setOverrideLoading(false);
          }
        };

        return (
          <div key={`${group.title}-tie`} className="mb-8">
            <Alert variant="warning" title={`${group.title} Preliminary Boundary Tie Detected`} className="mb-4">
              Candidates <strong>{tiedNumbers}</strong> have tied at the boundary, exceeding available Top 3 slots.
              The judges must decide offline who advances.
              <br />Once decided, use the override below:
            </Alert>

            <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
              <input
                type="password"
                placeholder="Admin PIN"
                value={overridePin}
                onChange={e => setOverridePin(e.target.value)}
                className="p-2 border border-neutral-300 rounded focus:border-amber-500 outline-none w-32"
              />

              {pendingCandidates.map(row => {
                const retreatIds = pendingCandidates
                  .filter(r => r.candidate.id !== row.candidate.id)
                  .map(r => r.candidate.id);
                return (
                  <Button
                    key={row.candidate.id}
                    disabled={overrideLoading || !overridePin}
                    onClick={() => handleAdvance(row.candidate.id, retreatIds)}
                    variant="warning"
                  >
                    Advance #{row.candidate.candidateNumber} ({row.candidate.fullName}) to Top 3
                  </Button>
                );
              })}
            </div>
            {overrideError && <div className="mt-2 text-sm text-red-600 font-bold">{overrideError}</div>}
          </div>
        );
      })}


      {renderTable('Male Standings', maleData)}
      {renderTable('Female Standings', femaleData)}

      {(() => {
        const minorSegments = Object.values(SEGMENTS).filter(s => s.category === 'minor_award');
        if (minorSegments.length === 0) return null;

        return (
          <div className="bg-white rounded-xl shadow-panel overflow-hidden border border-neutral-100 mb-8">
            <div className="p-6 border-b border-neutral-100 bg-neutral-50">
              <h2 className="text-xl font-bold text-neutral-800">Minor Awards Standings</h2>
              <p className="text-sm text-neutral-500">Borda Count: Lowest rank sum wins.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-100/50">
                    <th className="p-4 font-semibold text-neutral-600 border-b whitespace-nowrap">Candidate</th>
                    {minorSegments.map(seg => (
                      <th key={seg.id} className="p-4 font-semibold text-neutral-600 border-b text-center whitespace-nowrap">{seg.label} (Rank Sum)</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate, i) => (
                    <tr 
                      key={candidate.id} 
                      className={`border-b border-neutral-50 hover:bg-gold-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}`}
                    >
                      <td className="p-4 font-medium text-neutral-800 whitespace-nowrap">
                        <span className="text-primary-600 font-bold mr-2">#{candidate.candidateNumber}</span>
                        {candidate.fullName} ({candidate.gender === 'male' ? 'M' : 'F'})
                      </td>
                      {minorSegments.map(seg => {
                        const b = breakdown.find(m => m.candidateId === candidate.id && m.segmentId === seg.id);
                        return (
                          <td key={seg.id} className="p-4 text-center text-neutral-600 whitespace-nowrap font-bold">
                            {b && b.rankSum > 0 ? b.rankSum : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-neutral-400">No candidates found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

    </PageWrapper>
  );
};
