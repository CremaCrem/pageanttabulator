import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from './Button';

export interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'connecting';
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status, className }) => {
  return (
    <div className={cn("flex items-center space-x-2 text-sm", className)}>
      {status === 'connected' && (
        <>
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
          </div>
          <span className="text-success font-medium">Connected</span>
          <Wifi className="w-4 h-4 text-success" />
        </>
      )}
      
      {status === 'connecting' && (
        <>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-warning"></span>
          <span className="text-warning font-medium">Connecting...</span>
          <Wifi className="w-4 h-4 text-warning opacity-50" />
        </>
      )}

      {status === 'disconnected' && (
        <>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-error"></span>
          <span className="text-error font-medium">Disconnected</span>
          <WifiOff className="w-4 h-4 text-error" />
        </>
      )}
    </div>
  );
};
