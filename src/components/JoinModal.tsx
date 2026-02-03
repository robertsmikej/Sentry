import { useState } from 'react';
import { type ShareableConfig, clearJoinHash } from '../services/sharing';
import { saveSettings, getSettings } from '../services/storage';
import { syncFromSheet } from '../services/sync';

interface JoinModalProps {
  config: ShareableConfig;
  isOpen: boolean;
  onClose: () => void;
  onJoined: () => void;
}

export function JoinModal({ config, isOpen, onClose, onJoined }: JoinModalProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setIsJoining(true);
    setError(null);

    try {
      // Get current settings to preserve other values
      const currentSettings = await getSettings();

      // Save the new sheet URLs
      await saveSettings({
        ...currentSettings,
        sheetUrl: config.sheetUrl,
        writeUrl: config.writeUrl,
      });

      // Clear the join hash from URL
      clearJoinHash();

      // Trigger initial sync
      try {
        await syncFromSheet(config.sheetUrl);
      } catch (syncError) {
        console.warn('Initial sync failed, but settings were saved:', syncError);
        // Don't block join on sync failure - settings are saved
      }

      onJoined();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join database';
      setError(message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleCancel = () => {
    clearJoinHash();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6 text-primary"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
            />
          </svg>
          Join Watchlist
        </h3>

        <div className="py-4">
          <p className="text-base-content/80">
            {config.name ? (
              <>
                You've been invited to join <strong>{config.name}</strong>'s plate watchlist.
              </>
            ) : (
              <>You've been invited to join a shared plate watchlist.</>
            )}
          </p>

          {/* Info about what joining means */}
          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-success shrink-0 mt-0.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
              <span>You'll see all plates in the shared database</span>
            </div>
            {config.writeUrl && (
              <div className="flex items-start gap-2 text-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5 text-success shrink-0 mt-0.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
                <span>You can add and edit plates (changes sync to everyone)</span>
              </div>
            )}
            <div className="flex items-start gap-2 text-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-warning shrink-0 mt-0.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
              <span className="text-base-content/70">
                This will replace your current database settings
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <div className="modal-action">
          <button
            onClick={handleCancel}
            className="btn btn-ghost"
            disabled={isJoining}
          >
            Cancel
          </button>
          <button
            onClick={handleJoin}
            className="btn btn-primary"
            disabled={isJoining}
          >
            {isJoining ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Joining...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                  />
                </svg>
                Join Database
              </>
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleCancel}></div>
    </div>
  );
}
