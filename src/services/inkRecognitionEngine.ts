// Hybrid Context-Aware Ink Recognition Engine
// Translates freehand strokes into clean characters (English/Tamil), solved numbers/equations,
// straightened lines, geometric shapes with sliders, coordinate slope graphs, and custom diagrams.

import {
  ConceptNode,
  InkBoundingBox,
  InkDetectedCategory,
  InkRecognitionResult,
  InkStroke,
  SubjectDefinition,
  WhiteboardVisualScene,
} from '../types/adaptiveLearning';
import { getApiUrl } from './api';
import { getActiveAiModel, getActiveAiProvider } from './aiConfig';
import { sanitizeWhiteboardPrimitives } from './adaptiveLearningService';
import {
  buildCircleScene,
  buildLinearSlopeGraphScene,
  buildParametricVisualScene,
  buildRectangleScene,
  buildSquareScene,
  buildTriangleScene,
  evaluateMathExpression,
} from './whiteboardVisualEngine';

// ============================================================================
// 1. CLEAN OFFSCREEN INK SNAPSHOT FOR HIGH-CONTRAST VISION OCR
// ============================================================================

export function computeInkBoundingBox(strokes: InkStroke[]): InkBoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of strokes) {
    if (s.isEraser) continue;
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(10, maxX - minX),
    height: Math.max(10, maxY - minY),
  };
}

export function buildCleanInkSnapshot(strokes: InkStroke[]): {
  imageBase64: string;
  boundingBox: InkBoundingBox;
} {
  const validStrokes = strokes.filter((s) => !s.isEraser && s.points.length >= 2);
  const boundingBox = computeInkBoundingBox(validStrokes);

  if (typeof document === 'undefined' || validStrokes.length === 0) {
    return { imageBase64: '', boundingBox };
  }

  const maxW = 760;
  const maxH = 440;
  const pad = 36;
  const scale = Math.min(
    (maxW - pad * 2) / Math.max(20, boundingBox.width),
    (maxH - pad * 2) / Math.max(20, boundingBox.height),
    2.2
  );
  const canvasW = Math.min(maxW, Math.max(160, Math.ceil(boundingBox.width * scale + pad * 2)));
  const canvasH = Math.min(maxH, Math.max(120, Math.ceil(boundingBox.height * scale + pad * 2)));

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { imageBase64: '', boundingBox };

  // Pure white high-contrast background regardless of active Whiteboard/Blackboard theme
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.strokeStyle = '#0f172a';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const s of validStrokes) {
    ctx.lineWidth = Math.max(5, Math.min(10, s.size * scale * 1.15));
    ctx.beginPath();
    s.points.forEach((p, idx) => {
      const px = pad + (p.x - boundingBox.minX) * scale;
      const py = pad + (p.y - boundingBox.minY) * scale;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  return {
    imageBase64: canvas.toDataURL('image/png'),
    boundingBox,
  };
}

// ============================================================================
// 2. INSTANT LOCAL GEOMETRIC STROKE ANALYZER (<5ms OFFLINE RECOGNIZER)
// ============================================================================

function perpendicularDistance(
  pt: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
  return Math.abs(dy * pt.x - dx * pt.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / len;
}

function simplifyPolyline(
  points: Array<{ x: number; y: number }>,
  epsilon: number
): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const rec1 = simplifyPolyline(points.slice(0, index + 1), epsilon);
    const rec2 = simplifyPolyline(points.slice(index), epsilon);
    return [...rec1.slice(0, -1), ...rec2];
  }
  return [points[0], points[end]];
}

function computePathLength(pts: Array<{ x: number; y: number }>): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

function angleBetweenSegmentsDeg(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);
  if (mag1 < 1e-3 || mag2 < 1e-3) return 0;
  const cosVal = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (mag1 * mag2)));
  return (Math.acos(cosVal) * 180) / Math.PI;
}

export function classifyFreehandStrokesLocally(
  strokes: InkStroke[],
  bbox: InkBoundingBox,
  _subject: SubjectDefinition
): { result: InkRecognitionResult; hintText: string } | null {
  const valid = strokes.filter((s) => !s.isEraser && s.points.length >= 2);
  if (valid.length === 0) return null;

  const diag = Math.hypot(bbox.width, bbox.height);
  const maxDim = Math.max(bbox.width, bbox.height);

  // Guard: Small strokes (<120px) are almost always handwritten letters ('O','1','L') or numbers ('0') —
  // ONLY classify as geometric shapes when drawn deliberately large enough OR clearly multi-edge polygon/axes!
  const isLargeSingleShape = maxDim >= 115;

  // Case 1: Single Stroke Analysis (Straight Line, Circle, Triangle, Square, Rectangle)
  if (valid.length === 1) {
    const pts = valid[0].points;
    const pStart = pts[0];
    const pEnd = pts[pts.length - 1];
    const startEndDist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
    const totalLen = computePathLength(pts);
    const chordRatio = totalLen > 0 ? startEndDist / totalLen : 0;

    // Straight Open Line (must be deliberate span >= 95px)
    if (chordRatio > 0.90 && startEndDist >= 95) {
      const dx = pEnd.x - pStart.x;
      const dy = pEnd.y - pStart.y;
      const angleDeg = Math.round((Math.atan2(-dy, dx) * 180) / Math.PI);
      return {
        hintText: `Single open straight line at ~${angleDeg} degrees`,
        result: {
          detectedCategory: 'straight_line',
          recognizedText: `Straight Line (${angleDeg}°)` ,
          detectedPurpose: 'Auto-straightened precision vector line',
          boundingBox: bbox,
          inlineLine: { x1: pStart.x, y1: pStart.y, x2: pEnd.x, y2: pEnd.y, angleDeg },
          confidence: 0.94,
          spokenFeedback: `Straightened line segment at ${angleDeg} degrees.`,
          modelUsed: 'Local Geometric Engine',
        },
      };
    }

    // Closed Shapes (must be large enough to distinguish from '0' or 'O')
    const isClosed = startEndDist < Math.max(40, maxDim * 0.35) && totalLen > 180;
    if (isClosed && isLargeSingleShape) {
      // Sample radial variance from centroid for Circularity check
      const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
      const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
      const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
      const meanR = radii.reduce((a, b) => a + b, 0) / radii.length;
      const variance =
        radii.reduce((acc, r) => acc + Math.pow(r - meanR, 2), 0) / radii.length;
      const cv = meanR > 0 ? Math.sqrt(variance) / meanR : 1;
      const aspect = bbox.width / bbox.height;

      if (cv < 0.22 && aspect >= 0.65 && aspect <= 1.48) {
        const estRadiusCm = Math.max(2, Math.min(20, Math.round(meanR / 22)));
        const scene = buildCircleScene(estRadiusCm, 'cm');
        return {
          hintText: `Closed circle sketch (estimated radius ~${estRadiusCm} cm)`,
          result: {
            detectedCategory: 'geometry_diagram',
            recognizedText: `Circle (r ≈ ${estRadiusCm} cm)`,
            detectedPurpose: 'Hand-sketched circle converted to exact geometry + sliders',
            boundingBox: bbox,
            visualQuery: `circle radius ${estRadiusCm} cm`,
            scene,
            confidence: 0.91,
            spokenFeedback: scene.spokenSummary,
            modelUsed: 'Local Geometric Engine',
          },
        };
      }

      // Check Polygon Vertices via Ramer-Douglas-Peucker
      const simplified = simplifyPolyline(pts, Math.max(14, maxDim * 0.08));
      // If start & end merged in simplified list, remove duplicate tail vertex
      const vertices =
        simplified.length > 2 &&
        Math.hypot(
          simplified[0].x - simplified[simplified.length - 1].x,
          simplified[0].y - simplified[simplified.length - 1].y
        ) < maxDim * 0.28
          ? simplified.slice(0, -1)
          : simplified;

      if (vertices.length === 3) {
        const baseVal = Math.max(3, Math.min(18, Math.round(bbox.width / 32)));
        const heightVal = Math.max(3, Math.min(18, Math.round(bbox.height / 32)));
        const angles = [
          angleBetweenSegmentsDeg(vertices[2], vertices[0], vertices[1]),
          angleBetweenSegmentsDeg(vertices[0], vertices[1], vertices[2]),
          angleBetweenSegmentsDeg(vertices[1], vertices[2], vertices[0]),
        ];
        const hasRightAngle = angles.some((a) => Math.abs(a - 90) <= 18);
        const triType = hasRightAngle
          ? 'right'
          : angles.every((a) => Math.abs(a - 60) <= 16)
          ? 'equilateral'
          : 'isosceles';

        const scene = buildTriangleScene(baseVal, heightVal, triType, 'cm');
        return {
          hintText: `Closed ${triType} triangle sketch`,
          result: {
            detectedCategory: 'geometry_diagram',
            recognizedText: `${triType.charAt(0).toUpperCase() + triType.slice(1)} Triangle`,
            detectedPurpose: 'Hand-sketched triangle converted to exact geometry + sliders',
            boundingBox: bbox,
            visualQuery: `${triType} triangle base ${baseVal} height ${heightVal}`,
            scene,
            confidence: 0.90,
            spokenFeedback: scene.spokenSummary,
            modelUsed: 'Local Geometric Engine',
          },
        };
      }

      if (vertices.length === 4) {
        const wVal = Math.max(3, Math.min(20, Math.round(bbox.width / 30)));
        const hVal = Math.max(3, Math.min(20, Math.round(bbox.height / 30)));
        if (Math.abs(bbox.width / bbox.height - 1) < 0.22) {
          const scene = buildSquareScene(wVal, 'cm');
          return {
            hintText: `Closed square sketch (side ~${wVal} cm)`,
            result: {
              detectedCategory: 'geometry_diagram',
              recognizedText: `Square (side ≈ ${wVal} cm)`,
              detectedPurpose: 'Hand-sketched square converted to exact geometry + sliders',
              boundingBox: bbox,
              visualQuery: `square side ${wVal} cm`,
              scene,
              confidence: 0.89,
              spokenFeedback: scene.spokenSummary,
              modelUsed: 'Local Geometric Engine',
            },
          };
        } else {
          const scene = buildRectangleScene(Math.max(wVal, hVal), Math.min(wVal, hVal), 'cm');
          return {
            hintText: `Closed rectangle sketch (${wVal} × ${hVal} cm)`,
            result: {
              detectedCategory: 'geometry_diagram',
              recognizedText: `Rectangle (${wVal} × ${hVal} cm)`,
              detectedPurpose: 'Hand-sketched rectangle converted to exact geometry + sliders',
              boundingBox: bbox,
              visualQuery: `rectangle ${wVal} by ${hVal} cm`,
              scene,
              confidence: 0.89,
              spokenFeedback: scene.spokenSummary,
              modelUsed: 'Local Geometric Engine',
            },
          };
        }
      }
    }
  }

  // Case 2: Multi-stroke Axes + Diagonal Sloped Line (e.g., user sketches X axis, Y axis, and a line)
  if (valid.length === 3 && diag >= 180) {
    const strokeSummaries = valid.map((s) => {
      const p0 = s.points[0];
      const p1 = s.points[s.points.length - 1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const dist = Math.hypot(dx, dy);
      const len = computePathLength(s.points);
      const straight = len > 0 ? dist / len > 0.88 : false;
      const isHoriz = straight && Math.abs(dy) < Math.abs(dx) * 0.25 && dist > 90;
      const isVert = straight && Math.abs(dx) < Math.abs(dy) * 0.25 && dist > 90;
      const isDiag = straight && !isHoriz && !isVert && dist > 75;
      return { p0, p1, dx, dy, isHoriz, isVert, isDiag };
    });

    const hasHoriz = strokeSummaries.some((s) => s.isHoriz);
    const hasVert = strokeSummaries.some((s) => s.isVert);
    const diagLine = strokeSummaries.find((s) => s.isDiag);

    if (hasHoriz && hasVert && diagLine) {
      // Canvas Y increases downward, so Cartesian slope = -dy / dx
      const rawSlope = diagLine.dx !== 0 ? -diagLine.dy / diagLine.dx : 1;
      const roundedSlope = Number(Math.max(-5, Math.min(5, Math.round(rawSlope * 2) / 2)).toFixed(1)) || 1;
      const scene = buildLinearSlopeGraphScene(roundedSlope, 1);
      return {
        hintText: `3-stroke coordinate graph with sloped line (m ≈ ${roundedSlope})`,
        result: {
          detectedCategory: 'graph_plot',
          recognizedText: `Graph + Straight Line Slope (m ≈ ${roundedSlope})`,
          detectedPurpose: 'Hand-drawn X/Y axes & sloped line converted to Cartesian slope graph',
          boundingBox: bbox,
          visualQuery: `graph straight line slope ${roundedSlope} intercept 1`,
          scene,
          confidence: 0.88,
          spokenFeedback: scene.spokenSummary,
          modelUsed: 'Local Geometric Engine',
        },
      };
    }
  }

  return null;
}

// ============================================================================
// 3. HYBRID MULTIMODAL CONTEXT-AWARE TRANSLATOR
// ============================================================================

export async function recognizeAndTranslateFreehandInk(
  strokes: InkStroke[],
  subject: SubjectDefinition,
  activeConcept: ConceptNode,
  language = 'en-IN'
): Promise<InkRecognitionResult> {
  const { imageBase64, boundingBox } = buildCleanInkSnapshot(strokes);
  const validStrokes = strokes.filter((s) => !s.isEraser && s.points.length >= 2);
  const localMatch = classifyFreehandStrokesLocally(validStrokes, boundingBox, subject);

  // Instant zero-latency snap when user drew a clean single large geometric shape or single straight line
  if (
    localMatch &&
    validStrokes.length === 1 &&
    (localMatch.result.detectedCategory === 'straight_line' ||
      localMatch.result.detectedCategory === 'geometry_diagram')
  ) {
    return localMatch.result;
  }

  // Otherwise send the crisp ink snapshot + context to Multimodal Vision AI so handwritten characters,
  // numbers, equations, Tamil script, labeled shapes ("r=7"), or complex diagrams are accurately understood!
  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);
  const customGeminiKey =
    typeof window !== 'undefined' ? localStorage.getItem('aura_custom_gemini_api_key') : null;

  try {
    const res = await fetch(getApiUrl('/api/adaptive-learning/recognize-ink'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        subjectId: subject.id,
        subjectName: subject.name,
        conceptTitle: activeConcept.title,
        language,
        localGeometryHint: localMatch?.hintText || null,
        geminiApiKey: customGeminiKey || undefined,
        modelOverride: provider === 'gemini' ? model : undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.result) {
        const raw = data.result;
        const category: InkDetectedCategory = raw.detectedCategory || 'text_characters';
        const recognizedText: string = String(raw.recognizedText || '').trim();
        let solvedAnswer: string | undefined =
          raw.solvedAnswer && raw.solvedAnswer !== 'null'
            ? String(raw.solvedAnswer).trim()
            : undefined;
        const visualQuery: string | undefined =
          raw.visualQuery && raw.visualQuery !== 'null'
            ? String(raw.visualQuery).trim()
            : undefined;

        // If AI recognized an equation without filling solvedAnswer, evaluate arithmetic safely locally
        if (category === 'equation_solve' && !solvedAnswer && recognizedText) {
          const lhs = recognizedText.split('=')[0].trim();
          const val = evaluateMathExpression(lhs, NaN);
          if (Number.isFinite(val)) {
            solvedAnswer = String(Number(val.toFixed(4)));
          }
        }

        // Attach interactive visual scene when geometry, graph, or science diagram is detected
        let attachedScene: WhiteboardVisualScene | undefined = undefined;
        if (visualQuery) {
          const built = buildParametricVisualScene(visualQuery, subject);
          attachedScene = {
            ...built.scene,
            modelUsed: `${data.modelUsed} → Parametric Visual Engine`,
          };
        } else if (
          raw.customScene &&
          typeof raw.customScene === 'object' &&
          Array.isArray(raw.customScene.primitives)
        ) {
          const sanitized = sanitizeWhiteboardPrimitives(raw.customScene.primitives);
          if (sanitized.length > 0) {
            attachedScene = {
              title: raw.customScene.title || recognizedText || `${subject.name} Visual`,
              subtitle: raw.customScene.subtitle || raw.detectedPurpose,
              formulaBox: raw.customScene.formulaBox,
              steps: Array.isArray(raw.customScene.steps)
                ? raw.customScene.steps.slice(0, 5)
                : [],
              primitives: sanitized,
              spokenSummary: raw.spokenFeedback || recognizedText,
              modelUsed: data.modelUsed,
            };
          }
        } else if (localMatch?.result.scene) {
          attachedScene = localMatch.result.scene;
        }

        return {
          detectedCategory: category,
          recognizedText: recognizedText || localMatch?.result.recognizedText || 'Sketch Captured',
          detectedPurpose: raw.detectedPurpose || `Interpreted for ${subject.name}`,
          solvedAnswer,
          boundingBox,
          visualQuery: visualQuery || localMatch?.result.visualQuery,
          scene: attachedScene,
          confidence: Number(raw.confidence) || 0.9,
          spokenFeedback:
            raw.spokenFeedback ||
            (solvedAnswer
              ? `${recognizedText} equals ${solvedAnswer}`
              : `Recognized ${recognizedText}`),
          modelUsed: data.modelUsed || 'Gemini Vision Ink Engine',
        };
      }
    }
  } catch (err) {
    console.warn('[InkEngine] Multimodal endpoint fallback to local recognizer:', err);
  }

  // Offline / Fallback Path
  if (localMatch) {
    return localMatch.result;
  }

  return {
    detectedCategory: 'text_characters',
    recognizedText: `Freehand Note (${subject.name})`,
    detectedPurpose: 'Offline ink preserved (connect Gemini API key for handwriting OCR)',
    boundingBox,
    confidence: 0.5,
    spokenFeedback: 'Handwritten sketch preserved on board.',
    modelUsed: 'Offline Ink Guard',
  };
}

