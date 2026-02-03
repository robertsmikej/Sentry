import {useState, useEffect, useCallback} from 'react'
import {Camera} from './Camera'
import {ImageUpload} from './ImageUpload'
import {ImageCropper} from './ImageCropper'
import {PerspectiveCropper} from './PerspectiveCropper'
import {ResultCard} from './ResultCard'
import {useOCR} from '../hooks/useOCR'
import {useLookup} from '../hooks/useLookup'
import {useHistory} from '../hooks/useHistory'
import {useVibration} from '../hooks/useVibration'
import {getRecognitionSettings} from '../services/ocr'
import {getSettings, addEncounter, getEncounter, updateEncounter} from '../services/storage'
import {getCurrentLocation} from '../services/location'
import {syncEncountersToSheet} from '../services/encounterSync'
import type {LookupEntry, Experience, Encounter} from '../types'
import type {Corners} from '../services/perspective'

// Generate a simple UUID
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Set to true to show the preprocessed OCR image below results for debugging
const SHOW_DEBUG_PREPROCESSED_IMAGE = true

// Default input mode: 'camera' or 'upload'
const DEFAULT_INPUT_MODE: InputMode = 'upload'

// Whether to auto-start the camera when camera mode is active
// Set to false to require user to manually start camera (saves battery/privacy)
const CAMERA_AUTO_START = false

type InputMode = 'camera' | 'upload'
type ScanState =
  | 'idle'
  | 'preview' // New: preview image before sending to Gemini
  | 'cropping'
  | 'perspective'
  | 'processing'
  | 'result'

interface ScanResult {
  extractedText: string
  normalizedText: string
  confidence: number
  matched: boolean
  matchedEntry?: LookupEntry
}

export function Scanner() {
  const [inputMode, setInputMode] = useState<InputMode>(DEFAULT_INPUT_MODE)
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [preprocessedImage, setPreprocessedImage] = useState<string | null>(
    null
  )
  // Store the cropped image before perspective transform so user can re-adjust
  const [prePerspectiveImage, setPrePerspectiveImage] = useState<string | null>(
    null
  )
  // Store the last used corner positions for re-adjustment
  const [lastUsedCorners, setLastUsedCorners] = useState<Corners | null>(null)

  // Editable fields for inline editing on result card
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editExperience, setEditExperience] = useState<Experience>('neutral')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Current encounter ID for updating notes/tags
  const [currentEncounterId, setCurrentEncounterId] = useState<string | null>(null)

  // Display settings
  const [showEditFields, setShowEditFields] = useState(false)

  // Load display settings on mount
  useEffect(() => {
    getSettings().then((settings) => {
      if (settings?.showEditFields !== undefined) {
        setShowEditFields(settings.showEditFields)
      }
    })
  }, [])

  const {isProcessing, progress, processImage, usedFallback} = useOCR()
  const {lookup, upsertPlate, incrementSeen} = useLookup()
  const {addEntry} = useHistory()
  const {vibrateSuccess, vibrateError, vibrate} = useVibration()

  // Helper to create an encounter for a scan result
  const createEncounter = useCallback(async (
    plateCode: string,
    scanId?: string,
    experience?: Experience
  ): Promise<string | null> => {
    try {
      // Get location if enabled (opt-in)
      const location = await getCurrentLocation()

      const encounterId = generateId()
      const encounter: Encounter = {
        id: encounterId,
        plateCode: plateCode.toUpperCase().replace(/[^A-Z0-9]/g, '').trim(),
        timestamp: new Date(),
        experience: experience || 'neutral',
        location: location ?? undefined,
        scanId,
        needsSync: true,
      }

      await addEncounter(encounter)
      setCurrentEncounterId(encounterId)
      console.log('[Scanner] Created encounter:', encounterId, 'for plate:', plateCode)

      // Trigger immediate sync to Google Sheets
      const settings = await getSettings()
      if (settings?.writeUrl && navigator.onLine) {
        syncEncountersToSheet(settings.writeUrl)
          .then(result => {
            if (result.success && result.count > 0) {
              console.log('[Scanner] Immediate sync: pushed', result.count, 'encounter(s)')
            }
          })
          .catch(err => console.warn('[Scanner] Immediate sync failed:', err))
      }

      return encounterId
    } catch (error) {
      console.error('[Scanner] Failed to create encounter:', error)
      return null
    }
  }, [])

  // Handler to update encounter with notes/tags from ResultCard
  const handleEncounterUpdate = useCallback(async (notes: string, tags: string[]) => {
    if (!currentEncounterId) {
      console.warn('[Scanner] No current encounter to update')
      return
    }

    try {
      const encounter = await getEncounter(currentEncounterId)
      if (!encounter) {
        console.warn('[Scanner] Encounter not found:', currentEncounterId)
        return
      }

      await updateEncounter({
        ...encounter,
        notes,
        tags,
      })
      console.log('[Scanner] Updated encounter:', currentEncounterId, 'with notes/tags')
    } catch (error) {
      console.error('[Scanner] Failed to update encounter:', error)
    }
  }, [currentEncounterId])

  // Called when camera captures or image is uploaded
  const handleImageCaptured = async (canvas: HTMLCanvasElement) => {
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(imageDataUrl)
    setPrePerspectiveImage(imageDataUrl) // Store original for re-adjustment

    // Check if using Gemini
    const recognitionSettings = getRecognitionSettings()
    if (
      recognitionSettings.method === 'gemini' &&
      recognitionSettings.geminiApiKey
    ) {
      // Check if auto-scan is enabled
      if (recognitionSettings.geminiAutoScan) {
        // Auto-scan: go directly to processing
        setScanState('processing')
        const ocrResult = await processImage(imageDataUrl)
        if (ocrResult) {
          if (ocrResult.preprocessedImageUrl) {
            setPreprocessedImage(ocrResult.preprocessedImageUrl)
          }
          let matchedEntry = await lookup(ocrResult.normalized)
          const matched = !!matchedEntry
          if (matched && matchedEntry) {
            matchedEntry = (await incrementSeen(matchedEntry.code)) || matchedEntry
          }
          const scanResult: ScanResult = {
            extractedText: ocrResult.raw,
            normalizedText: ocrResult.normalized,
            confidence: ocrResult.confidence,
            matched,
            matchedEntry
          }
          setResult(scanResult)
          // Initialize edit fields from matched entry or empty
          setEditName(matchedEntry?.name || '')
          setEditDescription(matchedEntry?.description || '')
          setEditExperience(matchedEntry?.experience || 'neutral')
          setScanState('result')
          if (matched) {
            if (matchedEntry?.experience === 'bad') {
              vibrate([100, 50, 100, 50, 100])
            } else {
              vibrateSuccess()
            }
          } else {
            vibrateError()
          }
          await addEntry({
            extractedText: ocrResult.raw,
            normalizedText: ocrResult.normalized,
            matched,
            matchedEntry,
            imageDataUrl
          })
          // Auto-create encounter for this scan
          await createEncounter(ocrResult.normalized, undefined, matchedEntry?.experience || 'neutral')
        } else {
          setScanState('idle')
        }
        return
      }
      // No auto-scan: go to preview state so user can see image before scanning
      setScanState('preview')
      return
    }

    // For local OCR, go to perspective correction mode
    setScanState('perspective')
  }

  // Process the current captured image with Gemini (called from preview screen)
  const handleScanWithGemini = async () => {
    if (!capturedImage) return

    setScanState('processing')

    const ocrResult = await processImage(capturedImage)

    if (ocrResult) {
      if (ocrResult.preprocessedImageUrl) {
        setPreprocessedImage(ocrResult.preprocessedImageUrl)
      }

      let matchedEntry = await lookup(ocrResult.normalized)
      const matched = !!matchedEntry

      if (matched && matchedEntry) {
        matchedEntry = (await incrementSeen(matchedEntry.code)) || matchedEntry
      }

      const scanResult: ScanResult = {
        extractedText: ocrResult.raw,
        normalizedText: ocrResult.normalized,
        confidence: ocrResult.confidence,
        matched,
        matchedEntry
      }

      setResult(scanResult)
      // Initialize edit fields from matched entry or empty
      setEditName(matchedEntry?.name || '')
      setEditDescription(matchedEntry?.description || '')
      setEditExperience(matchedEntry?.experience || 'neutral')
      setScanState('result')

      if (matched) {
        if (matchedEntry?.experience === 'bad') {
          vibrate([100, 50, 100, 50, 100])
        } else {
          vibrateSuccess()
        }
      } else {
        vibrateError()
      }

      await addEntry({
        extractedText: ocrResult.raw,
        normalizedText: ocrResult.normalized,
        matched,
        matchedEntry,
        imageDataUrl: capturedImage
      })
      // Auto-create encounter for this scan
      await createEncounter(ocrResult.normalized, undefined, matchedEntry?.experience || 'neutral')
    } else {
      setScanState('idle')
    }
  }

  // Go to simple crop tool from preview (for Gemini users who want to crop first)
  const handleCropFromPreview = () => {
    setScanState('cropping')
  }

  // Cancel from preview screen
  const handlePreviewCancel = () => {
    setScanState('idle')
    setCapturedImage(null)
    setPrePerspectiveImage(null)
  }

  // Called when user confirms crop - process the cropped image
  const handleCropComplete = async (canvas: HTMLCanvasElement) => {
    setScanState('processing')
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedImage(imageDataUrl) // Update to cropped version

    const ocrResult = await processImage(canvas)

    if (ocrResult) {
      // Store preprocessed image for debugging
      if (ocrResult.preprocessedImageUrl) {
        setPreprocessedImage(ocrResult.preprocessedImageUrl)
      }

      let matchedEntry = await lookup(ocrResult.normalized)
      const matched = !!matchedEntry

      // Auto-increment seen count for known plates
      if (matched && matchedEntry) {
        matchedEntry = (await incrementSeen(matchedEntry.code)) || matchedEntry
      }

      const scanResult: ScanResult = {
        extractedText: ocrResult.raw,
        normalizedText: ocrResult.normalized,
        confidence: ocrResult.confidence,
        matched,
        matchedEntry
      }

      setResult(scanResult)
      setScanState('result')

      // Haptic feedback based on experience
      if (matched) {
        if (matchedEntry?.experience === 'bad') {
          vibrate([100, 50, 100, 50, 100]) // Warning pattern
        } else {
          vibrateSuccess()
        }
      } else {
        vibrateError()
      }

      // Save to history
      await addEntry({
        extractedText: ocrResult.raw,
        normalizedText: ocrResult.normalized,
        matched,
        matchedEntry,
        imageDataUrl
      })
      // Auto-create encounter for this scan
      await createEncounter(ocrResult.normalized, undefined, matchedEntry?.experience || 'neutral')
    } else {
      setScanState('idle')
    }
  }

  const handleScanAgain = () => {
    setScanState('idle')
    setResult(null)
    setCapturedImage(null)
    setPreprocessedImage(null)
    setPrePerspectiveImage(null)
    setLastUsedCorners(null)
    setCurrentEncounterId(null)
  }

  // Save plate with inline edited values
  const handleSave = async () => {
    if (!result || isSaving) return

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      const entry: LookupEntry = {
        code: result.normalizedText,
        name: editName,
        description: editDescription,
        experience: editExperience,
        seenCount: result.matchedEntry?.seenCount || 1,
        lastSeen: new Date(),
        isLocal: true,
      }

      await upsertPlate(entry)

      if (currentEncounterId) {
        const encounter = await getEncounter(currentEncounterId)
        if (encounter) {
          await updateEncounter({
            ...encounter,
            experience: editExperience
          })
        }
      }

      // Update result with new entry data
      setResult({
        ...result,
        matched: true,
        matchedEntry: entry
      })

      vibrateSuccess()
      setSaveSuccess(true)

      // Clear success after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (error) {
      console.error('Failed to save plate:', error)
      vibrateError()
    } finally {
      setIsSaving(false)
    }
  }

  const handleCropCancel = () => {
    setScanState('idle')
    setCapturedImage(null)
    setPreprocessedImage(null)
  }

  // Go to perspective correction mode with current cropped image
  const handlePerspectiveMode = (canvas: HTMLCanvasElement) => {
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(imageDataUrl)
    setPrePerspectiveImage(imageDataUrl) // Store for re-adjustment
    setScanState('perspective')
  }

  // Go back to perspective mode to re-adjust (from result screen)
  const handleAdjustPerspective = () => {
    if (prePerspectiveImage) {
      setCapturedImage(prePerspectiveImage)
      setScanState('perspective')
    }
  }

  // Called when perspective correction is complete
  const handlePerspectiveComplete = async (
    canvas: HTMLCanvasElement,
    corners: Corners
  ) => {
    // Store the corners used so we can restore them on re-adjustment
    setLastUsedCorners(corners)
    setScanState('processing')
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedImage(imageDataUrl)

    const ocrResult = await processImage(canvas)

    if (ocrResult) {
      if (ocrResult.preprocessedImageUrl) {
        setPreprocessedImage(ocrResult.preprocessedImageUrl)
      }

      let matchedEntry = await lookup(ocrResult.normalized)
      const matched = !!matchedEntry

      if (matched && matchedEntry) {
        matchedEntry = (await incrementSeen(matchedEntry.code)) || matchedEntry
      }

      const scanResult: ScanResult = {
        extractedText: ocrResult.raw,
        normalizedText: ocrResult.normalized,
        confidence: ocrResult.confidence,
        matched,
        matchedEntry
      }

      setResult(scanResult)
      // Initialize edit fields from matched entry or empty
      setEditName(matchedEntry?.name || '')
      setEditDescription(matchedEntry?.description || '')
      setEditExperience(matchedEntry?.experience || 'neutral')
      setScanState('result')

      if (matched) {
        if (matchedEntry?.experience === 'bad') {
          vibrate([100, 50, 100, 50, 100])
        } else {
          vibrateSuccess()
        }
      } else {
        vibrateError()
      }

      await addEntry({
        extractedText: ocrResult.raw,
        normalizedText: ocrResult.normalized,
        matched,
        matchedEntry,
        imageDataUrl
      })
      // Auto-create encounter for this scan
      await createEncounter(ocrResult.normalized, undefined, matchedEntry?.experience || 'neutral')
    } else {
      setScanState('idle')
    }
  }

  const handlePerspectiveCancel = () => {
    // Go back to idle state
    setScanState('idle')
    setCapturedImage(null)
    setPrePerspectiveImage(null)
  }

  // Switch from perspective mode to simple crop mode
  const handleSwitchToSimpleCrop = () => {
    setScanState('cropping')
  }

  const handlePlateChange = async (newPlate: string) => {
    if (result) {
      // Check database for match with the new plate number
      const matchedEntry = await lookup(newPlate)
      const matched = !!matchedEntry

      setResult({
        ...result,
        normalizedText: newPlate,
        matched,
        matchedEntry
      })
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 p-2">
      {scanState === 'idle' && (
        <>
          <div className="tabs tabs-boxed bg-base-200 shadow-sm">
            <button
              className={`tab gap-1 ${inputMode === 'camera' ? 'tab-active bg-primary text-primary-content' : ''}`}
              onClick={() => setInputMode('camera')}
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
                  d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                />
              </svg>
              Camera
            </button>
            <button
              className={`tab gap-1 ${inputMode === 'upload' ? 'tab-active bg-primary text-primary-content' : ''}`}
              onClick={() => setInputMode('upload')}
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
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
              Upload
            </button>
          </div>

          {inputMode === 'camera' ? (
            <Camera
              onCapture={handleImageCaptured}
              autoStart={CAMERA_AUTO_START}
            />
          ) : (
            <ImageUpload onImageSelected={handleImageCaptured} />
          )}
        </>
      )}

      {scanState === 'preview' && capturedImage && (
        <div className="flex flex-col items-center gap-2 w-full max-w-md">
          <div className="card bg-base-200/50 border border-base-300 shadow-lg w-full">
            <div className="card-body p-3">
              <h3 className="card-title text-base justify-center">Review Image</h3>
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full rounded-lg shadow-sm border border-base-300"
              />
              <p className="text-sm text-base-content/60 text-center mt-1">
                Ready to scan? Or crop first if the plate is small/far away.
              </p>

              <div className="card-actions flex-col gap-2 mt-2">
                <button
                  onClick={handleScanWithGemini}
                  className="btn btn-primary btn-lg w-full min-h-[56px]"
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
                      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
                    />
                  </svg>
                  Scan with AI
                </button>
                <button
                  onClick={handleCropFromPreview}
                  className="btn btn-outline btn-lg w-full min-h-[56px]"
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
                  Crop First
                </button>
                <button
                  onClick={handlePreviewCancel}
                  className="btn btn-ghost w-full min-h-[48px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {scanState === 'cropping' && capturedImage && (
        <ImageCropper
          imageDataUrl={capturedImage}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          onPerspective={handlePerspectiveMode}
          // Use more square crop for Gemini (user is isolating the plate area)
          defaultAspectRatio={
            getRecognitionSettings().method === 'gemini' ? 1.5 : undefined
          }
        />
      )}

      {scanState === 'perspective' && capturedImage && (
        <PerspectiveCropper
          imageDataUrl={capturedImage}
          onComplete={handlePerspectiveComplete}
          onCancel={handlePerspectiveCancel}
          onSimpleCrop={handleSwitchToSimpleCrop}
          initialCorners={lastUsedCorners ?? undefined}
        />
      )}

      {scanState === 'processing' && (
        <div className="flex flex-col items-center gap-2 p-2 w-full max-w-md">
          <div className="card bg-base-200/50 border border-base-300 shadow-lg w-full">
            <div className="card-body p-4 items-center">
              {capturedImage && (
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full rounded-lg opacity-60 mb-4"
                />
              )}
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="text-base-content/70 font-medium mt-2">
                Analyzing plate...
              </p>
              {isProcessing && progress > 0 && (
                <progress
                  className="progress progress-primary w-full mt-2"
                  value={progress * 100}
                  max="100"
                ></progress>
              )}
            </div>
          </div>
        </div>
      )}

      {scanState === 'result' && result && (
        <>
          <ResultCard
            normalizedText={result.normalizedText}
            matched={result.matched}
            matchedEntry={result.matchedEntry}
            name={editName}
            description={editDescription}
            experience={editExperience}
            onNameChange={setEditName}
            onDescriptionChange={setEditDescription}
            onExperienceChange={setEditExperience}
            onScanAgain={handleScanAgain}
            onSave={handleSave}
            onPlateChange={handlePlateChange}
            onAdjustPerspective={
              prePerspectiveImage ? handleAdjustPerspective : undefined
            }
            isSaving={isSaving}
            saveSuccess={saveSuccess}
            showEditFields={showEditFields}
            onEncounterUpdate={handleEncounterUpdate}
          />

          {/* Offline fallback warning */}
          {usedFallback && (
            <div className="alert alert-warning w-full max-w-md text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>You're offline. Used local OCR instead of Gemini AI.</span>
            </div>
          )}

          {/* Debug images container */}
          {(capturedImage ||
            (SHOW_DEBUG_PREPROCESSED_IMAGE && preprocessedImage)) && (
            <div className="w-full max-w-md bg-base-200/50 rounded-lg p-2 flex flex-col gap-2 border border-base-300 shadow-sm">
              {capturedImage && (
                <div>
                  <p className="text-xs text-base-content/50 mb-2 text-center font-medium">
                    Scanned Image
                  </p>
                  <img
                    src={capturedImage}
                    alt="Cropped plate"
                    className="w-full rounded-lg shadow-sm border border-base-300"
                  />
                </div>
              )}

              {SHOW_DEBUG_PREPROCESSED_IMAGE && preprocessedImage && (
                <div>
                  <p className="text-xs text-base-content/50 mb-2 text-center font-medium">
                    Preprocessed OCR Image (debug)
                  </p>
                  <img
                    src={preprocessedImage}
                    alt="Preprocessed for OCR"
                    className="w-full rounded-lg shadow-sm border border-base-300"
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

    </div>
  )
}
