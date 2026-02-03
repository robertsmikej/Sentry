import { useEffect, useRef, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { getUnsyncedCount, getUnsyncedEncounterCount, getSettings } from '../services/storage';
import { syncToSheet } from '../services/writeSync';
import { syncFromSheet } from '../services/sync';
import { syncEncountersToSheet } from '../services/encounterSync';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface UseAutoSyncOptions {
  onSyncComplete?: (count: number) => void;
  onSyncError?: (error: string) => void;
  onInitialSyncComplete?: () => void;
  onInitialSyncError?: (error: string) => void;
}

export function useAutoSync(options: UseAutoSyncOptions = {}) {
  const isOnline = useOnlineStatus();
  const intervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);
  const hasInitialSyncedRef = useRef(false);

  // Full sync on app load: push local changes, then pull from Google
  const attemptInitialSync = useCallback(async () => {
    // Only run once per session
    if (hasInitialSyncedRef.current || isSyncingRef.current || !navigator.onLine) {
      return;
    }

    try {
      const settings = await getSettings();
      if (!settings?.sheetUrl) {
        // No sheet URL configured, skip initial sync
        return;
      }

      hasInitialSyncedRef.current = true;
      isSyncingRef.current = true;

      console.log('[AutoSync] Starting initial full sync...');

      // Step 1: Push any pending local changes first
      if (settings.writeUrl) {
        // Sync plate entries
        const pendingCount = await getUnsyncedCount();
        if (pendingCount > 0) {
          console.log('[AutoSync] Pushing', pendingCount, 'local plate changes first...');
          const writeResult = await syncToSheet(settings.writeUrl);
          if (!writeResult.success) {
            console.warn('[AutoSync] Plate write sync had issues:', writeResult.error);
          }
        }

        // Sync encounters
        const pendingEncounters = await getUnsyncedEncounterCount();
        if (pendingEncounters > 0) {
          console.log('[AutoSync] Pushing', pendingEncounters, 'encounters...');
          const encounterResult = await syncEncountersToSheet(settings.writeUrl);
          if (!encounterResult.success) {
            console.warn('[AutoSync] Encounter sync had issues:', encounterResult.error);
          }
        }
      }

      // Step 2: Pull from Google to get latest data
      console.log('[AutoSync] Pulling from Google Sheets...');
      await syncFromSheet(settings.sheetUrl);

      console.log('[AutoSync] Initial full sync complete');
      options.onInitialSyncComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Initial sync failed';
      console.error('[AutoSync] Initial sync error:', message);
      options.onInitialSyncError?.(message);
    } finally {
      isSyncingRef.current = false;
    }
  }, [options]);

  const attemptSync = useCallback(async () => {
    // Don't sync if already syncing or offline
    if (isSyncingRef.current || !navigator.onLine) {
      return;
    }

    try {
      const settings = await getSettings();
      let totalSynced = 0;

      isSyncingRef.current = true;

      // Sync plate entries if we have pending changes and a write URL
      const pendingPlateCount = await getUnsyncedCount();
      if (pendingPlateCount > 0 && settings?.writeUrl) {
        const result = await syncToSheet(settings.writeUrl);
        if (result.success && result.count > 0) {
          totalSynced += result.count;
          console.log(`Auto-synced ${result.count} plate entries to Google Sheets`);
        } else if (!result.success) {
          console.error('Plate sync failed:', result.error);
        }
      }

      // Sync encounters if we have pending encounters and an encounter write URL
      // Use the same writeUrl for encounters (the Apps Script handles both)
      const pendingEncounterCount = await getUnsyncedEncounterCount();
      if (pendingEncounterCount > 0 && settings?.writeUrl) {
        const encounterResult = await syncEncountersToSheet(settings.writeUrl);
        if (encounterResult.success && encounterResult.count > 0) {
          totalSynced += encounterResult.count;
          console.log(`Auto-synced ${encounterResult.count} encounters to Google Sheets`);
        } else if (!encounterResult.success) {
          console.error('Encounter sync failed:', encounterResult.error);
        }
      }

      if (totalSynced > 0) {
        options.onSyncComplete?.(totalSynced);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Auto-sync failed';
      console.error('Auto-sync error:', message);
      options.onSyncError?.(message);
    } finally {
      isSyncingRef.current = false;
    }
  }, [options]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only set up auto-sync if online
    if (isOnline) {
      // On first load (or when coming online), do a full sync
      attemptInitialSync();

      // Also check for pending write syncs
      attemptSync();

      // Then run write sync every N minutes
      intervalRef.current = window.setInterval(attemptSync, AUTO_SYNC_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOnline, attemptSync, attemptInitialSync]);

  return {
    triggerSync: attemptSync,
    triggerInitialSync: attemptInitialSync,
  };
}
