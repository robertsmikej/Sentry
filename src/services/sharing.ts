import QRCode from 'qrcode';

export interface ShareableConfig {
  sheetUrl: string;
  writeUrl?: string;
  name?: string;
}

/**
 * Encode a shareable config to base64
 */
export function encodeConfig(config: ShareableConfig): string {
  const json = JSON.stringify(config);
  // Use btoa for base64 encoding (works in browser)
  return btoa(json);
}

/**
 * Decode a base64 config string back to ShareableConfig
 */
export function decodeConfig(encoded: string): ShareableConfig | null {
  try {
    const json = atob(encoded);
    const parsed = JSON.parse(json);

    // Validate required fields
    if (!parsed.sheetUrl || typeof parsed.sheetUrl !== 'string') {
      return null;
    }

    return {
      sheetUrl: parsed.sheetUrl,
      writeUrl: parsed.writeUrl || undefined,
      name: parsed.name || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a shareable URL with the config encoded in the hash
 */
export function generateShareUrl(config: ShareableConfig): string {
  const encoded = encodeConfig(config);
  // Use current origin for the base URL
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#join=${encoded}`;
}

/**
 * Parse a share URL and extract the config
 */
export function parseShareUrl(url: string): ShareableConfig | null {
  try {
    const hashIndex = url.indexOf('#join=');
    if (hashIndex === -1) {
      return null;
    }

    const encoded = url.substring(hashIndex + 6); // Skip '#join='
    return decodeConfig(encoded);
  } catch {
    return null;
  }
}

/**
 * Check if the current URL contains a join hash
 */
export function getJoinConfigFromUrl(): ShareableConfig | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#join=')) {
    return null;
  }

  const encoded = hash.substring(6); // Skip '#join='
  return decodeConfig(encoded);
}

/**
 * Clear the join hash from the URL without triggering navigation
 */
export function clearJoinHash(): void {
  // Replace current URL without the hash
  const url = window.location.pathname + window.location.search;
  window.history.replaceState(null, '', url);
}

/**
 * Generate a QR code as a data URL
 */
export async function generateQRCode(url: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return dataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw error;
  }
}

/**
 * Check if Web Share API is available
 */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

/**
 * Share a URL using the native share sheet
 */
export async function shareUrl(url: string, title?: string): Promise<boolean> {
  if (!canShare()) {
    return false;
  }

  try {
    await navigator.share({
      title: title || 'Join my watchlist',
      text: 'Scan the QR code or click the link to join my plate watchlist',
      url,
    });
    return true;
  } catch (error) {
    // User cancelled or share failed
    console.log('Share cancelled or failed:', error);
    return false;
  }
}
