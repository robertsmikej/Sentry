import { useState, useCallback, useEffect } from 'react';
import {
  getAllLookupEntries,
  findLookupEntry,
  upsertLookupEntry,
  incrementSeenCount,
  getUnsyncedCount,
  getSettings,
} from '../services/storage';
import { syncFromSheet, getLastSyncTime } from '../services/sync';
import { syncToSheet } from '../services/writeSync';
import type { LookupEntry } from '../types';

// Immediate sync when online after data changes
const IMMEDIATE_SYNC_ENABLED = true;

interface UseLookupReturn {
  entries: LookupEntry[];
  lastSync: Date | undefined;
  lastWriteSync: Date | undefined;
  isSyncing: boolean;
  isWriteSyncing: boolean;
  syncError: string | null;
  writeSyncError: string | null;
  pendingSyncCount: number;
  lookup: (code: string) => Promise<LookupEntry | undefined>;
  sync: (sheetUrl: string) => Promise<void>;
  writeSync: (writeUrl: string) => Promise<{ success: boolean; count: number }>;
  refresh: () => Promise<void>;
  upsertPlate: (entry: LookupEntry) => Promise<void>;
  incrementSeen: (code: string) => Promise<LookupEntry | undefined>;
}

export function useLookup(): UseLookupReturn {
  const [entries, setEntries] = useState<LookupEntry[]>([]);
  const [lastSync, setLastSync] = useState<Date | undefined>();
  const [lastWriteSync, setLastWriteSync] = useState<Date | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isWriteSyncing, setIsWriteSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [writeSyncError, setWriteSyncError] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const refresh = useCallback(async () => {
    const data = await getAllLookupEntries();
    setEntries(data);
    const syncTime = await getLastSyncTime();
    setLastSync(syncTime);

    // Get pending sync count
    const count = await getUnsyncedCount();
    setPendingSyncCount(count);

    // Get last write sync time
    const settings = await getSettings();
    setLastWriteSync(settings?.lastWriteSyncTime);
  }, []);

  const lookup = useCallback(async (code: string): Promise<LookupEntry | undefined> => {
    return findLookupEntry(code);
  }, []);

  const sync = useCallback(async (sheetUrl: string) => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      await syncFromSheet(sheetUrl);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setSyncError(message);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [refresh]);

  const writeSync = useCallback(async (writeUrl: string) => {
    setIsWriteSyncing(true);
    setWriteSyncError(null);

    try {
      const result = await syncToSheet(writeUrl);
      if (!result.success) {
        setWriteSyncError(result.error || 'Write sync failed');
      }
      await refresh();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Write sync failed';
      setWriteSyncError(message);
      return { success: false, count: 0 };
    } finally {
      setIsWriteSyncing(false);
    }
  }, [refresh]);

  // Trigger immediate sync to server when online
  const triggerImmediateSync = useCallback(async () => {
    if (!IMMEDIATE_SYNC_ENABLED || !navigator.onLine) {
      return;
    }

    try {
      const settings = await getSettings();
      if (!settings?.writeUrl) {
        return;
      }

      const result = await syncToSheet(settings.writeUrl);
      if (result.success && result.count > 0) {
        await refresh();
      }
    } catch {
      // Silent fail - will retry on next interval or when coming online
    }
  }, [refresh]);

  const upsertPlate = useCallback(async (entry: LookupEntry) => {
    await upsertLookupEntry(entry);
    await refresh();
    // Trigger immediate sync if online
    triggerImmediateSync();
  }, [refresh, triggerImmediateSync]);

  const incrementSeen = useCallback(async (code: string): Promise<LookupEntry | undefined> => {
    const updated = await incrementSeenCount(code);
    await refresh();
    // Trigger immediate sync if online
    triggerImmediateSync();
    return updated;
  }, [refresh, triggerImmediateSync]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    entries,
    lastSync,
    lastWriteSync,
    isSyncing,
    isWriteSyncing,
    syncError,
    writeSyncError,
    pendingSyncCount,
    lookup,
    sync,
    writeSync,
    refresh,
    upsertPlate,
    incrementSeen,
  };
}
