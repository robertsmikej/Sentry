import { useState, useCallback, useEffect } from 'react';
import {
  getAllLookupEntries,
  findLookupEntry,
  upsertLookupEntry,
  incrementSeenCount,
  getUnsyncedCount,
  getUnsyncedEncounterCount,
  getSettings,
} from '../services/storage';
import { syncFromSheet, getLastSyncTime } from '../services/sync';
import { syncToSheet } from '../services/writeSync';
import { syncEncountersToSheet } from '../services/encounterSync';
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
  pendingPlateCount: number;
  pendingEncounterCount: number;
  lookup: (code: string) => Promise<LookupEntry | undefined>;
  sync: (sheetUrl: string) => Promise<void>;
  fullSync: (sheetUrl: string, writeUrl?: string) => Promise<void>;
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
  const [pendingPlateCount, setPendingPlateCount] = useState(0);
  const [pendingEncounterCount, setPendingEncounterCount] = useState(0);

  const refresh = useCallback(async () => {
    const data = await getAllLookupEntries();
    setEntries(data);
    const syncTime = await getLastSyncTime();
    setLastSync(syncTime);

    // Get pending sync count
    const plateCount = await getUnsyncedCount();
    const encounterCount = await getUnsyncedEncounterCount();
    setPendingSyncCount(plateCount + encounterCount);
    setPendingPlateCount(plateCount);
    setPendingEncounterCount(encounterCount);

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

  // Combined sync: push local changes first, then pull from Google
  const fullSync = useCallback(async (sheetUrl: string, writeUrl?: string) => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      // Step 1: Push local changes to Google first (if write URL configured)
      if (writeUrl) {
        const pendingCount = await getUnsyncedCount();
        if (pendingCount > 0) {
          console.log('[Sync] Pushing', pendingCount, 'local changes to Google first...');
          const writeResult = await syncToSheet(writeUrl);
          if (!writeResult.success) {
            console.warn('[Sync] Write sync had issues:', writeResult.error);
            // Continue with read sync anyway
          }
        }

        const pendingEncounters = await getUnsyncedEncounterCount();
        if (pendingEncounters > 0) {
          console.log('[Sync] Pushing', pendingEncounters, 'encounters to Google first...');
          const encounterResult = await syncEncountersToSheet(writeUrl);
          if (!encounterResult.success) {
            console.warn('[Sync] Encounter sync had issues:', encounterResult.error);
          }
        }
      }

      // Step 2: Pull from Google to get any updates
      console.log('[Sync] Pulling from Google Sheets...');
      await syncFromSheet(sheetUrl);
      await refresh();
      console.log('[Sync] Full sync complete');
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
      let totalCount = 0;
      let errorMessage: string | null = null;

      const pendingPlates = await getUnsyncedCount();
      if (pendingPlates > 0) {
        const plateResult = await syncToSheet(writeUrl);
        if (!plateResult.success) {
          errorMessage = plateResult.error || 'Plate write sync failed';
        } else {
          totalCount += plateResult.count;
        }
      }

      const pendingEncounters = await getUnsyncedEncounterCount();
      if (pendingEncounters > 0) {
        const encounterResult = await syncEncountersToSheet(writeUrl);
        if (!encounterResult.success) {
          const encounterError = encounterResult.error || 'Encounter sync failed';
          errorMessage = errorMessage ? `${errorMessage} | ${encounterError}` : encounterError;
        } else {
          totalCount += encounterResult.count;
        }
      }

      if (errorMessage) {
        setWriteSyncError(errorMessage);
      }
      await refresh();
      return { success: !errorMessage, count: totalCount };
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
    pendingPlateCount,
    pendingEncounterCount,
    lookup,
    sync,
    fullSync,
    writeSync,
    refresh,
    upsertPlate,
    incrementSeen,
  };
}
