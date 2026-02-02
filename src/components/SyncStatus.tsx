import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function SyncStatus() {
  const isOnline = useOnlineStatus();

  return (
    <div
      className={`badge badge-sm gap-2 ${
        isOnline
          ? 'bg-success/20 text-success border-success/30'
          : 'bg-error/20 text-error border-error/30'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success' : 'bg-error'}`}
      ></span>
      {isOnline ? 'Online' : 'Offline'}
    </div>
  );
}
