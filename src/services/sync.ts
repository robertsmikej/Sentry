import type { LookupEntry } from '../types';
import { setLookupEntries, saveSettings, getSettings } from './storage';

export function parseCSV(csv: string): LookupEntry[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const codeIndex = headers.findIndex((h) => h === 'code' || h === 'id' || h === 'plate');
  const nameIndex = headers.findIndex((h) => h === 'name' || h === 'title');
  const descIndex = headers.findIndex((h) => h === 'description' || h === 'desc' || h === 'info');
  const catIndex = headers.findIndex((h) => h === 'category' || h === 'cat' || h === 'type');

  if (codeIndex === -1) {
    throw new Error('CSV must have a "code" column');
  }

  const entries: LookupEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length > codeIndex && values[codeIndex].trim()) {
      entries.push({
        code: normalizeCode(values[codeIndex]),
        name: nameIndex >= 0 ? values[nameIndex]?.trim() || '' : '',
        description: descIndex >= 0 ? values[descIndex]?.trim() || '' : '',
        category: catIndex >= 0 ? values[catIndex]?.trim() : undefined,
      });
    }
  }

  return entries;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

export async function syncFromSheet(sheetUrl: string): Promise<{ count: number }> {
  const response = await fetch(sheetUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.status}`);
  }

  const csv = await response.text();
  const entries = parseCSV(csv);

  await setLookupEntries(entries);
  const currentSettings = await getSettings();
  await saveSettings({
    ...currentSettings,
    sheetUrl,
    lastSyncTime: new Date(),
  });

  return { count: entries.length };
}

export async function getLastSyncTime(): Promise<Date | undefined> {
  const settings = await getSettings();
  return settings?.lastSyncTime;
}
