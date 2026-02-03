import { useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';

const OFFLINE_PREP_KEY = 'plate-reader-offline-prepped';

/**
 * Auto-downloads and caches Tesseract.js OCR files on first app load.
 * This ensures the app can work offline after the initial visit.
 */
export function useOfflinePrep() {
  const hasAttempted = useRef(false);

  useEffect(() => {
    // Only attempt once per session
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    // Check if we've already prepped
    const alreadyPrepped = localStorage.getItem(OFFLINE_PREP_KEY);
    if (alreadyPrepped) {
      console.log('[OfflinePrep] Tesseract files already cached');
      return;
    }

    // Only prep if online
    if (!navigator.onLine) {
      console.log('[OfflinePrep] Offline, skipping Tesseract cache prep');
      return;
    }

    // Run in background after a short delay to not block initial render
    const timeoutId = setTimeout(async () => {
      try {
        console.log('[OfflinePrep] Downloading Tesseract.js files for offline use...');

        // Create a small dummy canvas with text
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 30;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, 100, 30);
          ctx.fillStyle = 'black';
          ctx.font = '16px Arial';
          ctx.fillText('TEST', 10, 20);
        }

        // Run OCR to trigger download of WASM and language files
        const worker = await Tesseract.createWorker('eng', undefined, {
          logger: (m) => {
            if (m.status === 'loading tesseract core') {
              console.log('[OfflinePrep] Loading Tesseract core...', Math.round(m.progress * 100) + '%');
            } else if (m.status === 'loading language traineddata') {
              console.log('[OfflinePrep] Loading language data...', Math.round(m.progress * 100) + '%');
            }
          }
        });

        await worker.recognize(canvas);
        await worker.terminate();

        // Mark as prepped
        localStorage.setItem(OFFLINE_PREP_KEY, new Date().toISOString());
        console.log('[OfflinePrep] Tesseract files cached successfully - app ready for offline use');
      } catch (err) {
        console.error('[OfflinePrep] Failed to cache Tesseract files:', err);
        // Don't set the flag so we try again next time
      }
    }, 2000); // Wait 2 seconds after mount to not interfere with initial load

    return () => clearTimeout(timeoutId);
  }, []);
}
