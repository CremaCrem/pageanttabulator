import React, { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

export const ReportsPage: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, round: 'preliminary' | 'final' | null}>({
    isOpen: false,
    round: null
  });

  const handleComputeClick = (round: 'preliminary' | 'final') => {
    setConfirmConfig({ isOpen: true, round });
  };

  const handleComputeConfirm = async () => {
    const { round } = confirmConfig;
    if (!round) return;
    
    setConfirmConfig({ ...confirmConfig, isOpen: false });
    
    setLoading(round);
    setError('');
    setMessage('');
    
    try {
      const res = await fetchApi('/api/results/compute', {
        method: 'POST',
        body: JSON.stringify({ round })
      });
      setMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to compute results');
    } finally {
      setLoading(null);
    }
  };

  return (
    <PageWrapper>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-heading-1 text-primary-900">Final Reports & Tabulation</h1>
          <p className="text-neutral-500">Compute rankings, view special awards, and generate PDFs</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}
      
      {message && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100 font-semibold">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Preliminary Tabulation */}
        <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-neutral-800">Preliminary Results (Top 5)</h3>
            <p className="text-sm text-neutral-500 mt-1">Computes scores from Production, Uniform, Professional, and Barong.</p>
          </div>
          <div className="flex-1"></div>
          <button 
            onClick={() => handleComputeClick('preliminary')}
            disabled={loading !== null}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 mt-4"
          >
            {loading === 'preliminary' ? 'Computing...' : 'Compute Preliminary & Select Top 5'}
          </button>
        </div>

        {/* Final Tabulation */}
        <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-neutral-800">Final Championship</h3>
            <p className="text-sm text-neutral-500 mt-1">Computes Final Q&A and combines with Preliminary Score (50/50).</p>
          </div>
          <div className="flex-1"></div>
          <button 
            onClick={() => handleComputeClick('final')}
            disabled={loading !== null}
            className="w-full py-3 bg-gold-500 hover:bg-gold-600 text-primary-900 font-bold rounded-lg transition-colors disabled:opacity-50 mt-4"
          >
            {loading === 'final' ? 'Computing...' : 'Compute Final Winners'}
          </button>
        </div>

        {/* Special Awards */}
        <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col md:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-neutral-800">Export & Print</h3>
              <p className="text-sm text-neutral-500">Download official score sheets for auditors.</p>
            </div>
            <button className="px-6 py-2 bg-neutral-800 hover:bg-black text-white font-semibold rounded shadow-sm transition-colors">
              Generate PDF Report
            </button>
          </div>
          
          <div className="bg-neutral-50 p-8 rounded-lg border-2 border-dashed border-neutral-200 text-center text-neutral-500">
            Preview of PDF generation will appear here...
          </div>
        </div>

      </div>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title="Compute Results"
        message={`Are you sure you want to compute ${confirmConfig.round} results? This will lock in rankings.`}
        confirmText="Yes, Compute"
        onConfirm={handleComputeConfirm}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />
    </PageWrapper>
  );
};
