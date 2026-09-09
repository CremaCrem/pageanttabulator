import React, { useEffect } from 'react';
import { CheckCircle, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastProps extends ToastMessage {
  onDismiss: (id: string) => void;
}

const variantStyles: Record<ToastVariant, { border: string; iconColor: string; icon: React.ReactNode }> = {
  success: { border: 'border-l-green-500', iconColor: 'text-green-600', icon: <CheckCircle className="w-5 h-5" /> },
  error: { border: 'border-l-red-500', iconColor: 'text-red-600', icon: <AlertOctagon className="w-5 h-5" /> },
  warning: { border: 'border-l-yellow-500', iconColor: 'text-yellow-600', icon: <AlertTriangle className="w-5 h-5" /> },
  info: { border: 'border-l-blue-500', iconColor: 'text-blue-600', icon: <Info className="w-5 h-5" /> },
};

export const Toast: React.FC<ToastProps> = ({ id, message, variant, duration = 4000, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const style = variantStyles[variant];

  return (
    <div className={`flex items-start bg-white border-l-4 ${style.border} rounded-lg shadow-panel p-4 w-80 animate-in slide-in-from-right-4 fade-in duration-300 pointer-events-auto`}>
      <div className={`flex-shrink-0 ${style.iconColor} mr-3`}>{style.icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-800">{message}</p>
      </div>
      <button onClick={() => onDismiss(id)} className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 transition-colors ml-3">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
