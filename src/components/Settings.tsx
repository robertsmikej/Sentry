import { useState, useEffect, useRef, useCallback } from 'react';
import { useLookup } from '../hooks/useLookup';
import {
  getSettings,
  saveSettings,
  exportPlatesToCSV,
  exportEncountersToCSV,
  downloadCSV,
} from '../services/storage';
import { APPS_SCRIPT_CODE } from '../services/writeSync';
import { ShareModal } from './ShareModal';
import {
  getOCRSettings,
  saveOCRSettings,
  DEFAULT_OCR_SETTINGS,
  PSM_DESCRIPTIONS,
  getRecognitionSettings,
  saveRecognitionSettings,
  DEFAULT_RECOGNITION_SETTINGS,
} from '../services/ocr';
import { validateGeminiApiKey } from '../services/gemini';
import type { OCRSettings, PSMMode, RecognitionSettings, RecognitionMethod } from '../types';
import { APP_NAME, APP_DESCRIPTION, DEFAULT_SHEET_URL, DEFAULT_WRITE_URL } from '../constants/app';

export function Settings() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [writeUrl, setWriteUrl] = useState('');
  const [showEditFields, setShowEditFields] = useState(true);
  const [showScript, setShowScript] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [writeToast, setWriteToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const initialLoadDone = useRef(false);
  const writeToastTimerRef = useRef<number | null>(null);

  // OCR Settings
  const [ocrSettings, setOcrSettings] = useState<OCRSettings>(DEFAULT_OCR_SETTINGS);
  const [ocrSaveStatus, setOcrSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const ocrInitialLoadDone = useRef(false);

  // Recognition Settings (OCR vs Gemini)
  const [recognitionSettings, setRecognitionSettings] = useState<RecognitionSettings>(DEFAULT_RECOGNITION_SETTINGS);
  const [recognitionSaveStatus, setRecognitionSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const [apiKeyValidating, setApiKeyValidating] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const recognitionInitialLoadDone = useRef(false);

  // Location Settings
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [locationPrecision, setLocationPrecision] = useState<'exact' | 'neighborhood' | 'city'>('neighborhood');

  // Share Modal
  const [showShareModal, setShowShareModal] = useState(false);

  // Export state
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const {
    entries,
    lastSync,
    lastWriteSync,
    isSyncing,
    isWriteSyncing,
    syncError,
    writeSyncError,
    pendingSyncCount,
    pendingPlateCount,
    pendingEncounterCount,
    fullSync,
    writeSync,
  } = useLookup();

  const writeSyncStatus =
    !writeUrl ? 'Add Apps Script URL to enable' :
    isWriteSyncing ? 'Syncing…' :
    pendingSyncCount === 0 ? 'No pending items' :
    'Ready to sync';
  const writeSyncLabel =
    pendingSyncCount > 0 ? `Sync to Sheet (${pendingSyncCount})` : 'Sync to Sheet';

  // Load settings on mount
  useEffect(() => {
    getSettings().then((settings) => {
      if (settings?.sheetUrl) {
        setSheetUrl(settings.sheetUrl);
      }
      if (settings?.writeUrl) {
        setWriteUrl(settings.writeUrl);
      }
      if (settings?.showEditFields !== undefined) {
        setShowEditFields(settings.showEditFields);
      }
      if (settings?.locationEnabled !== undefined) {
        setLocationEnabled(settings.locationEnabled);
      }
      if (settings?.locationPrecision !== undefined) {
        setLocationPrecision(settings.locationPrecision);
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

    // Load Recognition settings
    const storedRecognitionSettings = getRecognitionSettings();
    setRecognitionSettings(storedRecognitionSettings);
    setTimeout(() => {
      recognitionInitialLoadDone.current = true;
    }, 100);
  }, []);

  // Auto-save settings when they change (with debounce)
  const saveUserSettings = useCallback(async (
    newSheetUrl: string,
    newWriteUrl: string,
    newShowEditFields: boolean,
    newLocationEnabled: boolean,
    newLocationPrecision: 'exact' | 'neighborhood' | 'city'
  ) => {
    if (!initialLoadDone.current) return;

    setSaveStatus('saving');
    const currentSettings = await getSettings();
    await saveSettings({
      sheetUrl: newSheetUrl,
      writeUrl: newWriteUrl,
      showEditFields: newShowEditFields,
      locationEnabled: newLocationEnabled,
      locationPrecision: newLocationPrecision,
      lastSyncTime: currentSettings?.lastSyncTime,
      lastWriteSyncTime: currentSettings?.lastWriteSyncTime,
      lastEncounterSyncTime: currentSettings?.lastEncounterSyncTime,
      encounterWriteUrl: currentSettings?.encounterWriteUrl,
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 1500);
  }, []);

  // Debounced auto-save effect
  useEffect(() => {
    if (!initialLoadDone.current) return;

    const timeoutId = setTimeout(() => {
      saveUserSettings(sheetUrl, writeUrl, showEditFields, locationEnabled, locationPrecision);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [sheetUrl, writeUrl, showEditFields, locationEnabled, locationPrecision, saveUserSettings]);

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

  // Auto-save Recognition settings when they change
  useEffect(() => {
    if (!recognitionInitialLoadDone.current) return;

    setRecognitionSaveStatus('saving');
    const timeoutId = setTimeout(() => {
      saveRecognitionSettings(recognitionSettings);
      setRecognitionSaveStatus('saved');
      setTimeout(() => setRecognitionSaveStatus(null), 1500);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [recognitionSettings]);

  const updateOcrSetting = <K extends keyof OCRSettings>(key: K, value: OCRSettings[K]) => {
    setOcrSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetOcrSettings = () => {
    setOcrSettings(DEFAULT_OCR_SETTINGS);
  };

  const updateRecognitionMethod = (method: RecognitionMethod) => {
    setRecognitionSettings(prev => ({ ...prev, method }));
  };

  const updateGeminiApiKey = (apiKey: string) => {
    setRecognitionSettings(prev => ({ ...prev, geminiApiKey: apiKey }));
    // Reset validation state when key changes
    setApiKeyValid(null);
  };

  const updateGeminiMaxImageSize = (size: number) => {
    setRecognitionSettings(prev => ({ ...prev, geminiMaxImageSize: size }));
  };

  const updateGeminiAutoScan = (autoScan: boolean) => {
    setRecognitionSettings(prev => ({ ...prev, geminiAutoScan: autoScan }));
  };

  const handleValidateApiKey = async () => {
    const key = recognitionSettings.geminiApiKey;
    if (!key) {
      setApiKeyValid(false);
      return;
    }
    setApiKeyValidating(true);
    setApiKeyValid(null);
    const isValid = await validateGeminiApiKey(key);
    setApiKeyValid(isValid);
    setApiKeyValidating(false);
  };

  const handleSync = async () => {
    if (!sheetUrl) return;
    try {
      // Push local changes first, then pull from Google
      await fullSync(sheetUrl, writeUrl || undefined);
    } catch {
      // Error is handled by useLookup
    }
  };

  const handleWriteSync = async () => {
    if (!writeUrl) return;
    const result = await writeSync(writeUrl);
    if (writeToastTimerRef.current) {
      window.clearTimeout(writeToastTimerRef.current);
    }

    if (result.success) {
      if (result.count > 0) {
        setWriteToast({ type: 'success', message: `Synced ${result.count} item${result.count !== 1 ? 's' : ''} to Sheets` });
      } else {
        setWriteToast({ type: 'info', message: 'No pending items to sync' });
      }
    } else {
      setWriteToast({ type: 'error', message: 'Sync failed — see details above' });
    }

    writeToastTimerRef.current = window.setTimeout(() => {
      setWriteToast(null);
    }, 3000);
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
      {writeToast && (
        <div className="toast toast-bottom toast-center z-50">
          <div className={`alert ${
            writeToast.type === 'success'
              ? 'alert-success'
              : writeToast.type === 'error'
                ? 'alert-error'
                : 'alert-info'
          }`}>
            <span>{writeToast.message}</span>
          </div>
        </div>
      )}
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

      {/* Quick Setup - Use Shared Database */}
      {!sheetUrl && !writeUrl && DEFAULT_SHEET_URL && DEFAULT_WRITE_URL && (
        <div className="card bg-primary/10 border-2 border-primary">
          <div className="card-body">
            <h3 className="card-title text-base">Quick Setup</h3>
            <p className="text-sm text-base-content/70">
              Get started instantly by using the shared community database. Your scans will contribute to a shared watchlist that benefits everyone.
            </p>
            <div className="card-actions mt-2">
              <button
                onClick={() => {
                  setSheetUrl(DEFAULT_SHEET_URL);
                  setWriteUrl(DEFAULT_WRITE_URL);
                }}
                className="btn btn-primary btn-sm gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                Use Shared Database
              </button>
            </div>
            <p className="text-xs text-base-content/50 mt-2">
              Or scroll down to set up your own private Google Sheet
            </p>
          </div>
        </div>
      )}

      {/* Full Sync Card */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-base">Sync with Google Sheets</h3>

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
              <p>Last sync: {formatDate(lastSync)}</p>
            </div>
            <button
              onClick={handleSync}
              disabled={!sheetUrl || isSyncing}
              className="btn btn-primary btn-sm"
            >
              {isSyncing ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Syncing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Sync All
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
              {pendingSyncCount > 0 && (
                <p>
                  Plates: {pendingPlateCount} • Encounters: {pendingEncounterCount}
                </p>
              )}
              <p>Last write: {formatDate(lastWriteSync)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
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
                    {writeSyncLabel}
                  </>
                )}
              </button>
              <span className="text-xs text-base-content/60">{writeSyncStatus}</span>
            </div>
          </div>

          {/* Reset to Shared Database option */}
          {DEFAULT_SHEET_URL && DEFAULT_WRITE_URL && (sheetUrl || writeUrl) && (
            <div className="mt-3 pt-3 border-t border-base-300">
              <button
                onClick={() => {
                  setSheetUrl(DEFAULT_SHEET_URL);
                  setWriteUrl(DEFAULT_WRITE_URL);
                }}
                className="btn btn-ghost btn-xs text-base-content/60 gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                Switch to shared community database
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Share Database Card */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-base">Share Database</h3>
          <p className="text-sm text-base-content/60">
            Share your plate watchlist with family or neighbors. They'll be able to see and edit the same database.
          </p>
          <div className="mt-2">
            <button
              onClick={() => setShowShareModal(true)}
              disabled={!sheetUrl}
              className="btn btn-outline btn-sm gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                />
              </svg>
              Share with Others
            </button>
            {!sheetUrl && (
              <p className="text-xs text-base-content/50 mt-2">
                Add a Google Sheets URL above to enable sharing
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        config={{
          sheetUrl,
          writeUrl: writeUrl || undefined,
        }}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      {/* Export Data Card */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-base">Export Data</h3>
          <p className="text-sm text-base-content/60">
            Download your plates and encounters as CSV files for backup or import into other apps.
          </p>

          {exportStatus && (
            <div className="alert alert-success py-2 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {exportStatus}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={async () => {
                const csv = await exportPlatesToCSV();
                downloadCSV(csv, `sentry-plates-${new Date().toISOString().split('T')[0]}.csv`);
                setExportStatus('Plates exported!');
                setTimeout(() => setExportStatus(null), 3000);
              }}
              className="btn btn-outline btn-sm gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Plates
            </button>
            <button
              onClick={async () => {
                const csv = await exportEncountersToCSV();
                downloadCSV(csv, `sentry-encounters-${new Date().toISOString().split('T')[0]}.csv`);
                setExportStatus('Encounters exported!');
                setTimeout(() => setExportStatus(null), 3000);
              }}
              className="btn btn-outline btn-sm gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Encounters
            </button>
          </div>
        </div>
      </div>

      {/* Recognition Method Card */}
      <div className="card bg-base-200">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h3 className="card-title text-base">Recognition Method</h3>
            {recognitionSaveStatus && (
              <span className="text-xs text-base-content/60 flex items-center gap-1">
                {recognitionSaveStatus === 'saving' ? (
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

          <p className="text-sm text-base-content/60 mb-2">
            Choose how license plates are recognized from images.
          </p>

          {/* Method Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => updateRecognitionMethod('ocr')}
              className={`btn btn-sm flex-1 ${recognitionSettings.method === 'ocr' ? 'btn-primary' : 'btn-outline'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Local OCR
            </button>
            <button
              onClick={() => updateRecognitionMethod('gemini')}
              className={`btn btn-sm flex-1 ${recognitionSettings.method === 'gemini' ? 'btn-primary' : 'btn-outline'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
              Gemini AI
            </button>
          </div>

          {/* Method Descriptions */}
          <div className={`p-3 rounded-lg mb-4 ${recognitionSettings.method === 'ocr' ? 'bg-primary/10' : 'bg-base-300'}`}>
            {recognitionSettings.method === 'ocr' ? (
              <div className="text-sm">
                <strong>Local OCR (Tesseract)</strong>
                <p className="text-base-content/70 mt-1">
                  Uses on-device text recognition. Works offline, no API key needed. Good for clear, well-lit plates.
                </p>
              </div>
            ) : (
              <div className="text-sm">
                <strong>Gemini AI (Google)</strong>
                <p className="text-base-content/70 mt-1">
                  Uses Google's AI vision model for recognition. Requires internet and API key. Better accuracy for challenging images.
                </p>
              </div>
            )}
          </div>

          {/* Gemini API Key Input (shown when Gemini is selected) */}
          {recognitionSettings.method === 'gemini' && (
            <div className="space-y-3">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Gemini API Key</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Enter your Gemini API key"
                      value={recognitionSettings.geminiApiKey}
                      onChange={(e) => updateGeminiApiKey(e.target.value)}
                      className={`input input-bordered w-full pr-10 ${apiKeyValid === true ? 'input-success' : apiKeyValid === false ? 'input-error' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={handleValidateApiKey}
                    disabled={!recognitionSettings.geminiApiKey || apiKeyValidating}
                    className="btn btn-outline btn-sm"
                  >
                    {apiKeyValidating ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      'Test'
                    )}
                  </button>
                </div>
                {apiKeyValid !== null && (
                  <label className="label">
                    <span className={`label-text-alt whitespace-normal break-words ${apiKeyValid ? 'text-success' : 'text-error'}`}>
                      {apiKeyValid ? 'API key is valid' : 'Invalid API key'}
                    </span>
                  </label>
                )}
                {/* Get API Key Link */}
                {!recognitionSettings.geminiApiKey && (
                  <div className="mt-2">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline gap-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                        />
                      </svg>
                      Get Free API Key
                    </a>
                    <p className="text-xs text-base-content/50 mt-2">
                      Opens Google AI Studio. Sign in with Google, click "Create API Key", then paste it above.
                    </p>
                  </div>
                )}
              </div>

              {/* Max Image Size Setting */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Max Image Size</span>
                  <span className="label-text-alt whitespace-normal break-words">{recognitionSettings.geminiMaxImageSize}px</span>
                </label>
                <input
                  type="range"
                  min="512"
                  max="4096"
                  step="256"
                  value={recognitionSettings.geminiMaxImageSize}
                  onChange={(e) => updateGeminiMaxImageSize(parseInt(e.target.value, 10))}
                  className="range range-primary range-sm"
                />
                <div className="flex justify-between text-xs text-base-content/50 px-1 mt-1">
                  <span>512</span>
                  <span>1536</span>
                  <span>2560</span>
                  <span>4096</span>
                </div>
                {/* Quick preset buttons */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => updateGeminiMaxImageSize(1024)}
                    className={`btn btn-xs ${recognitionSettings.geminiMaxImageSize === 1024 ? 'btn-primary' : 'btn-outline'}`}
                  >
                    1024 (Fast)
                  </button>
                  <button
                    onClick={() => updateGeminiMaxImageSize(1536)}
                    className={`btn btn-xs ${recognitionSettings.geminiMaxImageSize === 1536 ? 'btn-primary' : 'btn-outline'}`}
                  >
                    1536 (Default)
                  </button>
                  <button
                    onClick={() => updateGeminiMaxImageSize(2048)}
                    className={`btn btn-xs ${recognitionSettings.geminiMaxImageSize === 2048 ? 'btn-primary' : 'btn-outline'}`}
                  >
                    2048 (Quality)
                  </button>
                  <button
                    onClick={() => updateGeminiMaxImageSize(4096)}
                    className={`btn btn-xs ${recognitionSettings.geminiMaxImageSize === 4096 ? 'btn-primary' : 'btn-outline'}`}
                  >
                    4096 (Max)
                  </button>
                </div>
                <label className="label">
                  <span className="label-text-alt text-base-content/50 whitespace-normal break-words">
                    Larger = better for distant plates, but slower uploads. Smaller = faster processing.
                  </span>
                </label>
              </div>

              {/* Auto-Scan Toggle */}
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3 items-start flex-wrap whitespace-normal">
                  <input
                    type="checkbox"
                    checked={recognitionSettings.geminiAutoScan}
                    onChange={(e) => updateGeminiAutoScan(e.target.checked)}
                    className="toggle toggle-primary"
                  />
                  <div className="min-w-0">
                    <span className="label-text font-medium">Auto-scan images</span>
                    <p className="text-xs text-base-content/50 mt-0.5 break-words">
                      {recognitionSettings.geminiAutoScan
                        ? 'Images are sent to AI immediately after capture'
                        : 'Preview image first with option to crop before scanning'}
                    </p>
                  </div>
                </label>
              </div>

              <div className="alert alert-info text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div>
                  <p>Get a free API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="link">Google AI Studio</a></p>
                  <p className="mt-1 text-base-content/60">Your key is stored locally on this device only.</p>
                </div>
              </div>

              {!navigator.onLine && (
                <div className="alert alert-warning text-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                  <span>You're offline. Gemini requires internet - will fall back to local OCR.</span>
                </div>
              )}
            </div>
          )}
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
              <span className="label-text-alt text-base-content/50 whitespace-normal break-words">
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
              <span className="label-text-alt text-base-content/50 whitespace-normal break-words">
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
            <label className="label cursor-pointer justify-start gap-3 items-start flex-wrap whitespace-normal">
              <input
                type="checkbox"
                checked={ocrSettings.preprocessImage}
                onChange={(e) => updateOcrSetting('preprocessImage', e.target.checked)}
                className="checkbox checkbox-primary"
              />
              <div className="min-w-0">
                <span className="label-text">Preprocess Image</span>
                <p className="text-xs text-base-content/50 break-words">
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

      {/* Location Tracking */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-base">Location Tracking</h3>
          <p className="text-sm text-base-content/60 mb-3">
            Capture GPS location when scanning plates to track where encounters occur.
          </p>

          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3 items-start flex-wrap whitespace-normal">
              <input
                type="checkbox"
                checked={locationEnabled}
                onChange={(e) => setLocationEnabled(e.target.checked)}
                className="toggle toggle-primary"
              />
              <div className="min-w-0">
                <span className="label-text font-medium">Enable location capture</span>
                <p className="text-xs text-base-content/50 mt-0.5 break-words">
                  {locationEnabled
                    ? 'Location will be captured with each scan (requires permission)'
                    : 'Location tracking is disabled'}
                </p>
              </div>
            </label>
          </div>

          {locationEnabled && (
            <div className="form-control mt-3">
              <label className="label">
                <span className="label-text">Location precision</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={locationPrecision}
                onChange={(e) => setLocationPrecision(e.target.value as 'exact' | 'neighborhood' | 'city')}
              >
                <option value="exact">Exact (full GPS precision)</option>
                <option value="neighborhood">Neighborhood (~100m accuracy)</option>
                <option value="city">City (~1km accuracy)</option>
              </select>
              <label className="label">
                <span className="label-text-alt text-base-content/50 whitespace-normal break-words">
                  Lower precision protects privacy but reduces detail
                </span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Display Options */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-base">Display Options</h3>

          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3 items-start flex-wrap whitespace-normal">
              <input
                type="checkbox"
                checked={showEditFields}
                onChange={(e) => setShowEditFields(e.target.checked)}
                className="toggle toggle-primary"
              />
              <div className="min-w-0">
                <span className="label-text font-medium">Show edit fields on scan results</span>
                <p className="text-xs text-base-content/50 mt-0.5 break-words">
                  {showEditFields
                    ? 'Name, notes, and experience fields are shown after scanning'
                    : 'Only the plate number and match status are shown after scanning'}
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-base">About {APP_NAME}</h3>
          <div className="text-sm text-base-content/70 space-y-2">
            <p>
              {APP_DESCRIPTION}
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
