import React from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';

export const SetupPage: React.FC = () => {
  return (
    <PageWrapper>
      <h1 className="text-heading-1 mb-6 text-primary-900">Event Setup</h1>
      <div className="bg-white p-6 rounded-lg shadow-card">
        <p className="text-neutral-700">Setup event details, candidates, and judges here.</p>
      </div>
    </PageWrapper>
  );
};
