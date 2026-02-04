import { useState, useEffect } from 'react'
import { upsertLookupEntry, getEncountersForPlate, deleteLookupEntry } from '../services/storage'
import type { LookupEntry, Encounter, Experience } from '../types'

interface PlateDetailModalProps {
  plate: LookupEntry | null
  onClose: () => void
  onUpdate?: () => void
  onViewEncounter?: (encounter: Encounter) => void
}

export function PlateDetailModal({
  plate,
  onClose,
  onUpdate,
  onViewEncounter
}: PlateDetailModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [experience, setExperience] = useState<Experience>('neutral')
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [loadingEncounters, setLoadingEncounters] = useState(true)

  // Initialize form when plate changes
  useEffect(() => {
    if (plate) {
      setName(plate.name || '')
      setDescription(plate.description || '')
      setExperience(plate.experience || 'neutral')
      setHasChanges(false)

      // Load encounters for this plate
      setLoadingEncounters(true)
      getEncountersForPlate(plate.code)
        .then(setEncounters)
        .finally(() => setLoadingEncounters(false))
    }
  }, [plate])

  if (!plate) return null

  const formatDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const handleSave = async () => {
    if (!hasChanges) {
      onClose()
      return
    }

    setIsSaving(true)
    try {
      await upsertLookupEntry({
        ...plate,
        name: name.trim() || '',
        description: description.trim() || '',
        experience,
        needsSync: true
      })
      onUpdate?.()
      onClose()
    } catch (error) {
      console.error('Failed to update plate:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (confirm(`Delete plate ${plate.code} and all its data?`)) {
      try {
        await deleteLookupEntry(plate.code)
        onUpdate?.()
        onClose()
      } catch (error) {
        console.error('Failed to delete plate:', error)
      }
    }
  }

  const handleFieldChange = (setter: (value: string) => void, value: string) => {
    setter(value)
    setHasChanges(true)
  }

  const handleExperienceChange = (exp: Experience) => {
    setExperience(exp)
    setHasChanges(true)
  }

  // Count encounters by experience
  const goodCount = encounters.filter(e => e.experience === 'good').length
  const badCount = encounters.filter(e => e.experience === 'bad').length
  const neutralCount = encounters.filter(e => e.experience === 'neutral' || !e.experience).length

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-mono font-bold text-2xl">{plate.code}</h3>
            {plate.name && (
              <p className="text-sm text-base-content/60">{plate.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-base-200 rounded-lg p-2 text-center">
            <div className="text-lg font-bold">{plate.seenCount || 0}</div>
            <div className="text-xs text-base-content/60">Times Seen</div>
          </div>
          <div className="bg-base-200 rounded-lg p-2 text-center">
            <div className="text-lg font-bold">{encounters.length}</div>
            <div className="text-xs text-base-content/60">Encounters</div>
          </div>
          <div className="bg-base-200 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-xs">
              {plate.lastSeen ? formatDate(plate.lastSeen) : 'Never'}
            </div>
            <div className="text-xs text-base-content/60">Last Seen</div>
          </div>
        </div>

        {/* Encounter breakdown */}
        {encounters.length > 0 && (
          <div className="flex gap-2 mb-4">
            <div className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-success"></span>
              <span>{goodCount} good</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-warning"></span>
              <span>{neutralCount} neutral</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-error"></span>
              <span>{badCount} bad</span>
            </div>
          </div>
        )}

        {/* Name */}
        <div className="form-control mb-3">
          <label className="text-xs font-medium text-base-content/60 uppercase mb-1">
            Name / Alias
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleFieldChange(setName, e.target.value)}
            placeholder="e.g., John's truck, Suspicious van"
            className="input input-bordered input-sm"
          />
        </div>

        {/* Description */}
        <div className="form-control mb-4">
          <label className="text-xs font-medium text-base-content/60 uppercase mb-1">
            Notes
          </label>
          <textarea
            value={description}
            onChange={(e) => handleFieldChange(setDescription, e.target.value)}
            placeholder="Add notes about this plate..."
            className="textarea textarea-bordered textarea-sm h-20"
          />
        </div>

        {/* Experience */}
        <div className="form-control mb-4">
          <label className="text-xs font-medium text-base-content/60 uppercase mb-2">
            Overall Experience
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleExperienceChange('good')}
              className={`btn btn-sm flex-1 gap-1 ${experience === 'good' ? 'btn-success' : 'btn-outline'}`}
            >
              <span className="w-2 h-2 rounded-full bg-success"></span>
              Good
            </button>
            <button
              onClick={() => handleExperienceChange('neutral')}
              className={`btn btn-sm flex-1 gap-1 ${experience === 'neutral' ? 'btn-warning' : 'btn-outline'}`}
            >
              <span className="w-2 h-2 rounded-full bg-warning"></span>
              Neutral
            </button>
            <button
              onClick={() => handleExperienceChange('bad')}
              className={`btn btn-sm flex-1 gap-1 ${experience === 'bad' ? 'btn-error' : 'btn-outline'}`}
            >
              <span className="w-2 h-2 rounded-full bg-error"></span>
              Bad
            </button>
          </div>
        </div>

        {/* Recent Encounters */}
        <div className="mb-4">
          <label className="text-xs font-medium text-base-content/60 uppercase mb-2 block">
            Recent Encounters
          </label>
          {loadingEncounters ? (
            <div className="flex justify-center py-4">
              <span className="loading loading-spinner loading-sm"></span>
            </div>
          ) : encounters.length === 0 ? (
            <div className="text-sm text-base-content/50 text-center py-4 bg-base-200 rounded-lg">
              No encounters recorded yet
            </div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {encounters.slice(0, 10).map((encounter) => {
                const expColor = encounter.experience === 'good' ? 'bg-success' :
                                 encounter.experience === 'bad' ? 'bg-error' : 'bg-warning'
                return (
                  <div
                    key={encounter.id}
                    onClick={() => onViewEncounter?.(encounter)}
                    className="flex items-center gap-2 p-2 bg-base-200 rounded-lg text-sm cursor-pointer hover:bg-base-300 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full ${expColor} flex-shrink-0`}></span>
                    <div className="flex-1 min-w-0">
                      <span className="text-base-content/70">
                        {formatDate(encounter.timestamp)} at {formatTime(encounter.timestamp)}
                      </span>
                      {encounter.notes && (
                        <p className="text-xs text-base-content/50 truncate">{encounter.notes}</p>
                      )}
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-base-content/40 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                )
              })}
              {encounters.length > 10 && (
                <p className="text-xs text-center text-base-content/50 pt-1">
                  +{encounters.length - 10} more encounters
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sync status */}
        {plate.needsSync && (
          <div className="text-xs mb-4 flex items-center gap-1 text-warning">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            Pending sync
          </div>
        )}

        {/* Actions */}
        <div className="modal-action mt-6">
          <button
            onClick={handleDelete}
            className="btn btn-ghost btn-sm text-error"
          >
            Delete
          </button>
          <div className="flex-1"></div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-sm text-white hover:brightness-110"
            style={{ backgroundColor: '#132F45' }}
          >
            {isSaving ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : hasChanges ? (
              'Save'
            ) : (
              'Done'
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}
