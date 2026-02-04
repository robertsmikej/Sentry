import { useState, useEffect } from 'react';
import { getAllEncounters, getEncountersForPlate, deleteEncounter, migrateScansToEncounters } from '../services/storage';
import { EncounterDetailModal } from './EncounterDetailModal';
import { EncounterItem } from './EncounterItem';
import type { Encounter } from '../types';

interface EncounterListProps {
  plateCode?: string; // Optional: filter by plate
}

export function EncounterList({ plateCode }: EncounterListProps) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [migratedCount, setMigratedCount] = useState<number | null>(null);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);

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
        <div className="card bg-base-100 shadow-md border border-base-300">
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
            <EncounterItem
              key={encounter.id}
              encounter={encounter}
              onClick={() => setSelectedEncounter(encounter)}
              showRelativeTime={false}
            />
          ))}
        </div>
      ))}

      {/* Empty state after filter */}
      {filteredEncounters.length === 0 && encounters.length > 0 && (
        <div className="text-center text-base-content/50 py-8">
          No encounters match "{filter}"
        </div>
      )}

      {/* Encounter Detail Modal */}
      <EncounterDetailModal
        encounter={selectedEncounter}
        onClose={() => setSelectedEncounter(null)}
        onUpdate={loadEncounters}
        onDelete={handleDelete}
      />
    </div>
  );
}
