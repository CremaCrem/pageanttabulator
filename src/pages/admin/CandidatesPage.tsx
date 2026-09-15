import React, { useEffect, useState, useRef } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { ICandidate, Gender } from '../../types';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { ImageUpload } from '../../components/ui/ImageUpload';
import { getApiBaseUrl } from '../../api/client';
import { useDirtyState } from '../../hooks/useDirtyState';

export const CandidatesPage: React.FC = () => {
  const [candidates, setCandidates] = useState<ICandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const fullNameInputRef = useRef<HTMLInputElement>(null);

  const getNextCandidateNumber = (currentList: ICandidate[]): string => {
    let max = 0;
    let foundNumeric = false;
    for (const c of currentList) {
      const num = parseInt(c.candidateNumber, 10);
      if (!isNaN(num) && num.toString() === c.candidateNumber.replace(/^0+/, '')) {
        foundNumeric = true;
        if (num > max) max = num;
      } else if (!isNaN(num)) {
        foundNumeric = true;
        if (num > max) max = num;
      }
    }
    if (!foundNumeric) return '01';
    return String(max + 1).padStart(2, '0');
  };

  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, candidateId: string | null, currentlyEligible: boolean}>({
    isOpen: false,
    candidateId: null,
    currentlyEligible: true
  });
  
  const [baselineCandidate, setBaselineCandidate] = useState({
    candidateNumber: '',
    fullName: '',
    department: '',
    gender: Gender.Female,
    photoPath: '',
  });

  const [newCandidate, setNewCandidate] = useState({
    candidateNumber: '',
    fullName: '',
    department: '',
    gender: Gender.Female,
    photoPath: '',
  });

  const isDirty = React.useMemo(() => {
    if (imageUploading) return true;
    return (
      newCandidate.candidateNumber !== baselineCandidate.candidateNumber ||
      newCandidate.fullName !== baselineCandidate.fullName ||
      newCandidate.department !== baselineCandidate.department ||
      newCandidate.gender !== baselineCandidate.gender ||
      newCandidate.photoPath !== baselineCandidate.photoPath
    );
  }, [newCandidate, baselineCandidate, imageUploading]);

  useDirtyState(isDirty);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/api/candidates');
      const sorted = data.sort((a: any, b: any) => a.candidateNumber.localeCompare(b.candidateNumber));
      setCandidates(sorted);
      return sorted;
    } catch (err: any) {
      setError('Failed to load candidates.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates().then((data) => {
      if (data) {
        const nextNum = getNextCandidateNumber(data);
        setNewCandidate(prev => ({
          ...prev,
          candidateNumber: nextNum
        }));
        setBaselineCandidate(prev => ({
          ...prev,
          candidateNumber: nextNum
        }));
      }
    });
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adding || imageUploading) return;
    
    setAdding(true);
    setError('');
    
    try {
      await fetchApi('/api/candidates', {
        method: 'POST',
        body: JSON.stringify({
          candidateNumber: newCandidate.candidateNumber,
          fullName: newCandidate.fullName,
          department: newCandidate.department,
          gender: newCandidate.gender,
          photoPath: newCandidate.photoPath || undefined,
          isEligible: true
        })
      });
      const latestCandidates = await loadCandidates();
      const nextNum = getNextCandidateNumber(latestCandidates || []);
      
      const updatedCleanState = {
        candidateNumber: nextNum,
        fullName: '',
        department: newCandidate.department,
        gender: newCandidate.gender,
        photoPath: ''
      };
      
      setNewCandidate(updatedCleanState);
      setBaselineCandidate(updatedCleanState);
      fullNameInputRef.current?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to add candidate');
    } finally {
      setAdding(false);
    }
  };

  const handleDisqualifyClick = (id: string, currentlyEligible: boolean) => {
    setConfirmConfig({ isOpen: true, candidateId: id, currentlyEligible });
  };

  const handleDisqualifyConfirm = async () => {
    const { candidateId, currentlyEligible } = confirmConfig;
    if (!candidateId) return;
    
    setConfirmConfig({ ...confirmConfig, isOpen: false });
    
    try {
      await fetchApi(`/api/candidates/${candidateId}/disqualify`, {
        method: 'PATCH',
        body: JSON.stringify({
          isEligible: !currentlyEligible,
          disqualificationNote: currentlyEligible ? 'Admin disqualified' : null
        })
      });
      await loadCandidates();
    } catch (err: any) {
      setError(err.message || 'Failed to update candidate status');
    }
  };

  return (
    <PageWrapper>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-heading-1 text-primary-900">Candidates</h1>
          <p className="text-neutral-500">Manage the official roster</p>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">{error}</Alert>
      )}

      {/* Add Candidate Form */}
      <div className="bg-white p-6 rounded-xl shadow-panel mb-8 border border-neutral-100">
        <h2 className="text-lg font-bold text-neutral-800 mb-4">Add New Candidate</h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-6">
          <div className="flex gap-6 items-start">
            <ImageUpload 
              value={newCandidate.photoPath} 
              onChange={(url) => setNewCandidate({...newCandidate, photoPath: url})} 
              onUploadingChange={setImageUploading}
            />
            <div className="flex flex-wrap gap-4 items-end flex-1">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Number</label>
                <input type="text" required value={newCandidate.candidateNumber} onChange={e => setNewCandidate({...newCandidate, candidateNumber: e.target.value})} className="w-full form-control" placeholder="e.g. 01" />
              </div>
          <div className="flex-[3] min-w-[200px]">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Full Name</label>
            <input ref={fullNameInputRef} type="text" required value={newCandidate.fullName} onChange={e => setNewCandidate({...newCandidate, fullName: e.target.value})} className="w-full form-control" placeholder="Juan dela Cruz" />
          </div>
          <div className="flex-[2] min-w-[150px]">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Department/College</label>
            <input type="text" required value={newCandidate.department} onChange={e => setNewCandidate({...newCandidate, department: e.target.value})} className="w-full form-control" placeholder="CAS" />
          </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Category</label>
                <select value={newCandidate.gender} onChange={e => setNewCandidate({...newCandidate, gender: e.target.value as Gender})} className="w-full form-control">
                  <option value={Gender.Female}>Female (Ms.)</option>
                  <option value={Gender.Male}>Male (Mr.)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={adding || imageUploading} isLoading={adding} loadingText="Adding...">
              Add Candidate
            </Button>
          </div>
        </form>
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-xl shadow-panel overflow-hidden border border-neutral-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 text-neutral-600 text-sm border-b border-neutral-200">
                <th className="p-4 font-semibold w-16">Photo</th>
                <th className="p-4 font-semibold">No.</th>
                <th className="p-4 font-semibold">Name</th>
                <th className="p-4 font-semibold">Department</th>
                <th className="p-4 font-semibold">Category</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-neutral-400">Loading...</td></tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0 border-b-0">
                    <EmptyState 
                      title="No Candidates Found" 
                      description="No candidates have been added to the roster yet. Add the first candidate above to begin." 
                      className="border-none rounded-none"
                    />
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="p-4">
                      {candidate.photoPath ? (
                        <img src={`${getApiBaseUrl()}${candidate.photoPath}`} alt={candidate.fullName} className="w-10 h-10 rounded-full object-cover border border-neutral-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 text-xs font-bold border border-neutral-300">
                          {candidate.candidateNumber}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-bold text-primary-900">{candidate.candidateNumber}</td>
                    <td className="p-4 font-medium text-neutral-800">{candidate.fullName}</td>
                    <td className="p-4 text-neutral-600">{candidate.department}</td>
                    <td className="p-4 text-neutral-600">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${candidate.gender === Gender.Female ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                        {candidate.gender === Gender.Female ? 'Ms.' : 'Mr.'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-2">
                        {candidate.isEligible ? (
                          <span className="inline-flex px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full w-max">Active</span>
                        ) : (
                          <span className="inline-flex px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full w-max">Disqualified</span>
                        )}
                        {candidate.isInTiebreak && (
                          <span className="inline-flex px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full w-max">In Tie-Break</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right space-x-2">

                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisqualifyClick(candidate.id, candidate.isEligible)}
                        className={candidate.isEligible ? '!text-red-600 hover:!bg-red-50' : '!text-green-600 hover:!bg-green-50'}
                      >
                        {candidate.isEligible ? 'Disqualify' : 'Reinstate'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.currentlyEligible ? "Disqualify Candidate" : "Reinstate Candidate"}
        message={`Are you sure you want to mark this candidate as ${confirmConfig.currentlyEligible ? 'disqualified' : 'eligible'}?`}
        confirmText="Yes, Proceed"
        onConfirm={handleDisqualifyConfirm}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />
    </PageWrapper>
  );
};
