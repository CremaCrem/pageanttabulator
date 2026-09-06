import React, { useEffect, useState, useMemo } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { ICandidate, ISegmentScore } from '../../types';
import { SEGMENTS } from '../../utils/constants';
import { Modal } from '../../components/ui/Modal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const ResultsPage: React.FC = () => {
  const [candidates, setCandidates] = useState<ICandidate[]>([]);
  const [scores, setScores] = useState<ISegmentScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedCandidate, setSelectedCandidate] = useState<ICandidate | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [candRes, scoreRes] = await Promise.all([
          fetchApi('/api/candidates'),
          fetchApi('/api/scores/all')
        ]);
        setCandidates(candRes);
        setScores(scoreRes);
      } catch (err: any) {
        setError('Failed to load results data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const chartData = useMemo(() => {
    return candidates.map(c => {
      const cScores = scores.filter(s => s.candidateId === c.id);
      let total = 0;
      
      const segmentBreakdown: Record<string, number> = {};

      Object.values(SEGMENTS).forEach(seg => {
        const segScores = cScores.filter(s => s.segmentId === seg.id);
        if (segScores.length > 0) {
          const avg = segScores.reduce((acc, curr) => acc + curr.computedScore, 0) / segScores.length;
          const weighted = avg * seg.preliminaryWeight;
          total += weighted;
          segmentBreakdown[seg.label] = weighted;
        }
      });

      return {
        name: c.candidateNumber + ' ' + c.fullName,
        total: Number(total.toFixed(2)),
        ...segmentBreakdown,
        candidate: c
      };
    }).sort((a, b) => b.total - a.total);
  }, [candidates, scores]);

  if (loading) {
    return <PageWrapper><div className="p-8 text-center text-neutral-500 font-medium">Loading Data...</div></PageWrapper>;
  }

  return (
    <PageWrapper>
      <div className="mb-6">
        <h1 className="text-heading-1 text-primary-900">Raw Scores & Visualization</h1>
        <p className="text-neutral-500">Live candidate standing and score breakdown</p>
      </div>
      
      {error && <div className="mb-4 p-4 text-red-700 bg-red-50 rounded-lg">{error}</div>}

      {/* Bar Chart */}
      <div className="bg-white p-6 rounded-xl shadow-panel mb-8 border border-neutral-100">
        <h2 className="text-xl font-bold mb-6 text-neutral-800">Overall Standings (Preliminary)</h2>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12, fill: '#4B5563' }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#4B5563' }} />
              <Tooltip cursor={{ fill: 'rgba(27, 94, 55, 0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend verticalAlign="top" height={36}/>
              <Bar dataKey="total" name="Total Weighted Score" fill="#C9A84C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Raw Data Grid */}
      <div className="bg-white rounded-xl shadow-panel overflow-hidden border border-neutral-100">
        <div className="p-6 border-b border-neutral-100 bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-800">Raw Scores Table</h2>
          <p className="text-sm text-neutral-500">Click a candidate to view detailed judge breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-100/50">
                <th className="p-4 font-semibold text-neutral-600 border-b whitespace-nowrap">Candidate</th>
                {Object.values(SEGMENTS).map(seg => (
                  <th key={seg.id} className="p-4 font-semibold text-neutral-600 border-b text-center whitespace-nowrap">{seg.label} (Avg)</th>
                ))}
                <th className="p-4 font-semibold text-neutral-600 border-b text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, i) => (
                <tr 
                  key={row.candidate.id} 
                  onClick={() => setSelectedCandidate(row.candidate)}
                  className={`border-b border-neutral-50 hover:bg-gold-50 cursor-pointer transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}`}
                >
                  <td className="p-4 font-medium text-neutral-800 whitespace-nowrap">
                    <span className="text-primary-600 font-bold mr-2">#{row.candidate.candidateNumber}</span>
                    {row.candidate.fullName}
                  </td>
                  {Object.values(SEGMENTS).map(seg => {
                    const cScores = scores.filter(s => s.candidateId === row.candidate.id && s.segmentId === seg.id);
                    const avg = cScores.length > 0 
                      ? (cScores.reduce((acc, curr) => acc + curr.computedScore, 0) / cScores.length).toFixed(2)
                      : '-';
                    return (
                      <td key={seg.id} className="p-4 text-center text-neutral-600 whitespace-nowrap">
                        {avg} <span className="text-xs text-neutral-400">({cScores.length})</span>
                      </td>
                    );
                  })}
                  <td className="p-4 text-center font-bold text-primary-900 text-lg">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={selectedCandidate !== null} 
        onClose={() => setSelectedCandidate(null)}
        title={selectedCandidate ? `Detailed Breakdown: ${selectedCandidate.fullName}` : ''}
      >
        {selectedCandidate && (
          <div className="space-y-6">
            {Object.values(SEGMENTS).map(seg => {
              const segScores = scores.filter(s => s.candidateId === selectedCandidate.id && s.segmentId === seg.id);
              if (segScores.length === 0) return null;

              return (
                <div key={seg.id} className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="bg-primary-900 text-white p-3 font-semibold flex justify-between items-center">
                    <span>{seg.label}</span>
                    <span className="text-gold-400 text-sm">Weight: {seg.preliminaryWeight * 100}%</span>
                  </div>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-neutral-100 text-neutral-600">
                      <tr>
                        <th className="p-3 border-b">Judge ID</th>
                        <th className="p-3 border-b text-right">Computed Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segScores.map((s, idx) => (
                        <tr key={s.id} className={`border-b last:border-0 border-neutral-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}`}>
                          <td className="p-3 font-medium text-neutral-800">{s.judgeId}</td>
                          <td className="p-3 text-right font-mono text-neutral-700">{s.computedScore.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

    </PageWrapper>
  );
};
