import React from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';

export const JudgeStatusPage: React.FC = () => {
  return (
    <PageWrapper>
      <h1 className="text-heading-1 mb-6 text-primary-900">Judge Status</h1>
      <div className="bg-white p-6 rounded-lg shadow-card">
        <p className="text-neutral-700">Monitor judge submission progress here.</p>
      </div>
    </PageWrapper>
  );
};
