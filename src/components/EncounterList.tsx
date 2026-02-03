import { useState, useEffect } from 'react';
import { getAllEncounters, getEncountersForPlate, deleteEncounter, migrateScansToEncounters } from '../services/storage';
import { formatLocation, getGoogleMapsUrl } from '../services/location';
import type { Encounter } from '../types';

interface EncounterListProps {
  plateCode?: string; // Optional: filter by plate
}

export function EncounterList({ plateCode }: EncounterListProps) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [migratedCount, setMigratedCount] = useState<number | null>(null);

  // Load encounters
  const loadEncounters = async () => {
    setIsLoading(true);
    try {
      const data = plateCode
        ? await getEncountersForPlate(plateCode)
        : await getAllEncounters();
      setEncounters(data);
    } catch (error) {
      console.error('Failed to load encounters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEncounters();
  }, [plateCode]);

  // Migrate existing scans to encounters (one-time)
  const handleMigrate = async () => {
    try {
      const count = await migrateScansToEncounters();
      setMigratedCount(count);
      await loadEncounters();
    } catch (error) {
      console.error('Migration failed:', error);
    }
  };

  // Delete an encounter
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this encounter?')) return;
    try {
      await deleteEncounter(id);
      setEncounters(encounters.filter((e) => e.id !== id));
    } catch (error) {
      console.error('Failed to delete encounter:', error);
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Filter encounters by plate code
  const filteredEncounters = filter
    ? encounters.filter((e) =>
        e.plateCode.toLowerCase().includes(filter.toLowerCase())
      )
    : encounters;

  // Group encounters by date
  const groupedEncounters = filteredEncounters.reduce(
    (groups, encounter) => {
      const date = formatDate(encounter.timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(encounter);
      return groups;
    },
    {} as Record<string, Encounter[]>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {plateCode ? `Encounters: ${plateCode}` : 'All Encounters'}
        </h2>
        <span className="badge badge-neutral">{encounters.length} total</span>
      </div>

      {/* Search/Filter */}
      {!plateCode && (
        <div className="form-control">
          <input
            type="text"
            placeholder="Filter by plate number..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input input-bordered input-sm"
          />
        </div>
      )}

      {/* Migration button (if no encounters exist) */}
      {encounters.length === 0 && (
        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title text-base">No encounters yet</h3>
            <p className="text-sm text-base-content/70">
              Encounters are created automatically when you scan plates. You can
              also migrate your existing scan history to create encounter
              records.
            </p>
            <div className="card-actions mt-2">
              <button onClick={handleMigrate} className="btn btn-primary btn-sm">
                Migrate Scan History
              </button>
            </div>
            {migratedCount !== null && (
              <p className="text-sm text-success mt-2">
                Migrated {migratedCount} scans to encounters
              </p>
            )}
          </div>
        </div>
      )}

      {/* Encounters List */}
      {Object.entries(groupedEncounters).map(([date, dateEncounters]) => (
        <div key={date} className="space-y-2">
          <h3 className="text-sm font-semibold text-base-content/70 sticky top-0 bg-base-100 py-1">
            {date}
          </h3>
          {dateEncounters.map((encounter) => (
            <div
              key={encounter.id}
              className="card bg-base-200 shadow-sm"
            >
              <div className="card-body p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Plate code */}
                    <div className="font-mono font-bold text-lg">
                      {encounter.plateCode}
                    </div>

                    {/* Time */}
                    <div className="text-sm text-base-content/60">
                      {formatTime(encounter.timestamp)}
                    </div>

                    {/* Location */}
                    {encounter.location && (
                      <div className="text-sm text-base-content/70 mt-1">
                        <a
                          href={getGoogleMapsUrl(encounter.location)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary"
                        >
                          {encounter.locationLabel ||
                            formatLocation(encounter.location)}
                        </a>
                      </div>
                    )}

                    {/* Location label */}
                    {encounter.locationLabel && !encounter.location && (
                      <div className="text-sm text-base-content/70 mt-1">
                        {encounter.locationLabel}
                      </div>
                    )}

                    {/* Notes */}
                    {encounter.notes && (
                      <div className="text-sm mt-2 p-2 bg-base-300 rounded">
                        {encounter.notes}
                      </div>
                    )}

                    {/* Tags */}
                    {encounter.tags && encounter.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {encounter.tags.map((tag) => (
                          <span key={tag} className="badge badge-sm badge-outline">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="dropdown dropdown-end">
                    <label tabIndex={0} className="btn btn-ghost btn-xs btn-circle">
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
                          d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
                        />
                      </svg>
                    </label>
                    <ul
                      tabIndex={0}
                      className="dropdown-content z-10 menu p-2 shadow bg-base-100 rounded-box w-32"
                    >
                      <li>
                        <button
                          onClick={() => handleDelete(encounter.id)}
                          className="text-error"
                        >
                          Delete
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Sync status */}
                {encounter.needsSync && (
                  <div className="text-xs text-warning mt-1">
                    Pending sync
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Empty state after filter */}
      {filteredEncounters.length === 0 && encounters.length > 0 && (
        <div className="text-center text-base-content/50 py-8">
          No encounters match "{filter}"
        </div>
      )}
    </div>
  );
}
