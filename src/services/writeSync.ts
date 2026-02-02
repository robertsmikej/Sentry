import { getUnsyncedEntries, markAsSynced, getSettings, saveSettings } from './storage';
import type { LookupEntry } from '../types';

export interface WriteSyncResult {
  success: boolean;
  count: number;
  error?: string;
}

export async function syncToSheet(writeUrl: string): Promise<WriteSyncResult> {
  const unsyncedEntries = await getUnsyncedEntries();

  if (unsyncedEntries.length === 0) {
    return { success: true, count: 0 };
  }

  // Prepare entries for the Apps Script
  const payload = {
    entries: unsyncedEntries.map((entry: LookupEntry) => ({
      code: entry.code,
      name: entry.name || '',
      description: entry.description || '',
      seenCount: entry.seenCount || 0,
      experience: entry.experience || 'neutral',
      lastSeen: entry.lastSeen ? new Date(entry.lastSeen).toISOString() : '',
    })),
  };

  try {
    // With no-cors mode, we can't read the response
    // We assume success if no network error occurred
    await fetch(writeUrl, {
      method: 'POST',
      mode: 'no-cors', // Apps Script requires this
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Mark entries as synced
    await markAsSynced(unsyncedEntries.map((e: LookupEntry) => e.code));

    // Update last write sync time in settings
    const settings = await getSettings();
    if (settings) {
      await saveSettings({
        ...settings,
        lastWriteSyncTime: new Date(),
      });
    }

    return { success: true, count: unsyncedEntries.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    return { success: false, count: 0, error: message };
  }
}

// Apps Script code that users need to paste into their Google Sheet
export const APPS_SCRIPT_CODE = `
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);

  // Find or create headers
  let headers = sheet.getRange(1, 1, 1, 6).getValues()[0];
  if (!headers[0]) {
    headers = ['code', 'name', 'description', 'seenCount', 'experience', 'lastSeen'];
    sheet.getRange(1, 1, 1, 6).setValues([headers]);
  }

  // Process each entry
  data.entries.forEach(entry => {
    const rows = sheet.getDataRange().getValues();
    const rowIndex = rows.findIndex(row => row[0] === entry.code);

    const rowData = [
      entry.code,
      entry.name || '',
      entry.description || '',
      entry.seenCount || 0,
      entry.experience || 'neutral',
      entry.lastSeen || ''
    ];

    if (rowIndex > 0) {
      // Update existing row
      sheet.getRange(rowIndex + 1, 1, 1, 6).setValues([rowData]);
    } else {
      // Append new row
      sheet.appendRow(rowData);
    }
  });

  return ContentService.createTextOutput(JSON.stringify({ success: true }));
}
`.trim();
