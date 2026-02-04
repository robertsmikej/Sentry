import type { Experience } from '../types'

// Format relative time (e.g., "2 min ago", "1 hour ago", "Yesterday")
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return new Date(date).toLocaleDateString()
}

// Format time for display
function formatTime(date: Date): string {
  const d = new Date(date)
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Experience indicator dot
function ExperienceDot({ experience }: { experience?: Experience }) {
  if (experience === 'good') {
    return <span className="w-3 h-3 rounded-full bg-success inline-block flex-shrink-0"></span>
  }
  if (experience === 'bad') {
    return <span className="w-3 h-3 rounded-full bg-error inline-block flex-shrink-0"></span>
  }
  return <span className="w-3 h-3 rounded-full bg-warning inline-block flex-shrink-0"></span>
}

export interface EncounterItemData {
  id: string
  plateCode: string
  timestamp: Date
  experience?: Experience
  plateName?: string
  needsSync?: boolean
}

interface EncounterItemProps {
  encounter: EncounterItemData
  onClick?: () => void
  showRelativeTime?: boolean // true = "2 min ago", false = "10:30 AM"
}

export function EncounterItem({ encounter, onClick, showRelativeTime = true }: EncounterItemProps) {
  const exp = encounter.experience || 'neutral'
  const borderColor = exp === 'good' ? 'border-l-success' : exp === 'bad' ? 'border-l-error' : 'border-l-warning'

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-base-100 rounded-lg cursor-pointer hover:bg-base-200 transition-colors shadow-md border border-base-300 border-l-4 ${borderColor}`}
      onClick={onClick}
    >
      <ExperienceDot experience={exp} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm">
            {encounter.plateCode}
          </span>
          {encounter.plateName && (
            <span className="text-xs text-base-content/60 truncate">
              {encounter.plateName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-base-content/50">
          <span>{showRelativeTime ? formatRelativeTime(encounter.timestamp) : formatTime(encounter.timestamp)}</span>
          {encounter.needsSync && (
            <span className="text-warning">• Pending sync</span>
          )}
        </div>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-4 h-4 text-base-content/40 flex-shrink-0"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m8.25 4.5 7.5 7.5-7.5 7.5"
        />
      </svg>
    </div>
  )
}
