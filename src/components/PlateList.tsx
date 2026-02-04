import { useState, useEffect } from 'react'
import { getAllLookupEntries, getEncounterCountForPlate } from '../services/storage'
import { PlateDetailModal } from './PlateDetailModal'
import { EncounterDetailModal } from './EncounterDetailModal'
import type { LookupEntry, Encounter, Experience } from '../types'

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

interface PlateWithEncounterCount extends LookupEntry {
  encounterCount: number
}

export function PlateList() {
  const [plates, setPlates] = useState<PlateWithEncounterCount[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [selectedPlate, setSelectedPlate] = useState<LookupEntry | null>(null)
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null)
  const [sortBy, setSortBy] = useState<'lastSeen' | 'seenCount' | 'code'>('lastSeen')

  const loadPlates = async () => {
    try {
      const entries = await getAllLookupEntries()

      // Get encounter counts for each plate
      const platesWithCounts = await Promise.all(
        entries.map(async (plate) => ({
          ...plate,
          encounterCount: await getEncounterCountForPlate(plate.code)
        }))
      )

      setPlates(platesWithCounts)
    } catch (error) {
      console.error('Failed to load plates:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlates()
  }, [])

  // Filter plates by search
  const filteredPlates = filter
    ? plates.filter((p) =>
        p.code.toLowerCase().includes(filter.toLowerCase()) ||
        (p.name && p.name.toLowerCase().includes(filter.toLowerCase()))
      )
    : plates

  // Sort plates
  const sortedPlates = [...filteredPlates].sort((a, b) => {
    if (sortBy === 'lastSeen') {
      const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0
      const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0
      return bTime - aTime // Most recent first
    }
    if (sortBy === 'seenCount') {
      return (b.seenCount || 0) - (a.seenCount || 0) // Most seen first
    }
    return a.code.localeCompare(b.code) // Alphabetical
  })

  // Format date for display
  const formatDate = (date?: Date) => {
    if (!date) return 'Never'
    const d = new Date(date)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`

    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    })
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
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold">Known Plates</h2>
        <p className="text-sm text-base-content/60">
          {plates.length} plate{plates.length !== 1 ? 's' : ''} in your database
        </p>
      </div>

      {/* Search and Sort */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search plates..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input input-bordered input-sm w-full pl-9"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'lastSeen' | 'seenCount' | 'code')}
          className="select select-bordered select-sm"
        >
          <option value="lastSeen">Recent</option>
          <option value="seenCount">Most Seen</option>
          <option value="code">A-Z</option>
        </select>
      </div>

      {/* Plate List */}
      {sortedPlates.length === 0 ? (
        <div className="text-center py-12 text-base-content/50">
          {filter ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-2 opacity-50">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p>No plates match "{filter}"</p>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 mx-auto mb-2 opacity-50">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              <p>No plates yet</p>
              <p className="text-xs mt-1">Scan your first plate to get started</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedPlates.map((plate) => {
            const borderColor = plate.experience === 'good' ? 'border-l-success' :
                               plate.experience === 'bad' ? 'border-l-error' : 'border-l-warning'
            return (
              <div
                key={plate.code}
                onClick={() => setSelectedPlate(plate)}
                className={`flex items-center gap-3 p-3 bg-base-100 rounded-lg cursor-pointer hover:bg-base-200 transition-colors shadow-md border border-base-300 border-l-4 ${borderColor}`}
              >
                <ExperienceDot experience={plate.experience} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">
                      {plate.code}
                    </span>
                    {plate.name && (
                      <span className="text-xs text-base-content/60 truncate">
                        {plate.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-base-content/50">
                    <span>{plate.seenCount || 0} times</span>
                    <span>•</span>
                    <span>{plate.encounterCount} encounters</span>
                    <span>•</span>
                    <span>{formatDate(plate.lastSeen)}</span>
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
          })}
        </div>
      )}

      {/* Plate Detail Modal */}
      <PlateDetailModal
        plate={selectedPlate}
        onClose={() => setSelectedPlate(null)}
        onUpdate={loadPlates}
        onViewEncounter={(encounter) => {
          setSelectedPlate(null)
          setSelectedEncounter(encounter)
        }}
      />

      {/* Encounter Detail Modal (when viewing from plate) */}
      <EncounterDetailModal
        encounter={selectedEncounter}
        onClose={() => setSelectedEncounter(null)}
        onUpdate={loadPlates}
      />
    </div>
  )
}
