import React from 'react';
import { ConnectionStatus } from '../ui/ConnectionStatus';

export const JudgeShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen w-full bg-parchment">
      {/* Minimal Header */}
      <header className="h-16 shrink-0 bg-primary-900 text-white flex items-center px-6 justify-between shadow-md z-10">
        <div className="flex items-center space-x-4">
          <h1 className="display-font text-xl font-bold tracking-wide">Mr. & Ms. IDSC 2026</h1>
          <div className="h-6 w-px bg-white/20 hidden sm:block"></div>
          <div className="hidden sm:block text-sm font-medium text-gold-400">Official Judging Portal</div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm font-medium bg-white/10 px-3 py-1 rounded-full">
            Judge ID: <span className="text-gold-500 font-bold">J1</span> {/* TODO: hook up to session state */}
          </div>
          <ConnectionStatus status="connected" className="hidden sm:flex text-white" />
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
};
