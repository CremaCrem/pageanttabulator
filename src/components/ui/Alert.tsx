import React from 'react';
import { CheckCircle, AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { cn } from './Button';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<AlertVariant, { wrapper: string; iconColor: string; icon: React.ReactNode }> = {
  success: { wrapper: 'bg-status-success-light border-status-success-border text-status-success-dark', iconColor: 'text-status-success', icon: <CheckCircle className="w-5 h-5" /> },
  error: { wrapper: 'bg-status-error-light border-status-error-border text-status-error-dark', iconColor: 'text-status-error', icon: <AlertOctagon className="w-5 h-5" /> },
  warning: { wrapper: 'bg-status-warning-light border-status-warning-border text-status-warning-dark', iconColor: 'text-status-warning', icon: <AlertTriangle className="w-5 h-5" /> },
  info: { wrapper: 'bg-status-info-light border-status-info-border text-status-info-dark', iconColor: 'text-status-info', icon: <Info className="w-5 h-5" /> },
};

export const Alert: React.FC<AlertProps> = ({ variant, title, children, className }) => {
  const style = variantStyles[variant];

  return (
    <div className={cn('flex p-4 border rounded-lg', style.wrapper, className)} role="alert">
      <div className={cn('flex-shrink-0 mr-3', style.iconColor)}>{style.icon}</div>
      <div className="flex-1">
        {title && <h3 className="font-semibold mb-1">{title}</h3>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
};
