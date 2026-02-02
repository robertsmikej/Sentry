import { useEffect, useRef, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { getUnsyncedCount, getSettings } from '../services/storage';
import { syncToSheet } from '../services/writeSync';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface UseAutoSyncOptions {
  onSyncComplete?: (count: number) => void;
  onSyncError?: (error: string) => void;
}

export function useAutoSync(options: UseAutoSyncOptions = {}) {
  const isOnline = useOnlineStatus();
  const intervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

  const attemptSync = useCallback(async () => {
    // Don't sync if already syncing or offline
    if (isSyncingRef.current || !navigator.onLine) {
      return;
    }

    try {
      // Check if there are pending changes
      const pendingCount = await getUnsyncedCount();
      if (pendingCount === 0) {
        return;
      }

      // Check if we have a write URL configured
      const settings = await getSettings();
      if (!settings?.writeUrl) {
        return;
      }

      isSyncingRef.current = true;

      const result = await syncToSheet(settings.writeUrl);

      if (result.success && result.count > 0) {
        console.log(`Auto-synced ${result.count} entries to Google Sheets`);
        options.onSyncComplete?.(result.count);
      } else if (!result.success) {
        console.error('Auto-sync failed:', result.error);
        options.onSyncError?.(result.error || 'Auto-sync failed');
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
      // Run immediately on coming online (if there are pending changes)
      attemptSync();

      // Then run every N minutes
      intervalRef.current = window.setInterval(attemptSync, AUTO_SYNC_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOnline, attemptSync]);

  return {
    triggerSync: attemptSync,
  };
}
