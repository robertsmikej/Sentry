import {useState, useEffect} from 'react'
import {
  getDashboardStats,
  getRecentEncountersWithPlates,
  deleteEncounter,
  type DashboardStats,
  type RecentEncounterWithPlate
} from '../services/storage'
import {APP_NAME, APP_TAGLINE} from '../constants/app'
import {EncounterDetailModal} from './EncounterDetailModal'
import {EncounterMap} from './EncounterMap'

interface DashboardProps {
  onNavigate: (tab: 'scan' | 'encounters' | 'settings') => void
  onManualEntry: () => void
  onScanWithCamera: () => void
}

// Detect if device likely has a camera (mobile/tablet)
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches)
}

// Format relative time (e.g., "2 min ago", "1 hour ago", "Yesterday")
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24)
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return new Date(date).toLocaleDateString()
}

// Experience indicator dot
function ExperienceDot({
  experience
}: {
  experience?: 'good' | 'bad' | 'neutral'
}) {
  if (experience === 'good') {
    return (
      <span className="w-3 h-3 rounded-full bg-success inline-block"></span>
    )
  }
  if (experience === 'bad') {
    return <span className="w-3 h-3 rounded-full bg-error inline-block"></span>
  }
  return <span className="w-3 h-3 rounded-full bg-warning inline-block"></span>
}

export function Dashboard({onNavigate, onManualEntry, onScanWithCamera}: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isMobile] = useState(() => isMobileDevice())
  const [recentEncounters, setRecentEncounters] = useState<
    RecentEncounterWithPlate[]
  >([])
  const [loading, setLoading] = useState(true)
  const [selectedEncounter, setSelectedEncounter] = useState<RecentEncounterWithPlate | null>(null)

  const loadData = async () => {
    try {
      const [statsData, encounters] = await Promise.all([
        getDashboardStats(),
        getRecentEncountersWithPlates(8)
      ])
      setStats(statsData)
      setRecentEncounters(encounters)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleDeleteEncounter = async (id: string) => {
    try {
      await deleteEncounter(id)
      await loadData()
    } catch (error) {
      console.error('Failed to delete encounter:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 max-w-lg mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-6">
        <div className="flex flex-col items-center gap-2 mb-2">
          <img
            src="/logos/sentry_logo_tight_padding.png"
            alt={APP_NAME}
            className="w-16 h-16"
          />
          <img
            src="/logos/sentry_text_tight_padding.png"
            alt={APP_NAME}
            className="h-8 w-auto"
          />
        </div>
        <p className="text-sm text-base-content/60">{APP_TAGLINE}</p>
        <p className="text-xs text-base-content/40 mt-1">
          Scan and track license plates to keep your neighborhood safe
        </p>
      </div>

      {/* Big Scan Button - opens camera directly on mobile, navigates to scan page on desktop */}
      <button
        onClick={() => isMobile ? onScanWithCamera() : onNavigate('scan')}
        className="btn btn-lg w-full min-h-20 text-xl gap-3 shadow-lg text-white hover:brightness-110 active:brightness-95"
        style={{backgroundColor: '#132F45'}}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-8 h-8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
          />
        </svg>
        Scan Plate
      </button>
      <p className="text-sm text-base-content/50 text-center mt-2 font-medium">
        Closer and head-on = better reads
      </p>

      {/* Manual Entry Option */}
      <button
        onClick={onManualEntry}
        className="btn btn-ghost btn-sm w-full mt-2 gap-2 text-base-content/70"
      >
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
        Enter plate manually
      </button>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        <div className="stat bg-base-100 rounded-box p-3 text-center shadow-md border border-base-300">
          <div className="stat-value text-2xl">{stats?.totalPlates ?? 0}</div>
          <div className="stat-desc text-xs">Plates In Data</div>
        </div>
        <div className="stat bg-base-100 rounded-box p-3 text-center shadow-md border border-base-300">
          <div className="stat-value text-2xl">
            {stats?.encountersThisWeek ?? 0}
          </div>
          <div className="stat-desc text-xs">Scans This Week</div>
        </div>
        <div className="stat bg-base-100 rounded-box p-3 text-center shadow-md border border-base-300">
          <div
            className={`stat-value text-2xl ${(stats?.pendingSync ?? 0) > 0 ? 'text-warning' : ''}`}
          >
            {stats?.pendingSync ?? 0}
          </div>
          <div className="stat-desc text-xs">Pending Uploads</div>
        </div>
      </div>

      {/* Alert Banner for Recent Bad Encounters */}
      {stats && stats.recentBadEncounters > 0 && (
        <div className="alert alert-warning mt-4">
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
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <span>
            {stats.recentBadEncounters} flagged plate
            {stats.recentBadEncounters !== 1 ? 's' : ''} spotted this week
          </span>
        </div>
      )}

      {/* Map Widget - only show if any encounters have location data */}
      {recentEncounters.some(e => e.location) && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-base-content/70 mb-3">
            Recent Locations
          </h3>
          <EncounterMap
            encounters={recentEncounters}
            height="180px"
            onMarkerClick={(encounter) => setSelectedEncounter(encounter as RecentEncounterWithPlate)}
          />
        </div>
      )}

      {/* Recent Activity */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-base-content/70 mb-3">
          Recent Activity
        </h3>

        {recentEncounters.length === 0 ? (
          <div className="text-center py-8 text-base-content/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
              className="w-12 h-12 mx-auto mb-2 opacity-50"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p>No activity yet</p>
            <p className="text-xs mt-1">Scan your first plate to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentEncounters.map((encounter) => {
              const exp = encounter.plateExperience || encounter.experience
              const borderColor = exp === 'good' ? 'border-l-success' : exp === 'bad' ? 'border-l-error' : 'border-l-warning'
              return (
              <div
                key={encounter.id}
                className={`flex items-center gap-3 p-3 bg-base-100 rounded-lg cursor-pointer hover:bg-base-200 transition-colors shadow-md border border-base-300 border-l-4 ${borderColor}`}
                onClick={() => setSelectedEncounter(encounter)}
              >
                <ExperienceDot
                  experience={exp}
                />
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
                  <div className="text-xs text-base-content/50">
                    {formatRelativeTime(encounter.timestamp)}
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 text-base-content/40"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m8.25 4.5 7.5 7.5-7.5 7.5"
                  />
                </svg>
              </div>
            )})}
          </div>
        )}

        {/* View All Button */}
        {recentEncounters.length > 0 && (
          <button
            onClick={() => onNavigate('encounters')}
            className="btn btn-ghost btn-sm w-full mt-3"
          >
            View All Encounters
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
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Empty State Tip */}
      {stats && stats.totalPlates === 0 && (
        <div className="mt-6 p-4 bg-base-100 rounded-lg text-center shadow-md border border-base-300">
          <p className="text-sm text-base-content/70">
            Welcome to {APP_NAME}! Start by scanning a license plate or go to{' '}
            <button
              onClick={() => onNavigate('settings')}
              className="link link-primary"
            >
              Settings
            </button>{' '}
            to connect your Google Sheet.
          </p>
        </div>
      )}

      {/* Encounter Detail Modal */}
      <EncounterDetailModal
        encounter={selectedEncounter}
        plateName={selectedEncounter?.plateName}
        plateExperience={selectedEncounter?.plateExperience}
        onClose={() => setSelectedEncounter(null)}
        onUpdate={loadData}
        onDelete={handleDeleteEncounter}
      />
    </div>
  )
}
