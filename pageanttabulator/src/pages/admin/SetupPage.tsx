import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { IEventConfig } from '../../types';
import { useAppContext } from '../../context/AppContext';

export const SetupPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

      <div className="bg-white p-8 rounded-xl shadow-panel max-w-2xl">
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
    </PageWrapper>
  );
};
