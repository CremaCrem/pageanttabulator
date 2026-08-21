import React from 'react';
import { cn } from '../ui/Button';

export interface PageWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({ children, className, ...props }) => {
  return (
    <div className={cn('p-6 md:p-8 lg:p-12 w-full max-w-7xl mx-auto', className)} {...props}>
      {children}
    </div>
  );
};
