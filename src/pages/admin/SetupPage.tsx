import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { IEventConfig } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, MonitorSmartphone, QrCode } from 'lucide-react';

export const SetupPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [networkInfo, setNetworkInfo] = useState<any>(null);

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

  return (
    <PageWrapper>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-heading-1 text-primary-900">Event Setup</h1>
          <p className="text-neutral-500">Configure the master details for the pageant</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Panel */}
        <div className="lg:col-span-2 bg-white p-8 rounded-xl shadow-panel">
          {loading ? (
            <div className="text-neutral-500 animate-pulse">Loading configuration...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {error && (
                <div className="p-4 bg-error-50 text-error-700 rounded-lg text-sm border border-error-100">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="p-4 bg-success-50 text-success-700 rounded-lg text-sm border border-success-100">
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
          
        </div>

      </div>
    </PageWrapper>
  );
};
