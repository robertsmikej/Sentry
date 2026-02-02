import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getAllScans, addScan, clearHistory } from '../services/storage';
import { exportHistoryToCSV } from '../services/export';
import type { ScanEntry, LookupEntry } from '../types';

interface UseHistoryReturn {
  scans: ScanEntry[];
  addEntry: (data: {
    extractedText: string;
    normalizedText: string;
    matched: boolean;
    matchedEntry?: LookupEntry;
    imageDataUrl?: string;
  }) => Promise<void>;
  clear: () => Promise<void>;
  exportCSV: () => void;
  refresh: () => Promise<void>;
}

export function useHistory(): UseHistoryReturn {
  const [scans, setScans] = useState<ScanEntry[]>([]);

  const refresh = useCallback(async () => {
    const data = await getAllScans();
    setScans(data);
  }, []);

  const addEntry = useCallback(
    async (data: {
      extractedText: string;
      normalizedText: string;
      matched: boolean;
      matchedEntry?: LookupEntry;
      imageDataUrl?: string;
    }) => {
      const entry: ScanEntry = {
        id: uuidv4(),
        timestamp: new Date(),
        ...data,
      };

      await addScan(entry);
      await refresh();
    },
    [refresh]
  );

  const clear = useCallback(async () => {
    await clearHistory();
    setScans([]);
  }, []);

  const exportCSV = useCallback(() => {
    exportHistoryToCSV(scans);
  }, [scans]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    scans,
    addEntry,
    clear,
    exportCSV,
    refresh,
  };
}
