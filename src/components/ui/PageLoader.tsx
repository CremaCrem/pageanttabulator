import React from 'react';
import { Spinner } from './Spinner';

interface PageLoaderProps {
  label?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ label = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full h-full">
      <Spinner size="lg" variant="primary" />
      {label && <p className="mt-4 text-neutral-500 font-medium animate-pulse">{label}</p>}
    </div>
  );
};
