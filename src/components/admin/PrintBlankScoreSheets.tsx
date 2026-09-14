import React, { useEffect, useState } from 'react';
import { fetchApi } from '../../api/client';
import { ICandidate, IJudge, ICandidateResult } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { SEGMENTS } from '../../utils/constants';

interface Props {
  judgeIds: string[];
  segmentIds: string[];
  onLoaded?: () => void;
}

export const PrintBlankScoreSheets: React.FC<Props> = ({ judgeIds, segmentIds, onLoaded }) => {
  const { state } = useAppContext();
  const [judges, setJudges] = useState<IJudge[]>([]);
  const [candidates, setCandidates] = useState<ICandidate[]>([]);
  const [results, setResults] = useState<ICandidateResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const needsResults = segmentIds.includes('final_qa');
        const [jData, cData, rData] = await Promise.all([
          fetchApi('/api/judges'),
          fetchApi('/api/candidates'),
          needsResults ? fetchApi('/api/results') : Promise.resolve([]),
        ]);
        setJudges(jData);
        setCandidates(cData.sort((a: ICandidate, b: ICandidate) => a.candidateNumber.localeCompare(b.candidateNumber)));
        setResults(rData);
      } catch (err) {
        console.error('Failed to load blank sheets data', err);
      } finally {
        setLoading(false);
        if (onLoaded) onLoaded();
      }
    };
    loadData();
  }, [segmentIds, onLoaded]);

  if (judgeIds.length === 0 || segmentIds.length === 0) {
    if (onLoaded && !loading) {
      setTimeout(onLoaded, 100); // Trigger print even if error so we don't hang the page
    }
    return <div className="text-center p-8 text-red-600 font-bold">Error: Missing judges or segments in URL parameters.</div>;
  }

  if (loading) return <div className="text-center p-8">Loading sheets data...</div>;

  const eventName = state.eventConfig?.name || 'Pageant Tabulator';
  const subtitle = state.eventConfig?.subtitle || '';
  
  const top3Ids = new Set(results.filter(r => r.preliminaryStatus === 'advancing').map(r => r.candidateId));

  // Pre-calculate all combinations in order
  const sheets: { judge: IJudge, segmentId: string }[] = [];
  judgeIds.forEach(jid => {
    const j = judges.find(x => x.id === jid);
    if (j) {
      segmentIds.forEach(sid => {
        if (SEGMENTS[sid as keyof typeof SEGMENTS]) {
          sheets.push({ judge: j, segmentId: sid });
        }
      });
    }
  });

  return (
    <div className="w-full max-w-4xl mx-auto bg-white p-8 md:p-12 text-neutral-900 shadow-modal print:shadow-none print:p-0">
      {sheets.map((sheet, index) => {
        const isFirst = index === 0;
        const isLast = index === sheets.length - 1;
        const segment = SEGMENTS[sheet.segmentId as keyof typeof SEGMENTS];
        
        let eligible = candidates.filter(c => c.isEligible);
        if (sheet.segmentId === 'tie_breaking_qa') {
          eligible = eligible.filter(c => c.isInTiebreak);
        } else if (sheet.segmentId === 'final_qa') {
          eligible = eligible.filter(c => top3Ids.has(c.id));
        }

        return (
          <div key={`${sheet.judge.id}-${sheet.segmentId}`} style={{ pageBreakAfter: isLast ? 'auto' : 'always' }} className="mb-12 print:mb-0">
            
            {isFirst ? (
              <div className="text-center mb-10 pb-6 border-b-4 border-gold-500">
                <h1 className="text-4xl font-display font-bold text-primary-900 uppercase tracking-widest">{eventName}</h1>
                <h2 className="text-xl font-medium text-gold-600 mt-2 tracking-wide">{subtitle}</h2>
                <p className="text-sm text-neutral-500 mt-4 uppercase tracking-wider">Official Tabulation Report</p>
              </div>
            ) : (
              <div className="text-center mb-4 pb-2 border-b border-neutral-300">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{eventName}</p>
              </div>
            )}
            
            <div className={`${isFirst ? '' : 'pt-4'}`}>
              <div className="mb-6 flex justify-between items-end border-b-2 border-gold-500 pb-2">
                <div>
                  <h3 className="text-2xl font-bold font-display text-primary-900">{segment.label}</h3>
                  <p className="text-lg text-neutral-700 font-semibold mt-1">Judge: {sheet.judge.name}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-primary-100 text-primary-800 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded">Official Score Sheet</span>
                </div>
              </div>

              <table className="w-full text-left text-sm border-collapse mt-6">
                <thead>
                  <tr className="bg-primary-50 text-primary-900">
                    <th className="p-3 border border-neutral-300 w-12 text-center">No.</th>
                    <th className="p-3 border border-neutral-300 w-48">Candidate Name</th>
                    {segment.criteria.map((crit) => (
                      <th key={crit.id} className="p-3 border border-neutral-300 text-center">
                        <div>{crit.label}</div>
                        <div className="text-xs font-normal text-neutral-500 mt-1">{crit.weight * 100}%</div>
                      </th>
                    ))}
                    <th className="p-3 border border-neutral-300 text-center w-24 font-bold bg-primary-100">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {eligible.length === 0 ? (
                    <tr>
                      <td colSpan={segment.criteria.length + 3} className="p-6 text-center text-neutral-500 border border-neutral-300 italic">
                        No eligible candidates for this segment.
                      </td>
                    </tr>
                  ) : (
                    eligible.map((c, i) => (
                      <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                        <td className="p-3 border border-neutral-300 font-bold text-center h-16">{c.candidateNumber}</td>
                        <td className="p-3 border border-neutral-300 font-semibold">{c.fullName}</td>
                        {segment.criteria.map((crit) => (
                          <td key={crit.id} className="p-3 border border-neutral-300"></td>
                        ))}
                        <td className="p-3 border border-neutral-300 bg-primary-50"></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="mt-16 pt-8 border-t border-neutral-300 grid grid-cols-2 gap-8 text-center text-sm w-3/4 mx-auto">
                <div></div>
                <div>
                  <div className="border-b border-black mb-1 mx-8 h-10"></div>
                  <p className="font-bold leading-tight">{sheet.judge.name}</p>
                  <p className="font-semibold text-xs text-neutral-600">Judge Signature</p>
                </div>
              </div>

            </div>
          </div>
        );
      })}
    </div>
  );
};
