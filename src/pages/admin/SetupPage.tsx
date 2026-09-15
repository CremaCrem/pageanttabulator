import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { IEventConfig } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { QRCodeSVG } from 'qrcode.react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Copy, MonitorSmartphone, QrCode } from 'lucide-react';

export const SetupPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [networkInfo, setNetworkInfo] = useState<any>(null);

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, type: 'save' | 'reset', pin: string }>({
    isOpen: false,
    type: 'save',
    pin: ''
  });
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchApi('/api/network-info')
      .then(info => setNetworkInfo(info))
      .catch(err => console.error('Failed to fetch network info', err));
  }, []);

  const [formData, setFormData] = useState({
    name: 'Mr. & Ms. IDSC 2026',
    subtitle: 'Coronation Night',
    eventDate: '2026-09-10',
    venue: 'IDSC Gymnasium',
    judgeCount: 5,
    headTabulator: '',
    coordinator: '',
    auditor: '',
  });

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const config: IEventConfig = await fetchApi('/api/event');
        if (config && config.id) {
          dispatch({ type: 'SET_EVENT_CONFIG', payload: config });
          setFormData({
            name: config.name,
            subtitle: config.subtitle,
            eventDate: config.eventDate,
            venue: config.venue,
            judgeCount: config.judgeCount,
            headTabulator: config.headTabulator || '',
            coordinator: config.coordinator || '',
            auditor: config.auditor || '',
          });
        }
      } catch (err: any) {
        if (err.message !== 'Event configuration not found' && !err.message.includes('404')) {
           setError('Failed to load event configuration.');
        }
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [dispatch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'judgeCount' ? parseInt(value) || 0 : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const config: IEventConfig = await fetchApi('/api/event', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      dispatch({ type: 'SET_EVENT_CONFIG', payload: config });
      setSuccess('Event configuration saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleActionConfirm = async () => {
    if (!confirmModal.pin) {
      setActionError('PIN is required');
      return;
    }
    
    setActionLoading(true);
    setActionError('');
    try {
      if (confirmModal.type === 'save') {
        const res = await fetchApi('/api/scores/all');
        const winnersJson = JSON.stringify(res);
        await fetchApi('/api/event/save-close', {
          method: 'POST',
          body: JSON.stringify({ pin: confirmModal.pin, winnersJson })
        });
        setSuccess('Event saved to history and closed successfully!');
      } else {
        await fetchApi('/api/event/reset', {
          method: 'POST',
          body: JSON.stringify({ pin: confirmModal.pin })
        });
        setSuccess('Event reset successfully!');
      }
      setConfirmModal({ isOpen: false, type: 'save', pin: '' });
      setTimeout(() => setSuccess(''), 3000);
      window.location.reload();
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <PageWrapper>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-heading-1 text-primary-900">Event Setup</h1>
          <p className="text-neutral-500">Configure the master details for the pageant</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Main Panel */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-panel overflow-hidden flex flex-col">
          <div className="p-8 flex-grow">
          {loading ? (
            <div className="text-neutral-500 animate-pulse">Loading configuration...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100">
                  {success}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700">Event Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700">Subtitle</label>
                  <input
                    type="text"
                    name="subtitle"
                    value={formData.subtitle}
                    onChange={handleChange}
                    className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-neutral-700">Event Date</label>
                  <input
                    type="date"
                    name="eventDate"
                    value={formData.eventDate}
                    onChange={handleChange}
                    required
                    className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-neutral-700">Number of Judges</label>
                  <input
                    type="number"
                    name="judgeCount"
                    min="1"
                    max="15"
                    value={formData.judgeCount}
                    onChange={handleChange}
                    required
                    className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700">Venue</label>
                  <input
                    type="text"
                    name="venue"
                    value={formData.venue}
                    onChange={handleChange}
                    required
                    className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2 md:col-span-2 pt-4 border-t border-neutral-100">
                  <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider mb-2">Event Officials</h3>
                  <p className="text-xs text-neutral-500 mb-4">These names will appear at the bottom of official tabulation reports.</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-neutral-700">Head Tabulator</label>
                  <input
                    type="text"
                    name="headTabulator"
                    value={formData.headTabulator}
                    onChange={handleChange}
                    className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                    placeholder="e.g. Jeremy Zion L. Jamer"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-neutral-700">Coordinator</label>
                  <input
                    type="text"
                    name="coordinator"
                    value={formData.coordinator}
                    onChange={handleChange}
                    className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                    placeholder="e.g. Ma. Lalaine Serrano"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-neutral-700">Auditor</label>
                  <input
                    type="text"
                    name="auditor"
                    value={formData.auditor}
                    onChange={handleChange}
                    className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                    placeholder="e.g. Dr. Marilou B. Lansangan"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-neutral-100 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (state.eventConfig ? 'Update Event Details' : 'Initialize Event')}
                </button>
              </div>
            </form>
          )}
          </div>
          
          {/* Creative Decorative Footer */}
          <div className="bg-gradient-to-r from-primary-900 to-primary-700 p-6 relative overflow-hidden flex items-center justify-between">
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-4 -translate-y-4">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 8V16M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="relative z-10 text-white">
              <h4 className="font-bold text-lg mb-1 flex items-center">
                <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                System Ready
              </h4>
              <p className="text-primary-100 text-sm max-w-md">
                Configure your event settings here. Changes are instantly broadcast to all connected judge devices via the local network.
              </p>
            </div>
          </div>
        </div>

        {/* Live Hub Panel */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white p-6 rounded-xl shadow-card border border-neutral-200/60">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">Event Preview</h3>
            <div className="space-y-1">
              <h2 className="text-heading-2 text-primary-900 leading-tight">
                {formData.name || 'Untitled Event'}
              </h2>
              {formData.subtitle && (
                <p className="text-neutral-500 font-medium">{formData.subtitle}</p>
              )}
            </div>
            <div className="mt-6 pt-6 border-t border-neutral-100 text-sm text-neutral-600 space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-400">Date</span>
                <span className="font-medium text-neutral-800">{formData.eventDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Venue</span>
                <span className="font-medium text-neutral-800 text-right max-w-[150px] truncate">{formData.venue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Judges</span>
                <span className="font-medium text-neutral-800">{formData.judgeCount} configured</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-card border border-neutral-200/60 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <QrCode className="w-24 h-24" />
            </div>
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4 flex items-center">
              <MonitorSmartphone className="w-4 h-4 mr-2" />
              Judge Connection
            </h3>
            
            {networkInfo ? (
              <>
                <p className="text-sm text-neutral-600 mb-6 relative z-10">
                  Judges can connect by scanning the QR code below on their tablets, or typing the URL manually.
                </p>
                <div className="flex justify-center mb-6 bg-white p-3 rounded-lg border border-neutral-100 shadow-sm relative z-10">
                  <QRCodeSVG value={networkInfo.judgeUrl} size={160} />
                </div>
                <div className="flex flex-col space-y-2 relative z-10">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Direct URL</div>
                  <div className="flex items-center justify-between bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                    <div className="text-sm font-medium truncate mr-3">{networkInfo.judgeUrl}</div>
                    <button 
                      type="button"
                      onClick={() => navigator.clipboard.writeText(networkInfo.judgeUrl)}
                      className="p-1.5 hover:bg-neutral-200 rounded-md text-neutral-700 transition-colors shrink-0"
                      title="Copy URL"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-sm text-neutral-400 animate-pulse">
                Discovering network...
              </div>
            )}
          </div>
          
          {/* Event Actions */}
          <div className="bg-red-50 p-6 rounded-xl shadow-card border border-red-200">
            <h3 className="text-sm font-bold text-red-700 uppercase tracking-wider mb-4 flex items-center">
              Danger Zone
            </h3>
            <div className="space-y-4">
              <button 
                onClick={() => setConfirmModal({ isOpen: true, type: 'save', pin: '' })}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
              >
                Save & Close Event
              </button>
              <button 
                onClick={() => setConfirmModal({ isOpen: true, type: 'reset', pin: '' })}
                className="w-full py-3 bg-white text-red-600 border border-red-200 hover:bg-red-50 font-bold rounded-lg transition-colors"
              >
                Emergency Reset
              </button>
            </div>
            <p className="text-xs text-red-500 mt-4 leading-relaxed">
              These actions modify the database. "Save & Close" archives the event. "Emergency Reset" wipes current scores permanently.
            </p>
          </div>

        </div>

      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.type === 'save' ? 'Save & Close Event' : 'Emergency Reset'}
        message={confirmModal.type === 'save' 
          ? 'This will save the current event scores to history and wipe the active tables. This action cannot be undone.' 
          : 'WARNING: This will instantly delete all active scores, rounds, and candidates from the database without saving to history. This action cannot be undone.'}
        onConfirm={handleActionConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        confirmText={confirmModal.type === 'save' ? 'Confirm Save & Close' : 'CONFIRM RESET'}
        variant={confirmModal.type === 'save' ? 'positive' : 'destructive'}
        loading={actionLoading}
      >
        <div className="mt-4">
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Enter Admin PIN to confirm</label>
          <input 
            type="password"
            className="w-full p-3 border border-neutral-300 rounded-lg outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            value={confirmModal.pin}
            onChange={(e) => setConfirmModal({...confirmModal, pin: e.target.value})}
            placeholder="****"
          />
          {actionError && <p className="text-sm text-red-600 mt-2 font-medium">{actionError}</p>}
        </div>
      </ConfirmModal>

    </PageWrapper>
  );
};
