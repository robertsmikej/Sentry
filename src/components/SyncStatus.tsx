import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function SyncStatus() {
  const isOnline = useOnlineStatus();

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
          <>Online<span className="opacity-70"> • </span>Auto‑sync on</>
        ) : (
          <>Offline<span className="opacity-70"> • </span>Sync queued</>
        )}
      </span>
    </div>
  );
}
