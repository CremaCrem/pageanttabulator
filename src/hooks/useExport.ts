import { useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';

export const useExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = async (): Promise<string> => {
    setIsExporting(true);
    try {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        const res = await invoke<string>('generate_pdf');
        return res;
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
