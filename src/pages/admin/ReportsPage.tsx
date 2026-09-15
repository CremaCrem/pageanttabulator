import React, { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PrintReport } from '../../components/admin/PrintReport';
import { useExport } from '../../hooks/useExport';
import { useToast } from '../../context/ToastContext';
import { SEGMENTS } from '../../utils/constants';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export const ReportsPage: React.FC = () => {
  const { exportPdf, exportBlankScoreSheets, isExporting } = useExport();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, round: 'preliminary' | 'final' | 'minor_awards' | null}>({
    isOpen: false,
    round: null
  });

  const [judges, setJudges] = useState<{id: string, name: string}[]>([]);
  const [selectedJudges, setSelectedJudges] = useState<Set<string>>(new Set());
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    fetchApi('/api/judges').then(setJudges).catch(console.error);
  }, []);

  const toggleJudge = (id: string) => {
    const next = new Set(selectedJudges);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedJudges(next);
  };

  const toggleSegment = (id: string) => {
    const next = new Set(selectedSegments);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSegments(next);
  };

  const handleExportBlank = async () => {
    try {
      const res = await exportBlankScoreSheets(Array.from(selectedJudges), Array.from(selectedSegments));
      toast(res, 'success');
    } catch (err: any) {
      toast(err.message || 'Export failed', 'error');
    }
  };

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
    
    try {
      const res = await fetchApi('/api/results/compute', {
        method: 'POST',
        body: JSON.stringify({ round })
      });
      toast(res.message, 'success');
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
        <Alert variant="error" className="mb-6">{error}</Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
        
        {/* Preliminary Tabulation */}
        <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-neutral-800">Preliminary Results (Top 3)</h3>
            <p className="text-sm text-neutral-500 mb-4">Compute Borda ranks and determine the Top 3 candidates.</p>
          </div>
          <div className="flex-1"></div>
          <Button 
            fullWidth
            onClick={() => handleComputeClick('preliminary')}
            disabled={loading !== null && loading !== 'preliminary'}
            isLoading={loading === 'preliminary'}
            loadingText="Computing..."
            className="mt-4"
          >
            Compute Preliminary & Select Top 3
          </Button>
        </div>

        {/* Final Tabulation */}
        <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-neutral-800">Final Championship</h3>
            <p className="text-sm text-neutral-500 mt-1">Computes Final Q&A and combines with Preliminary Score (50/50).</p>
          </div>
          <div className="flex-1"></div>
          <Button 
            fullWidth
            onClick={() => handleComputeClick('final')}
            disabled={loading !== null && loading !== 'final'}
            isLoading={loading === 'final'}
            loadingText="Computing..."
            className="mt-4"
          >
            Compute Final Winners
          </Button>
        </div>

        {/* Minor Awards */}
        <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col md:col-span-2">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-neutral-800">Minor Awards</h3>
            <p className="text-sm text-neutral-500 mt-1">Computes Best in Advocacy and Best in Ramp using Simple Average of judge scores.</p>
          </div>
          <Button 
            fullWidth
            onClick={() => handleComputeClick('minor_awards')}
            disabled={loading !== null && loading !== 'minor_awards'}
            isLoading={loading === 'minor_awards'}
            loadingText="Computing..."
            className="mt-2 !bg-neutral-800 hover:!bg-black"
          >
            Compute Special Awards
          </Button>
        </div>

        {/* Export and Preview */}
        <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col md:col-span-2 print:hidden">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-neutral-800">Export & Print</h3>
              <p className="text-sm text-neutral-500">Download official score sheets for auditors.</p>
            </div>
            <Button 
              onClick={handleExport}
              isLoading={isExporting}
              loadingText="Exporting..."
              className="!bg-neutral-800 hover:!bg-black"
            >
              Generate PDF Report
            </Button>
          </div>
          
          <div className="bg-neutral-50 p-8 rounded-lg border-2 border-dashed border-neutral-200 overflow-y-auto max-h-[600px]">
            <PrintReport />
          </div>
        </div>

        {/* Print Blank Score Sheets */}
        <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col md:col-span-2 print:hidden">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-neutral-800">Print Blank Score Sheets</h3>
            <p className="text-sm text-neutral-500">Generate printable physical score sheets for manual tabulation backup.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <h4 className="font-semibold text-sm mb-3">Select Judges</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-neutral-200 p-3 rounded-lg">
                {judges.length === 0 ? <p className="text-sm text-neutral-400">Loading...</p> : judges.map(j => (
                  <label key={j.id} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-neutral-50 p-1 rounded">
                    <input type="checkbox" checked={selectedJudges.has(j.id)} onChange={() => toggleJudge(j.id)} className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                    <span>{j.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Select Segments</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-neutral-200 p-3 rounded-lg">
                {Object.values(SEGMENTS).map(s => (
                  <label key={s.id} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-neutral-50 p-1 rounded">
                    <input type="checkbox" checked={selectedSegments.has(s.id)} onChange={() => toggleSegment(s.id)} className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          <Button 
            fullWidth
            onClick={handleExportBlank}
            disabled={selectedJudges.size === 0 || selectedSegments.size === 0}
            isLoading={isExporting}
            loadingText="Exporting..."
            className="mt-auto !bg-neutral-800 hover:!bg-black"
          >
            Print Selected Sheets
          </Button>
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
