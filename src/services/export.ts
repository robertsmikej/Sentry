import type { ScanEntry } from '../types';

export function exportHistoryToCSV(history: ScanEntry[]): void {
  const headers = ['Timestamp', 'Extracted Text', 'Normalized', 'Matched', 'Match Code', 'Match Name', 'Match Description'];

  const rows = history.map((entry) => [
    new Date(entry.timestamp).toISOString(),
    escapeCSV(entry.extractedText),
    entry.normalizedText,
    entry.matched ? 'Yes' : 'No',
    entry.matchedEntry?.code || '',
    escapeCSV(entry.matchedEntry?.name || ''),
    escapeCSV(entry.matchedEntry?.description || ''),
  ]);

  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `sentry-history-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
