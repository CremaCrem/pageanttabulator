import { useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

export const useExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = async (): Promise<string> => {
    setIsExporting(true);
    try {
      if (isTauri()) {
        // Use the current application origin (e.g., http://localhost:1420 in dev, or 3000 in prod)
        // This ensures the new route is found by the live Vite server in development.
        const baseUrl = window.location.origin;
        await openUrl(`${baseUrl}/print-report`);
        return 'Opened report in default browser for printing.';
      } else {
        throw new Error('PDF Export is only available in the Admin Desktop App.');
      }
    } catch (error: any) {
      console.error('Failed to export PDF', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  };

  return { exportPdf, isExporting };
};
