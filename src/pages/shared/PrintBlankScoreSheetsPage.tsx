import React, { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PrintBlankScoreSheets } from '../../components/admin/PrintBlankScoreSheets';

/**
 * A standalone page that renders ONLY the PrintBlankScoreSheets component
 * with no sidebar/chrome. When opened in a browser, it auto-triggers
 * window.print() after the report data finishes loading.
 */
export const PrintBlankScoreSheetsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const hasPrinted = useRef(false);

  const handleLoaded = useCallback(() => {
    if (!hasPrinted.current) {
      hasPrinted.current = true;
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, []);

  const judgeIds = searchParams.get('judgeIds')?.split(',').filter(Boolean) || [];
  const segmentIds = searchParams.get('segmentIds')?.split(',').filter(Boolean) || [];

  return (
    <div className="min-h-screen bg-white">
      <PrintBlankScoreSheets judgeIds={judgeIds} segmentIds={segmentIds} onLoaded={handleLoaded} />
    </div>
  );
};
