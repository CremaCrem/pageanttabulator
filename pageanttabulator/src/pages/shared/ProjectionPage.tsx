import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { SEGMENTS } from '../../utils/constants';

export const ProjectionPage: React.FC = () => {
  const { state } = useAppContext();
  
  // Connect to websocket to get live segment updates
  const serverIp = window.location.hostname || '127.0.0.1';
  useWebSocket(serverIp);

  const activeSegment = state.activeSegmentId ? SEGMENTS[state.activeSegmentId] : null;

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-primary-900 flex flex-col items-center justify-center p-8 font-sans">
      
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-gold-500/20 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] bg-primary-500/20 rounded-full blur-[150px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50"></div>
      </div>

      {/* Main Glassmorphic Panel */}
      <div className="relative z-10 w-full max-w-5xl backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-12 md:p-24 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col items-center text-center transition-all duration-1000 ease-in-out">
        
        <div className="mb-6 flex space-x-3 items-center">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold-400"></div>
          <span className="uppercase tracking-[0.3em] text-gold-400 font-bold text-sm md:text-base">
            {state.eventConfig?.subtitle || 'Coronation Night'}
          </span>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold-400"></div>
        </div>

        <h1 className="display-font text-5xl md:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-gold-100 to-gold-600 mb-8 drop-shadow-lg tracking-tight">
          {state.eventConfig?.name || 'Mr. & Ms. IDSC 2026'}
        </h1>

        <div className="w-full max-w-lg mx-auto h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-12"></div>

        <div className="min-h-[160px] flex flex-col items-center justify-center transition-all duration-500">
          {!activeSegment ? (
            <div className="animate-fade-in flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-gold-500/30 border-t-gold-500 rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl md:text-3xl text-primary-100 font-light tracking-wide">
                Waiting for the next segment...
              </h2>
            </div>
          ) : (
            <div className="animate-scale-in flex flex-col items-center">
              <span className="text-gold-400/80 uppercase tracking-widest text-sm font-semibold mb-2 block">
                Currently Judging
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-white drop-shadow-md">
                {activeSegment.label}
              </h2>
            </div>
          )}
        </div>

      </div>
      
      {/* Footer Details */}
      <div className="absolute bottom-8 text-white/30 text-sm tracking-widest uppercase font-semibold">
        IDSC Pageant Tabulation System
      </div>
    </div>
  );
};
