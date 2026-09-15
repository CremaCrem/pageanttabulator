import React, { useEffect, useState, useMemo } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { ICandidate, ICandidateResult, ISegmentBreakdown } from '../../types';
import { SEGMENTS } from '../../utils/constants';
import { PageLoader } from '../../components/ui/PageLoader';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

const getChampion = (data: any[]) => data.find(r => r.result?.rank === 1);
const getTop3 = (data: any[]) => data.filter(r => r.result?.preliminaryStatus === 'advancing');

const getMinorAwardResult = (data: any[], segmentId: string) => {
  const scored = data.map(row => {
    const b = row.breakdown.find((m: any) => m.segmentId === segmentId);
    return { 
      candidate: row.candidate, 
      rankSum: b ? b.rankSum : 0
    };
  }).filter(x => x.rankSum > 0);
  
  if (scored.length === 0) return { status: 'pending' };
  
  const minRankSum = Math.min(...scored.map(x => x.rankSum));
  const winners = scored.filter(x => x.rankSum === minRankSum);
  
  if (winners.length === 1) {
    return { status: 'winner', winner: winners[0] };
  } else {
    return { status: 'tied', winners };
  }
};

const ChampionCard = ({ title, data }: { title: string, data: any }) => {
  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-panel border border-neutral-100 p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
        <h3 className="text-xl font-display font-bold text-neutral-400 mb-2">{title}</h3>
        <p className="text-sm text-neutral-500">Awaiting Final Results</p>
      </div>
    );
  }

  const { candidate, result } = data;
  return (
    <div className="bg-gold-50/30 rounded-xl shadow-panel border border-gold-400 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden h-full min-h-[300px]">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gold-500"></div>
      <h3 className="text-xl font-display font-bold text-primary-900 mb-6">{title}</h3>
      
      {candidate.photoPath ? (
        <img src={candidate.photoPath} alt={`Photo of ${candidate.fullName}`} className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-gold mb-4" />
      ) : (
        <div className="w-32 h-32 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center text-3xl font-display font-bold border-4 border-white shadow-gold mb-4">
          #{candidate.candidateNumber}
        </div>
      )}
      
      <div className="text-xs font-bold tracking-widest text-gold-600 uppercase mb-1">Rank 1 — Champion</div>
      <h2 className="text-2xl font-display font-black text-primary-900 mb-1">{candidate.fullName}</h2>
      <div className="text-sm text-neutral-600 font-medium mb-4">Candidate #{candidate.candidateNumber}</div>
      
      {typeof result?.finalScore === 'number' && (
        <div className="inline-block bg-primary-900 text-gold-400 px-5 py-2 rounded-full font-black text-lg shadow-card">
          {result.finalScore.toFixed(2)}
        </div>
      )}
    </div>
  );
};

const PodiumRow = ({ title, data }: { title: string, data: any[] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-panel border border-neutral-100 p-6 flex flex-col items-center justify-center text-center min-h-[150px]">
        <h3 className="text-lg font-bold text-neutral-400 mb-1">{title}</h3>
        <p className="text-sm text-neutral-500">Awaiting Preliminary Results</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-panel border border-neutral-100 p-6">
      <h3 className="text-lg font-bold text-primary-900 mb-4">{title}</h3>
      <div className="flex flex-col space-y-3">
        {data.map((row) => (
          <div key={row.candidate.id} className="flex items-center p-3 rounded-lg bg-neutral-50 border border-neutral-100">
            <div className="w-10 h-10 shrink-0 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-sm mr-4">
              {row.result?.rank ? `${row.result.rank}${['st','nd','rd'][row.result.rank-1]||'th'}` : 'Top 3'}
            </div>
            {row.candidate.photoPath ? (
              <img src={row.candidate.photoPath} alt="" className="w-10 h-10 rounded-full object-cover mr-4 shadow-sm" />
            ) : (
              <div className="w-10 h-10 shrink-0 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center font-bold text-xs mr-4">
                #{row.candidate.candidateNumber}
              </div>
            )}
            <div className="flex-grow min-w-0">
              <div className="font-bold text-neutral-800 truncate">{row.candidate.fullName}</div>
              <div className="text-xs text-neutral-500">Candidate #{row.candidate.candidateNumber}</div>
            </div>
            <div className="text-right shrink-0 ml-4">
              {typeof row.result?.finalScore === 'number' ? (
                <div className="font-black text-primary-800">{row.result.finalScore.toFixed(2)}</div>
              ) : typeof row.result?.preliminaryScore === 'number' ? (
                <div className="font-bold text-primary-600">{row.result.preliminaryScore.toFixed(2)} <span className="text-xs font-normal text-neutral-400 block">Prelim Sum</span></div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AwardCard = ({ title, result }: { title: string, result: any }) => {
  if (result.status === 'pending') {
    return (
      <div className="bg-white rounded-xl border border-neutral-100 p-4 flex items-center justify-between text-neutral-400 shadow-sm h-full">
        <span className="font-semibold text-sm">{title}</span>
        <span className="text-xs font-medium">Pending</span>
      </div>
    );
  }
  
  if (result.status === 'tied') {
    const candidateNumbers = result.winners.map((w: any) => `#${w.candidate.candidateNumber}`).join(', ');
    return (
      <div className="bg-warning-light/30 rounded-xl border-l-4 border-l-warning border-t border-r border-b border-warning-border p-4 flex items-center justify-between shadow-sm h-full">
        <div className="min-w-0 mr-4">
          <div className="text-[10px] font-bold text-warning-dark uppercase tracking-wider mb-1">{title}</div>
          <div className="font-bold text-warning-dark truncate">Tied — Resolution Required</div>
          <div className="text-xs text-warning-dark/70 mt-1">Candidates {candidateNumbers}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-black text-warning-dark text-lg">{result.winners[0].rankSum}</div>
          <div className="text-[10px] text-warning-dark/70 uppercase tracking-wider">Score</div>
        </div>
      </div>
    );
  }

  const { winner } = result;
  return (
    <div className="bg-white rounded-xl border-l-4 border-l-gold-500 border-t border-r border-b border-neutral-100 p-4 flex items-center justify-between shadow-sm h-full hover:bg-gold-50/30 transition-colors">
      <div className="min-w-0 mr-4">
        <div className="text-[10px] font-bold text-gold-600 uppercase tracking-wider mb-1">{title}</div>
        <div className="font-bold text-neutral-800 truncate">{winner.candidate.fullName}</div>
        <div className="text-xs text-neutral-500">#{winner.candidate.candidateNumber} {winner.candidate.gender === 'male' ? '(M)' : '(F)'}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-black text-primary-800 text-lg">{winner.rankSum}</div>
        <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Score</div>
      </div>
    </div>
  );
};

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
        if (a.result?.rank && b.result?.rank) return a.result.rank - b.result.rank;
        const aPrelim = a.result?.preliminaryScore || 9999;
        const bPrelim = b.result?.preliminaryScore || 9999;
        return aPrelim - bPrelim;
      });
  };

  const maleData = useMemo(() => getCandidateData('male'), [candidates, results, breakdown]);
  const femaleData = useMemo(() => getCandidateData('female'), [candidates, results, breakdown]);

  const maleChampion = useMemo(() => getChampion(maleData), [maleData]);
  const femaleChampion = useMemo(() => getChampion(femaleData), [femaleData]);
  const maleTop3 = useMemo(() => getTop3(maleData), [maleData]);
  const femaleTop3 = useMemo(() => getTop3(femaleData), [femaleData]);

  if (loading) {
    return <PageWrapper><PageLoader label="Loading Data..." /></PageWrapper>;
  }

  const renderTable = (title: string, data: any[]) => (
    <div className="bg-white rounded-xl shadow-panel overflow-hidden border border-neutral-100 mb-8">
      <div className="p-6 border-b border-neutral-100 bg-neutral-50">
        <h3 className="text-lg font-bold text-neutral-800">{title}</h3>
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
                  {typeof row.result?.preliminaryScore === 'number' ? row.result.preliminaryScore.toFixed(2) : '-'}
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
      {/* 1. Event / Results Context */}
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-heading-1 text-primary-900">Official Results</h1>
          <p className="text-neutral-500">Verified rankings, champions, and detailed tabulation data.</p>
        </div>
        <Button 
          onClick={async () => {
            setLoading(true);
            setError('');
            try {
              await fetchApi('/api/results/compute', { method: 'POST', body: JSON.stringify({ round: 'preliminary' }) });
              await fetchApi('/api/results/compute', { method: 'POST', body: JSON.stringify({ round: 'final' }) });
              await fetchApi('/api/results/compute', { method: 'POST', body: JSON.stringify({ round: 'minor_awards' }) });
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
          className="shrink-0"
        >
          Recompute All Results
        </Button>
      </div>
      
      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {/* 2. Tie Resolution / Critical Warnings */}
      {candidates.some(c => c.isInTiebreak) && (
        <Alert variant="error" title="Finals Tie Detected — Tie-Breaking Q&A" className="mb-8 shadow-sm">
          Tied finalists have been auto-flagged. Go to the Dashboard and open the Tie-Breaking Q&A segment.
        </Alert>
      )}

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
            <Alert variant="warning" title={`${group.title} Preliminary Boundary Tie Detected`} className="mb-4 shadow-sm">
              Candidates <strong>{tiedNumbers}</strong> have tied at the boundary, exceeding available Top 3 slots.
              The judges must decide offline who advances.
              <br />Once decided, use the override below:
            </Alert>

            <div className="flex flex-wrap items-center gap-4 bg-white p-5 rounded-xl border border-warning-border shadow-sm">
              <input
                type="password"
                placeholder="Admin PIN"
                value={overridePin}
                onChange={e => setOverridePin(e.target.value)}
                className="p-2.5 border border-neutral-300 rounded-lg focus:border-warning outline-none w-36 transition-colors"
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
            {overrideError && <div className="mt-2 text-sm text-red-600 font-bold px-2">{overrideError}</div>}
          </div>
        );
      })}

      {results.length === 0 ? (
        <div className="bg-white rounded-xl shadow-panel border border-neutral-100 p-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center text-3xl font-bold mb-6">?</div>
          <h2 className="text-2xl font-bold text-neutral-800 mb-2">No Results Computed</h2>
          <p className="text-neutral-500 max-w-md">Tabulate scores from the dashboard or click "Recompute All Results" to view champions and standings.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* 3. Championship Presentation */}
          <section>
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 ml-1">Championship</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ChampionCard title="Mr. IDSC 2026" data={maleChampion} />
              <ChampionCard title="Ms. IDSC 2026" data={femaleChampion} />
            </div>
          </section>

          {/* 4. Top 3 Podium */}
          <section>
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 ml-1">Top 3 Placements</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <PodiumRow title="Male Top 3" data={maleTop3} />
              <PodiumRow title="Female Top 3" data={femaleTop3} />
            </div>
          </section>

          {/* 5. Special / Minor Awards */}
          {(() => {
            const minorSegments = Object.values(SEGMENTS).filter(s => s.category === 'minor_award');
            if (minorSegments.length === 0) return null;

            return (
              <section>
                <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 ml-1">Special Awards</h2>
                <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {minorSegments.map(seg => {
                      const mResult = getMinorAwardResult(maleData, seg.id);
                      const fResult = getMinorAwardResult(femaleData, seg.id);
                      return (
                        <React.Fragment key={seg.id}>
                          <AwardCard title={`${seg.label} (Male)`} result={mResult} />
                          <AwardCard title={`${seg.label} (Female)`} result={fResult} />
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })()}

          {/* 6. Detailed Official Results */}
          <section className="pt-8 border-t-2 border-dashed border-neutral-200">
            <div className="mb-6 ml-1">
              <h2 className="text-xl font-bold text-primary-900">Official Tabulation Data</h2>
              <p className="text-sm text-neutral-500">Detailed standings and Borda Count verification data.</p>
            </div>
            
            {renderTable('Male Detailed Standings', maleData)}
            {renderTable('Female Detailed Standings', femaleData)}

            {(() => {
              const minorSegments = Object.values(SEGMENTS).filter(s => s.category === 'minor_award');
              if (minorSegments.length === 0) return null;

              return (
                <div className="bg-white rounded-xl shadow-panel overflow-hidden border border-neutral-100 mb-8">
                  <div className="p-6 border-b border-neutral-100 bg-neutral-50">
                    <h3 className="text-lg font-bold text-neutral-800">Minor Awards Breakdown</h3>
                    <p className="text-sm text-neutral-500">Simple Average scores or Rank Sum values per candidate.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-neutral-100/50">
                          <th className="p-4 font-semibold text-neutral-600 border-b whitespace-nowrap">Candidate</th>
                          {minorSegments.map(seg => (
                            <th key={seg.id} className="p-4 font-semibold text-neutral-600 border-b text-center whitespace-nowrap">{seg.label}</th>
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
          </section>
        </div>
      )}
    </PageWrapper>
  );
};
