import React from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';

export const ReportsPage: React.FC = () => {
  return (
    <PageWrapper>
      <h1 className="text-heading-1 mb-6 text-primary-900">Final Reports & Export</h1>
      <div className="bg-white p-6 rounded-lg shadow-card">
        <p className="text-neutral-700">Final results, winner determination, and PDF export will be here.</p>
      </div>
    </PageWrapper>
  );
};
