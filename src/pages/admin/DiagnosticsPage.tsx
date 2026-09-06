import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { Activity, AlertTriangle, Trash2, Clock, CheckCircle } from 'lucide-react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface SystemLog {
  id: string;
  level: string;
  source: string;
  message: string;
  details: string | null;
  createdAt: string;
}

interface JudgeStatus {
  id: string;
  name: string;
  isActive: boolean;
  lastSeen?: string;
}

export const DiagnosticsPage: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [judges, setJudges] = useState<JudgeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
    
    // Auto refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [logsRes, judgesRes] = await Promise.all([
        fetchApi('/api/logs'),
        fetchApi('/api/judges')
      ]);
      setLogs(logsRes);
      setJudges(judgesRes);
    } catch (err) {
      console.error('Failed to load diagnostics data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetchApi('/api/logs', { method: 'DELETE' });
      setLogs([]);
      setClearModalOpen(false);
    } catch (err) {
      console.error('Failed to clear logs', err);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warn': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <PageWrapper>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-heading-1 text-primary-900">System Diagnostics</h1>
          <p className="text-neutral-500">Live connection status and error logs</p>
        </div>
        <button
          onClick={() => setClearModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-neutral-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-neutral-600 font-medium rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Logs</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Judge Status Overview (Live) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-card border border-neutral-200/60">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4 flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Live Judge Status
            </h3>
            <div className="space-y-3">
              {judges.map(judge => {
                const isActive = judge.isActive;
                return (
                  <div key={judge.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                    <div className="flex items-center">
                      <div className={`w-2.5 h-2.5 rounded-full mr-3 ${isActive ? 'bg-success animate-pulse-slow' : 'bg-neutral-300'}`}></div>
                      <div>
                        <div className="font-semibold text-neutral-800 text-sm">{judge.name || `Judge ${judge.id.replace('J', '')}`}</div>
                        <div className="text-xs text-neutral-500">{isActive ? 'Connected' : 'Offline'}</div>
                      </div>
                    </div>
                    {isActive ? <CheckCircle className="w-4 h-4 text-success opacity-70" /> : <Clock className="w-4 h-4 text-neutral-400 opacity-70" />}
                  </div>
                );
              })}
              {judges.length === 0 && (
                <div className="text-center p-4 text-sm text-neutral-500">No judges configured yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* System Logs */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-card border border-neutral-200/60 overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2 text-neutral-500" />
                System Event Logs
              </h3>
              <div className="text-xs text-neutral-400">
                {logs.length} entries • Auto-updating
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading && logs.length === 0 ? (
                <div className="text-center p-8 text-neutral-400">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-center p-8 text-neutral-400 flex flex-col items-center">
                  <CheckCircle className="w-8 h-8 text-neutral-200 mb-2" />
                  No errors or system events recorded yet.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="p-3 rounded-lg border bg-neutral-50/50 border-neutral-100 text-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getLevelColor(log.level)}`}>
                          {log.level}
                        </span>
                        <span className="font-semibold text-neutral-800">{log.message}</span>
                      </div>
                      <span className="text-xs text-neutral-400 font-mono">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.details && (
                      <div className="mt-2 text-xs font-mono bg-neutral-100 p-2 rounded text-neutral-600 break-all overflow-hidden">
                        {log.details}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] uppercase text-neutral-400 font-semibold">
                      Source: {log.source}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      <ConfirmModal
        isOpen={clearModalOpen}
        title="Clear System Logs"
        message="Are you sure you want to permanently delete all system logs? This action cannot be undone."
        onConfirm={handleClearLogs}
        onCancel={() => setClearModalOpen(false)}
        confirmText="Clear Logs"
        isDestructive={true}
      />

    </PageWrapper>
  );
};
