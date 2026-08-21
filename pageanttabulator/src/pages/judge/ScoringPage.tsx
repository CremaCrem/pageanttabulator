import React from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';

export const ScoringPage: React.FC = () => {
  return (
    <PageWrapper>
      <h1 className="text-heading-2 mb-6 text-primary-900">Scoring: Production Number</h1>
      <div className="bg-white p-6 rounded-lg shadow-card">
        <p className="text-neutral-700">Candidate list and scoring inputs will appear here.</p>
      </div>
    </PageWrapper>
  );
};
