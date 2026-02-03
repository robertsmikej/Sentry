import { getUnsyncedEncounters, markEncountersAsSynced, getSettings, saveSettings } from './storage';
import type { Encounter } from '../types';

export interface EncounterSyncResult {
  success: boolean;
  count: number;
  error?: string;
}

export async function syncEncountersToSheet(writeUrl: string): Promise<EncounterSyncResult> {
  const unsyncedEncounters = await getUnsyncedEncounters();

  console.log('[EncounterSync] Starting sync check...');
  console.log('[EncounterSync] Unsynced encounters found:', unsyncedEncounters.length);

  if (unsyncedEncounters.length === 0) {
    console.log('[EncounterSync] No encounters to sync, skipping.');
    return { success: true, count: 0 };
  }

  // Prepare encounters for the Apps Script
  const payload = {
    encounters: unsyncedEncounters.map((encounter: Encounter) => ({
      id: encounter.id,
      plateCode: encounter.plateCode,
      timestamp: new Date(encounter.timestamp).toISOString(),
      // Location data
      latitude: encounter.location?.latitude ?? '',
      longitude: encounter.location?.longitude ?? '',
      accuracy: encounter.location?.accuracy ?? '',
      locationLabel: encounter.locationLabel || '',
      // User metadata
      notes: encounter.notes || '',
      tags: encounter.tags?.join(', ') || '', // Comma-separated for Google Sheets
      experience: encounter.experience || 'neutral',
      // Link to scan
      scanId: encounter.scanId || '',
    })),
  };

  console.log('[EncounterSync] Sending to Google Sheets:');
  console.log('[EncounterSync] URL:', writeUrl);
  console.log('[EncounterSync] Payload:', JSON.stringify(payload, null, 2));

  try {
    // With no-cors mode, we can't read the response body
    // We assume success if no network error occurred
    const response = await fetch(writeUrl, {
      method: 'POST',
      mode: 'no-cors', // Apps Script requires this
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Log what we can from the opaque response
    console.log('[EncounterSync] Response received:');
    console.log('[EncounterSync] - Type:', response.type);
    console.log('[EncounterSync] - Status:', response.status);
    console.log('[EncounterSync] Note: With no-cors mode, response body is opaque and cannot be read.');

    // Mark encounters as synced
    const ids = unsyncedEncounters.map((e: Encounter) => e.id);
    console.log('[EncounterSync] Marking encounters as synced:', ids.length);
    await markEncountersAsSynced(ids);

    // Update last encounter sync time in settings
    const settings = await getSettings();
    if (settings) {
      await saveSettings({
        ...settings,
        lastEncounterSyncTime: new Date(),
      });
    }

    console.log('[EncounterSync] Sync completed successfully for', unsyncedEncounters.length, 'encounters');
    return { success: true, count: unsyncedEncounters.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Encounter sync failed';
    console.error('[EncounterSync] Sync FAILED:', message);
    console.error('[EncounterSync] Error details:', err);
    return { success: false, count: 0, error: message };
  }
}

// Apps Script code that users need to add to their Google Sheet for encounter syncing
// This should be added as a SEPARATE function in the same Apps Script project
export const ENCOUNTER_APPS_SCRIPT_CODE = `
// ============================================
// ENCOUNTER SYNC - Add this to your Apps Script
// ============================================
// This handles POST requests for encounter data.
// It writes to a sheet named "Encounters" (creates it if needed).

function doPost(e) {
  const data = JSON.parse(e.postData.contents);

  // Check if this is an encounter sync or plate sync
  if (data.encounters) {
    return handleEncounterSync(data);
  }

  // Otherwise handle as plate sync (existing logic)
  return handlePlateSync(data);
}

function ensureEncountersSheet(ss) {
  let sheet = ss.getSheetByName('Encounters');
  if (!sheet) {
    sheet = ss.insertSheet('Encounters');
    const headers = [
      'ID', 'Plate Code', 'Timestamp', 'Date', 'Time',
      'Latitude', 'Longitude', 'Accuracy (m)', 'Location Label',
      'Notes', 'Tags', 'Experience', 'Scan ID'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  const headerRow = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  if (headerRow.indexOf('Experience') === -1) {
    headerRow.push('Experience');
    sheet.getRange(1, headerRow.length).setValue('Experience');
  }
  return sheet;
}

function handleEncounterSync(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureEncountersSheet(ss);

  // Process each encounter
  data.encounters.forEach(enc => {
    // Check if encounter already exists (by ID)
    const existingData = sheet.getDataRange().getValues();
    const rowIndex = existingData.findIndex(row => row[0] === enc.id);

    // Parse timestamp for separate date/time columns
    const timestamp = new Date(enc.timestamp);
    const dateStr = timestamp.toLocaleDateString();
    const timeStr = timestamp.toLocaleTimeString();

    const rowData = [
      enc.id,
      enc.plateCode,
      enc.timestamp,
      dateStr,
      timeStr,
      enc.latitude,
      enc.longitude,
      enc.accuracy,
      enc.locationLabel,
      enc.notes,
      enc.tags,
      enc.experience,
      enc.scanId
    ];

    if (rowIndex > 0) {
      // Update existing row
      sheet.getRange(rowIndex + 1, 1, 1, rowData.length).setValues([rowData]);
    } else {
      // Append new row
      sheet.appendRow(rowData);
    }
  });

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    count: data.encounters.length
  }));
}

function ensurePlatesHeaders(sheet) {
  let lastCol = sheet.getLastColumn();
  if (lastCol < 6) lastCol = 6;
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (!headers[0]) {
    headers = ['code', 'name', 'description', 'seenCount', 'experience', 'lastSeen'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const required = ['goodEncounters', 'badEncounters', 'neutralEncounters'];
  required.forEach((h) => {
    if (headers.indexOf(h) === -1) {
      headers.push(h);
      sheet.getRange(1, headers.length).setValue(h);
    }
  });

  return headers;
}

function setEncounterCountFormulas(sheet, rowIndex, headers) {
  const goodCol = headers.indexOf('goodEncounters') + 1;
  const badCol = headers.indexOf('badEncounters') + 1;
  const neutralCol = headers.indexOf('neutralEncounters') + 1;
  if (goodCol < 1 || badCol < 1 || neutralCol < 1) return;

  const plateCell = 'A' + rowIndex;
  sheet.getRange(rowIndex, goodCol).setFormula('=COUNTIFS(Encounters!$B:$B, ' + plateCell + ', INDEX(Encounters!$A:$Z, 0, MATCH(\"Experience\", Encounters!$1:$1, 0)), \"good\")');
  sheet.getRange(rowIndex, badCol).setFormula('=COUNTIFS(Encounters!$B:$B, ' + plateCell + ', INDEX(Encounters!$A:$Z, 0, MATCH(\"Experience\", Encounters!$1:$1, 0)), \"bad\")');
  sheet.getRange(rowIndex, neutralCol).setFormula('=COUNTIFS(Encounters!$B:$B, ' + plateCell + ', INDEX(Encounters!$A:$Z, 0, MATCH(\"Experience\", Encounters!$1:$1, 0)), \"neutral\") + COUNTIFS(Encounters!$B:$B, ' + plateCell + ', INDEX(Encounters!$A:$Z, 0, MATCH(\"Experience\", Encounters!$1:$1, 0)), \"\")');
}

function handlePlateSync(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureEncountersSheet(ss);

  // Get or create "Plates" sheet (rename Sheet1 if needed)
  let sheet = ss.getSheetByName('Plates');
  if (!sheet) {
    // Check if Sheet1 exists and rename it
    const sheet1 = ss.getSheetByName('Sheet1');
    if (sheet1) {
      sheet1.setName('Plates');
      sheet = sheet1;
    } else {
      // Use the active sheet and rename if it's the default name
      sheet = ss.getActiveSheet();
      if (sheet.getName() === 'Sheet1') {
        sheet.setName('Plates');
      }
    }
  }

  const headers = ensurePlatesHeaders(sheet);

  // Process each entry
  data.entries.forEach(entry => {
    const rows = sheet.getDataRange().getValues();
    const rowIndex = rows.findIndex(row => row[0] === entry.code);

    let targetRow;
    if (rowIndex > 0) {
      const currentSeenCount = parseInt(rows[rowIndex][3], 10) || 0;
      const newSeenCount = entry.incrementSeen ? currentSeenCount + 1 : currentSeenCount;
      const rowData = [
        entry.code,
        entry.name || '',
        entry.description || '',
        newSeenCount,
        entry.experience || 'neutral',
        entry.lastSeen || ''
      ];
      targetRow = rowIndex + 1;
      sheet.getRange(targetRow, 1, 1, 6).setValues([rowData]);
    } else {
      const rowData = [
        entry.code,
        entry.name || '',
        entry.description || '',
        entry.incrementSeen ? 1 : (entry.seenCount || 0),
        entry.experience || 'neutral',
        entry.lastSeen || ''
      ];
      sheet.appendRow(rowData);
      targetRow = sheet.getLastRow();
    }

    setEncounterCountFormulas(sheet, targetRow, headers);
  });

  return ContentService.createTextOutput(JSON.stringify({ success: true }));
}
`.trim();
