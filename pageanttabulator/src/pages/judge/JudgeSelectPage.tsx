import React from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';

export const JudgeSelectPage: React.FC = () => {
  return (
    <PageWrapper className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <div className="bg-white p-8 rounded-xl shadow-panel max-w-md w-full text-center">
        <h1 className="text-heading-2 mb-2 text-primary-900">Welcome, Judge</h1>
        <p className="text-neutral-500 mb-8">Please select your assigned judge number to begin scoring.</p>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Stub buttons */}
          <button className="p-4 border-2 border-neutral-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors font-semibold text-neutral-700">Judge 1</button>
          <button className="p-4 border-2 border-neutral-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors font-semibold text-neutral-700">Judge 2</button>
          <button className="p-4 border-2 border-neutral-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors font-semibold text-neutral-700">Judge 3</button>
          <button className="p-4 border-2 border-neutral-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors font-semibold text-neutral-700">Judge 4</button>
        </div>
      </div>
    </PageWrapper>
  );
};
