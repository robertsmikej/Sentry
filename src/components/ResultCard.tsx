import { useState } from 'react'
import type {LookupEntry, Experience} from '../types'
import { DEFAULT_ENCOUNTER_TAGS } from '../types'

interface ResultCardProps {
  normalizedText: string
  matched: boolean
  matchedEntry?: LookupEntry
  // Editable fields
  name: string
  description: string
  experience: Experience
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  onExperienceChange: (experience: Experience) => void
  // Actions
  onScanAgain: () => void
  onSave: () => void
  onPlateChange?: (newPlate: string) => void
  onAdjustPerspective?: () => void
  // Save state
  isSaving?: boolean
  saveSuccess?: boolean
  // Display options
  showEditFields?: boolean
  // Encounter tracking
  onEncounterUpdate?: (notes: string, tags: string[]) => void
}

// Large glanceable banner - visible from peripheral vision
function GlanceableBanner({
  matched,
  matchedEntry,
  normalizedText
}: {
  matched: boolean
  matchedEntry?: LookupEntry
  normalizedText: string
}) {
  // Determine status type
  const isNew = !matched
  const isGood = matched && matchedEntry?.experience === 'good'

  // Get banner colors and content
  const getBannerConfig = () => {
    if (isNew) {
      return {
        bgClass: 'bg-info',
        textClass: 'text-info-content',
        iconClass: 'w-20 h-20',
        titleClass: 'text-4xl',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ),
        title: 'NEW PLATE',
        subtitle: 'Not in database'
      }
    }
    if (isGood) {
      return {
        bgClass: 'bg-success',
        textClass: 'text-success-content',
        iconClass: 'w-20 h-20',
        titleClass: 'text-4xl',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
          </svg>
        ),
        title: 'GOOD',
        subtitle: 'Positive experience recorded'
      }
    }
    // Bad or neutral - show warning
    return {
      bgClass: 'bg-error',
      textClass: 'text-error-content',
      iconClass: 'w-16 h-16',
      titleClass: 'text-3xl',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      ),
      title: 'AVOID',
      subtitle: matchedEntry?.experience === 'bad' ? 'Bad experience recorded' : 'In your watch list'
    }
  }

  const config = getBannerConfig()

  return (
    <div className={`${config.bgClass} ${config.textClass} -mx-4 -mt-4 mb-4 py-6 px-4`}>
      {/* Large centered icon and status */}
      <div className="flex flex-col items-center text-center">
        {/* Big icon */}
        <div className={`mb-2 ${config.iconClass}`}>
          {config.icon}
        </div>

        {/* Large status text */}
        <h2 className={`${config.titleClass} font-black tracking-wide mb-1`}>
          {config.title}
        </h2>

        {/* Plate number - very prominent */}
        <div className="text-3xl font-mono font-bold tracking-widest my-2 px-4 py-2 bg-black/20 rounded-lg">
          {normalizedText || '---'}
        </div>

        {/* Subtitle */}
        <p className="text-lg opacity-90">
          {config.subtitle}
        </p>

        {/* Seen count for matches */}
        {matched && matchedEntry && (
          <div className="flex gap-4 mt-2 text-sm opacity-80">
            <span>Seen {matchedEntry.seenCount || 1}x</span>
            {matchedEntry.lastSeen && (
              <span>Last: {new Date(matchedEntry.lastSeen).toLocaleDateString()}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ResultCard({
  normalizedText,
  matched,
  matchedEntry,
  name,
  description,
  experience,
  onNameChange,
  onDescriptionChange,
  onExperienceChange,
  onScanAgain,
  onSave,
  onPlateChange,
  onAdjustPerspective,
  isSaving = false,
  saveSuccess = false,
  showEditFields = false,
  onEncounterUpdate
}: ResultCardProps) {
  // Encounter notes/tags state
  const [encounterNotes, setEncounterNotes] = useState('')
  const [encounterTags, setEncounterTags] = useState<string[]>([])
  const [showEncounterForm, setShowEncounterForm] = useState(false)
  const [encounterSaved, setEncounterSaved] = useState(false)

  const handlePlateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Normalize input: uppercase and alphanumeric only
    const normalized = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    onPlateChange?.(normalized)
  }

  // Determine card border color based on match status and experience
  const getBorderClass = () => {
    if (!matched) return 'border-info' // New plates: blue
    if (matchedEntry?.experience === 'good') return 'border-success' // Good experience: green
    return 'border-error' // Bad/neutral: red
  }

  return (
    <div className={`card w-full max-w-md shadow-xl overflow-hidden border-4 ${getBorderClass()}`}>
      <div className="card-body p-4">
        {/* Large Glanceable Banner - visible from peripheral vision */}
        <GlanceableBanner
          matched={matched}
          matchedEntry={matchedEntry}
          normalizedText={normalizedText}
        />

        {/* Editable plate number input - smaller, for corrections */}
        <div className="mb-2">
          <label className="label py-1">
            <span className="label-text text-sm">Edit plate number if needed:</span>
          </label>
          <input
            type="text"
            value={normalizedText}
            onChange={handlePlateInputChange}
            placeholder="Enter plate number"
            className="input input-bordered font-mono text-4xl font-black tracking-widest text-center w-full focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-base-100"
          />
        </div>

        {/* Editable fields section - only shown if enabled in settings */}
        {showEditFields && (
          <div className="bg-base-100/80 rounded-lg p-3 mb-3 shadow-sm border border-base-300 space-y-3">
            {/* Name field */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-sm">Name / Label</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g., Blue Honda Civic"
                className="input input-bordered input-sm"
              />
            </div>

            {/* Description field */}
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-sm">Notes</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="Any notes..."
                className="textarea textarea-bordered textarea-sm h-16 resize-none w-full"
              />
            </div>

            {/* Experience buttons */}
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-sm">Experience (optional)</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onExperienceChange(experience === 'good' ? 'neutral' : 'good')
                  }
                  className={`btn flex-1 gap-2 ${
                    experience === 'good' ? 'btn-success' : 'btn-outline btn-sm'
                  }`}
                >
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
                      d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z"
                    />
                  </svg>
                  Good
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onExperienceChange(experience === 'bad' ? 'neutral' : 'bad')
                  }
                  className={`btn flex-1 gap-2 ${
                    experience === 'bad' ? 'btn-error' : 'btn-outline btn-sm'
                  }`}
                >
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
                      d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.01.05.027.1.05.148.593 1.2.925 2.55.925 3.977 0 1.487-.36 2.89-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54"
                    />
                  </svg>
                  Bad
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Encounter notes/tags (collapsible) */}
        {onEncounterUpdate && (
          <div className="mt-2">
            <button
              onClick={() => setShowEncounterForm(!showEncounterForm)}
              className="btn btn-ghost btn-sm w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                {encounterSaved ? 'Encounter logged' : 'Add encounter details'}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 transition-transform ${showEncounterForm ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {showEncounterForm && (
              <div className="bg-base-100/80 rounded-lg p-3 mt-2 shadow-sm border border-base-300 space-y-3">
                {/* Notes */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Notes about this encounter</span>
                  </label>
                  <textarea
                    value={encounterNotes}
                    onChange={(e) => setEncounterNotes(e.target.value)}
                    placeholder="What happened? Where were you?"
                    className="textarea textarea-bordered textarea-sm h-16 resize-none w-full"
                  />
                </div>

                {/* Quick tags */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Tags</span>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {DEFAULT_ENCOUNTER_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (encounterTags.includes(tag)) {
                            setEncounterTags(encounterTags.filter(t => t !== tag))
                          } else {
                            setEncounterTags([...encounterTags, tag])
                          }
                        }}
                        className={`badge badge-sm cursor-pointer ${
                          encounterTags.includes(tag) ? 'badge-primary' : 'badge-outline'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save encounter details button */}
                <button
                  onClick={() => {
                    onEncounterUpdate(encounterNotes, encounterTags)
                    setEncounterSaved(true)
                    setShowEncounterForm(false)
                  }}
                  className="btn btn-sm btn-outline w-full"
                >
                  {encounterSaved ? 'Update encounter' : 'Save encounter details'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="card-actions flex-col gap-3">
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`btn btn-lg w-full min-h-[56px] ${
              saveSuccess ? 'btn-success' : 'btn-primary'
            }`}
          >
            {isSaving ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
                Saved!
              </>
            ) : (
              <>
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
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
                Save
              </>
            )}
          </button>
          <button
            onClick={onScanAgain}
            className="btn btn-outline btn-lg w-full min-h-[56px]"
          >
            Start Over
          </button>
          {onAdjustPerspective && (
            <button
              onClick={onAdjustPerspective}
              className="btn btn-ghost w-full min-h-[48px]"
            >
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
