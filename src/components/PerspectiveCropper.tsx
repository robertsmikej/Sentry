import {useRef, useState, useEffect, useCallback} from 'react'
import {
  detectPlateCorners,
  applyPerspectiveTransform,
  getDefaultCorners,
  type Corners,
  type Point
} from '../services/perspective'

interface PerspectiveCropperProps {
  imageDataUrl: string
  onComplete: (canvas: HTMLCanvasElement, corners: Corners) => void
  onCancel: () => void
  onSimpleCrop?: () => void
  initialCorners?: Corners
}

type CornerKey = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

export function PerspectiveCropper({
  imageDataUrl,
  onComplete,
  onCancel,
  onSimpleCrop,
  initialCorners
}: PerspectiveCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [displaySize, setDisplaySize] = useState({width: 0, height: 0})
  const [imageNaturalSize, setImageNaturalSize] = useState({width: 0, height: 0})
  const [containerHeight, setContainerHeight] = useState(300) // Dynamic height based on image
  const [isDetecting, setIsDetecting] = useState(false)

  // Corners in display coordinates
  const [corners, setCorners] = useState<Corners>({
    topLeft: {x: 0, y: 0},
    topRight: {x: 0, y: 0},
    bottomLeft: {x: 0, y: 0},
    bottomRight: {x: 0, y: 0}
  })

  // Dragging state
  const [draggingCorner, setDraggingCorner] = useState<CornerKey | null>(null)

  // Scale factors for converting between display and natural coordinates
  const getScale = useCallback(() => {
    if (displaySize.width === 0 || imageNaturalSize.width === 0) {
      return {x: 1, y: 1}
    }
    return {
      x: imageNaturalSize.width / displaySize.width,
      y: imageNaturalSize.height / displaySize.height
    }
  }, [displaySize, imageNaturalSize])

  // Initialize and detect corners when image loads
  const handleImageLoad = useCallback(async () => {
    const img = imageRef.current
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!img || !container || !canvas) return

    const naturalWidth = img.naturalWidth
    const naturalHeight = img.naturalHeight
    setImageNaturalSize({width: naturalWidth, height: naturalHeight})

    // Calculate display size based on container width and image aspect ratio
    const containerRect = container.getBoundingClientRect()
    const maxWidth = containerRect.width
    const maxHeight = window.innerHeight * 0.6 // Max 60% of viewport height

    // Calculate what height would be needed to fit the full image width
    const imageAspectRatio = naturalHeight / naturalWidth
    let displayWidth = maxWidth
    let displayHeight = maxWidth * imageAspectRatio

    // If too tall, scale down to fit max height
    if (displayHeight > maxHeight) {
      displayHeight = maxHeight
      displayWidth = maxHeight / imageAspectRatio
    }

    setDisplaySize({width: displayWidth, height: displayHeight})
    setContainerHeight(displayHeight)

    // Calculate scale for coordinate conversion
    const scale = naturalWidth / displayWidth

    // Draw image to hidden canvas for edge detection
    canvas.width = naturalWidth
    canvas.height = naturalHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0)
    }

    // If we have initial corners (from previous adjustment), use those
    if (initialCorners) {
      // Convert from natural to display coordinates
      setCorners({
        topLeft: {
          x: initialCorners.topLeft.x / scale,
          y: initialCorners.topLeft.y / scale
        },
        topRight: {
          x: initialCorners.topRight.x / scale,
          y: initialCorners.topRight.y / scale
        },
        bottomLeft: {
          x: initialCorners.bottomLeft.x / scale,
          y: initialCorners.bottomLeft.y / scale
        },
        bottomRight: {
          x: initialCorners.bottomRight.x / scale,
          y: initialCorners.bottomRight.y / scale
        }
      })
      setImageLoaded(true)
      return
    }

    // Set default corners first (in display coordinates)
    const defaultCorners = getDefaultCorners(displayWidth, displayHeight)
    setCorners(defaultCorners)
    setImageLoaded(true)

    // Then try to auto-detect
    setIsDetecting(true)
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const detectedCorners = detectPlateCorners(canvas)
        // Convert from natural to display coordinates
        setCorners({
          topLeft: {
            x: detectedCorners.topLeft.x / scale,
            y: detectedCorners.topLeft.y / scale
          },
          topRight: {
            x: detectedCorners.topRight.x / scale,
            y: detectedCorners.topRight.y / scale
          },
          bottomLeft: {
            x: detectedCorners.bottomLeft.x / scale,
            y: detectedCorners.bottomLeft.y / scale
          },
          bottomRight: {
            x: detectedCorners.bottomRight.x / scale,
            y: detectedCorners.bottomRight.y / scale
          }
        })
      } catch (err) {
        console.error('Edge detection failed:', err)
      }
      setIsDetecting(false)
    }, 100)
  }, [initialCorners])

  // Get event coordinates relative to image
  const getEventCoords = useCallback(
    (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point => {
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
    },
    [displaySize]
  )

  // Find which corner is closest to the touch point
  const findClosestCorner = useCallback(
    (point: Point): CornerKey | null => {
      const threshold = 40 // Touch target size

      const distances: {key: CornerKey; dist: number}[] = [
        {
          key: 'topLeft',
          dist: Math.hypot(point.x - corners.topLeft.x, point.y - corners.topLeft.y)
        },
        {
          key: 'topRight',
          dist: Math.hypot(point.x - corners.topRight.x, point.y - corners.topRight.y)
        },
        {
          key: 'bottomLeft',
          dist: Math.hypot(
            point.x - corners.bottomLeft.x,
            point.y - corners.bottomLeft.y
          )
        },
        {
          key: 'bottomRight',
          dist: Math.hypot(
            point.x - corners.bottomRight.x,
            point.y - corners.bottomRight.y
          )
        }
      ]

      distances.sort((a, b) => a.dist - b.dist)

      if (distances[0].dist < threshold) {
        return distances[0].key
      }

      return null
    },
    [corners]
  )

  // Handle drag start
  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      const coords = getEventCoords(e)
      const corner = findClosestCorner(coords)
      if (corner) {
        setDraggingCorner(corner)
      }
    },
    [getEventCoords, findClosestCorner]
  )

  // Handle drag move
  const handleMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!draggingCorner) return

      const coords = getEventCoords(e)

      // Clamp to image bounds
      const clampedX = Math.max(0, Math.min(displaySize.width, coords.x))
      const clampedY = Math.max(0, Math.min(displaySize.height, coords.y))

      setCorners((prev) => ({
        ...prev,
        [draggingCorner]: {x: clampedX, y: clampedY}
      }))
    },
    [draggingCorner, displaySize, getEventCoords]
  )

  // Handle drag end
  const handleEnd = useCallback(() => {
    setDraggingCorner(null)
  }, [])

  // Global event listeners for dragging
  useEffect(() => {
    if (draggingCorner) {
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
  }, [draggingCorner, handleMove, handleEnd])

  // Apply perspective transform and complete
  const handleConfirm = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scale = getScale()

    // Convert display corners to natural image coordinates
    const naturalCorners: Corners = {
      topLeft: {x: corners.topLeft.x * scale.x, y: corners.topLeft.y * scale.y},
      topRight: {x: corners.topRight.x * scale.x, y: corners.topRight.y * scale.y},
      bottomLeft: {
        x: corners.bottomLeft.x * scale.x,
        y: corners.bottomLeft.y * scale.y
      },
      bottomRight: {
        x: corners.bottomRight.x * scale.x,
        y: corners.bottomRight.y * scale.y
      }
    }

    const correctedCanvas = applyPerspectiveTransform(canvas, naturalCorners)
    // Pass back the natural corners so they can be restored on re-adjustment
    onComplete(correctedCanvas, naturalCorners)
  }

  // Reset to default corners
  const handleReset = () => {
    const defaultCorners = getDefaultCorners(displaySize.width, displaySize.height)
    setCorners(defaultCorners)
  }

  // Re-detect corners
  const handleRedetect = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsDetecting(true)
    setTimeout(() => {
      try {
        const scale =
          displaySize.width > 0 ? imageNaturalSize.width / displaySize.width : 1
        const detectedCorners = detectPlateCorners(canvas)
        setCorners({
          topLeft: {
            x: detectedCorners.topLeft.x / scale,
            y: detectedCorners.topLeft.y / scale
          },
          topRight: {
            x: detectedCorners.topRight.x / scale,
            y: detectedCorners.topRight.y / scale
          },
          bottomLeft: {
            x: detectedCorners.bottomLeft.x / scale,
            y: detectedCorners.bottomLeft.y / scale
          },
          bottomRight: {
            x: detectedCorners.bottomRight.x / scale,
            y: detectedCorners.bottomRight.y / scale
          }
        })
      } catch (err) {
        console.error('Edge detection failed:', err)
      }
      setIsDetecting(false)
    }, 100)
  }

  // Render a corner handle
  const renderCornerHandle = (key: CornerKey) => {
    const point = corners[key]
    const isActive = draggingCorner === key

    return (
      <div
        key={key}
        className={`absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 ${
          isActive ? 'scale-125' : ''
        } transition-transform`}
        style={{
          left: `calc(50% - ${displaySize.width / 2}px + ${point.x}px)`,
          top: `calc(50% - ${displaySize.height / 2}px + ${point.y}px)`,
          backgroundColor: 'rgba(59, 130, 246, 0.25)', // Blue at 25% opacity
          borderColor: 'rgba(59, 130, 246, 0.8)', // Blue at 80% opacity
          boxShadow: '0 0 0 2px white, 0 2px 8px rgba(0,0,0,0.5)'
        }}
      />
    )
  }

  // Draw the quadrilateral outline
  const renderQuadOutline = () => {
    const offsetX = `calc(50% - ${displaySize.width / 2}px)`
    const offsetY = `calc(50% - ${displaySize.height / 2}px)`

    const points = [
      corners.topLeft,
      corners.topRight,
      corners.bottomRight,
      corners.bottomLeft
    ]

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')
      + ' Z'

    return (
      <svg
        className="absolute pointer-events-none"
        style={{
          left: offsetX,
          top: offsetY,
          width: displaySize.width,
          height: displaySize.height
        }}
      >
        <path
          d={pathD}
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d={pathD}
          fill="none"
          stroke="rgba(59, 130, 246, 0.8)"
          strokeWidth="2"
          strokeDasharray="8 4"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-md">
      <div className="text-center">
        <p className="text-sm text-base-content/60">
          Drag corners to match plate edges
        </p>
        {isDetecting && (
          <p className="text-xs text-primary animate-pulse">Detecting edges...</p>
        )}
      </div>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      <div
        ref={containerRef}
        className="relative w-full bg-base-300 rounded-lg overflow-hidden touch-none select-none cursor-crosshair"
        style={{ height: containerHeight > 0 ? containerHeight : 300 }}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        <img
          ref={imageRef}
          src={imageDataUrl}
          alt="Perspective correction preview"
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
            {/* Semi-transparent overlay outside the quad */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'rgba(0,0,0,0.4)'
              }}
            />

            {/* Quad outline */}
            {renderQuadOutline()}

            {/* Corner handles */}
            {renderCornerHandle('topLeft')}
            {renderCornerHandle('topRight')}
            {renderCornerHandle('bottomLeft')}
            {renderCornerHandle('bottomRight')}
          </>
        )}
      </div>

      {/* Tool buttons */}
      <div className="flex gap-2 w-full">
        <button
          onClick={handleRedetect}
          disabled={!imageLoaded || isDetecting}
          className="btn btn-ghost flex-1 min-h-[44px]"
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
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          Re-detect
        </button>
        <button
          onClick={handleReset}
          disabled={!imageLoaded}
          className="btn btn-ghost flex-1 min-h-[44px]"
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
              d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"
            />
          </svg>
          Reset
        </button>
        {onSimpleCrop && (
          <button
            onClick={onSimpleCrop}
            disabled={!imageLoaded}
            className="btn btn-ghost flex-1 min-h-[44px]"
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
                d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5"
              />
            </svg>
            Simple Crop
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 w-full">
        <button onClick={onCancel} className="btn btn-outline btn-lg flex-1 min-h-[56px]">
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!imageLoaded || isDetecting}
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
          Apply & Scan
        </button>
      </div>
    </div>
  )
}
