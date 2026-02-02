import { useHistory } from '../hooks/useHistory';

export function History() {
  const { scans, clear, exportCSV } = useHistory();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Scan History</h2>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={scans.length === 0}
            className="btn btn-sm btn-outline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={clear}
            disabled={scans.length === 0}
            className="btn btn-sm btn-error btn-outline"
          >
            Clear
          </button>
        </div>
      </div>

      {scans.length === 0 ? (
        <div className="text-center py-12 text-base-content/50">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p>No scans yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => (
            <div
              key={scan.id}
              className={`card card-compact ${
                scan.matched ? 'bg-success/10' : 'bg-base-200'
              }`}
            >
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono font-bold">{scan.normalizedText || '(empty)'}</p>
                    {scan.matched && scan.matchedEntry && (
                      <p className="text-sm text-success">{scan.matchedEntry.name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`badge badge-sm ${
                        scan.matched ? 'badge-success' : 'badge-ghost'
                      }`}
                    >
                      {scan.matched ? 'Match' : 'No Match'}
                    </span>
                    <p className="text-xs text-base-content/50 mt-1">
                      {formatDate(scan.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
