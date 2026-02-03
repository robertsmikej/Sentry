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
  pendingSeenIncrement?: boolean; // true if seenCount should be incremented in Google Sheets
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
  showEditFields?: boolean; // Show name/description/experience fields on scan result (default: false)
  // Location settings
  locationEnabled?: boolean; // Master toggle for location capture (opt-in, default: false)
  locationPrecision?: 'exact' | 'neighborhood' | 'city'; // Precision level for stored coordinates
  // Encounter sync settings
  encounterWriteUrl?: string; // Apps Script URL for encounter sync
  lastEncounterSyncTime?: Date;
}

// ============== ENCOUNTER TRACKING ==============

// GPS location data
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number; // meters
  altitude?: number; // meters
  timestamp: Date;
}

// Encounter represents a single sighting/interaction with a plate
export interface Encounter {
  id: string; // UUID
  plateCode: string; // Links to LookupEntry.code
  timestamp: Date;
  experience?: Experience;

  // Location (optional, requires user opt-in)
  location?: GeoLocation;
  locationLabel?: string; // User-defined label: "Work parking lot", "Near school"

  // User metadata
  notes?: string;
  tags?: string[]; // User-defined tags

  // Link to scan (if encounter was from camera scan)
  scanId?: string; // Links to ScanEntry.id

  // Sync status
  needsSync?: boolean;
  syncedAt?: Date;
}

// Default tag suggestions for encounters
export const DEFAULT_ENCOUNTER_TAGS = [
  'morning',
  'afternoon',
  'evening',
  'night',
  'weekday',
  'weekend',
  'parking-lot',
  'street',
  'highway',
  'residential',
  'commercial',
  'suspicious',
  'friendly',
] as const;

export type EncounterTag = (typeof DEFAULT_ENCOUNTER_TAGS)[number] | string;

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

// Recognition method - OCR (local Tesseract) or AI (Gemini)
export type RecognitionMethod = 'ocr' | 'gemini';

export interface RecognitionSettings {
  method: RecognitionMethod;
  geminiApiKey: string; // User's own Gemini API key
  geminiMaxImageSize: number; // Max dimension (width/height) for images sent to Gemini
  geminiAutoScan: boolean; // Auto-scan when image captured, or show preview first
}
