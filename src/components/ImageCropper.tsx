import {useRef, useState, useEffect, useCallback} from 'react'

// ============ DEFAULT CROP AREA SETTINGS ============
// Horizontal margin as percentage (0.05 = 5% margin on each side, so 90% width)
const DEFAULT_HORIZONTAL_MARGIN = 0.05

// Target aspect ratio for the crop box (width / height)
// 3 = wide rectangle good for plate text, 2 = full plate shape
const DEFAULT_ASPECT_RATIO = 3

// Maximum crop height as percentage of image height (0.4 = 40%)
const DEFAULT_MAX_HEIGHT_PERCENT = 0.54
// ====================================================

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

interface Corners {
  topLeft: Point
  topRight: Point
  bottomLeft: Point
  bottomRight: Point
}

interface ImageCropperProps {
  imageDataUrl: string
  onCropComplete: (canvas: HTMLCanvasElement, corners: Corners) => void
  onCancel: () => void
  onPerspective?: (canvas: HTMLCanvasElement, corners: Corners) => void
  /** Override default aspect ratio (width/height). Default is 3 for wide plates, use ~1.2 for more square */
  defaultAspectRatio?: number
  /** Override horizontal margin (0.05 = 5% margin each side = 90% width). Default is 0.05 */
  defaultHorizontalMargin?: number
  /** Override max height as percentage of image (0.8 = 80% height). Default is 0.54 */
  defaultMaxHeightPercent?: number
}

export function ImageCropper({
  imageDataUrl,
  onCropComplete,
  onCancel,
  onPerspective,
  defaultAspectRatio = DEFAULT_ASPECT_RATIO,
  defaultHorizontalMargin = DEFAULT_HORIZONTAL_MARGIN,
  defaultMaxHeightPercent = DEFAULT_MAX_HEIGHT_PERCENT
}: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [displaySize, setDisplaySize] = useState({width: 0, height: 0})
  const [imageNaturalSize, setImageNaturalSize] = useState({
    width: 0,
    height: 0
  })

  // Crop area in display coordinates (relative to displayed image)
  const [cropArea, setCropArea] = useState<CropArea>({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  })

  // Dragging state
  const [isDragging, setIsDragging] = useState(false)
  const [dragType, setDragType] = useState<
    'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null
  >(null)
  const [dragStart, setDragStart] = useState({x: 0, y: 0})
  const [cropStart, setCropStart] = useState<CropArea>({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  })

  // Initialize crop area when image loads
  const handleImageLoad = useCallback(() => {
    const img = imageRef.current
    const container = containerRef.current
    if (!img || !container) return

    const naturalWidth = img.naturalWidth
    const naturalHeight = img.naturalHeight
    setImageNaturalSize({width: naturalWidth, height: naturalHeight})

    // Calculate display size (fit within container)
    const containerRect = container.getBoundingClientRect()
    const maxWidth = containerRect.width
    const maxHeight = containerRect.height

    const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight)
    const displayWidth = naturalWidth * scale
    const displayHeight = naturalHeight * scale

    setDisplaySize({width: displayWidth, height: displayHeight})

    // Initialize crop to a plate-shaped rectangle (wide and short)
    const cropWidth = displayWidth * (1 - defaultHorizontalMargin * 2)
    let cropHeight = cropWidth / defaultAspectRatio

    // Make sure the crop height doesn't exceed max percentage of image height
    const maxCropHeight = displayHeight * defaultMaxHeightPercent
    if (cropHeight > maxCropHeight) {
      cropHeight = maxCropHeight
    }

    // Center the crop area
    const cropX = displayWidth * defaultHorizontalMargin
    const cropY = (displayHeight - cropHeight) / 2

    setCropArea({
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight
    })

    setImageLoaded(true)
  }, [defaultAspectRatio, defaultHorizontalMargin, defaultMaxHeightPercent])

  // Recalculate on resize
  useEffect(() => {
    const handleResize = () => {
      if (imageRef.current && imageLoaded) {
        handleImageLoad()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [imageLoaded, handleImageLoad])

  // Get coordinates from mouse or touch event
  const getEventCoords = (
    e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent
  ) => {
    const container = containerRef.current
    if (!container) return {x: 0, y: 0}

    const rect = container.getBoundingClientRect()
    const offsetX = (rect.width - displaySize.width) / 2
    const offsetY = (rect.height - displaySize.height) / 2

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left - offsetX,
        y: e.touches[0].clientY - rect.top - offsetY
      }
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left - offsetX,
        y: e.clientY - rect.top - offsetY
      }
    }
    return {x: 0, y: 0}
  }

  // Determine what part of crop area was clicked
  const getHitArea = (x: number, y: number): typeof dragType => {
    const handleSize = 30 // Touch-friendly handle size
    const {x: cx, y: cy, width: cw, height: ch} = cropArea

    // Check corners first (larger hit areas)
    if (
      x >= cx - handleSize &&
      x <= cx + handleSize &&
      y >= cy - handleSize &&
      y <= cy + handleSize
    )
      return 'nw'
    if (
      x >= cx + cw - handleSize &&
      x <= cx + cw + handleSize &&
      y >= cy - handleSize &&
      y <= cy + handleSize
    )
      return 'ne'
    if (
      x >= cx - handleSize &&
      x <= cx + handleSize &&
      y >= cy + ch - handleSize &&
      y <= cy + ch + handleSize
    )
      return 'sw'
    if (
      x >= cx + cw - handleSize &&
      x <= cx + cw + handleSize &&
      y >= cy + ch - handleSize &&
      y <= cy + ch + handleSize
    )
      return 'se'

    // Check edges
    if (x >= cx && x <= cx + cw && y >= cy - handleSize && y <= cy + handleSize)
      return 'n'
    if (
      x >= cx &&
      x <= cx + cw &&
      y >= cy + ch - handleSize &&
      y <= cy + ch + handleSize
    )
      return 's'
    if (x >= cx - handleSize && x <= cx + handleSize && y >= cy && y <= cy + ch)
      return 'w'
    if (
      x >= cx + cw - handleSize &&
      x <= cx + cw + handleSize &&
      y >= cy &&
      y <= cy + ch
    )
      return 'e'

    // Check inside crop area
    if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) return 'move'

    return null
  }

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const coords = getEventCoords(e)
    const hitArea = getHitArea(coords.x, coords.y)

    if (hitArea) {
      setIsDragging(true)
      setDragType(hitArea)
      setDragStart(coords)
      setCropStart({...cropArea})
    }
  }

  const handleMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !dragType) return

      const coords = getEventCoords(e)
      const dx = coords.x - dragStart.x
      const dy = coords.y - dragStart.y

      const minSize = 50 // Minimum crop size

      let newCrop = {...cropStart}

      switch (dragType) {
        case 'move':
          newCrop.x = Math.max(
            0,
            Math.min(displaySize.width - cropStart.width, cropStart.x + dx)
          )
          newCrop.y = Math.max(
            0,
            Math.min(displaySize.height - cropStart.height, cropStart.y + dy)
          )
          break
        case 'nw':
          newCrop.x = Math.max(
            0,
            Math.min(cropStart.x + cropStart.width - minSize, cropStart.x + dx)
          )
          newCrop.y = Math.max(
            0,
            Math.min(cropStart.y + cropStart.height - minSize, cropStart.y + dy)
          )
          newCrop.width = cropStart.width - (newCrop.x - cropStart.x)
          newCrop.height = cropStart.height - (newCrop.y - cropStart.y)
          break
        case 'ne':
          newCrop.y = Math.max(
            0,
            Math.min(cropStart.y + cropStart.height - minSize, cropStart.y + dy)
          )
          newCrop.width = Math.max(
            minSize,
            Math.min(displaySize.width - cropStart.x, cropStart.width + dx)
          )
          newCrop.height = cropStart.height - (newCrop.y - cropStart.y)
          break
        case 'sw':
          newCrop.x = Math.max(
            0,
            Math.min(cropStart.x + cropStart.width - minSize, cropStart.x + dx)
          )
          newCrop.width = cropStart.width - (newCrop.x - cropStart.x)
          newCrop.height = Math.max(
            minSize,
            Math.min(displaySize.height - cropStart.y, cropStart.height + dy)
          )
          break
        case 'se':
          newCrop.width = Math.max(
            minSize,
            Math.min(displaySize.width - cropStart.x, cropStart.width + dx)
          )
          newCrop.height = Math.max(
            minSize,
            Math.min(displaySize.height - cropStart.y, cropStart.height + dy)
          )
          break
        case 'n':
          newCrop.y = Math.max(
            0,
            Math.min(cropStart.y + cropStart.height - minSize, cropStart.y + dy)
          )
          newCrop.height = cropStart.height - (newCrop.y - cropStart.y)
          break
        case 's':
          newCrop.height = Math.max(
            minSize,
            Math.min(displaySize.height - cropStart.y, cropStart.height + dy)
          )
          break
        case 'w':
          newCrop.x = Math.max(
            0,
            Math.min(cropStart.x + cropStart.width - minSize, cropStart.x + dx)
          )
          newCrop.width = cropStart.width - (newCrop.x - cropStart.x)
          break
        case 'e':
          newCrop.width = Math.max(
            minSize,
            Math.min(displaySize.width - cropStart.x, cropStart.width + dx)
          )
          break
      }

      setCropArea(newCrop)
    },
    [isDragging, dragType, dragStart, cropStart, displaySize]
  )

  const handleEnd = useCallback(() => {
    setIsDragging(false)
    setDragType(null)
  }, [])

  // Global mouse/touch event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleEnd)
      window.addEventListener('touchmove', handleMove, {passive: false})
      window.addEventListener('touchend', handleEnd)

      return () => {
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleEnd)
        window.removeEventListener('touchmove', handleMove)
        window.removeEventListener('touchend', handleEnd)
      }
    }
  }, [isDragging, handleMove, handleEnd])

  // Apply crop and return canvas
  const handleCropConfirm = () => {
    const img = imageRef.current
    if (!img || !imageLoaded) return

    // Convert display coordinates to natural image coordinates
    const scaleX = imageNaturalSize.width / displaySize.width
    const scaleY = imageNaturalSize.height / displaySize.height

    const naturalCrop = {
      x: Math.round(cropArea.x * scaleX),
      y: Math.round(cropArea.y * scaleY),
      width: Math.round(cropArea.width * scaleX),
      height: Math.round(cropArea.height * scaleY)
    }

    // Create cropped canvas
    const canvas = document.createElement('canvas')
    canvas.width = naturalCrop.width
    canvas.height = naturalCrop.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(
      img,
      naturalCrop.x,
      naturalCrop.y,
      naturalCrop.width,
      naturalCrop.height,
      0,
      0,
      naturalCrop.width,
      naturalCrop.height
    )

    // Convert crop rectangle to corners (in the cropped image's coordinate space)
    // Add 7% margin so corners are easier to grab in perspective tool
    const marginX = naturalCrop.width * 0.07
    const marginY = naturalCrop.height * 0.07
    const corners: Corners = {
      topLeft: {x: marginX, y: marginY},
      topRight: {x: naturalCrop.width - marginX, y: marginY},
      bottomLeft: {x: marginX, y: naturalCrop.height - marginY},
      bottomRight: {x: naturalCrop.width - marginX, y: naturalCrop.height - marginY}
    }

    onCropComplete(canvas, corners)
  }

  // Apply crop and go to perspective correction
  const handlePerspective = () => {
    if (!onPerspective) return
    const img = imageRef.current
    if (!img || !imageLoaded) return

    const scaleX = imageNaturalSize.width / displaySize.width
    const scaleY = imageNaturalSize.height / displaySize.height

    const naturalCrop = {
      x: Math.round(cropArea.x * scaleX),
      y: Math.round(cropArea.y * scaleY),
      width: Math.round(cropArea.width * scaleX),
      height: Math.round(cropArea.height * scaleY)
    }

    const canvas = document.createElement('canvas')
    canvas.width = naturalCrop.width
    canvas.height = naturalCrop.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(
      img,
      naturalCrop.x,
      naturalCrop.y,
      naturalCrop.width,
      naturalCrop.height,
      0,
      0,
      naturalCrop.width,
      naturalCrop.height
    )

    // Convert crop rectangle to corners (in the cropped image's coordinate space)
    // Add 7% margin so corners are easier to grab in perspective tool
    const marginX = naturalCrop.width * 0.07
    const marginY = naturalCrop.height * 0.07
    const corners: Corners = {
      topLeft: {x: marginX, y: marginY},
      topRight: {x: naturalCrop.width - marginX, y: marginY},
      bottomLeft: {x: marginX, y: naturalCrop.height - marginY},
      bottomRight: {x: naturalCrop.width - marginX, y: naturalCrop.height - marginY}
    }

    onPerspective(canvas, corners)
  }

  // Calculate offset to center image in container
  const offsetX =
    (containerRef.current?.getBoundingClientRect().width ||
      0 - displaySize.width) / 2
  const offsetY =
    (containerRef.current?.getBoundingClientRect().height ||
      0 - displaySize.height) / 2

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-md">
      <p className="text-sm text-base-content/60">Drag to adjust crop area</p>

      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] bg-base-300 rounded-lg overflow-hidden touch-none select-none"
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        <img
          ref={imageRef}
          src={imageDataUrl}
          alt="Crop preview"
          onLoad={handleImageLoad}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-full max-h-full"
          style={{
            width: displaySize.width || 'auto',
            height: displaySize.height || 'auto'
          }}
          draggable={false}
        />

        {imageLoaded && (
          <>
            {/* Dark overlay outside crop area */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: `calc(50% - ${displaySize.width / 2}px)`,
                top: `calc(50% - ${displaySize.height / 2}px)`,
                width: displaySize.width,
                height: displaySize.height
              }}
            >
              {/* Top overlay */}
              <div
                className="absolute bg-black/50"
                style={{
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: cropArea.y
                }}
              />
              {/* Bottom overlay */}
              <div
                className="absolute bg-black/50"
                style={{
                  left: 0,
                  top: cropArea.y + cropArea.height,
                  width: '100%',
                  height: displaySize.height - cropArea.y - cropArea.height
                }}
              />
              {/* Left overlay */}
              <div
                className="absolute bg-black/50"
                style={{
                  left: 0,
                  top: cropArea.y,
                  width: cropArea.x,
                  height: cropArea.height
                }}
              />
              {/* Right overlay */}
              <div
                className="absolute bg-black/50"
                style={{
                  left: cropArea.x + cropArea.width,
                  top: cropArea.y,
                  width: displaySize.width - cropArea.x - cropArea.width,
                  height: cropArea.height
                }}
              />
            </div>

            {/* Crop border and handles */}
            <div
              className="absolute border-2 border-white pointer-events-none"
              style={{
                left: `calc(50% - ${displaySize.width / 2}px + ${cropArea.x}px)`,
                top: `calc(50% - ${displaySize.height / 2}px + ${cropArea.y}px)`,
                width: cropArea.width,
                height: cropArea.height
              }}
            >
              {/* Grid lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="border border-white/30" />
                ))}
              </div>

              {/* Corner handles */}
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-white rounded-sm" />
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-sm" />
              <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white rounded-sm" />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white rounded-sm" />

              {/* Edge handles */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-white rounded-sm" />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-white rounded-sm" />
              <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-8 bg-white rounded-sm" />
              <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-8 bg-white rounded-sm" />
            </div>
          </>
        )}
      </div>

      {/* Perspective button */}
      {onPerspective && (
        <button
          onClick={handlePerspective}
          disabled={!imageLoaded}
          className="btn btn-ghost w-full min-h-[44px]"
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
          Fix Skewed Angle
        </button>
      )}

      <div className="flex gap-2 w-full">
        <button onClick={onCancel} className="btn btn-outline btn-lg flex-1 min-h-[56px]">
          Cancel
        </button>
        <button
          onClick={handleCropConfirm}
          disabled={!imageLoaded}
          className="btn btn-lg flex-1 min-h-[56px] text-white hover:brightness-110 active:brightness-95 disabled:opacity-50"
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
              d="m4.5 12.75 6 6 9-13.5"
            />
          </svg>
          Crop & Scan
        </button>
      </div>
    </div>
  )
}
