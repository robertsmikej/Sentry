import { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getSettings } from '../services/storage';

export function SyncStatus() {
  const isOnline = useOnlineStatus();
  const [hasSyncConfigured, setHasSyncConfigured] = useState(false);

  useEffect(() => {
    const checkSettings = async () => {
      const settings = await getSettings();
      setHasSyncConfigured(!!settings?.sheetUrl && !!settings?.writeUrl);
    };
    checkSettings();
  }, []);

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold shadow-sm ${
        isOnline
          ? 'bg-white/90 text-green-700'
          : 'bg-red-600 text-white'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-white animate-pulse'}`}
      ></span>
      <span className="leading-tight whitespace-nowrap">
        {isOnline ? (
          hasSyncConfigured ? (
            <>Online<span className="opacity-70"> • </span>Auto‑sync on</>
          ) : (
            <>Online</>
          )
        ) : (
          hasSyncConfigured ? (
            <>Offline<span className="opacity-70"> • </span>Sync queued</>
          ) : (
            <>Offline</>
          )
        )}
      </span>
    </div>
  );
}
