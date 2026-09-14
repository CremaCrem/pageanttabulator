import React, { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PrintReport } from '../../components/admin/PrintReport';
import { useExport } from '../../hooks/useExport';
import { useToast } from '../../context/ToastContext';

export const ReportsPage: React.FC = () => {
  const { exportPdf, isExporting } = useExport();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, round: 'preliminary' | 'final' | 'minor_awards' | null}>({
    isOpen: false,
    round: null
  });

  const handleExport = async () => {
    try {
      const res = await exportPdf();
      toast(res, 'success');
    } catch (err: any) {
      toast(err.message || 'Export failed', 'error');
    }
  };

  const handleComputeClick = (round: 'preliminary' | 'final' | 'minor_awards') => {
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
    <PageWrapper className="print:p-0 print:max-w-none print:m-0">
      <div className="flex justify-between items-center mb-6 print:hidden">
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
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100 font-semibold print:hidden">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
        
        {/* Preliminary Tabulation */}
        <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-neutral-800">Preliminary Results (Top 3)</h3>
            <p className="text-sm text-neutral-500 mb-4">Compute Borda ranks and determine the Top 3 candidates.</p>
          </div>
          <div className="flex-1"></div>
          <button 
            onClick={() => handleComputeClick('preliminary')}
            disabled={loading !== null}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 mt-4"
          >
            {loading === 'preliminary' ? 'Computing...' : 'Compute Preliminary & Select Top 3'}
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

        {/* Minor Awards */}
        <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col md:col-span-2">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-neutral-800">Minor Awards</h3>
            <p className="text-sm text-neutral-500 mt-1">Computes Best in Advocacy and Best in Ramp using Simple Average of judge scores.</p>
          </div>
          <button 
            onClick={() => handleComputeClick('minor_awards')}
            disabled={loading !== null}
            className="w-full py-3 bg-neutral-800 hover:bg-black text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-80 mt-2"
          >
            {loading === 'minor_awards' ? 'Computing...' : 'Compute Special Awards'}
          </button>
        </div>

        {/* Export and Preview */}
        <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col md:col-span-2 print:hidden">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-neutral-800">Export & Print</h3>
              <p className="text-sm text-neutral-500">Download official score sheets for auditors.</p>
            </div>
            <button 
              onClick={handleExport}
              disabled={isExporting}
              className="px-6 py-2 bg-neutral-800 hover:bg-black text-white font-semibold rounded shadow-sm transition-colors disabled:opacity-80 disabled:cursor-wait flex items-center justify-center"
            >
              {isExporting && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isExporting ? 'Exporting...' : 'Generate PDF Report'}
            </button>
          </div>
          
          <div className="bg-neutral-50 p-8 rounded-lg border-2 border-dashed border-neutral-200 overflow-y-auto max-h-[600px]">
            <PrintReport />
          </div>
        </div>

      </div>
      
      <div className="hidden print:block w-full">
        <PrintReport />
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
