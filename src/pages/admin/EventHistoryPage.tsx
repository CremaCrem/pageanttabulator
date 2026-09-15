import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { fetchApi } from '../../api/client';
import { Modal } from '../../components/ui/Modal';
import { Archive, Download } from 'lucide-react';
import { PageLoader } from '../../components/ui/PageLoader';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';

interface PastEvent {
  id: string;
  name: string;
  subtitle: string;
  eventDate: string;
  winnersJson: string;
  createdAt: string;
}

export const EventHistoryPage: React.FC = () => {
  const [events, setEvents] = useState<PastEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedEvent, setSelectedEvent] = useState<PastEvent | null>(null);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const res = await fetchApi('/api/event/history');
        setEvents(res);
      } catch (err: any) {
        setError('Failed to load event history');
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  const handleExport = (evt: PastEvent) => {
    const blob = new Blob([evt.winnersJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pageant-export-${evt.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <PageWrapper><PageLoader label="Loading History..." /></PageWrapper>;
  }

  return (
    <PageWrapper>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-heading-1 text-primary-900">Event History</h1>
          <p className="text-neutral-500">Read-only archives of past pageant events</p>
        </div>
        <div className="bg-primary-100 p-3 rounded-full text-primary-700">
          <Archive className="w-6 h-6" />
        </div>
      </div>
      
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className="bg-white rounded-xl shadow-panel overflow-hidden border border-neutral-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-100/50">
                <th className="p-4 font-semibold text-neutral-600 border-b">Event Name</th>
                <th className="p-4 font-semibold text-neutral-600 border-b">Subtitle</th>
                <th className="p-4 font-semibold text-neutral-600 border-b">Event Date</th>
                <th className="p-4 font-semibold text-neutral-600 border-b">Saved At</th>
                <th className="p-4 font-semibold text-neutral-600 border-b text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0 border-b-0">
                    <EmptyState 
                      title="No History Found" 
                      description="No past events have been archived yet." 
                      className="border-none rounded-none"
                    />
                  </td>
                </tr>
              ) : (
                events.map((evt, i) => (
                  <tr key={evt.id} className={`border-b border-neutral-50 hover:bg-neutral-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}`}>
                    <td className="p-4 font-bold text-primary-900">{evt.name}</td>
                    <td className="p-4 text-neutral-600">{evt.subtitle || '-'}</td>
                    <td className="p-4 text-neutral-600">{evt.eventDate || '-'}</td>
                    <td className="p-4 text-neutral-500 text-sm">{new Date(evt.createdAt).toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center space-x-2">
                        <Button 
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedEvent(evt)}
                        >
                          View Scores
                        </Button>
                        <Button 
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExport(evt)}
                          title="Download Raw JSON"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={selectedEvent !== null} 
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent ? `Archive: ${selectedEvent.name}` : ''}
      >
        {selectedEvent && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-500 mb-4">
              Below is the raw JSON snapshot of all final scores and rankings at the exact moment the event was closed.
            </p>
            <div className="bg-neutral-900 text-neutral-300 p-4 rounded-lg overflow-x-auto max-h-[60vh] font-mono text-xs">
              <pre>{JSON.stringify(JSON.parse(selectedEvent.winnersJson), null, 2)}</pre>
            </div>
          </div>
        )}
      </Modal>

    </PageWrapper>
  );
};
