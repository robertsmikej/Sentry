import {useState, useEffect, useCallback, useRef} from 'react'
import {ImageCropper} from './ImageCropper'
import {PerspectiveCropper} from './PerspectiveCropper'
import {ResultCard} from './ResultCard'
import {useOCR} from '../hooks/useOCR'
import {useLookup} from '../hooks/useLookup'
import {useHistory} from '../hooks/useHistory'
import {useVibration} from '../hooks/useVibration'
import {getSettings, addEncounter, getEncounter, updateEncounter, getAllEncounters} from '../services/storage'
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

// Read a file as a data URL
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// Convert an image data URL to a canvas
function imageToCanvas(imageDataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to create canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0)
      resolve(canvas)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = imageDataUrl
  })
}

// Set to true to show the preprocessed OCR image below results for debugging
const SHOW_DEBUG_PREPROCESSED_IMAGE = true

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

interface ScannerProps {
  startWithManualEntry?: boolean;
  onManualEntryHandled?: () => void;
  startWithCamera?: boolean;
  onCameraHandled?: () => void;
}

// Detect if device likely has a camera (mobile/tablet)
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches)
}

export function Scanner({ startWithManualEntry, onManualEntryHandled, startWithCamera, onCameraHandled }: ScannerProps = {}) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [isMobile] = useState(() => isMobileDevice())
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
  const [isRemoving, setIsRemoving] = useState(false)

  // Current encounter ID for updating notes/experience
  const [currentEncounterId, setCurrentEncounterId] = useState<string | null>(null)

  // Display settings
  const [showEditFields, setShowEditFields] = useState(false)

  // Recent encounters for quick-view (enriched with lookup info)
  const [recentEncounters, setRecentEncounters] = useState<(Encounter & { isKnown?: boolean; dbExperience?: Experience })[]>([])

  // Load display settings on mount
  useEffect(() => {
    getSettings().then((settings) => {
      if (settings?.showEditFields !== undefined) {
        setShowEditFields(settings.showEditFields)
      }
    })
  }, [])

  // Handle external trigger for manual entry (from Dashboard)
  useEffect(() => {
    if (startWithManualEntry && scanState === 'idle') {
      // Create an empty result for manual entry
      const scanResult: ScanResult = {
        extractedText: '',
        normalizedText: '',
        confidence: 100,
        matched: false,
        matchedEntry: undefined
      }
      setResult(scanResult)
      setCurrentEncounterId(null)
      setCapturedImage(null)
      setPreprocessedImage(null)
      setEditName('')
      setEditDescription('')
      setEditExperience('neutral')
      setScanState('result')
      onManualEntryHandled?.()
    }
  }, [startWithManualEntry, scanState, onManualEntryHandled])

  // Handle external trigger for camera (from Dashboard on mobile)
  // Use a ref to prevent React Strict Mode from firing this twice
  const cameraTriggeredRef = useRef(false)
  useEffect(() => {
    if (startWithCamera && scanState === 'idle' && !cameraTriggeredRef.current) {
      cameraTriggeredRef.current = true
      // Small delay to ensure the input is ready
      setTimeout(() => {
        // Use guarded open to prevent double-triggers
        if (!isFilePickerOpenRef.current && !isProcessingFileRef.current) {
          isFilePickerOpenRef.current = true
          cameraInputRef.current?.click()
        }
        onCameraHandled?.()
        // Reset after a delay to allow future triggers
        setTimeout(() => {
          cameraTriggeredRef.current = false
          isFilePickerOpenRef.current = false
        }, 1000)
      }, 100)
    }
  }, [startWithCamera, scanState, onCameraHandled])

  const {isProcessing, progress, processImage, usedFallback} = useOCR()
  const {lookup, upsertPlate, deletePlate, incrementSeen} = useLookup()

  // Load and refresh recent encounters (on mount and when returning to idle)
  useEffect(() => {
    if (scanState === 'idle') {
      // Load encounters and enrich with lookup info
      async function loadRecentEncounters() {
        const encounters = await getAllEncounters()
        const recent = encounters.slice(0, 5)

        // Look up each plate to get match status and database experience
        const enriched = await Promise.all(
          recent.map(async (enc) => {
            const entry = await lookup(enc.plateCode)
            return {
              ...enc,
              isKnown: !!entry,
              dbExperience: entry?.experience
            }
          })
        )

        setRecentEncounters(enriched)
      }
      loadRecentEncounters()
    }
  }, [scanState, lookup])
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

  // Handler for manual plate entry (skip photo)
  const handleManualEntry = useCallback(async () => {
    // Create an empty result for manual entry
    const scanResult: ScanResult = {
      extractedText: '',
      normalizedText: '',
      confidence: 100,
      matched: false,
      matchedEntry: undefined
    }

    setResult(scanResult)
    setCurrentEncounterId(null)
    setCapturedImage(null)
    setPreprocessedImage(null)

    // Initialize edit fields empty
    setEditName('')
    setEditDescription('')
    setEditExperience('neutral')

    // Switch to result view
    setScanState('result')
  }, [])

  // Handler to load a recent encounter for viewing/editing
  const handleRecentEncounterClick = useCallback(async (encounter: Encounter) => {
    // Look up the plate in the database
    const matchedEntry = await lookup(encounter.plateCode)

    // Set the current encounter for editing
    setCurrentEncounterId(encounter.id)

    // Create a result object to display
    const scanResult: ScanResult = {
      extractedText: encounter.plateCode,
      normalizedText: encounter.plateCode,
      confidence: 100,
      matched: !!matchedEntry,
      matchedEntry: matchedEntry || undefined
    }

    setResult(scanResult)

    // Initialize edit fields from matched entry or encounter data
    setEditName(matchedEntry?.name || '')
    setEditDescription(matchedEntry?.description || '')
    setEditExperience(encounter.experience || matchedEntry?.experience || 'neutral')

    // Switch to result view
    setScanState('result')
  }, [lookup])

  // Handler to update encounter with notes/experience from ResultCard
  const handleEncounterUpdate = useCallback(async (notes: string, experience: Experience) => {
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
        experience,
      })
      console.log('[Scanner] Updated encounter:', currentEncounterId, 'with notes/experience')

      // Trigger immediate sync to Google Sheets
      const settings = await getSettings()
      if (settings?.writeUrl && navigator.onLine) {
        syncEncountersToSheet(settings.writeUrl)
          .then(syncResult => {
            if (syncResult.success && syncResult.count > 0) {
              console.log('[Scanner] Immediate sync after update: pushed', syncResult.count, 'encounter(s)')
            }
          })
          .catch(err => console.warn('[Scanner] Immediate sync after update failed:', err))
      }
    } catch (error) {
      console.error('[Scanner] Failed to update encounter:', error)
    }
  }, [currentEncounterId])

  // Track if we're currently processing a file to prevent double-triggers
  const isProcessingFileRef = useRef(false)
  // Track if a file picker is currently open to prevent double-opens
  const isFilePickerOpenRef = useRef(false)

  // Guarded function to open file picker
  const openFilePicker = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    if (isFilePickerOpenRef.current || isProcessingFileRef.current) {
      console.log('[Scanner] File picker already open or processing, ignoring click')
      return
    }
    isFilePickerOpenRef.current = true
    inputRef.current?.click()
    // Reset after a delay (accounts for user dismissing the dialog)
    setTimeout(() => {
      isFilePickerOpenRef.current = false
    }, 1000)
  }

  // Handle native file input (camera or gallery)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    // Reset input immediately so the same file can be selected again
    e.target.value = ''

    if (!file) {
      // User cancelled - reset guards
      isFilePickerOpenRef.current = false
      return
    }

    // Prevent double-processing (some browsers trigger onChange twice)
    if (isProcessingFileRef.current) {
      console.log('[Scanner] Already processing a file, ignoring')
      return
    }
    isProcessingFileRef.current = true

    try {
      const imageDataUrl = await readFileAsDataURL(file)
      const canvas = await imageToCanvas(imageDataUrl)
      handleImageCaptured(canvas)
    } catch (err) {
      console.error('Failed to process image:', err)
    } finally {
      // Reset the guards after processing is complete
      setTimeout(() => {
        isProcessingFileRef.current = false
        isFilePickerOpenRef.current = false
      }, 500)
    }
  }

  // Called when camera captures or image is uploaded
  const handleImageCaptured = async (canvas: HTMLCanvasElement) => {
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(imageDataUrl)
    setPrePerspectiveImage(imageDataUrl) // Store original for re-adjustment

    // Always go to cropping first so user can select the plate area
    setScanState('cropping')
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
  const handleCropComplete = async (canvas: HTMLCanvasElement, corners?: Corners) => {
    setScanState('processing')
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedImage(imageDataUrl) // Update to cropped version
    setPrePerspectiveImage(imageDataUrl) // Store cropped image for perspective adjustment
    // Store the corners so "Adjust Perspective" can use them
    if (corners) {
      setLastUsedCorners(corners)
    }

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
    if (!result || isSaving || !result.normalizedText) return

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
        // Update existing encounter
        const encounter = await getEncounter(currentEncounterId)
        if (encounter) {
          await updateEncounter({
            ...encounter,
            experience: editExperience
          })
        }
      } else {
        // Create encounter for manual entry
        await createEncounter(result.normalizedText, undefined, editExperience)
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

  // Remove plate from watchlist
  const handleRemove = async () => {
    if (!result || isRemoving || !result.normalizedText) return

    setIsRemoving(true)

    try {
      await deletePlate(result.normalizedText)

      // Update result to show as unmatched (removed from watchlist)
      setResult({
        ...result,
        matched: false,
        matchedEntry: undefined
      })

      // Reset edit fields
      setEditName('')
      setEditDescription('')
      setEditExperience('neutral')

      vibrateSuccess()
    } catch (error) {
      console.error('Failed to remove plate:', error)
      vibrateError()
    } finally {
      setIsRemoving(false)
    }
  }

  const handleCropCancel = () => {
    setScanState('idle')
    setCapturedImage(null)
    setPreprocessedImage(null)
  }

  // Go to perspective correction mode with current cropped image
  const handlePerspectiveMode = (canvas: HTMLCanvasElement, corners?: Corners) => {
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(imageDataUrl)
    setPrePerspectiveImage(imageDataUrl) // Store for re-adjustment
    // Store the corners from the crop area so PerspectiveCropper starts with them
    if (corners) {
      setLastUsedCorners(corners)
    }
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
    // If we already have scan results, go back to result screen
    // Otherwise go back to cropping
    if (result) {
      setScanState('result')
    } else if (prePerspectiveImage) {
      setCapturedImage(prePerspectiveImage)
      setScanState('cropping')
    } else {
      setScanState('idle')
      setCapturedImage(null)
    }
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
          {/* Hidden file inputs for native camera */}
          {/* Only use capture="environment" on mobile - it causes double-dialogs on desktop */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            {...(isMobile ? { capture: 'environment' } : {})}
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Big Take Photo Button */}
          <div className="w-full max-w-md">
            <button
              onClick={() => openFilePicker(cameraInputRef)}
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
              {isMobile ? 'Take Photo' : 'Select Photo'}
            </button>
            <p className="text-sm text-base-content/50 text-center mt-2 font-medium">
              Closer and head-on = better reads
            </p>

            {/* Secondary options */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => openFilePicker(galleryInputRef)}
                className="btn btn-outline btn-sm flex-1 gap-2"
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
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
                From Gallery
              </button>
              <button
                onClick={handleManualEntry}
                className="btn btn-outline btn-sm flex-1 gap-2"
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
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Manual Entry
              </button>
            </div>
          </div>

          {/* Recent Plates Quick-View */}
          {recentEncounters.length > 0 && (
            <div className="w-full max-w-md mt-4">
              <h3 className="text-sm font-medium text-base-content/60 mb-2 px-1">Recent Plates</h3>
              <div className="flex flex-col gap-1">
                {recentEncounters.map((encounter) => {
                  // Use database experience if known, otherwise encounter experience
                  const displayExperience = encounter.dbExperience || encounter.experience
                  return (
                    <button
                      key={encounter.id}
                      type="button"
                      onClick={() => handleRecentEncounterClick(encounter)}
                      className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${
                        displayExperience === 'good'
                          ? 'bg-success/10 border-success/30 hover:bg-success/20'
                          : displayExperience === 'bad'
                            ? 'bg-error/10 border-error/30 hover:bg-error/20'
                            : encounter.isKnown
                              ? 'bg-primary/10 border-primary/30 hover:bg-primary/20'
                              : 'bg-base-200 border-base-300 hover:bg-base-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Experience/Known indicator */}
                        <div className={`w-2 h-2 rounded-full ${
                          displayExperience === 'good'
                            ? 'bg-success'
                            : displayExperience === 'bad'
                              ? 'bg-error'
                              : encounter.isKnown
                                ? 'bg-primary'
                                : 'bg-base-content/30'
                        }`} />
                        {/* Plate code */}
                        <span className="font-mono font-bold text-sm tracking-wide">
                          {encounter.plateCode}
                        </span>
                        {/* Known badge */}
                        {encounter.isKnown && (
                          <span className="badge badge-xs badge-error">Known</span>
                        )}
                      </div>
                      {/* Timestamp */}
                      <span className="text-xs text-base-content/50">
                        {new Date(encounter.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
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
                  className="btn btn-lg w-full min-h-[56px] text-white hover:brightness-110 active:brightness-95"
                  style={{backgroundColor: '#132F45'}}
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
          // Large crop area: 90% width, 80% height max
          defaultHorizontalMargin={0.05}
          defaultMaxHeightPercent={0.8}
          // Use more square aspect ratio for plate area
          defaultAspectRatio={1.5}
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
            onRemove={handleRemove}
            isSaving={isSaving}
            saveSuccess={saveSuccess}
            isRemoving={isRemoving}
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
