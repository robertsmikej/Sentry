import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { LookupEntry, ScanEntry, UserSettings, Encounter } from '../types';

interface PlateReaderDB extends DBSchema {
  lookupData: {
    key: string;
    value: LookupEntry;
    indexes: { 'by-code': string };
  };
  scanHistory: {
    key: string;
    value: ScanEntry;
    indexes: { 'by-timestamp': Date };
  };
  settings: {
    key: string;
    value: UserSettings;
  };
  encounters: {
    key: string;
    value: Encounter;
    indexes: {
      'by-plateCode': string;
      'by-timestamp': Date;
      'by-needsSync': number;
    };
  };
}

const DB_NAME = 'plate-reader-db';
const DB_VERSION = 2; // Incremented for encounters store

let dbPromise: Promise<IDBPDatabase<PlateReaderDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PlateReaderDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Version 1: Original schema
        if (oldVersion < 1) {
          const lookupStore = db.createObjectStore('lookupData', { keyPath: 'code' });
          lookupStore.createIndex('by-code', 'code');

          const historyStore = db.createObjectStore('scanHistory', { keyPath: 'id' });
          historyStore.createIndex('by-timestamp', 'timestamp');

          db.createObjectStore('settings', { keyPath: 'sheetUrl' });
        }

        // Version 2: Add encounters store
        if (oldVersion < 2) {
          const encounterStore = db.createObjectStore('encounters', { keyPath: 'id' });
          encounterStore.createIndex('by-plateCode', 'plateCode');
          encounterStore.createIndex('by-timestamp', 'timestamp');
          encounterStore.createIndex('by-needsSync', 'needsSync');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Normalize a plate code for consistent matching
 * - Uppercase
 * - Remove spaces and special characters
 */
function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

// Lookup Data
export async function getAllLookupEntries(): Promise<LookupEntry[]> {
  const db = await getDB();
  return db.getAll('lookupData');
}

export async function setLookupEntries(entries: LookupEntry[]): Promise<void> {
  const db = await getDB();

  // Get existing local entries to preserve user data
  const existingEntries = await db.getAll('lookupData');
  const localEntries = existingEntries.filter(e => e.isLocal);
  const localEntriesMap = new Map(localEntries.map(e => [e.code, e]));

  const tx = db.transaction('lookupData', 'readwrite');
  await tx.objectStore('lookupData').clear();

  // Add synced entries, merging with local data if exists
  for (const entry of entries) {
    const localData = localEntriesMap.get(entry.code);
    if (localData) {
      // Merge: Google is source of truth for seenCount UNLESS we have a pending scan increment
      // For experience/lastSeen, preserve local if we have unsynced changes
      const hasUnpushedScanIncrement = localData.needsSync && localData.pendingSeenIncrement;
      const hasUnpushedChanges = localData.needsSync;

      await tx.objectStore('lookupData').put({
        ...entry,
        // Use Google's seenCount unless we have a pending scan increment that hasn't been pushed yet
        seenCount: hasUnpushedScanIncrement ? localData.seenCount : entry.seenCount,
        // Preserve local experience/lastSeen only if we have unpushed changes
        experience: hasUnpushedChanges ? localData.experience : entry.experience,
        lastSeen: hasUnpushedChanges ? localData.lastSeen : entry.lastSeen,
        isLocal: hasUnpushedChanges,
        needsSync: localData.needsSync, // Preserve sync status
        pendingSeenIncrement: localData.pendingSeenIncrement, // Preserve pending increment flag
      });
      localEntriesMap.delete(entry.code);
    } else {
      await tx.objectStore('lookupData').put(entry);
    }
  }

  // Re-add any local-only entries not in the sheet
  for (const localEntry of localEntriesMap.values()) {
    await tx.objectStore('lookupData').put(localEntry);
  }

  await tx.done;
}

export async function findLookupEntry(code: string): Promise<LookupEntry | undefined> {
  const db = await getDB();
  // Normalize the code to handle spaces or formatting differences
  const normalizedCode = normalizeCode(code);

  // Try direct lookup first (for properly normalized database entries)
  let entry = await db.get('lookupData', normalizedCode);

  // Fallback: scan all entries comparing normalized codes
  // This handles old database entries that may have spaces in the key
  if (!entry) {
    const allEntries = await db.getAll('lookupData');
    entry = allEntries.find(e => normalizeCode(e.code) === normalizedCode);
  }

  return entry;
}

// Add or update a single entry (marks as needing sync, but NOT as a seen event)
export async function upsertLookupEntry(entry: LookupEntry): Promise<void> {
  const db = await getDB();
  // Preserve pendingSeenIncrement if it exists, otherwise don't set it
  // This is a metadata update, not a "seen" event
  await db.put('lookupData', {
    ...entry,
    isLocal: true,
    needsSync: true,
    pendingSeenIncrement: entry.pendingSeenIncrement || false,
  });
}

// Increment seen count and update lastSeen (marks as needing sync)
export async function incrementSeenCount(code: string): Promise<LookupEntry | undefined> {
  const db = await getDB();
  const normalizedCode = normalizeCode(code);

  // Try direct lookup first
  let entry = await db.get('lookupData', normalizedCode);

  // Fallback: scan all entries for old data with spaces in key
  if (!entry) {
    const allEntries = await db.getAll('lookupData');
    entry = allEntries.find(e => normalizeCode(e.code) === normalizedCode);
  }

  if (entry) {
    const updated: LookupEntry = {
      ...entry,
      seenCount: (entry.seenCount || 0) + 1,
      lastSeen: new Date(),
      isLocal: true,
      needsSync: true,
      pendingSeenIncrement: true, // Flag to tell Google Sheets to increment seenCount
    };
    await db.put('lookupData', updated);
    return updated;
  }

  return undefined;
}

// Delete a lookup entry
export async function deleteLookupEntry(code: string): Promise<void> {
  const db = await getDB();
  await db.delete('lookupData', code);
}

// Get all entries that need to be synced to the sheet
export async function getUnsyncedEntries(): Promise<LookupEntry[]> {
  const db = await getDB();
  const allEntries = await db.getAll('lookupData');
  return allEntries.filter(e => e.needsSync === true);
}

// Get count of entries needing sync
export async function getUnsyncedCount(): Promise<number> {
  const entries = await getUnsyncedEntries();
  return entries.length;
}

// Mark entries as synced (clear needsSync and pendingSeenIncrement flags)
export async function markAsSynced(codes: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('lookupData', 'readwrite');

  for (const code of codes) {
    const entry = await tx.objectStore('lookupData').get(code);
    if (entry) {
      await tx.objectStore('lookupData').put({
        ...entry,
        needsSync: false,
        pendingSeenIncrement: false, // Clear the increment flag after sync
      });
    }
  }

  await tx.done;
}

// Scan History
export async function getAllScans(): Promise<ScanEntry[]> {
  const db = await getDB();
  const scans = await db.getAll('scanHistory');
  return scans.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function addScan(scan: ScanEntry): Promise<void> {
  const db = await getDB();
  await db.put('scanHistory', scan);
}

export async function clearHistory(): Promise<void> {
  const db = await getDB();
  await db.clear('scanHistory');
}

// Settings
export async function getSettings(): Promise<UserSettings | undefined> {
  const db = await getDB();
  const allSettings = await db.getAll('settings');
  return allSettings[0];
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings);
}

// ============== ENCOUNTERS ==============

// Get all encounters, sorted by timestamp (newest first)
export async function getAllEncounters(): Promise<Encounter[]> {
  const db = await getDB();
  const encounters = await db.getAll('encounters');
  return encounters.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Get encounters for a specific plate
export async function getEncountersForPlate(plateCode: string): Promise<Encounter[]> {
  const db = await getDB();
  const normalizedCode = plateCode.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  const encounters = await db.getAllFromIndex('encounters', 'by-plateCode', normalizedCode);
  return encounters.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Get a single encounter by ID
export async function getEncounter(id: string): Promise<Encounter | undefined> {
  const db = await getDB();
  return db.get('encounters', id);
}

// Add a new encounter
export async function addEncounter(encounter: Encounter): Promise<void> {
  const db = await getDB();
  await db.put('encounters', {
    ...encounter,
    needsSync: true,
  });
}

// Update an existing encounter
export async function updateEncounter(encounter: Encounter): Promise<void> {
  const db = await getDB();
  await db.put('encounters', {
    ...encounter,
    needsSync: true,
  });
}

// Delete an encounter
export async function deleteEncounter(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('encounters', id);
}

// Get encounters that need to be synced
export async function getUnsyncedEncounters(): Promise<Encounter[]> {
  const db = await getDB();
  const allEncounters = await db.getAll('encounters');
  return allEncounters.filter(e => e.needsSync === true);
}

// Get count of encounters needing sync
export async function getUnsyncedEncounterCount(): Promise<number> {
  const encounters = await getUnsyncedEncounters();
  return encounters.length;
}

// Mark encounters as synced
export async function markEncountersAsSynced(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('encounters', 'readwrite');

  for (const id of ids) {
    const encounter = await tx.objectStore('encounters').get(id);
    if (encounter) {
      await tx.objectStore('encounters').put({
        ...encounter,
        needsSync: false,
        syncedAt: new Date(),
      });
    }
  }

  await tx.done;
}

// Get recent encounters (for display on ResultCard)
export async function getRecentEncountersForPlate(plateCode: string, limit: number = 3): Promise<Encounter[]> {
  const encounters = await getEncountersForPlate(plateCode);
  return encounters.slice(0, limit);
}

// Get encounter count for a plate
export async function getEncounterCountForPlate(plateCode: string): Promise<number> {
  const encounters = await getEncountersForPlate(plateCode);
  return encounters.length;
}

// Migrate existing matched scans to encounters (one-time migration)
export async function migrateScansToEncounters(): Promise<number> {
  const db = await getDB();
  const scans = await db.getAll('scanHistory');
  const existingEncounters = await db.getAll('encounters');
  const existingEncounterScanIds = new Set(existingEncounters.map(e => e.scanId).filter(Boolean));

  let migratedCount = 0;
  const tx = db.transaction('encounters', 'readwrite');

  for (const scan of scans) {
    // Only migrate matched scans that haven't been migrated yet
    if (scan.matched && scan.matchedEntry && !existingEncounterScanIds.has(scan.id)) {
      const encounter: Encounter = {
        id: `migrated-${scan.id}`,
        plateCode: scan.normalizedText.toUpperCase().replace(/[^A-Z0-9]/g, '').trim(),
        timestamp: scan.timestamp,
        scanId: scan.id,
        experience: scan.matchedEntry?.experience || 'neutral',
        notes: undefined,
        tags: undefined,
        needsSync: false, // Don't sync migrated data
      };
      await tx.objectStore('encounters').put(encounter);
      migratedCount++;
    }
  }

  await tx.done;
  return migratedCount;
}
