import React from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';

export const DashboardPage: React.FC = () => {
  return (
    <PageWrapper>
      <h1 className="text-heading-1 mb-6 text-primary-900">Live Dashboard</h1>
      <div className="bg-white p-6 rounded-lg shadow-card">
        <p className="text-neutral-700">Live overview of rankings and judge progress will appear here.</p>
      </div>
    </PageWrapper>
  );
};
