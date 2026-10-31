// Intelligent Document Edge Detector & Perspective Warper to Standard A4
// Sovereign Family Circle Document Scanner

import { Point2D, QuadCorners, CameraScanOrientation } from '../types/documentScanner';

// Standard A4 dimensions in pixels at 150 DPI (Crisp, fast, balanced)
export const A4_PORTRAIT_WIDTH = 1240;
export const A4_PORTRAIT_HEIGHT = 1754; // 1240 * 1.4142

export const A4_LANDSCAPE_WIDTH = 1754;
export const A4_LANDSCAPE_HEIGHT = 1240;

/**
 * Returns default A4 centered quadrilateral inside a frame of [width, height]
 */
export function getDefaultA4Quad(
  width: number,
  height: number,
  orientation: CameraScanOrientation = 'portrait'
): QuadCorners {
  const isPortrait = orientation === 'portrait';
  const targetRatio = isPortrait ? 1 / 1.4142 : 1.4142; // Width / Height

  let cropW: number;
  let cropH: number;

  const frameRatio = width / height;

  if (frameRatio > targetRatio) {
    // Frame is wider than target
    cropH = height * 0.88;
    cropW = cropH * targetRatio;
  } else {
    // Frame is taller than target
    cropW = width * 0.88;
    cropH = cropW / targetRatio;
  }

  const offsetX = (width - cropW) / 2;
  const offsetY = (height - cropH) / 2;

  return {
    topLeft: { x: Math.round(offsetX), y: Math.round(offsetY) },
    topRight: { x: Math.round(offsetX + cropW), y: Math.round(offsetY) },
    bottomRight: { x: Math.round(offsetX + cropW), y: Math.round(offsetY + cropH) },
    bottomLeft: { x: Math.round(offsetX), y: Math.round(offsetY + cropH) },
  };
}

/**
 * Intelligent Document Edge Detection
 * Downsamples the frame and analyzes contrast/luminance boundaries to find document corners.
 */
export function detectDocumentQuad(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  orientation: CameraScanOrientation = 'portrait'
): QuadCorners {
  const srcWidth = 'videoWidth' in source ? source.videoWidth : source.width;
  const srcHeight = 'videoHeight' in source ? source.videoHeight : source.height;

  if (!srcWidth || !srcHeight) {
    return getDefaultA4Quad(1240, 1754, orientation);
  }

  // Downsample to fast analysis canvas (max 320px) for <15ms execution
  const maxDim = 320;
  const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
  const w = Math.round(srcWidth * scale);
  const h = Math.round(srcHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return getDefaultA4Quad(srcWidth, srcHeight, orientation);

  ctx.drawImage(source, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. Compute grayscale & average brightness
  const gray = new Uint8Array(w * h);
  let totalLuma = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = luma;
    totalLuma += luma;
  }
  const avgLuma = totalLuma / (w * h);

  // 2. Compute edge magnitude (Sobel approximation) & paper mask
  // Paper is typically brighter than background table or has high edge boundaries
  const threshold = Math.max(80, Math.min(210, avgLuma * 1.05));
  const points: Point2D[] = [];

  // Sample grid to find document candidates
  const step = 4;
  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const idx = y * w + x;
      const val = gray[idx];

      // Edge gradient
      const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
      const gy = Math.abs(gray[idx + w] - gray[idx - w]);
      const edge = gx + gy;

      // Candidate if it's paper-like brightness or strong boundary
      if (val > threshold || edge > 45) {
        points.push({ x, y });
      }
    }
  }

  // If insufficient candidate points, return default A4 guide quad
  if (points.length < (w * h) / (step * step * 10)) {
    return getDefaultA4Quad(srcWidth, srcHeight, orientation);
  }

  // 3. Find 4 extremal corners from candidates
  // Top-Left: min(x + y)
  // Top-Right: max(x - y)
  // Bottom-Right: max(x + y)
  // Bottom-Left: min(x - y)
  let tl = points[0];
  let tr = points[0];
  let br = points[0];
  let bl = points[0];

  let minSum = Infinity;
  let maxSum = -Infinity;
  let maxDiff = -Infinity;
  let minDiff = Infinity;

  for (const pt of points) {
    const sum = pt.x + pt.y;
    const diff = pt.x - pt.y;

    if (sum < minSum) {
      minSum = sum;
      tl = pt;
    }
    if (sum > maxSum) {
      maxSum = sum;
      br = pt;
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      tr = pt;
    }
    if (diff < minDiff) {
      minDiff = diff;
      bl = pt;
    }
  }

  // Map corners back to full original image coordinate space
  const invScale = 1 / scale;
  const rawQuad: QuadCorners = {
    topLeft: { x: Math.round(tl.x * invScale), y: Math.round(tl.y * invScale) },
    topRight: { x: Math.round(tr.x * invScale), y: Math.round(tr.y * invScale) },
    bottomRight: { x: Math.round(br.x * invScale), y: Math.round(br.y * invScale) },
    bottomLeft: { x: Math.round(bl.x * invScale), y: Math.round(bl.y * invScale) },
  };

  // 4. Sanity validation: check if quad forms a reasonable non-degenerate polygon
  const quadWidth = Math.max(
    Math.hypot(rawQuad.topRight.x - rawQuad.topLeft.x, rawQuad.topRight.y - rawQuad.topLeft.y),
    Math.hypot(rawQuad.bottomRight.x - rawQuad.bottomLeft.x, rawQuad.bottomRight.y - rawQuad.bottomLeft.y)
  );
  const quadHeight = Math.max(
    Math.hypot(rawQuad.bottomLeft.x - rawQuad.topLeft.x, rawQuad.bottomLeft.y - rawQuad.topLeft.y),
    Math.hypot(rawQuad.bottomRight.x - rawQuad.topRight.x, rawQuad.bottomRight.y - rawQuad.topRight.y)
  );

  const minAcceptableDim = Math.min(srcWidth, srcHeight) * 0.35;
  if (quadWidth < minAcceptableDim || quadHeight < minAcceptableDim) {
    return getDefaultA4Quad(srcWidth, srcHeight, orientation);
  }

  // Constrain to frame boundaries
  return {
    topLeft: {
      x: Math.max(0, Math.min(srcWidth, rawQuad.topLeft.x)),
      y: Math.max(0, Math.min(srcHeight, rawQuad.topLeft.y)),
    },
    topRight: {
      x: Math.max(0, Math.min(srcWidth, rawQuad.topRight.x)),
      y: Math.max(0, Math.min(srcHeight, rawQuad.topRight.y)),
    },
    bottomRight: {
      x: Math.max(0, Math.min(srcWidth, rawQuad.bottomRight.x)),
      y: Math.max(0, Math.min(srcHeight, rawQuad.bottomRight.y)),
    },
    bottomLeft: {
      x: Math.max(0, Math.min(srcWidth, rawQuad.bottomLeft.x)),
      y: Math.max(0, Math.min(srcHeight, rawQuad.bottomLeft.y)),
    },
  };
}

/**
 * Solves 2D affine transformation matrix for 3 point correspondence:
 * Maps triangle (u0,v0)-(u1,v1)-(u2,v2) in source to (x0,y0)-(x1,y1)-(x2,y2) in destination.
 */
function solveAffineTriangle(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  u0: number, v0: number,
  u1: number, v1: number,
  u2: number, v2: number
): [number, number, number, number, number, number] | null {
  const delta = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
  if (Math.abs(delta) < 1e-6) return null;

  const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / delta;
  const c = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / delta;
  const e = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / delta;

  const b = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / delta;
  const d = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / delta;
  const f = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / delta;

  return [a, b, c, d, e, f];
}

/**
 * Bilinear point interpolation on a quad defined by 4 corners.
 * u, v are in range [0, 1].
 */
function interpolateQuadPoint(quad: QuadCorners, u: number, v: number): Point2D {
  const topX = (1 - u) * quad.topLeft.x + u * quad.topRight.x;
  const topY = (1 - u) * quad.topLeft.y + u * quad.topRight.y;

  const botX = (1 - u) * quad.bottomLeft.x + u * quad.bottomRight.x;
  const botY = (1 - u) * quad.bottomLeft.y + u * quad.bottomRight.y;

  return {
    x: (1 - v) * topX + v * botX,
    y: (1 - v) * topY + v * botY,
  };
}

/**
 * Perspective Transform & Edge-Crop to Standard A4
 * Maps detected quad corners into a pristine, straightened standard A4 rectangular page,
 * ignoring all background clutter outside the document.
 */
export async function warpQuadToA4(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  quad: QuadCorners,
  orientation: CameraScanOrientation = 'portrait'
): Promise<string> {
  const destWidth = orientation === 'portrait' ? A4_PORTRAIT_WIDTH : A4_LANDSCAPE_WIDTH;
  const destHeight = orientation === 'portrait' ? A4_PORTRAIT_HEIGHT : A4_LANDSCAPE_HEIGHT;

  const destCanvas = document.createElement('canvas');
  destCanvas.width = destWidth;
  destCanvas.height = destHeight;
  const ctx = destCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D canvas context for A4 warp');

  // Fill white page background first
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, destWidth, destHeight);

  // Mesh subdivision: 8x8 grid (64 sub-quads = 128 triangles)
  // Produces smooth hardware-accelerated projective perspective warp without distortion
  const subdivisions = 8;

  for (let yi = 0; yi < subdivisions; yi++) {
    for (let xi = 0; xi < subdivisions; xi++) {
      const u0 = xi / subdivisions;
      const u1 = (xi + 1) / subdivisions;
      const v0 = yi / subdivisions;
      const v1 = (yi + 1) / subdivisions;

      // Destination coordinates on the A4 page
      const dx0 = u0 * destWidth;
      const dx1 = u1 * destWidth;
      const dy0 = v0 * destHeight;
      const dy1 = v1 * destHeight;

      // Corresponding source points mapped via bilinear quad interpolation
      const s00 = interpolateQuadPoint(quad, u0, v0);
      const s10 = interpolateQuadPoint(quad, u1, v0);
      const s01 = interpolateQuadPoint(quad, u0, v1);
      const s11 = interpolateQuadPoint(quad, u1, v1);

      // Triangle 1: (s00, s10, s01) -> (dx0, dy0), (dx1, dy0), (dx0, dy1)
      const m1 = solveAffineTriangle(
        dx0, dy0, dx1, dy0, dx0, dy1,
        s00.x, s00.y, s10.x, s10.y, s01.x, s01.y
      );
      if (m1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(dx0 - 0.5, dy0 - 0.5);
        ctx.lineTo(dx1 + 0.5, dy0 - 0.5);
        ctx.lineTo(dx0 - 0.5, dy1 + 0.5);
        ctx.closePath();
        ctx.clip();
        ctx.transform(m1[0], m1[1], m1[2], m1[3], m1[4], m1[5]);
        ctx.drawImage(source, 0, 0);
        ctx.restore();
      }

      // Triangle 2: (s10, s11, s01) -> (dx1, dy0), (dx1, dy1), (dx0, dy1)
      const m2 = solveAffineTriangle(
        dx1, dy0, dx1, dy1, dx0, dy1,
        s10.x, s10.y, s11.x, s11.y, s01.x, s01.y
      );
      if (m2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(dx1 + 0.5, dy0 - 0.5);
        ctx.lineTo(dx1 + 0.5, dy1 + 0.5);
        ctx.lineTo(dx0 - 0.5, dy1 + 0.5);
        ctx.closePath();
        ctx.clip();
        ctx.transform(m2[0], m2[1], m2[2], m2[3], m2[4], m2[5]);
        ctx.drawImage(source, 0, 0);
        ctx.restore();
      }
    }
  }

  return destCanvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Loads an image from data URL and performs edge detection + A4 warping
 */
export async function cropAndFormatToA4(
  imageDataUrl: string,
  userQuad?: QuadCorners,
  orientation: CameraScanOrientation = 'portrait'
): Promise<{ a4DataUrl: string; detectedQuad: QuadCorners }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const quad = userQuad || detectDocumentQuad(img, orientation);
        const a4DataUrl = await warpQuadToA4(img, quad, orientation);
        resolve({ a4DataUrl, detectedQuad: quad });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for A4 edge detection'));
    img.src = imageDataUrl;
  });
}
