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

      <div className="space-y-8 print:hidden">
        
        {/* Tabulation Workflow */}
        <section>
          <h2 className="text-xl font-bold text-primary-900 mb-4">Tabulation Workflow</h2>
          <div className="bg-white rounded-xl shadow-panel border border-neutral-100 overflow-hidden divide-y divide-neutral-100">
            
            {/* Step 1: Preliminary */}
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center shrink-0">1</div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-800">Preliminary Results (Top 3)</h3>
                  <p className="text-sm text-neutral-500 mt-1 max-w-xl">Compute Borda ranks and determine the Top 3 candidates.</p>
                </div>
              </div>
              <Button 
                onClick={() => handleComputeClick('preliminary')}
                disabled={loading !== null && loading !== 'preliminary'}
                isLoading={loading === 'preliminary'}
                loadingText="Computing..."
                className="w-[300px] shrink-0"
              >
                Compute Preliminary & Select Top 3
              </Button>
            </div>

            {/* Step 2: Final Q&A */}
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center shrink-0">2</div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-800">Final Championship</h3>
                  <p className="text-sm text-neutral-500 mt-1 max-w-xl">Computes Final Q&A and combines with Preliminary Score (50/50).</p>
                </div>
              </div>
              <Button 
                onClick={() => handleComputeClick('final')}
                disabled={loading !== null && loading !== 'final'}
                isLoading={loading === 'final'}
                loadingText="Computing..."
                className="w-[300px] shrink-0"
              >
                Compute Final Winners
              </Button>
            </div>

            {/* Step 3: Special Awards */}
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center shrink-0">3</div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-800">Special / Minor Awards</h3>
                  <p className="text-sm text-neutral-500 mt-1 max-w-xl">Computes Best in Advocacy and Best in Ramp using Simple Average of judge scores.</p>
                </div>
              </div>
              <Button 
                onClick={() => handleComputeClick('minor_awards')}
                disabled={loading !== null && loading !== 'minor_awards'}
                isLoading={loading === 'minor_awards'}
                loadingText="Computing..."
                className="w-[300px] shrink-0"
              >
                Compute Special Awards
              </Button>
            </div>

            {/* Step 4: Export */}
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center shrink-0">4</div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-800">Export & Print</h3>
                  <p className="text-sm text-neutral-500 mt-1 max-w-xl">Generate the official PDF report containing all computed results.</p>
                </div>
              </div>
              <Button 
                onClick={handleExport}
                isLoading={isExporting}
                loadingText="Exporting..."
                className="!bg-neutral-800 hover:!bg-black w-[300px] shrink-0"
              >
                Generate PDF Report
              </Button>
            </div>
            
            <div className="p-6 bg-neutral-50">
              <h4 className="text-sm font-bold text-neutral-600 mb-4 uppercase tracking-wider">Report Preview</h4>
              <div className="bg-white p-8 rounded-lg border-2 border-dashed border-neutral-200 overflow-y-auto max-h-[600px]">
                <PrintReport />
              </div>
            </div>

          </div>
        </section>

        {/* Additional Tools */}
        <section>
          <h2 className="text-xl font-bold text-primary-900 mb-4">Additional Tools</h2>
          <div className="bg-white p-6 rounded-xl shadow-panel border border-neutral-100 flex flex-col">
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
              onClick={handleExportBlank}
              disabled={selectedJudges.size === 0 || selectedSegments.size === 0}
              isLoading={isExporting}
              loadingText="Exporting..."
              className="mt-auto !bg-neutral-800 hover:!bg-black self-start"
            >
              Print Selected Sheets
            </Button>
          </div>
        </section>

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
