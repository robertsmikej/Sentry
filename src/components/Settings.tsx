import { useState, useEffect, useRef, useCallback } from 'react';
import { useLookup } from '../hooks/useLookup';
import { getSettings, saveSettings } from '../services/storage';
import { APPS_SCRIPT_CODE } from '../services/writeSync';
import {
  getOCRSettings,
  saveOCRSettings,
  DEFAULT_OCR_SETTINGS,
  PSM_DESCRIPTIONS,
} from '../services/ocr';
import type { OCRSettings, PSMMode } from '../types';

export function Settings() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [writeUrl, setWriteUrl] = useState('');
  const [showScript, setShowScript] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const initialLoadDone = useRef(false);

  // OCR Settings
  const [ocrSettings, setOcrSettings] = useState<OCRSettings>(DEFAULT_OCR_SETTINGS);
  const [ocrSaveStatus, setOcrSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const ocrInitialLoadDone = useRef(false);

  const {
    entries,
    lastSync,
    lastWriteSync,
    isSyncing,
    isWriteSyncing,
    syncError,
    writeSyncError,
    pendingSyncCount,
    sync,
    writeSync,
  } = useLookup();

  // Load settings on mount
  useEffect(() => {
    getSettings().then((settings) => {
      if (settings?.sheetUrl) {
        setSheetUrl(settings.sheetUrl);
      }
      if (settings?.writeUrl) {
        setWriteUrl(settings.writeUrl);
      }
      // Mark initial load as complete after a small delay
      setTimeout(() => {
        initialLoadDone.current = true;
      }, 100);
    });

    // Load OCR settings
    const storedOcrSettings = getOCRSettings();
    setOcrSettings(storedOcrSettings);
    setTimeout(() => {
      ocrInitialLoadDone.current = true;
    }, 100);
  }, []);

  // Auto-save URLs when they change (with debounce)
  const saveUrls = useCallback(async (newSheetUrl: string, newWriteUrl: string) => {
    if (!initialLoadDone.current) return;

    setSaveStatus('saving');
    const currentSettings = await getSettings();
    await saveSettings({
      sheetUrl: newSheetUrl,
      writeUrl: newWriteUrl,
      lastSyncTime: currentSettings?.lastSyncTime,
      lastWriteSyncTime: currentSettings?.lastWriteSyncTime,
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 1500);
  }, []);

  // Debounced auto-save effect
  useEffect(() => {
    if (!initialLoadDone.current) return;

    const timeoutId = setTimeout(() => {
      saveUrls(sheetUrl, writeUrl);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [sheetUrl, writeUrl, saveUrls]);

  // Auto-save OCR settings when they change
  useEffect(() => {
    if (!ocrInitialLoadDone.current) return;

    setOcrSaveStatus('saving');
    const timeoutId = setTimeout(() => {
      saveOCRSettings(ocrSettings);
      setOcrSaveStatus('saved');
      setTimeout(() => setOcrSaveStatus(null), 1500);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [ocrSettings]);

  const updateOcrSetting = <K extends keyof OCRSettings>(key: K, value: OCRSettings[K]) => {
    setOcrSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetOcrSettings = () => {
    setOcrSettings(DEFAULT_OCR_SETTINGS);
  };

  const handleSync = async () => {
    if (!sheetUrl) return;
    try {
      await sync(sheetUrl);
    } catch {
      // Error is handled by useLookup
    }
  };

  const handleWriteSync = async () => {
    if (!writeUrl) return;
    await writeSync(writeUrl);
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = APPS_SCRIPT_CODE;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Settings</h2>
        {saveStatus && (
          <span className="text-xs text-base-content/60 flex items-center gap-1">
            {saveStatus === 'saving' ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                Saving...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 text-success">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Saved
              </>
            )}
          </span>
        )}
      </div>

      {/* Read Sync Card */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-base">Read from Google Sheets</h3>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Google Sheets CSV URL</span>
            </label>
            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>

          {syncError && (
            <div className="alert alert-error alert-sm">
              <span>{syncError}</span>
            </div>
          )}

          <div className="flex justify-between items-center mt-2">
            <div className="text-sm text-base-content/60">
              <p>Entries: {entries.length}</p>
              <p>Last read: {formatDate(lastSync)}</p>
            </div>
            <button
              onClick={handleSync}
              disabled={!sheetUrl || isSyncing}
              className="btn btn-primary btn-sm"
            >
              {isSyncing ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Reading...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Sync from Sheet
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Write Sync Card */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-base">
            Write to Google Sheets
            {pendingSyncCount > 0 && (
              <span className="badge badge-warning badge-sm">{pendingSyncCount} pending</span>
            )}
          </h3>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Apps Script Web App URL</span>
            </label>
            <input
              type="url"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={writeUrl}
              onChange={(e) => setWriteUrl(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>

          {writeSyncError && (
            <div className="alert alert-error alert-sm">
              <span>{writeSyncError}</span>
            </div>
          )}

          <div className="flex justify-between items-center mt-2">
            <div className="text-sm text-base-content/60">
              <p>Pending: {pendingSyncCount} plate{pendingSyncCount !== 1 ? 's' : ''}</p>
              <p>Last write: {formatDate(lastWriteSync)}</p>
            </div>
            <button
              onClick={handleWriteSync}
              disabled={!writeUrl || isWriteSyncing || pendingSyncCount === 0}
              className="btn btn-secondary btn-sm"
            >
              {isWriteSyncing ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Writing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  Sync to Sheet ({pendingSyncCount})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* OCR Settings Card */}
      <div className="card bg-base-200">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h3 className="card-title text-base">OCR Settings</h3>
            <div className="flex items-center gap-2">
              {ocrSaveStatus && (
                <span className="text-xs text-base-content/60 flex items-center gap-1">
                  {ocrSaveStatus === 'saving' ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 text-success">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Saved
                    </>
                  )}
                </span>
              )}
              <button
                onClick={resetOcrSettings}
                className="btn btn-xs btn-ghost"
              >
                Reset to Default
              </button>
            </div>
          </div>

          <p className="text-sm text-base-content/60 mb-2">
            Experiment with these settings to improve OCR accuracy for your use case.
          </p>

          {/* PSM Mode */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Page Segmentation Mode (PSM)</span>
            </label>
            <select
              value={ocrSettings.psm}
              onChange={(e) => updateOcrSetting('psm', e.target.value as PSMMode)}
              className="select select-bordered w-full"
            >
              {Object.entries(PSM_DESCRIPTIONS).map(([value, description]) => (
                <option key={value} value={value}>
                  PSM {value}: {description}
                </option>
              ))}
            </select>
            <label className="label">
              <span className="label-text-alt text-base-content/50">
                PSM 7 (single line) or PSM 8 (single word) often work best for plates
              </span>
            </label>
          </div>

          {/* Character Whitelist */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Character Whitelist</span>
            </label>
            <input
              type="text"
              placeholder="Leave empty for all characters, or e.g. ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
              value={ocrSettings.charWhitelist}
              onChange={(e) => updateOcrSetting('charWhitelist', e.target.value)}
              className="input input-bordered w-full font-mono text-sm"
            />
            <label className="label">
              <span className="label-text-alt text-base-content/50">
                Restrict to specific characters. Empty = all characters allowed.
              </span>
            </label>
          </div>

          {/* Quick Whitelist Buttons */}
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              onClick={() => updateOcrSetting('charWhitelist', '')}
              className={`btn btn-xs ${ocrSettings.charWhitelist === '' ? 'btn-primary' : 'btn-outline'}`}
            >
              All Characters
            </button>
            <button
              onClick={() => updateOcrSetting('charWhitelist', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')}
              className={`btn btn-xs ${ocrSettings.charWhitelist === 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' ? 'btn-primary' : 'btn-outline'}`}
            >
              Letters + Numbers
            </button>
            <button
              onClick={() => updateOcrSetting('charWhitelist', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ')}
              className={`btn btn-xs ${ocrSettings.charWhitelist === 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ' ? 'btn-primary' : 'btn-outline'}`}
            >
              Letters + Numbers + Space
            </button>
          </div>

          {/* Preprocess Toggle */}
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                checked={ocrSettings.preprocessImage}
                onChange={(e) => updateOcrSetting('preprocessImage', e.target.checked)}
                className="checkbox checkbox-primary"
              />
              <div>
                <span className="label-text">Preprocess Image</span>
                <p className="text-xs text-base-content/50">
                  Convert to grayscale and increase contrast before OCR
                </p>
              </div>
            </label>
          </div>

          {/* Current Settings Display */}
          <div className="mt-4 p-3 bg-base-300 rounded-lg">
            <p className="text-xs font-mono text-base-content/70">
              <strong>Current Config:</strong><br />
              PSM: {ocrSettings.psm} |
              Whitelist: {ocrSettings.charWhitelist || '(none)'} |
              Preprocess: {ocrSettings.preprocessImage ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-base">Setup Instructions</h3>
          <p className="text-sm text-base-content/60 mb-2">
            Follow these steps to connect your Google Sheet. You can set up read-only access first, then add write access later if needed.
          </p>

          <div className="collapse collapse-arrow bg-base-100">
            <input type="checkbox" />
            <div className="collapse-title font-medium">
              Step 1: Create Your Google Sheet
            </div>
            <div className="collapse-content">
              <ol className="list-decimal list-inside space-y-3 text-sm">
                <li>
                  Go to <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" className="link link-primary">sheets.google.com</a> and create a new spreadsheet
                </li>
                <li>
                  In the first row, add these column headers (exactly as shown):
                  <div className="mt-2 flex flex-wrap gap-1">
                    <code className="bg-base-300 px-2 py-1 rounded">code</code>
                    <code className="bg-base-300 px-2 py-1 rounded">name</code>
                    <code className="bg-base-300 px-2 py-1 rounded">description</code>
                    <code className="bg-base-300 px-2 py-1 rounded">seenCount</code>
                    <code className="bg-base-300 px-2 py-1 rounded">experience</code>
                    <code className="bg-base-300 px-2 py-1 rounded">lastSeen</code>
                  </div>
                </li>
                <li>
                  Add your plate data starting from row 2:
                  <ul className="list-disc list-inside ml-4 mt-1 text-base-content/70">
                    <li><strong>code</strong> - The plate number (e.g., ABC123)</li>
                    <li><strong>name</strong> - A nickname or owner name</li>
                    <li><strong>description</strong> - Any notes about this plate</li>
                    <li><strong>seenCount</strong> - How many times seen (starts at 0)</li>
                    <li><strong>experience</strong> - good, bad, or neutral</li>
                    <li><strong>lastSeen</strong> - Leave empty (auto-filled by app)</li>
                  </ul>
                </li>
              </ol>
            </div>
          </div>

          <div className="collapse collapse-arrow bg-base-100">
            <input type="checkbox" />
            <div className="collapse-title font-medium">
              Step 2: Enable Reading (Download from Sheet)
            </div>
            <div className="collapse-content">
              <p className="text-sm text-base-content/70 mb-3">
                This allows the app to download your plate list for offline use.
              </p>
              <ol className="list-decimal list-inside space-y-3 text-sm">
                <li>Open your Google Sheet</li>
                <li>Click <strong>File</strong> in the menu bar</li>
                <li>Click <strong>Share</strong>, then <strong>Publish to web</strong></li>
                <li>
                  In the dropdown, make sure <strong>Entire Document</strong> is selected
                </li>
                <li>
                  Change the format from "Web page" to <strong>Comma-separated values (.csv)</strong>
                </li>
                <li>Click the green <strong>Publish</strong> button</li>
                <li>A URL will appear - <strong>copy this entire URL</strong></li>
                <li>Paste the URL in the "Google Sheets CSV URL" field above</li>
                <li>Click <strong>Sync from Sheet</strong> to test it</li>
              </ol>
              <div className="alert alert-info mt-3 text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>The URL should look like: https://docs.google.com/spreadsheets/d/abc.../pub?output=csv</span>
              </div>
            </div>
          </div>

          <div className="collapse collapse-arrow bg-base-100">
            <input type="checkbox" />
            <div className="collapse-title font-medium">
              Step 3: Enable Writing (Upload Changes to Sheet)
            </div>
            <div className="collapse-content">
              <p className="text-sm text-base-content/70 mb-3">
                This allows the app to save your changes (new plates, seen counts, ratings) back to Google Sheets. This step is optional but recommended.
              </p>
              <ol className="list-decimal list-inside space-y-3 text-sm">
                <li>Open your Google Sheet</li>
                <li>Click <strong>Extensions</strong> in the menu bar</li>
                <li>Click <strong>Apps Script</strong> (this opens a new tab)</li>
                <li>
                  Delete any code you see in the editor (select all and delete)
                </li>
                <li>
                  Copy the script below and paste it into the empty editor
                  <div className="mt-2">
                    <button
                      onClick={() => setShowScript(!showScript)}
                      className="btn btn-sm btn-outline"
                    >
                      {showScript ? 'Hide Script' : 'Show Script to Copy'}
                    </button>

                    {showScript && (
                      <div className="mt-2">
                        <div className="flex justify-end mb-1">
                          <button
                            onClick={handleCopyScript}
                            className="btn btn-xs btn-primary"
                          >
                            {copySuccess ? 'Copied!' : 'Copy Script'}
                          </button>
                        </div>
                        <pre className="bg-base-300 p-3 rounded-lg text-xs overflow-x-auto max-h-48">
                          {APPS_SCRIPT_CODE}
                        </pre>
                      </div>
                    )}
                  </div>
                </li>
                <li>Click the <strong>Save</strong> icon (or Ctrl+S / Cmd+S)</li>
                <li>Click the blue <strong>Deploy</strong> button in the top right</li>
                <li>Select <strong>New deployment</strong></li>
                <li>
                  Click the gear icon next to "Select type" and choose <strong>Web app</strong>
                </li>
                <li>
                  Under "Who has access", select <strong>Anyone</strong>
                </li>
                <li>Click <strong>Deploy</strong></li>
                <li>
                  Click <strong>Authorize access</strong> and sign in with your Google account
                  <ul className="list-disc list-inside ml-4 mt-1 text-base-content/70">
                    <li>If you see "Google hasn't verified this app", click <strong>Advanced</strong></li>
                    <li>Then click <strong>Go to Untitled project (unsafe)</strong></li>
                    <li>Click <strong>Allow</strong> to grant permission</li>
                  </ul>
                </li>
                <li><strong>Copy the Web App URL</strong> that appears</li>
                <li>Paste it in the "Apps Script Web App URL" field above</li>
              </ol>
              <div className="alert alert-info mt-3 text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>The URL should look like: https://script.google.com/macros/s/abc.../exec</span>
              </div>
            </div>
          </div>

          <div className="collapse collapse-arrow bg-base-100">
            <input type="checkbox" />
            <div className="collapse-title font-medium">
              How Syncing Works
            </div>
            <div className="collapse-content">
              <div className="space-y-3 text-sm">
                <div>
                  <strong className="text-primary">Reading (Download)</strong>
                  <p className="text-base-content/70">
                    Downloads your entire plate list from Google Sheets to your device. Do this before going offline to have your data available.
                  </p>
                </div>
                <div>
                  <strong className="text-secondary">Writing (Upload)</strong>
                  <p className="text-base-content/70">
                    Uploads any changes you've made (new plates, edits, seen counts, experience ratings) back to Google Sheets.
                  </p>
                </div>
                <div>
                  <strong className="text-accent">Auto-Sync</strong>
                  <p className="text-base-content/70">
                    When you're online and have pending changes, the app automatically syncs to Google Sheets every 5 minutes. You'll see a notification when this happens.
                  </p>
                </div>
                <div>
                  <strong>Offline Mode</strong>
                  <p className="text-base-content/70">
                    All your data is stored on your device. You can scan plates, add new ones, and record experiences even without internet. Changes will sync when you're back online.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-base">About Plate Reader</h3>
          <div className="text-sm text-base-content/70 space-y-2">
            <p>
              <strong>Plate Reader</strong> helps you quickly identify and track license plates using your phone's camera or photo library.
            </p>
            <p><strong>Features:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Scan plates using camera or upload photos</li>
              <li>Automatic text recognition (OCR)</li>
              <li>Track how many times you've seen each plate</li>
              <li>Rate experiences as good, bad, or neutral</li>
              <li>Works completely offline (airplane mode friendly)</li>
              <li>Sync with Google Sheets for easy data management</li>
              <li>Auto-sync changes when back online</li>
              <li>Add to home screen for app-like experience</li>
            </ul>
            <p className="pt-2 text-base-content/50">
              Tip: Add this app to your home screen for the best experience. On iOS, tap the Share button and select "Add to Home Screen". On Android, tap the menu and select "Add to Home Screen" or "Install App".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
