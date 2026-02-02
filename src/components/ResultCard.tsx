import type {LookupEntry} from '../types'

interface ResultCardProps {
  normalizedText: string
  matched: boolean
  matchedEntry?: LookupEntry
  onScanAgain: () => void
  onEdit: () => void
  onPlateChange?: (newPlate: string) => void
  onAdjustPerspective?: () => void
}

function ExperienceBadge({experience}: {experience?: string}) {
  if (!experience || experience === 'neutral') {
    return <span className="badge badge-ghost badge-sm">Neutral</span>
  }
  if (experience === 'good') {
    return <span className="badge badge-success badge-sm">Good</span>
  }
  return <span className="badge badge-error badge-sm">Bad</span>
}

export function ResultCard({
  normalizedText,
  matched,
  matchedEntry,
  onScanAgain,
  onEdit,
  onPlateChange,
  onAdjustPerspective
}: ResultCardProps) {
  const handlePlateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Normalize input: uppercase and alphanumeric only
    const normalized = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    onPlateChange?.(normalized)
  }
  // Determine card color based on experience if matched
  const getCardClass = () => {
    if (!matched) return 'bg-base-200'
    if (matchedEntry?.experience === 'good') return 'bg-success/10'
    if (matchedEntry?.experience === 'bad') return 'bg-error/10'
    return 'bg-info/10'
  }

  return (
    <div className={`card w-full max-w-md ${getCardClass()}`}>
      <div className="card-body">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {matched ? (
            <div className="badge badge-success gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
              Known Plate
            </div>
          ) : (
            <div className="badge badge-warning gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
              New Plate
            </div>
          )}
          {matched && matchedEntry && (
            <ExperienceBadge experience={matchedEntry.experience} />
          )}
        </div>

        <div className="mb-4 text-center">
          <p className="text-sm text-base-content/60">Detected Plate:</p>
          <input
            type="text"
            value={normalizedText}
            onChange={handlePlateInputChange}
            placeholder="Enter plate number"
            className="input input-bordered font-mono text-2xl font-bold tracking-wider text-center w-full max-w-xs"
          />
          <p className="text-xs text-base-content/40 mt-1">
            Tap to edit if this guess is incorrect
          </p>
          <p className="text-xs text-base-content/40 mt-1">
            {normalizedText.length} characters detected
          </p>
        </div>

        {matched && matchedEntry && (
          <div className="bg-base-100 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">
                  {matchedEntry.name || 'Unnamed'}
                </h3>
                {matchedEntry.description && (
                  <p className="mt-1 text-base-content/80">
                    {matchedEntry.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-3 text-sm text-base-content/60">
              <div className="flex items-center gap-1">
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
                    d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
                Seen {matchedEntry.seenCount || 1}x
              </div>
              {matchedEntry.lastSeen && (
                <div className="flex items-center gap-1">
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
                      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  {new Date(matchedEntry.lastSeen).toLocaleDateString()}
                </div>
              )}
            </div>
            <p className="text-xs text-base-content/40 mt-3 text-center">
              Tap "Edit" to update details.
            </p>
          </div>
        )}

        {!matched && (
          <div className="bg-base-100 rounded-lg p-4 mb-4 text-center">
            <p className="text-base-content/60">
              This plate is not in your database.
            </p>
            <p className="text-sm text-base-content/40 mt-1">
              Tap "Add" to save it.
            </p>
          </div>
        )}

        <div className="card-actions flex-col gap-2">
          <div className="flex gap-2 w-full">
            <button onClick={onEdit} className="btn btn-outline flex-1">
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
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                />
              </svg>
              {matched ? 'Edit' : 'Add'}
            </button>
            <button onClick={onScanAgain} className="btn btn-primary flex-1">
              Scan Again
            </button>
          </div>
          {onAdjustPerspective && (
            <button onClick={onAdjustPerspective} className="btn btn-outline btn-sm w-full">
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
                  d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                />
              </svg>
              Wrong reading? Adjust Perspective
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
