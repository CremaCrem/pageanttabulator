import React, { useEffect, useState } from 'react';
import { fetchApi } from '../../api/client';
import { ICandidate, ICandidateResult, ISpecialAward } from '../../types';
import { useAppContext } from '../../context/AppContext';

export const PrintReport: React.FC<{ onLoaded?: () => void }> = ({ onLoaded }) => {
  const { state } = useAppContext();
  const [candidates, setCandidates] = useState<ICandidate[]>([]);
  const [results, setResults] = useState<ICandidateResult[]>([]);
  const [awards, setAwards] = useState<ISpecialAward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cData, rData, aData] = await Promise.all([
          fetchApi('/api/candidates'),
          fetchApi('/api/results'),
          fetchApi('/api/results/special-awards'),
        ]);
        setCandidates(cData);
        setResults(rData);
        setAwards(aData);
      } catch (err) {
        console.error('Failed to load report data', err);
      } finally {
        setLoading(false);
        if (onLoaded) onLoaded();
      }
    };
    loadData();
  }, [onLoaded]);

  if (loading) return <div className="text-center p-8">Loading report data...</div>;

  const eventName = state.eventConfig?.name || 'Pageant Tabulator';
  const subtitle = state.eventConfig?.subtitle || '';

  // Helper to get candidate details
  const getCandidate = (id: string) => candidates.find(c => c.id === id);

  // Group results
  const maleResults = results.filter(r => getCandidate(r.candidateId)?.gender === 'male');
  const femaleResults = results.filter(r => getCandidate(r.candidateId)?.gender === 'female');

  // Helper to render table
  const renderTable = (data: ICandidateResult[], title: string) => {
    // Sort by rank, then fallback to descending prelim score
    const sorted = [...data].sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.rank) return -1;
      if (b.rank) return 1;
      return (b.preliminaryScore || 0) - (a.preliminaryScore || 0);
    });

    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold font-display text-primary-900 mb-4 border-b-2 border-gold-500 pb-2">{title}</h3>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-primary-50 text-primary-900">
              <th className="p-2 border border-neutral-200">Rank</th>
              <th className="p-2 border border-neutral-200">No.</th>
              <th className="p-2 border border-neutral-200">Candidate Name</th>
              <th className="p-2 border border-neutral-200 text-right">Prelim QA Score</th>
              <th className="p-2 border border-neutral-200 text-right">Final QA Score</th>
              <th className="p-2 border border-neutral-200 text-right">Final Overall</th>
              <th className="p-2 border border-neutral-200 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-neutral-500 border border-neutral-200">No results computed yet.</td></tr>
            ) : sorted.map((r, i) => {
              const c = getCandidate(r.candidateId);
              if (!c) return null;
              
              const isWinner = typeof r.rank === 'number' && r.rank <= 3;
              const status = isWinner ? (r.rank === 1 ? 'Champion' : `${(r.rank as number) - 1} Runner-Up`) : (r.isTop5 ? 'Top 5' : 'Unplaced');
              
              return (
                <tr key={r.candidateId} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                  <td className="p-2 border border-neutral-200 font-bold">{r.rank || '-'}</td>
                  <td className="p-2 border border-neutral-200">{c.candidateNumber}</td>
                  <td className="p-2 border border-neutral-200 font-semibold">{c.fullName}</td>
                  <td className="p-2 border border-neutral-200 text-right">{r.preliminaryScore?.toFixed(2) || '-'}</td>
                  <td className="p-2 border border-neutral-200 text-right">{r.finalQAScore?.toFixed(2) || '-'}</td>
                  <td className="p-2 border border-neutral-200 text-right font-bold text-primary-800">{r.finalScore?.toFixed(2) || '-'}</td>
                  <td className="p-2 border border-neutral-200 text-center font-semibold text-gold-600">{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderAwards = () => {
    return (
      <div className="mb-8">
        <h3 className="text-xl font-bold font-display text-primary-900 mb-4 border-b-2 border-gold-500 pb-2">Special Awards</h3>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-primary-50 text-primary-900">
              <th className="p-2 border border-neutral-200">Award</th>
              <th className="p-2 border border-neutral-200">Male Winner</th>
              <th className="p-2 border border-neutral-200">Female Winner</th>
            </tr>
          </thead>
          <tbody>
            {awards.length === 0 ? (
              <tr><td colSpan={3} className="p-4 text-center text-neutral-500 border border-neutral-200">No special awards computed.</td></tr>
            ) : awards.map((a, i) => {
              const male = getCandidate(a.winnerMaleId || '');
              const female = getCandidate(a.winnerFemaleId || '');
              
              // Format award id beautifully
              const title = a.awardId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              
              return (
                <tr key={a.awardId} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                  <td className="p-2 border border-neutral-200 font-bold text-primary-800">Best in {title}</td>
                  <td className="p-2 border border-neutral-200">{male ? `#${male.candidateNumber} ${male.fullName}` : '-'}</td>
                  <td className="p-2 border border-neutral-200">{female ? `#${female.candidateNumber} ${female.fullName}` : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white p-8 md:p-12 text-neutral-900 shadow-modal print:shadow-none print:p-0">
      <div className="text-center mb-10 pb-6 border-b-4 border-gold-500">
        <h1 className="text-4xl font-display font-bold text-primary-900 uppercase tracking-widest">{eventName}</h1>
        <h2 className="text-xl font-medium text-gold-600 mt-2 tracking-wide">{subtitle}</h2>
        <p className="text-sm text-neutral-500 mt-4 uppercase tracking-wider">Official Tabulation Report</p>
      </div>

      {renderTable(maleResults, "Male Category Rankings")}
      {renderTable(femaleResults, "Female Category Rankings")}
      {renderAwards()}
      
      <div className="mt-16 pt-8 border-t border-neutral-300 grid grid-cols-3 gap-8 text-center text-sm">
        <div>
          <div className="border-b border-black mb-2 mx-8 h-10"></div>
          <p className="font-semibold">Head Tabulator</p>
        </div>
        <div>
          <div className="border-b border-black mb-2 mx-8 h-10"></div>
          <p className="font-semibold">Head Auditor</p>
        </div>
        <div>
          <div className="border-b border-black mb-2 mx-8 h-10"></div>
          <p className="font-semibold">Event Chairman</p>
        </div>
      </div>
    </div>
  );
};
