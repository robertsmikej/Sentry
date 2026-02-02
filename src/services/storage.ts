import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { LookupEntry, ScanEntry, UserSettings } from '../types';

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
}

const DB_NAME = 'plate-reader-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PlateReaderDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PlateReaderDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const lookupStore = db.createObjectStore('lookupData', { keyPath: 'code' });
        lookupStore.createIndex('by-code', 'code');

        const historyStore = db.createObjectStore('scanHistory', { keyPath: 'id' });
        historyStore.createIndex('by-timestamp', 'timestamp');

        db.createObjectStore('settings', { keyPath: 'sheetUrl' });
      },
    });
  }
  return dbPromise;
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
      // Merge: keep local user data, update from sheet
      await tx.objectStore('lookupData').put({
        ...entry,
        seenCount: localData.seenCount,
        experience: localData.experience,
        lastSeen: localData.lastSeen,
        isLocal: true,
        needsSync: localData.needsSync, // Preserve sync status
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
  return db.get('lookupData', code);
}

// Add or update a single entry (marks as needing sync)
export async function upsertLookupEntry(entry: LookupEntry): Promise<void> {
  const db = await getDB();
  await db.put('lookupData', { ...entry, isLocal: true, needsSync: true });
}

// Increment seen count and update lastSeen (marks as needing sync)
export async function incrementSeenCount(code: string): Promise<LookupEntry | undefined> {
  const db = await getDB();
  const entry = await db.get('lookupData', code);

  if (entry) {
    const updated: LookupEntry = {
      ...entry,
      seenCount: (entry.seenCount || 0) + 1,
      lastSeen: new Date(),
      isLocal: true,
      needsSync: true,
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

// Mark entries as synced (clear needsSync flag)
export async function markAsSynced(codes: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('lookupData', 'readwrite');

  for (const code of codes) {
    const entry = await tx.objectStore('lookupData').get(code);
    if (entry) {
      await tx.objectStore('lookupData').put({
        ...entry,
        needsSync: false,
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
