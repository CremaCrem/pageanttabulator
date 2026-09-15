import React from 'react';
import { cn } from './Button';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'gold';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'neutral', children, ...props }) => {
  const variants = {
    success: 'bg-status-success-light text-status-success-dark border-status-success-border',
    warning: 'bg-status-warning-light text-status-warning-dark border-status-warning-border',
    error: 'bg-status-error-light text-status-error-dark border-status-error-border',
    info: 'bg-status-info-light text-status-info-dark border-status-info-border',
    neutral: 'bg-status-neutral-light text-status-neutral-dark border-status-neutral-border',
    gold: 'bg-gold-100 text-gold-600 border-gold-500',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
