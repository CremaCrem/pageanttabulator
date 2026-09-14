import React, { useCallback, useRef } from 'react';
import { PrintReport } from '../../components/admin/PrintReport';

/**
 * A standalone page that renders ONLY the PrintReport component
 * with no sidebar/chrome. When opened in a browser, it auto-triggers
 * window.print() after the report data finishes loading.
 */
export const PrintReportPage: React.FC = () => {
  const hasPrinted = useRef(false);

  const handleLoaded = useCallback(() => {
    // Auto-trigger print dialog once the report data is loaded
    // Use a small delay to let the browser finish rendering
    if (!hasPrinted.current) {
      hasPrinted.current = true;
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <PrintReport onLoaded={handleLoaded} />
    </div>
  );
};
