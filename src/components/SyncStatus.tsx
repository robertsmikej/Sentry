import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function SyncStatus() {
  const isOnline = useOnlineStatus();

  return (
    <div
      className={`badge badge-sm gap-2 font-semibold ${
        isOnline
          ? 'bg-green-600/80 text-white border-green-500/50'
          : 'bg-red-600/90 text-white border-red-500/50'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-300' : 'bg-white animate-pulse'}`}
      ></span>
      {isOnline ? 'Online' : 'Offline'}
    </div>
  );
}
