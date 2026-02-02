export type Experience = 'good' | 'bad' | 'neutral';

export interface LookupEntry {
  code: string;
  name: string;
  description: string;
  category?: string;
  // User-added fields
  seenCount?: number;
  experience?: Experience;
  lastSeen?: Date;
  isLocal?: boolean; // true if added/edited by user locally
  needsSync?: boolean; // true if has unsynced local changes
}

export interface ScanEntry {
  id: string;
  timestamp: Date;
  extractedText: string;
  normalizedText: string;
  matched: boolean;
  matchedEntry?: LookupEntry;
  imageDataUrl?: string;
}

export interface UserSettings {
  sheetUrl: string;
  writeUrl?: string; // Apps Script web app URL for write-back
  lastSyncTime?: Date;
  lastWriteSyncTime?: Date;
}

// Tesseract Page Segmentation Modes
export type PSMMode =
  | '0'   // Orientation and script detection only
  | '1'   // Automatic page segmentation with OSD
  | '3'   // Fully automatic page segmentation, but no OSD (default)
  | '4'   // Assume a single column of text of variable sizes
  | '6'   // Assume a single uniform block of text
  | '7'   // Treat the image as a single text line
  | '8'   // Treat the image as a single word
  | '9'   // Treat the image as a single word in a circle
  | '10'  // Treat the image as a single character
  | '11'  // Sparse text - find as much text as possible
  | '12'  // Sparse text with OSD
  | '13'; // Raw line - treat as a single text line, no hacks

export interface OCRSettings {
  psm: PSMMode;
  charWhitelist: string;
  preprocessImage: boolean;
  contrastLevel: number; // 1.0 = normal, >1 = higher contrast
}
