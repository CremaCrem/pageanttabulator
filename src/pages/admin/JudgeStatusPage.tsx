import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { IJudge } from '../../types';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useAppContext } from '../../context/AppContext';
import { ImageUpload } from '../../components/ui/ImageUpload';
import { getApiBaseUrl } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';

interface JudgeStatusResponse extends IJudge {
  totalScoresSubmitted: number;
}

const isOnline = (judge: JudgeStatusResponse) => {
  if (!judge.isActive) return false;
  if (!judge.lastSeen) return false;
  const lastSeenDate = new Date(judge.lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();
  return diffMs < 45000; // 45 seconds grace period (PING is every 30s)
};

export const JudgeStatusPage: React.FC = () => {
  const { state } = useAppContext();
  const [statuses, setStatuses] = useState<JudgeStatusResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, judgeId: string | null}>({
    isOpen: false,
    judgeId: null
  });

  const [editJudge, setEditJudge] = useState<IJudge | null>(null);
  const [editForm, setEditForm] = useState({ name: '', photoPath: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isJudgeEditDirty = React.useMemo(() => {
    if (!editJudge) return false;
    return (
      editForm.name !== (editJudge.name || '') ||
      editForm.photoPath !== (editJudge.photoPath || '') ||
      editForm.password !== (editJudge.password || '')
    );
  }, [editForm, editJudge]);

  const handleCloseModal = () => {
    if (isJudgeEditDirty) {
      setShowDiscardConfirm(true);
    } else {
      setEditJudge(null);
    }
  };

  const handleDiscardChanges = () => {
    setShowDiscardConfirm(false);
    setEditJudge(null);
  };

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

  const handleEditClick = (judge: JudgeStatusResponse) => {
    setEditJudge(judge);
    setEditForm({
      name: judge.name || '',
      photoPath: judge.photoPath || '',
      password: judge.password || '',
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editJudge) return;

    setSaving(true);
    setError('');
    try {
      await fetchApi(`/api/judges/${editJudge.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name || undefined,
          photoPath: editForm.photoPath || undefined,
          password: editForm.password || undefined,
        })
      });
      setEditJudge(null);
      await loadStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to update judge profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageWrapper>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-heading-1 text-primary-900">Judge Status</h1>
          <p className="text-neutral-500">Live monitoring of judge connectivity and scoring progress</p>
        </div>
        <Button 
          variant="secondary"
          onClick={loadStatus}
        >
          Refresh Now
        </Button>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">{error}</Alert>
      )}

      <div className="bg-white rounded-xl shadow-panel overflow-hidden border border-neutral-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 text-neutral-600 text-sm border-b border-neutral-200">
              <th className="p-4 font-semibold w-16">Photo</th>
              <th className="p-4 font-semibold">Judge ID</th>
              <th className="p-4 font-semibold">Name</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-center">Scores Submitted</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && !state.eventConfig ? (
              <tr><td colSpan={6} className="p-8 text-center text-neutral-400">Loading...</td></tr>
            ) : !state.eventConfig ? (
              <tr><td colSpan={6} className="p-8 text-center text-neutral-400">No event configuration found.</td></tr>
            ) : (
              Array.from({ length: state.eventConfig.judgeCount || 5 }).map((_, i) => {
                const jId = `J${i + 1}`;
                const judge = statuses.find(j => j.id === jId) || { id: jId, isActive: false, totalScoresSubmitted: 0 } as JudgeStatusResponse;
                return (
                  <tr key={judge.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="p-4">
                      {judge.photoPath ? (
                        <img src={`${getApiBaseUrl()}${judge.photoPath}`} alt={judge.name || judge.id} className="w-10 h-10 rounded-full object-cover border border-neutral-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 text-xs font-bold border border-neutral-300">
                          {judge.id}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-bold text-primary-900">{judge.id}</td>
                    <td className="p-4 font-medium text-neutral-800">{judge.name || <span className="text-neutral-400 italic">Not set</span>}</td>
                    <td className="p-4">
                      {isOnline(judge) ? (
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
                    <td className="p-4 text-right space-x-4">
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(judge)}
                      >
                        Edit Profile
                      </Button>
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetSessionClick(judge.id)}
                        disabled={!judge.isActive}
                        className="!text-red-600 hover:!bg-red-50"
                      >
                        Force Logout
                      </Button>
                    </td>
                  </tr>
                );
              })
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

      {/* Edit Judge Modal */}
      <Modal
        isOpen={!!editJudge}
        onClose={handleCloseModal}
        title={editJudge ? `Edit ${editJudge.id} Profile` : ''}
      >
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Judge Photo</label>
            <ImageUpload 
              value={editForm.photoPath} 
              onChange={(url) => setEditForm({...editForm, photoPath: url})} 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Name</label>
            <input 
              type="text" 
              value={editForm.name} 
              onChange={e => setEditForm({...editForm, name: e.target.value})} 
              className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow" 
              placeholder="e.g. Dr. Jane Smith" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Password (Plain Text)</label>
            <input 
              type="text" 
              value={editForm.password} 
              onChange={e => setEditForm({...editForm, password: e.target.value})} 
              className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow" 
              placeholder="Leave empty for no password" 
            />
            <p className="text-xs text-neutral-500 mt-1">If set, the judge must enter this password to claim their slot.</p>
          </div>

          <div className="flex gap-3 justify-end mt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving} loadingText="Saving...">
              Save Profile
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={showDiscardConfirm}
        title="Discard Unsaved Changes?"
        message="You have unsaved changes to this judge profile. If you leave now, those changes will be lost."
        confirmText="Discard Changes"
        cancelText="Stay"
        onConfirm={handleDiscardChanges}
        onCancel={() => setShowDiscardConfirm(false)}
        variant="destructive"
      />
    </PageWrapper>
  );
};
