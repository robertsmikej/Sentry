import { useState, useEffect } from 'react'
import { updateEncounter } from '../services/storage'
import { formatLocation, getGoogleMapsUrl } from '../services/location'
import { EncounterMap } from './EncounterMap'
import type { Encounter, Experience } from '../types'

interface EncounterDetailModalProps {
  encounter: Encounter | null
  plateName?: string
  plateExperience?: Experience
  onClose: () => void
  onUpdate?: () => void
  onDelete?: (id: string) => void
}

export function EncounterDetailModal({
  encounter,
  plateName,
  plateExperience,
  onClose,
  onUpdate,
  onDelete
}: EncounterDetailModalProps) {
  const [notes, setNotes] = useState('')
  const [experience, setExperience] = useState<Experience>('neutral')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form when encounter changes
  useEffect(() => {
    if (encounter) {
      setNotes(encounter.notes || '')
      setExperience(encounter.experience || plateExperience || 'neutral')
      setHasChanges(false)
    }
  }, [encounter, plateExperience])

  if (!encounter) return null

  const formatDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
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
      await updateEncounter({
        ...encounter,
        notes: notes.trim() || undefined,
        experience,
        needsSync: true
      })
      onUpdate?.()
      onClose()
    } catch (error) {
      console.error('Failed to update encounter:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (confirm('Delete this encounter?')) {
      onDelete?.(encounter.id)
      onClose()
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

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-mono font-bold text-2xl">{encounter.plateCode}</h3>
            {plateName && (
              <p className="text-sm text-base-content/60">{plateName}</p>
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

        {/* Date & Time */}
        <div className="bg-base-200 rounded-lg p-3 mb-4">
          <div className="text-sm font-medium">{formatDate(encounter.timestamp)}</div>
          <div className="text-sm text-base-content/60">{formatTime(encounter.timestamp)}</div>
        </div>

        {/* Location with Map */}
        {encounter.location && (
          <div className="mb-4">
            <label className="text-xs font-medium text-base-content/60 uppercase mb-2 block">
              Location
            </label>
            <EncounterMap
              encounters={[encounter]}
              height="150px"
              className="mb-2"
            />
            <a
              href={getGoogleMapsUrl(encounter.location)}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary text-sm"
            >
              {formatLocation(encounter.location)} →
            </a>
          </div>
        )}

        {/* Experience */}
        <div className="form-control mb-4">
          <label className="text-xs font-medium text-base-content/60 uppercase mb-2">
            Experience
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

        {/* Notes */}
        <div className="form-control mb-4">
          <label className="text-xs font-medium text-base-content/60 uppercase mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => handleFieldChange(setNotes, e.target.value)}
            placeholder="Add notes about this encounter..."
            className="textarea textarea-bordered textarea-sm h-24"
          />
        </div>

        {/* Tags */}
        {encounter.tags && encounter.tags.length > 0 && (
          <div className="mb-4">
            <label className="text-xs font-medium text-base-content/60 uppercase mb-1 block">
              Tags
            </label>
            <div className="flex flex-wrap gap-1">
              {encounter.tags.map((tag) => (
                <span key={tag} className="badge badge-sm badge-outline">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sync status */}
        <div className={`text-xs mb-4 flex items-center gap-1 ${encounter.needsSync ? 'text-warning' : 'text-success'}`}>
          {encounter.needsSync ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              Pending sync
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Synced
            </>
          )}
        </div>

        {/* Actions */}
        <div className="modal-action mt-6">
          {onDelete && (
            <button
              onClick={handleDelete}
              className="btn btn-ghost btn-sm text-error"
            >
              Delete
            </button>
          )}
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
