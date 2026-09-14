import { useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { fetchApi } from '../api/client';

export const useExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = async (): Promise<string> => {
    setIsExporting(true);
    try {
      if (isTauri()) {
        const networkInfo = await fetchApi('/api/network-info');
        const baseUrl = networkInfo.serverUrl;
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

  const exportBlankScoreSheets = async (judgeIds: string[], segmentIds: string[]): Promise<string> => {
    setIsExporting(true);
    try {
      if (isTauri()) {
        const networkInfo = await fetchApi('/api/network-info');
        const baseUrl = networkInfo.serverUrl;
        const jParams = judgeIds.join(',');
        const sParams = segmentIds.join(',');
        await openUrl(`${baseUrl}/print-blank-scoresheets?judgeIds=${jParams}&segmentIds=${sParams}`);
        return 'Opened blank score sheets in default browser for printing.';
      } else {
        throw new Error('PDF Export is only available in the Admin Desktop App.');
      }
    } catch (error: any) {
      console.error('Failed to export blank score sheets', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  };

  return { exportPdf, exportBlankScoreSheets, isExporting };
};
