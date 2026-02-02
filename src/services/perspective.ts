/**
 * Perspective correction utilities
 * - Edge detection to find plate corners
 * - Perspective transform to correct skewed images
 */

export interface Point {
  x: number
  y: number
}

export interface Corners {
  topLeft: Point
  topRight: Point
  bottomLeft: Point
  bottomRight: Point
}

/**
 * Apply Sobel edge detection to find edges in the image
 */
function sobelEdgeDetection(
  imageData: ImageData
): {magnitude: Float32Array; direction: Float32Array} {
  const {width, height, data} = imageData
  const grayscale = new Float32Array(width * height)

  // Convert to grayscale
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4
    grayscale[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
  }

  const magnitude = new Float32Array(width * height)
  const direction = new Float32Array(width * height)

  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0
      let gy = 0

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx)
          const kernelIdx = (ky + 1) * 3 + (kx + 1)
          gx += grayscale[idx] * sobelX[kernelIdx]
          gy += grayscale[idx] * sobelY[kernelIdx]
        }
      }

      const idx = y * width + x
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy)
      direction[idx] = Math.atan2(gy, gx)
    }
  }

  return {magnitude, direction}
}

/**
 * Find strong edge points in the image
 */
function findEdgePoints(
  magnitude: Float32Array,
  width: number,
  height: number,
  threshold: number
): Point[] {
  const points: Point[] = []
  const maxMag = Math.max(...magnitude)
  const normalizedThreshold = maxMag * threshold

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (magnitude[y * width + x] > normalizedThreshold) {
        points.push({x, y})
      }
    }
  }

  return points
}

/**
 * Find the convex hull of a set of points using Graham scan
 */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points

  // Find the bottom-most point (or left-most in case of tie)
  let start = points[0]
  for (const p of points) {
    if (p.y > start.y || (p.y === start.y && p.x < start.x)) {
      start = p
    }
  }

  // Sort points by polar angle with respect to start
  const sorted = points
    .filter((p) => p !== start)
    .sort((a, b) => {
      const angleA = Math.atan2(a.y - start.y, a.x - start.x)
      const angleB = Math.atan2(b.y - start.y, b.x - start.x)
      return angleA - angleB
    })

  const hull: Point[] = [start]

  for (const p of sorted) {
    while (hull.length > 1) {
      const top = hull[hull.length - 1]
      const second = hull[hull.length - 2]
      const cross =
        (top.x - second.x) * (p.y - second.y) - (top.y - second.y) * (p.x - second.x)
      if (cross <= 0) {
        hull.pop()
      } else {
        break
      }
    }
    hull.push(p)
  }

  return hull
}

/**
 * Find the 4 corners of a quadrilateral that best fits the edge points
 */
function findQuadCorners(hull: Point[], width: number, height: number): Corners {
  if (hull.length < 4) {
    // Return default corners if not enough points
    return {
      topLeft: {x: width * 0.1, y: height * 0.1},
      topRight: {x: width * 0.9, y: height * 0.1},
      bottomLeft: {x: width * 0.1, y: height * 0.9},
      bottomRight: {x: width * 0.9, y: height * 0.9}
    }
  }

  // Find the 4 extreme points
  const centerX = hull.reduce((sum, p) => sum + p.x, 0) / hull.length
  const centerY = hull.reduce((sum, p) => sum + p.y, 0) / hull.length

  // Score each hull point for each corner position
  let topLeft = hull[0]
  let topRight = hull[0]
  let bottomLeft = hull[0]
  let bottomRight = hull[0]

  let tlScore = Infinity
  let trScore = Infinity
  let blScore = Infinity
  let brScore = Infinity

  for (const p of hull) {
    // Top-left: minimize x + y
    const tlS = p.x + p.y
    if (tlS < tlScore) {
      tlScore = tlS
      topLeft = p
    }

    // Top-right: maximize x, minimize y
    const trS = -p.x + p.y
    if (trS < trScore) {
      trScore = trS
      topRight = p
    }

    // Bottom-left: minimize x, maximize y
    const blS = p.x - p.y
    if (blS < blScore) {
      blScore = blS
      bottomLeft = p
    }

    // Bottom-right: maximize x + y
    const brS = -(p.x + p.y)
    if (brS < brScore) {
      brScore = brS
      bottomRight = p
    }
  }

  return {topLeft, topRight, bottomLeft, bottomRight}
}

/**
 * Automatically detect plate corners using edge detection
 */
export function detectPlateCorners(canvas: HTMLCanvasElement): Corners {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return getDefaultCorners(canvas.width, canvas.height)
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const {magnitude} = sobelEdgeDetection(imageData)

  // Find strong edge points
  const edgePoints = findEdgePoints(magnitude, canvas.width, canvas.height, 0.3)

  if (edgePoints.length < 10) {
    return getDefaultCorners(canvas.width, canvas.height)
  }

  // Sample points to speed up convex hull (max 1000 points)
  const sampledPoints =
    edgePoints.length > 1000
      ? edgePoints.filter((_, i) => i % Math.ceil(edgePoints.length / 1000) === 0)
      : edgePoints

  // Find convex hull
  const hull = convexHull(sampledPoints)

  // Find the 4 corners
  const corners = findQuadCorners(hull, canvas.width, canvas.height)

  return corners
}

/**
 * Get default corners (rectangle with margin)
 */
export function getDefaultCorners(width: number, height: number): Corners {
  const margin = 0.05
  return {
    topLeft: {x: width * margin, y: height * margin},
    topRight: {x: width * (1 - margin), y: height * margin},
    bottomLeft: {x: width * margin, y: height * (1 - margin)},
    bottomRight: {x: width * (1 - margin), y: height * (1 - margin)}
  }
}

/**
 * Calculate INVERSE perspective transform matrix
 * Maps destination rectangle coordinates back to source quadrilateral
 * This is what we need for the pixel-by-pixel sampling approach
 */
function getInversePerspectiveTransform(
  src: Corners,
  dstWidth: number,
  dstHeight: number
): number[] {
  // Source points (the quadrilateral we selected)
  const sx0 = src.topLeft.x,
    sy0 = src.topLeft.y
  const sx1 = src.topRight.x,
    sy1 = src.topRight.y
  const sx2 = src.bottomRight.x,
    sy2 = src.bottomRight.y
  const sx3 = src.bottomLeft.x,
    sy3 = src.bottomLeft.y

  // Destination points (rectangle - where we want to map TO)
  const dx0 = 0,
    dy0 = 0
  const dx1 = dstWidth,
    dy1 = 0
  const dx2 = dstWidth,
    dy2 = dstHeight
  const dx3 = 0,
    dy3 = dstHeight

  // We need the INVERSE transform: given (dx, dy) find (sx, sy)
  // So we solve for H where: src = H * dst
  // This means destination coords go in as "source" and source coords as "target"

  const A = [
    [dx0, dy0, 1, 0, 0, 0, -sx0 * dx0, -sx0 * dy0],
    [0, 0, 0, dx0, dy0, 1, -sy0 * dx0, -sy0 * dy0],
    [dx1, dy1, 1, 0, 0, 0, -sx1 * dx1, -sx1 * dy1],
    [0, 0, 0, dx1, dy1, 1, -sy1 * dx1, -sy1 * dy1],
    [dx2, dy2, 1, 0, 0, 0, -sx2 * dx2, -sx2 * dy2],
    [0, 0, 0, dx2, dy2, 1, -sy2 * dx2, -sy2 * dy2],
    [dx3, dy3, 1, 0, 0, 0, -sx3 * dx3, -sx3 * dy3],
    [0, 0, 0, dx3, dy3, 1, -sy3 * dx3, -sy3 * dy3]
  ]

  const b = [sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3]

  // Solve using Gaussian elimination
  const h = solveLinearSystem(A, b)

  return [...h, 1] // Add h33 = 1
}

/**
 * Solve a system of linear equations using Gaussian elimination
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length
  const augmented = A.map((row, i) => [...row, b[i]])

  // Forward elimination
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row
      }
    }

    // Swap rows
    ;[augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]]

    // Eliminate column
    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col]
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j]
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    x[row] = augmented[row][n]
    for (let col = row + 1; col < n; col++) {
      x[row] -= augmented[row][col] * x[col]
    }
    x[row] /= augmented[row][row]
  }

  return x
}

/**
 * Apply perspective transform to correct a skewed image
 */
export function applyPerspectiveTransform(
  sourceCanvas: HTMLCanvasElement,
  corners: Corners
): HTMLCanvasElement {
  // Calculate output dimensions based on the largest edge
  const topWidth = Math.sqrt(
    Math.pow(corners.topRight.x - corners.topLeft.x, 2) +
      Math.pow(corners.topRight.y - corners.topLeft.y, 2)
  )
  const bottomWidth = Math.sqrt(
    Math.pow(corners.bottomRight.x - corners.bottomLeft.x, 2) +
      Math.pow(corners.bottomRight.y - corners.bottomLeft.y, 2)
  )
  const leftHeight = Math.sqrt(
    Math.pow(corners.bottomLeft.x - corners.topLeft.x, 2) +
      Math.pow(corners.bottomLeft.y - corners.topLeft.y, 2)
  )
  const rightHeight = Math.sqrt(
    Math.pow(corners.bottomRight.x - corners.topRight.x, 2) +
      Math.pow(corners.bottomRight.y - corners.topRight.y, 2)
  )

  const dstWidth = Math.round(Math.max(topWidth, bottomWidth))
  const dstHeight = Math.round(Math.max(leftHeight, rightHeight))

  // Create output canvas
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = dstWidth
  outputCanvas.height = dstHeight

  const outputCtx = outputCanvas.getContext('2d')
  const sourceCtx = sourceCanvas.getContext('2d')

  if (!outputCtx || !sourceCtx) return sourceCanvas

  const sourceData = sourceCtx.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  )
  const outputData = outputCtx.createImageData(dstWidth, dstHeight)

  // Get inverse transform (from destination to source)
  const H = getInversePerspectiveTransform(corners, dstWidth, dstHeight)

  // For each pixel in destination, find corresponding source pixel
  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      // Apply inverse homography
      const w = H[6] * x + H[7] * y + H[8]
      const srcX = (H[0] * x + H[1] * y + H[2]) / w
      const srcY = (H[3] * x + H[4] * y + H[5]) / w

      // Bilinear interpolation
      const x0 = Math.floor(srcX)
      const y0 = Math.floor(srcY)
      const x1 = x0 + 1
      const y1 = y0 + 1

      if (x0 >= 0 && x1 < sourceCanvas.width && y0 >= 0 && y1 < sourceCanvas.height) {
        const dx = srcX - x0
        const dy = srcY - y0

        for (let c = 0; c < 4; c++) {
          const i00 = (y0 * sourceCanvas.width + x0) * 4 + c
          const i10 = (y0 * sourceCanvas.width + x1) * 4 + c
          const i01 = (y1 * sourceCanvas.width + x0) * 4 + c
          const i11 = (y1 * sourceCanvas.width + x1) * 4 + c

          const value =
            sourceData.data[i00] * (1 - dx) * (1 - dy) +
            sourceData.data[i10] * dx * (1 - dy) +
            sourceData.data[i01] * (1 - dx) * dy +
            sourceData.data[i11] * dx * dy

          outputData.data[(y * dstWidth + x) * 4 + c] = Math.round(value)
        }
      }
    }
  }

  outputCtx.putImageData(outputData, 0, 0)

  return outputCanvas
}
