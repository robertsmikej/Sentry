/**
 * Gemini AI Vision service for license plate recognition
 * Uses the user's own API key to call Google's Gemini API
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent'

/**
 * Rate limiting: minimum time between API requests (in milliseconds)
 * Helps prevent hitting Google's rate limits on free tier
 */
const MIN_REQUEST_INTERVAL_MS = 2000 // 2 seconds between requests
let lastRequestTime = 0

/**
 * Image compression settings for Gemini requests.
 * Smaller images = faster uploads and lower costs.
 */
const DEFAULT_MAX_IMAGE_DIMENSION = 1536 // Default max width or height in pixels
const JPEG_QUALITY = 0.7 // 0-1, lower = smaller file size

/**
 * Prompt sent to Gemini for license plate recognition.
 * Edit this to adjust how Gemini interprets images.
 */
const GEMINI_PROMPT = `Look at this image of a license plate and extract the license plate number/text.

IMPORTANT:
- Return ONLY the license plate characters (letters and numbers)
- Do not include any explanation, punctuation, spaces, or formatting
- If you see multiple plates, return only the most prominent one
- If you cannot clearly read the plate, make your best guess based on what's visible
- Common confusions: 0/O, 1/I/L, 8/B, 5/S, 2/Z - use context to determine the correct character

Example responses:
- ABC1234
- 7XYZ789
- KL55ABC

Your response should be ONLY the plate text, nothing else.`

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
  error?: {
    message: string
    code: number
  }
}

interface RecognitionResult {
  text: string
  confidence: number
}

/**
 * Resize and compress a canvas to reduce file size for API requests.
 * Returns base64 string (without data URL prefix).
 */
function compressCanvas(canvas: HTMLCanvasElement, maxDimension: number = DEFAULT_MAX_IMAGE_DIMENSION): string {
  const {width, height} = canvas

  // Check if resizing is needed
  if (width <= maxDimension && height <= maxDimension) {
    // No resize needed, just compress
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    return dataUrl.split(',')[1]
  }

  // Calculate new dimensions maintaining aspect ratio
  const scale = Math.min(
    maxDimension / width,
    maxDimension / height
  )
  const newWidth = Math.round(width * scale)
  const newHeight = Math.round(height * scale)

  // Create resized canvas
  const resizedCanvas = document.createElement('canvas')
  resizedCanvas.width = newWidth
  resizedCanvas.height = newHeight

  const ctx = resizedCanvas.getContext('2d')
  if (!ctx) {
    // Fallback: return original compressed
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    return dataUrl.split(',')[1]
  }

  // Use better quality scaling
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, newWidth, newHeight)

  const dataUrl = resizedCanvas.toDataURL('image/jpeg', JPEG_QUALITY)
  console.log(
    `[Gemini] Image resized: ${width}x${height} -> ${newWidth}x${newHeight}`
  )
  return dataUrl.split(',')[1]
}

/**
 * Compress a data URL image by loading it into a canvas and re-encoding.
 * Returns base64 string (without data URL prefix).
 */
async function compressDataUrl(dataUrl: string, maxDimension: number = DEFAULT_MAX_IMAGE_DIMENSION): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        // Fallback: extract base64 from original
        const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
        resolve(match ? match[1] : '')
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(compressCanvas(canvas, maxDimension))
    }
    img.onerror = () =>
      reject(new Error('Failed to load image for compression'))
    img.src = dataUrl
  })
}

/**
 * Recognize license plate text using Gemini Vision API
 */
export async function recognizeWithGemini(
  image: HTMLCanvasElement | string,
  apiKey: string,
  maxImageSize: number = DEFAULT_MAX_IMAGE_DIMENSION
): Promise<RecognitionResult> {
  if (!apiKey) {
    throw new Error('Gemini API key is required')
  }

  // Rate limiting: wait if we've made a request too recently
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS && lastRequestTime > 0) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest
    console.log(
      `[Gemini] Rate limiting: waiting ${waitTime}ms before next request`
    )
    await new Promise((resolve) => setTimeout(resolve, waitTime))
  }
  lastRequestTime = Date.now()

  // Get base64 image data (compressed)
  let base64Image: string
  const mimeType = 'image/jpeg' // Always JPEG after compression

  if (typeof image === 'string') {
    // It's a data URL - compress it
    if (image.startsWith('data:')) {
      base64Image = await compressDataUrl(image, maxImageSize)
    } else {
      throw new Error('Image must be a canvas or data URL')
    }
  } else {
    // It's a canvas - compress it
    base64Image = compressCanvas(image, maxImageSize)
  }

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: GEMINI_PROMPT
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1, // Low temperature for more deterministic output
      maxOutputTokens: 50 // Plate numbers are short
    }
  }

  console.log('[Gemini] Making recognition API call...')
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const geminiError = errorData as GeminiResponse

    // Provide clearer error messages for common issues
    if (response.status === 429) {
      console.error('[Gemini] Rate limited:', geminiError.error?.message)
      // Reset last request time to force longer wait on next attempt
      lastRequestTime = Date.now()
      throw new Error(
        "Rate limit exceeded. Google's free tier has usage limits. Please wait 30-60 seconds and try again."
      )
    }

    const errorMessage =
      geminiError.error?.message || `API request failed: ${response.status}`
    throw new Error(errorMessage)
  }

  const data: GeminiResponse = await response.json()

  // Extract the text from the response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('No text found in Gemini response')
  }

  // Clean up the response - remove any whitespace, newlines, etc.
  const cleanedText = text
    .trim()
    .replace(/\s+/g, '') // Remove all whitespace
    .toUpperCase()

  console.log('[Gemini] Cleaned text:', cleanedText)

  return {
    text: cleanedText,
    confidence: 95 // Gemini doesn't provide confidence, use high default
  }
}

/**
 * Check if a Gemini API key is valid by making a test request
 */
export async function validateGeminiApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.length < 10) {
    console.log('[Gemini] API key too short or empty')
    return false
  }

  // Rate limiting for validation too
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS && lastRequestTime > 0) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest
    console.log(`[Gemini] Rate limiting validation: waiting ${waitTime}ms`)
    await new Promise((resolve) => setTimeout(resolve, waitTime))
  }
  lastRequestTime = Date.now()

  try {
    // Make a simple text-only request to validate the key
    console.log('[Gemini] Validating API key...')
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Say "ok"'
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 5
        }
      })
    })

    console.log('[Gemini] Validation response status:', response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.log(
        '[Gemini] Validation error:',
        JSON.stringify(errorData, null, 2)
      )

      // 429 = rate limited, but the key IS valid
      if (response.status === 429) {
        console.log('[Gemini] Key is valid but rate limited')
        return true
      }
    }

    return response.ok
  } catch (err) {
    console.error('[Gemini] Validation exception:', err)
    return false
  }
}
