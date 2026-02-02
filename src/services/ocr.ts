import Tesseract, {PSM} from 'tesseract.js'
import type {OCRSettings, PSMMode} from '../types'

// Set to true to open processed image in new tab for debugging
const DEBUG_SHOW_PROCESSED_IMAGE_IN_NEW_TAB = false

// Max dimension for resizing - larger images are scaled down
// Set very high to effectively disable resizing
const MAX_IMAGE_DIMENSION = 10000

// Step 2: Convert to grayscale and threshold
const DARK_THRESHOLD = 70

const OCR_SETTINGS_KEY = 'plate-reader-ocr-settings'

export const DEFAULT_OCR_SETTINGS: OCRSettings = {
  psm: '7', // Single uniform block of text
  charWhitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  preprocessImage: true, // Using contrast boost preprocessing
  contrastLevel: 1.5 // Higher contrast to make dark colored text darker
}

export const PSM_DESCRIPTIONS: Record<PSMMode, string> = {
  '0': 'Orientation and script detection only',
  '1': 'Automatic page segmentation with OSD',
  '3': 'Fully automatic page segmentation (default)',
  '4': 'Single column of variable text sizes',
  '6': 'Single uniform block of text',
  '7': 'Single text line',
  '8': 'Single word',
  '9': 'Single word in a circle',
  '10': 'Single character',
  '11': 'Sparse text - find as much as possible',
  '12': 'Sparse text with OSD',
  '13': 'Raw line - single text line, no hacks'
}

export function getOCRSettings(): OCRSettings {
  try {
    const stored = localStorage.getItem(OCR_SETTINGS_KEY)
    if (stored) {
      return {...DEFAULT_OCR_SETTINGS, ...JSON.parse(stored)}
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_OCR_SETTINGS
}

export function saveOCRSettings(settings: OCRSettings): void {
  localStorage.setItem(OCR_SETTINGS_KEY, JSON.stringify(settings))
}

/**
 * Resize image if it exceeds max dimension (for faster OCR)
 */
function resizeImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const {width, height} = canvas

  // Check if resizing is needed
  if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
    return canvas
  }

  // Calculate new dimensions maintaining aspect ratio
  const scale = Math.min(
    MAX_IMAGE_DIMENSION / width,
    MAX_IMAGE_DIMENSION / height
  )
  const newWidth = Math.round(width * scale)
  const newHeight = Math.round(height * scale)

  const resizedCanvas = document.createElement('canvas')
  resizedCanvas.width = newWidth
  resizedCanvas.height = newHeight

  const ctx = resizedCanvas.getContext('2d')
  if (!ctx) return canvas

  // Use better quality scaling
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, newWidth, newHeight)

  return resizedCanvas
}
/**
 * Preprocess image for better OCR results
 * - Boost contrast to make dark colors darker
 * - Convert to grayscale with threshold
 */
function preprocessImage(
  canvas: HTMLCanvasElement,
  contrastLevel: number
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  // Step 1: Boost contrast - this makes dark blues/grays become darker
  const contrast = contrastLevel // 1.5 default, higher = more contrast
  const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100))

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128))
    data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128))
    data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128))
  }

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const value = gray < DARK_THRESHOLD ? 0 : 255

    data[i] = value // R
    data[i + 1] = value // G
    data[i + 2] = value // B
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Apply morphological erosion - a pixel is only kept if all neighbors are also set
 * This thins lines and breaks weak connections
 */
function applyErosion(
  binary: boolean[],
  width: number,
  height: number
): boolean[] {
  const result: boolean[] = new Array(binary.length).fill(false)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x

      // Check 3x3 neighborhood - pixel survives only if center and most neighbors are set
      // Using a less aggressive erosion (5 out of 9 neighbors)
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (binary[(y + dy) * width + (x + dx)]) {
            count++
          }
        }
      }

      // Keep pixel if it's set and has strong support from neighbors
      result[idx] = binary[idx] && count >= 5
    }
  }

  return result
}

interface RecognitionResult {
  text: string
  confidence: number
  preprocessedImageUrl?: string
}

interface PlateCandidate {
  text: string
  confidence: number
  score: number
  bbox: {x0: number; y0: number; x1: number; y1: number}
  source: 'word' | 'line'
}

/**
 * Score a text region for how "plate-like" it is
 */
function scorePlateCandidate(
  text: string,
  confidence: number,
  bbox: {x0: number; y0: number; x1: number; y1: number}
): number {
  let score = 0

  // Clean the text for analysis
  const cleaned = text.replace(/[^A-Z0-9]/gi, '').toUpperCase()

  // Length score: plates are typically 4-9 characters
  if (cleaned.length >= 4 && cleaned.length <= 9) {
    score += 30
  } else if (cleaned.length >= 3 && cleaned.length <= 11) {
    score += 15
  } else if (cleaned.length < 2 || cleaned.length > 12) {
    score -= 20 // Penalize very short or very long
  }

  // Alphanumeric ratio: plates are mostly alphanumeric
  const alphanumericRatio = cleaned.length / Math.max(text.length, 1)
  score += alphanumericRatio * 20

  // Has both letters and numbers (common for plates)
  const hasLetters = /[A-Z]/.test(cleaned)
  const hasNumbers = /[0-9]/.test(cleaned)
  if (hasLetters && hasNumbers) {
    score += 25
  }

  // Aspect ratio: plates are wide rectangles (roughly 2:1 to 5:1)
  const width = bbox.x1 - bbox.x0
  const height = bbox.y1 - bbox.y0
  const aspectRatio = width / Math.max(height, 1)
  if (aspectRatio >= 2 && aspectRatio <= 5) {
    score += 20
  } else if (aspectRatio >= 1.5 && aspectRatio <= 6) {
    score += 10
  }

  // Height bonus: larger text (taller bbox) is more likely to be the main plate number
  // This helps filter out smaller text like state names, slogans, etc.
  // Scale: every 10px of height adds 1 point, capped at 50 points
  const heightBonus = Math.min(height * 0.5, 50)
  score += heightBonus

  // Confidence bonus
  score += confidence * 0.2

  return score
}

/**
 * Recognize text from an image using Tesseract.js
 */
export async function recognizeText(
  image: HTMLCanvasElement | string,
  onProgress?: (progress: number) => void
): Promise<RecognitionResult> {
  const settings = getOCRSettings()

  // Resize and preprocess if we have a canvas
  let processedImage: HTMLCanvasElement | string = image
  let preprocessedImageUrl: string | undefined

  if (image instanceof HTMLCanvasElement) {
    // First resize for faster processing
    let canvas = resizeImage(image)

    // Then apply preprocessing if enabled
    if (settings.preprocessImage) {
      canvas = preprocessImage(canvas, settings.contrastLevel)
    }

    processedImage = canvas

    // Capture preprocessed image as data URL for debugging display
    preprocessedImageUrl = canvas.toDataURL('image/png')

    // Open processed image in new tab for debugging
    if (DEBUG_SHOW_PROCESSED_IMAGE_IN_NEW_TAB) {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank')
        }
      }, 'image/png')
    }
  }

  // Create worker with OCR settings
  const worker = await Tesseract.createWorker('eng', undefined, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(m.progress)
      }
    }
  })

  // Apply OCR settings from user preferences
  await worker.setParameters({
    tessedit_pageseg_mode: parseInt(settings.psm, 10) as unknown as PSM,
    ...(settings.charWhitelist && {
      tessedit_char_whitelist: settings.charWhitelist
    })
  })

  // Request detailed output with blocks/words/lines
  const result = await worker.recognize(
    processedImage,
    {},
    {
      text: true,
      blocks: true,
      hocr: false,
      tsv: false
    }
  )
  await worker.terminate()

  // Collect all candidates from words and lines
  const candidates: PlateCandidate[] = []

  // Cast to any to access nested structure (types are incomplete)
  const data = result.data as {
    text: string
    confidence: number
    symbols?: Array<{
      text: string
      confidence: number
      bbox: {x0: number; y0: number; x1: number; y1: number}
    }>
    blocks?: Array<{
      text: string
      confidence: number
      bbox: {x0: number; y0: number; x1: number; y1: number}
      paragraphs?: Array<{
        lines?: Array<{
          text: string
          confidence: number
          bbox: {x0: number; y0: number; x1: number; y1: number}
          words?: Array<{
            text: string
            confidence: number
            bbox: {x0: number; y0: number; x1: number; y1: number}
            symbols?: Array<{
              text: string
              confidence: number
              bbox: {x0: number; y0: number; x1: number; y1: number}
            }>
          }>
        }>
      }>
    }>
  }

  // Extract words and lines from nested structure
  const words: Array<{
    text: string
    confidence: number
    bbox: {x0: number; y0: number; x1: number; y1: number}
  }> = []
  const lines: Array<{
    text: string
    confidence: number
    bbox: {x0: number; y0: number; x1: number; y1: number}
  }> = []
  const allSymbols: Array<{
    text: string
    confidence: number
    bbox: {x0: number; y0: number; x1: number; y1: number}
  }> = []

  if (data.blocks) {
    for (const block of data.blocks) {
      if (block.paragraphs) {
        for (const para of block.paragraphs) {
          if (para.lines) {
            for (const line of para.lines) {
              lines.push({
                text: line.text,
                confidence: line.confidence,
                bbox: line.bbox
              })
              if (line.words) {
                for (const word of line.words) {
                  words.push({
                    text: word.text,
                    confidence: word.confidence,
                    bbox: word.bbox
                  })
                  // Extract individual symbols/characters
                  if (word.symbols) {
                    for (const sym of word.symbols) {
                      allSymbols.push({
                        text: sym.text,
                        confidence: sym.confidence,
                        bbox: sym.bbox
                      })
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Process words
  for (const word of words) {
    const text = word.text.trim()
    if (text.length < 2) continue // Skip single chars

    const bbox = word.bbox
    const score = scorePlateCandidate(text, word.confidence, bbox)

    candidates.push({
      text,
      confidence: word.confidence,
      score,
      bbox,
      source: 'word'
    })
  }

  // Process lines (might capture full plate if words are fragmented)
  for (const line of lines) {
    const text = line.text.trim()
    if (text.length < 3) continue

    const bbox = line.bbox
    const score = scorePlateCandidate(text, line.confidence, bbox)

    candidates.push({
      text,
      confidence: line.confidence,
      score,
      bbox,
      source: 'line'
    })
  }

  // Sort by score and pick the best
  candidates.sort((a, b) => b.score - a.score)

  // Use the best candidate, or fall back to full text
  const best = candidates[0]
  if (best && best.score > 30) {
    return {
      text: best.text,
      confidence: best.confidence,
      preprocessedImageUrl
    }
  }

  return {
    text: result.data.text.trim(),
    confidence: result.data.confidence,
    preprocessedImageUrl
  }
}

/**
 * Normalize OCR text for consistent matching
 * - Converts to uppercase
 * - Removes non-alphanumeric characters
 * - Trims whitespace
 */
export function normalizeOCRText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}
