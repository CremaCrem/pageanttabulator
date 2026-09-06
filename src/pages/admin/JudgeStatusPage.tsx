import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { IJudge } from '../../types';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface JudgeStatusResponse extends IJudge {
  totalScoresSubmitted: number;
}

export const JudgeStatusPage: React.FC = () => {
  const [statuses, setStatuses] = useState<JudgeStatusResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, judgeId: string | null}>({
    isOpen: false,
    judgeId: null
  });

  const loadStatus = async () => {
    try {
      // The API returns the Judge object with an extra totalScoresSubmitted field
      const data: JudgeStatusResponse[] = await fetchApi('/api/judges/status');
      setStatuses(data);
    } catch (err: any) {
      setError('Failed to load judge statuses');
    }
  };

  useEffect(() => {
    setLoading(true);
    loadStatus().finally(() => setLoading(false));
    
    // Poll every 5 seconds for live updates
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResetSessionClick = (judgeId: string) => {
    setConfirmConfig({ isOpen: true, judgeId });
  };

  const handleResetSessionConfirm = async () => {
    const { judgeId } = confirmConfig;
    if (!judgeId) return;
    
    setConfirmConfig({ ...confirmConfig, isOpen: false });
    try {
      await fetchApi(`/api/judges/session/${judgeId}`, { method: 'DELETE' });
      await loadStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to reset judge session');
    }
  };

  return (
    <PageWrapper>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-heading-1 text-primary-900">Judge Status</h1>
          <p className="text-neutral-500">Live monitoring of judge connectivity and scoring progress</p>
        </div>
        <button 
          onClick={loadStatus}
          className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-lg shadow-sm transition-colors text-sm"
        >
          Refresh Now
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-panel overflow-hidden border border-neutral-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 text-neutral-600 text-sm border-b border-neutral-200">
              <th className="p-4 font-semibold">Judge ID</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-center">Scores Submitted</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && statuses.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-neutral-400">Loading...</td></tr>
            ) : statuses.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-neutral-400">No judges configured yet.</td></tr>
            ) : (
              statuses.map((judge) => (
                <tr key={judge.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="p-4 font-bold text-primary-900">{judge.id}</td>
                  <td className="p-4">
                    {judge.isActive ? (
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-sm font-semibold text-green-700">Online</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-neutral-300"></span>
                        <span className="text-sm font-semibold text-neutral-500">Offline</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span className="font-bold text-lg text-primary-900">{judge.totalScoresSubmitted}</span>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleResetSessionClick(judge.id)}
                      disabled={!judge.isActive}
                      className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-30 disabled:hover:text-red-600"
                    >
                      Force Logout
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title="Force Logout"
        message={`Are you sure you want to forcibly logout ${confirmConfig.judgeId}? They will need to reconnect.`}
        confirmText="Yes, Force Logout"
        onConfirm={handleResetSessionConfirm}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />
    </PageWrapper>
  );
};
