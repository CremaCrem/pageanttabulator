import React, { useState, useEffect } from 'react';
import { ConnectionStatus } from '../ui/ConnectionStatus';
import { useAppContext } from '../../context/AppContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { SEGMENTS } from '../../utils/constants';

export const JudgeShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useAppContext();
  
  // Use the current hostname to connect to the backend WS, or default to localhost if not found
  const serverIp = window.location.hostname || '127.0.0.1';
  useWebSocket(serverIp);

  // Connection status UI mock logic (will be wired to real server state in Phase 5)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connected');
  
  useEffect(() => {
    const handleOnline = () => setConnectionStatus('connected');
    const handleOffline = () => setConnectionStatus('disconnected');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) setConnectionStatus('disconnected');
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const activeSegment = state.activeSegmentId ? SEGMENTS[state.activeSegmentId] : null;

  return (
    <div className="flex flex-col min-h-screen w-full bg-neutral-50">
      {/* Structural Judge Header */}
      <header className="h-16 shrink-0 bg-primary-900 text-white flex items-center px-4 md:px-6 justify-between shadow-md z-20 sticky top-0">
        
        {/* Left: Event & Segment Info */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 min-w-0">
          <h1 className="display-font text-lg md:text-xl font-bold tracking-wide truncate">
            {state.eventConfig?.name || 'Mr. & Ms. IDSC 2026'}
          </h1>
          <div className="h-6 w-px bg-white/20 hidden sm:block"></div>
          <div className="text-sm font-medium text-gold-400 truncate">
            {activeSegment ? activeSegment.label : 'Waiting for Segment...'}
          </div>
        </div>
        
        {/* Right: Judge Identity & Connection */}
        <div className="flex items-center space-x-3 md:space-x-4 flex-shrink-0 ml-2">
          {state.session?.judgeId && (
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs text-primary-200">Logged in as</span>
              <span className="text-sm font-bold text-white uppercase">{state.session.judgeId.replace('_', ' ')}</span>
            </div>
          )}
          <div className="bg-primary-800 rounded-lg p-2">
            <ConnectionStatus status={connectionStatus} className="text-white" />
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-neutral-50">
        {children}
      </main>
    </div>
  );
};
