// Universal Whiteboard Visual Engine
// 1. Safe Recursive-Descent Math Expression Parser (NO eval / NO new Function)
// 2. Parametric Geometry, Coordinate Slope Graph, Curve/Tangent & Advanced Concept Scene Builders
// 3. Theme-Aware (Whiteboard & Blackboard) Animated HTML5 Canvas Renderer

import {
  BoardTheme,
  ConceptNode,
  DiagramStampType,
  SubjectDefinition,
  WhiteboardPrimitive,
  WhiteboardVisualScene,
} from '../types/adaptiveLearning';

// ============================================================================
// 1. SAFE RECURSIVE-DESCENT MATH EVALUATOR
// ============================================================================

type MathToken =
  | { kind: 'num'; value: number }
  | { kind: 'id'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

const ALLOWED_FUNCS = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sqrt',
  'abs',
  'log',
  'ln',
  'exp',
  'floor',
  'ceil',
]);

function normalizeMathInput(raw: string): string {
  let s = (raw || '')
    .trim()
    .replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .toLowerCase();

  // Replace unicode subscript digits just in case
  s = s.replace(/\s+/g, '');
  return s;
}

function tokenizeMath(expr: string): MathToken[] {
  const rawTokens: MathToken[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let numStr = '';
      while (i < expr.length && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
        numStr += expr[i++];
      }
      const parsed = parseFloat(numStr);
      if (!Number.isFinite(parsed)) return [];
      rawTokens.push({ kind: 'num', value: parsed });
      continue;
    }

    if ((ch >= 'a' && ch <= 'z') || ch === '_') {
      let idStr = '';
      while (i < expr.length && ((expr[i] >= 'a' && expr[i] <= 'z') || expr[i] === '_')) {
        idStr += expr[i++];
      }
      // Split condensed products like "xsin" or individual variable letters if not known id
      if (idStr !== 'pi' && idStr !== 'e' && !ALLOWED_FUNCS.has(idStr)) {
        // Check if starts with 'x' followed by function, e.g., 'xsin'
        if (idStr.startsWith('x') && ALLOWED_FUNCS.has(idStr.slice(1))) {
          rawTokens.push({ kind: 'id', value: 'x' });
          rawTokens.push({ kind: 'id', value: idStr.slice(1) });
        } else {
          rawTokens.push({ kind: 'id', value: idStr });
        }
      } else {
        rawTokens.push({ kind: 'id', value: idStr });
      }
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      rawTokens.push({ kind: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '(' || ch === '[') {
      rawTokens.push({ kind: 'lparen' });
      i++;
      continue;
    }

    if (ch === ')' || ch === ']') {
      rawTokens.push({ kind: 'rparen' });
      i++;
      continue;
    }

    // Ignore stray punctuation
    i++;
  }

  // Insert implicit multiplication tokens (2x, 3(x+1), x(x+1), (a)(b), 2sin(x))
  const result: MathToken[] = [];
  for (let k = 0; k < rawTokens.length; k++) {
    const cur = rawTokens[k];
    if (k > 0) {
      const prev = rawTokens[k - 1];
      const prevProducesValue =
        prev.kind === 'num' ||
        prev.kind === 'rparen' ||
        (prev.kind === 'id' && !ALLOWED_FUNCS.has(prev.value));
      const curStartsValue =
        cur.kind === 'lparen' || cur.kind === 'id' || cur.kind === 'num';

      if (prevProducesValue && curStartsValue) {
        result.push({ kind: 'op', value: '*' });
      }
    }
    result.push(cur);
  }

  return result;
}

export function evaluateMathExpression(rawExpr: string, xVal: number): number {
  const normalized = normalizeMathInput(rawExpr);
  if (!normalized) return NaN;
  const tokens = tokenizeMath(normalized);
  if (tokens.length === 0) return NaN;

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseExpr = (): number => {
    let val = parseTerm();
    while (peek()?.kind === 'op' && (peek() as any).value !== undefined) {
      const op = (peek() as any).value;
      if (op === '+' || op === '-') {
        consume();
        const rhs = parseTerm();
        val = op === '+' ? val + rhs : val - rhs;
      } else {
        break;
      }
    }
    return val;
  };

  const parseTerm = (): number => {
    let val = parsePower();
    while (peek()?.kind === 'op') {
      const op = (peek() as any).value;
      if (op === '*' || op === '/') {
        consume();
        const rhs = parsePower();
        val = op === '*' ? val * rhs : rhs === 0 ? NaN : val / rhs;
      } else {
        break;
      }
    }
    return val;
  };

  const parseUnary = (): number => {
    const t = peek();
    if (t?.kind === 'op' && (t.value === '+' || t.value === '-')) {
      consume();
      const inner = parseUnary();
      return t.value === '-' ? -inner : inner;
    }
    return parsePrimary();
  };

  const parsePower = (): number => {
    const base = parseUnary();
    const next = peek();
    if (next?.kind === 'op' && next.value === '^') {
      consume();
      const exp = parsePower(); // right-associative
      return Math.pow(base, exp);
    }
    return base;
  };

  const parsePrimary = (): number => {
    const t = peek();
    if (!t) return NaN;

    if (t.kind === 'num') {
      consume();
      return t.value;
    }

    if (t.kind === 'lparen') {
      consume();
      const inner = parseExpr();
      if (peek()?.kind === 'rparen') consume();
      return inner;
    }

    if (t.kind === 'id') {
      consume();
      if (t.value === 'x' || t.value === 't') return xVal;
      if (t.value === 'pi') return Math.PI;
      if (t.value === 'e') return Math.E;

      if (ALLOWED_FUNCS.has(t.value)) {
        let arg: number;
        if (peek()?.kind === 'lparen') {
          consume();
          arg = parseExpr();
          if (peek()?.kind === 'rparen') consume();
        } else {
          arg = parseUnary();
        }
        switch (t.value) {
          case 'sin':
            return Math.sin(arg);
          case 'cos':
            return Math.cos(arg);
          case 'tan':
            return Math.tan(arg);
          case 'asin':
            return Math.asin(arg);
          case 'acos':
            return Math.acos(arg);
          case 'atan':
            return Math.atan(arg);
          case 'sqrt':
            return arg < 0 ? NaN : Math.sqrt(arg);
          case 'abs':
            return Math.abs(arg);
          case 'log':
            return arg <= 0 ? NaN : Math.log10(arg);
          case 'ln':
            return arg <= 0 ? NaN : Math.log(arg);
          case 'exp':
            return Math.exp(arg);
          case 'floor':
            return Math.floor(arg);
          case 'ceil':
            return Math.ceil(arg);
        }
      }
      return NaN;
    }

    return NaN;
  };

  try {
    const out = parseExpr();
    return Number.isFinite(out) ? out : NaN;
  } catch {
    return NaN;
  }
}

export function computeDerivativeAt(expr: string, x0: number): number {
  const h = 1e-4;
  const fPlus = evaluateMathExpression(expr, x0 + h);
  const fMinus = evaluateMathExpression(expr, x0 - h);
  if (!Number.isFinite(fPlus) || !Number.isFinite(fMinus)) return 0;
  return (fPlus - fMinus) / (2 * h);
}

// ============================================================================
// 2. PARAMETRIC GEOMETRY, GRAPH & ADVANCED CONCEPT SCENE BUILDERS
// ============================================================================

export function buildCircleScene(radiusInput: number, unit = 'cm'): WhiteboardVisualScene {
  const r = Math.min(500, Math.max(0.5, Number(radiusInput.toFixed(2))));
  const diameter = Number((2 * r).toFixed(2));
  const circumference = (2 * Math.PI * r).toFixed(2);
  const area = (Math.PI * r * r).toFixed(2);
  // Keep drawn pixel radius cleanly readable inside 1000x1000 stage while scaling subtly
  const drawnRadius = Math.round(230 + Math.min(130, r * 6));

  return {
    title: `Circle Geometry (Radius r = ${r} ${unit})`,
    subtitle: `Center O • Diameter d = ${diameter} ${unit}`,
    formulaBox: `A = πr² = ${area} ${unit}²   |   C = 2πr = ${circumference} ${unit}`,
    steps: [
      `1. Radius (r): ${r} ${unit} from center O to boundary`,
      `2. Diameter (d = 2r): 2 × ${r} = ${diameter} ${unit}`,
      `3. Circumference: C = 2π(${r}) ≈ ${circumference} ${unit}`,
      `4. Area: A = π × (${r})² ≈ ${area} ${unit}²`,
    ],
    primitives: [
      {
        type: 'circle',
        cx: 500,
        cy: 495,
        r: drawnRadius,
        radiusLabel: `r = ${r} ${unit}`,
        showCenter: true,
        showDiameter: true,
        stroke: '#2563eb',
        fill: 'rgba(37, 99, 235, 0.08)',
        label: `d = ${diameter} ${unit}`,
      },
      {
        type: 'text',
        x: 500,
        y: 80,
        text: `Circle of Radius r = ${r} ${unit}`,
        fontSize: 24,
        bold: true,
        align: 'center',
        color: '#1d4ed8',
      },
    ],
    spokenSummary: `Generated a circle of radius ${r} ${unit}. Its diameter is ${diameter} ${unit}, circumference is ${circumference} ${unit}, and area is ${area} square ${unit}.`,
    interactiveControl: { kind: 'circle', radius: r, unit },
  };
}

export function buildSquareScene(sideInput: number, unit = 'cm'): WhiteboardVisualScene {
  const s = Math.min(200, Math.max(1, Number(sideInput.toFixed(2))));
  const area = (s * s).toFixed(2);
  const perimeter = (4 * s).toFixed(2);
  const diagonal = (s * Math.SQRT2).toFixed(2);
  const pxSide = Math.round(Math.min(540, Math.max(360, 320 + s * 10)));
  const x0 = 500 - pxSide / 2;
  const y0 = 500 - pxSide / 2;

  return {
    title: `Square Geometry (Side a = ${s} ${unit})`,
    subtitle: '4 Equal Sides • All Interior Angles = 90°',
    formulaBox: `Area = a² = ${area} ${unit}²   |   Perimeter = 4a = ${perimeter} ${unit}`,
    steps: [
      `1. Side Length (a): ${s} ${unit} on all 4 sides`,
      `2. Perimeter: 4 × ${s} = ${perimeter} ${unit}`,
      `3. Area: ${s}² = ${area} ${unit}²`,
      `4. Diagonal (a√2): ${s}√2 ≈ ${diagonal} ${unit}`,
    ],
    primitives: [
      {
        type: 'rect',
        x: x0,
        y: y0,
        width: pxSide,
        height: pxSide,
        widthLabel: `a = ${s} ${unit}`,
        heightLabel: `a = ${s} ${unit}`,
        showDiagonal: true,
        label: `Diagonal = ${diagonal} ${unit}`,
        stroke: '#7c3aed',
        fill: 'rgba(124, 58, 237, 0.08)',
      },
    ],
    spokenSummary: `Drew a square with side ${s} ${unit}. Perimeter is ${perimeter} ${unit}, area is ${area} square ${unit}, and diagonal is ${diagonal} ${unit}.`,
    interactiveControl: { kind: 'square', side: s, unit },
  };
}

export function buildRectangleScene(
  lengthInput: number,
  widthInput: number,
  unit = 'cm'
): WhiteboardVisualScene {
  const l = Math.min(200, Math.max(1, Number(lengthInput.toFixed(2))));
  const w = Math.min(200, Math.max(1, Number(widthInput.toFixed(2))));
  const area = (l * w).toFixed(2);
  const perimeter = (2 * (l + w)).toFixed(2);
  const diagonal = Math.hypot(l, w).toFixed(2);

  // Proportionately fit inside stage
  const maxBoxW = 640;
  const maxBoxH = 480;
  const ratio = l / w;
  let drawW = maxBoxW;
  let drawH = drawW / Math.max(0.25, Math.min(4, ratio));
  if (drawH > maxBoxH) {
    drawH = maxBoxH;
    drawW = drawH * Math.max(0.25, Math.min(4, ratio));
  }
  const x0 = 500 - drawW / 2;
  const y0 = 500 - drawH / 2;

  return {
    title: `Rectangle (${l} × ${w} ${unit})`,
    subtitle: 'Opposite Sides Equal & Parallel • 4 Right Angles',
    formulaBox: `Area = l × w = ${area} ${unit}²   |   P = 2(l + w) = ${perimeter} ${unit}`,
    steps: [
      `1. Length (l) = ${l} ${unit}, Width (w) = ${w} ${unit}`,
      `2. Area = ${l} × ${w} = ${area} ${unit}²`,
      `3. Perimeter = 2(${l} + ${w}) = ${perimeter} ${unit}`,
      `4. Diagonal d = √(${l}² + ${w}²) ≈ ${diagonal} ${unit}`,
    ],
    primitives: [
      {
        type: 'rect',
        x: x0,
        y: y0,
        width: drawW,
        height: drawH,
        widthLabel: `l = ${l} ${unit}`,
        heightLabel: `w = ${w} ${unit}`,
        showDiagonal: true,
        label: `d = ${diagonal} ${unit}`,
        stroke: '#059669',
        fill: 'rgba(5, 150, 105, 0.08)',
      },
    ],
    spokenSummary: `Generated a ${l} by ${w} ${unit} rectangle with area ${area} square ${unit}, perimeter ${perimeter} ${unit}, and diagonal ${diagonal} ${unit}.`,
    interactiveControl: { kind: 'rectangle', length: l, width: w, unit },
  };
}

export function buildTriangleScene(
  baseInput: number,
  heightInput: number,
  triangleType: 'right' | 'equilateral' | 'isosceles' = 'right',
  unit = 'cm',
  explicitSides?: [number, number, number]
): WhiteboardVisualScene {
  let b = Math.min(100, Math.max(2, Number(baseInput.toFixed(2))));
  let h = Math.min(100, Math.max(2, Number(heightInput.toFixed(2))));
  let type = triangleType;
  let edgeA = 0; // opposite A
  let edgeB = 0; // opposite B
  let edgeC = 0; // base
  let area = 0;
  let perimeter = 0;
  let apexRatioX = 0.5; // 0 = left corner (right triangle), 0.5 = centered (isosceles/equilateral)
  let rightAngleVertex: number | undefined = undefined;

  if (
    explicitSides &&
    explicitSides[0] + explicitSides[1] > explicitSides[2] &&
    explicitSides[0] + explicitSides[2] > explicitSides[1] &&
    explicitSides[1] + explicitSides[2] > explicitSides[0]
  ) {
    const sorted = [...explicitSides].sort((x, y) => x - y);
    const [s1, s2, s3] = sorted;
    edgeC = s3; // base = largest side for stable horizontal placement
    edgeA = s1;
    edgeB = s2;
    const semiP = (s1 + s2 + s3) / 2;
    area = Math.sqrt(Math.max(0, semiP * (semiP - s1) * (semiP - s2) * (semiP - s3)));
    perimeter = s1 + s2 + s3;
    b = edgeC;
    h = (2 * area) / edgeC;
    // Law of cosines for x-offset of top vertex from left corner
    const cosAngle = (edgeC * edgeC + edgeA * edgeA - edgeB * edgeB) / (2 * edgeC * edgeA);
    const xProj = edgeA * cosAngle;
    apexRatioX = Math.max(0.05, Math.min(0.95, xProj / edgeC));

    const isRightByPyth = Math.abs(s1 * s1 + s2 * s2 - s3 * s3) < 0.05;
    if (isRightByPyth) {
      type = 'right';
      edgeC = s1;
      h = s2;
      b = s1;
      apexRatioX = 0;
      rightAngleVertex = 0;
    }
  } else if (type === 'equilateral') {
    h = Number(((b * Math.sqrt(3)) / 2).toFixed(2));
    edgeA = b;
    edgeB = b;
    edgeC = b;
    apexRatioX = 0.5;
    area = 0.5 * b * h;
    perimeter = 3 * b;
  } else if (type === 'isosceles') {
    const slant = Math.hypot(b / 2, h);
    edgeA = slant;
    edgeB = slant;
    edgeC = b;
    apexRatioX = 0.5;
    area = 0.5 * b * h;
    perimeter = b + 2 * slant;
  } else {
    // Right triangle
    const hyp = Math.hypot(b, h);
    edgeA = h;
    edgeB = hyp;
    edgeC = b;
    apexRatioX = 0;
    rightAngleVertex = 0;
    area = 0.5 * b * h;
    perimeter = b + h + hyp;
  }

  // Fit vertices cleanly inside 1000x1000 stage (margin ~160..840)
  const scale = Math.min(620 / Math.max(1, b), 490 / Math.max(1, h));
  const drawW = Math.max(220, b * scale);
  const drawH = Math.max(180, h * scale);
  const leftX = 500 - drawW / 2;
  const baseY = 500 + drawH / 2 + 20;
  const topX = leftX + apexRatioX * drawW;
  const topY = baseY - drawH;
  const rightX = leftX + drawW;

  const points = [
    { x: leftX, y: baseY, vertexLabel: 'A' },
    { x: rightX, y: baseY, vertexLabel: 'B' },
    { x: topX, y: topY, vertexLabel: 'C' },
  ];

  const primitives: WhiteboardPrimitive[] = [
    {
      type: 'polygon',
      points,
      rightAngleAtVertex: rightAngleVertex,
      edgeLabels: [
        `Base = ${b.toFixed(1)} ${unit}`,
        `${type === 'right' ? 'Hyp' : 'Side'} = ${edgeB.toFixed(1)} ${unit}`,
        `${type === 'right' ? `h = ${h.toFixed(1)}` : `Side = ${edgeA.toFixed(1)}`} ${unit}`,
      ],
      angleLabels:
        type === 'equilateral'
          ? [
              { vertexIndex: 0, text: '60°' },
              { vertexIndex: 1, text: '60°' },
              { vertexIndex: 2, text: '60°' },
            ]
          : rightAngleVertex === 0
          ? [{ vertexIndex: 0, text: '90°' }]
          : undefined,
      stroke: '#dc2626',
      fill: 'rgba(220, 38, 38, 0.08)',
    },
  ];

  // Add dashed altitude line for non-right triangles so height is visually clear
  if (rightAngleVertex === undefined) {
    primitives.push({
      type: 'line',
      x1: topX,
      y1: topY,
      x2: topX,
      y2: baseY,
      dashed: true,
      stroke: '#2563eb',
      label: `h = ${h.toFixed(1)} ${unit}`,
      lineWidth: 2.5,
    });
  }

  return {
    title: `${type.charAt(0).toUpperCase() + type.slice(1)} Triangle (b=${b.toFixed(1)}, h=${h.toFixed(1)} ${unit})`,
    subtitle: rightAngleVertex !== undefined ? 'Pythagoras: a² + b² = c²' : 'Altitude h perpendicular to base',
    formulaBox: `Area = ½bh = ${area.toFixed(2)} ${unit}²   |   Perimeter = ${perimeter.toFixed(2)} ${unit}`,
    steps: [
      `1. Type: ${type.charAt(0).toUpperCase() + type.slice(1)} Triangle`,
      `2. Base (b) = ${b.toFixed(2)} ${unit}, Height (h) = ${h.toFixed(2)} ${unit}`,
      `3. Sides: ${edgeA.toFixed(2)}, ${edgeB.toFixed(2)}, ${edgeC.toFixed(2)} ${unit}`,
      `4. Area = ½ × ${b.toFixed(1)} × ${h.toFixed(1)} = ${area.toFixed(2)} ${unit}²`,
    ],
    primitives,
    spokenSummary: `Drew a ${type} triangle with base ${b.toFixed(1)} ${unit} and height ${h.toFixed(1)} ${unit}. Its area is ${area.toFixed(2)} square ${unit} and perimeter is ${perimeter.toFixed(2)} ${unit}.`,
    interactiveControl: {
      kind: 'triangle',
      base: Number(b.toFixed(1)),
      height: Number(h.toFixed(1)),
      triangleType: type,
      unit,
    },
  };
}

export function buildLinearSlopeGraphScene(
  slopeInput: number,
  interceptInput: number,
  customPoints?: { x1: number; y1: number; x2: number; y2: number }
): WhiteboardVisualScene {
  const m = Number(slopeInput.toFixed(2));
  const c = Number(interceptInput.toFixed(2));

  const pt1 = customPoints ? { x: customPoints.x1, y: customPoints.y1 } : { x: 0, y: c };
  const pt2 = customPoints
    ? { x: customPoints.x2, y: customPoints.y2 }
    : { x: 2, y: Number((m * 2 + c).toFixed(2)) };

  const dx = Number((pt2.x - pt1.x).toFixed(2));
  const dy = Number((pt2.y - pt1.y).toFixed(2));

  // Auto-fit coordinate bounds around intercepts and slope triangle
  const allX = [pt1.x, pt2.x, -5, 5];
  const allY = [pt1.y, pt2.y, c, -5, 5];
  const boundX = Math.max(6, Math.ceil(Math.max(...allX.map(Math.abs)) + 1));
  const boundY = Math.max(6, Math.ceil(Math.max(...allY.map(Math.abs)) + 2));

  const signC = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`;
  const eqDisplay = `y = ${m}x ${signC}`;
  const expr = `${m}*x + (${c})`;

  const xIntercept = m !== 0 ? Number((-c / m).toFixed(2)) : null;

  const points: Array<{ x: number; y: number; label?: string; color?: string }> = [
    { x: pt1.x, y: pt1.y, label: `P₁(${pt1.x}, ${pt1.y})`, color: '#dc2626' },
    { x: pt2.x, y: pt2.y, label: `P₂(${pt2.x}, ${pt2.y})`, color: '#059669' },
  ];
  if (xIntercept !== null && Math.abs(xIntercept) <= boundX && xIntercept !== pt1.x) {
    points.push({ x: xIntercept, y: 0, label: `x-int (${xIntercept}, 0)`, color: '#7c3aed' });
  }

  return {
    title: `Linear Graph & Slope: ${eqDisplay}`,
    subtitle: `Rise (Δy) = ${dy}   •   Run (Δx) = ${dx}   •   Slope m = Δy / Δx`,
    formulaBox: `m = (${pt2.y} - ${pt1.y}) / (${pt2.x} - ${pt1.x}) = ${m}   |   y-int = (0, ${c})`,
    steps: [
      `1. Equation: ${eqDisplay} (y = mx + c)`,
      `2. Pick points P₁(${pt1.x}, ${pt1.y}) and P₂(${pt2.x}, ${pt2.y})`,
      `3. Rise Δy = ${pt2.y} - (${pt1.y}) = ${dy};  Run Δx = ${pt2.x} - (${pt1.x}) = ${dx}`,
      `4. Slope m = Δy / Δx = ${dy} / ${dx} = ${m}`,
    ],
    primitives: [
      {
        type: 'coordinate_graph',
        title: `Cartesian Plane: ${eqDisplay}`,
        xMin: -boundX,
        xMax: boundX,
        yMin: -boundY,
        yMax: boundY,
        xLabel: 'x',
        yLabel: 'y',
        curves: [{ expression: expr, label: eqDisplay, color: '#2563eb' }],
        slopeSegment: {
          x1: pt1.x,
          y1: pt1.y,
          x2: pt2.x,
          y2: pt2.y,
          label: `m = ${m}`,
          showTriangle: true,
        },
        points,
      },
    ],
    spokenSummary: `Plotted the straight line ${eqDisplay} on the coordinate graph with a highlighted slope triangle. Rise is ${dy} over a run of ${dx}, giving slope m equals ${m} and y-intercept ${c}.`,
    interactiveControl: { kind: 'linear_graph', slope: m, intercept: c },
  };
}

export function buildCurveGraphScene(
  rawExpression: string,
  tangentXInput = 1.5,
  customTitle?: string
): WhiteboardVisualScene {
  const cleanExpr = normalizeMathInput(rawExpression) || 'x^2 - 2';
  const x0 = Number(tangentXInput.toFixed(2));
  const y0Raw = evaluateMathExpression(cleanExpr, x0);
  const y0 = Number.isFinite(y0Raw) ? Number(y0Raw.toFixed(2)) : 0;
  const derivRaw = computeDerivativeAt(cleanExpr, x0);
  const slope = Number.isFinite(derivRaw) ? Number(derivRaw.toFixed(2)) : 0;

  // Determine vertical scale automatically by sampling [-6..6]
  let minY = -6;
  let maxY = 6;
  const samples: number[] = [];
  for (let x = -6; x <= 6; x += 0.5) {
    const v = evaluateMathExpression(cleanExpr, x);
    if (Number.isFinite(v) && Math.abs(v) < 40) {
      samples.push(v);
    }
  }
  if (samples.length > 0) {
    const lo = Math.min(...samples, 0);
    const hi = Math.max(...samples, 0);
    minY = Math.max(-25, Math.floor(lo - 2));
    maxY = Math.min(25, Math.ceil(hi + 2));
    if (maxY - minY < 6) {
      minY -= 3;
      maxY += 3;
    }
  }

  return {
    title: customTitle || `Function Graph & Tangent Slope: y = ${cleanExpr}`,
    subtitle: `Instantaneous Derivative at x₀ = ${x0}: Slope f'(${x0}) = ${slope}`,
    formulaBox: `At (${x0}, ${y0}):  Tangent Slope m = ${slope}   |   y - ${y0} = ${slope}(x - ${x0})`,
    steps: [
      `1. Function Plotted: y = ${cleanExpr}`,
      `2. Anchor Point: (${x0}, ${y0}) on the curve`,
      `3. Derivative Tangent Slope f'(${x0}) ≈ ${slope}`,
      `4. Orange dashed line touches curve with slope ${slope}`,
    ],
    primitives: [
      {
        type: 'coordinate_graph',
        title: `y = ${cleanExpr}`,
        xMin: -6,
        xMax: 6,
        yMin: minY,
        yMax: maxY,
        xLabel: 'x',
        yLabel: 'y',
        curves: [{ expression: cleanExpr, label: `y = ${cleanExpr}`, color: '#7c3aed' }],
        tangentAtX: {
          expression: cleanExpr,
          x0,
          label: `Slope m=${slope}`,
        },
        points: [{ x: x0, y: y0, label: `(${x0}, ${y0})`, color: '#ea580c' }],
      },
    ],
    spokenSummary: `Plotted y equals ${cleanExpr} with a live tangent line at x equals ${x0}. At that point, y is ${y0} and the instantaneous slope is ${slope}.`,
    interactiveControl: { kind: 'curve_graph', expression: cleanExpr, tangentX: x0 },
  };
}

// ============================================================================
// 3. SUBJECT DIAGRAM STAMPS & ADVANCED TOPIC SCENES
// ============================================================================

function buildProjectileMotionScene(): WhiteboardVisualScene {
  return {
    title: 'Projectile Motion Trajectory (Parabolic Arc)',
    subtitle: 'Horizontal v_x = v₀cosθ (Constant) • Vertical a_y = -g',
    formulaBox: 'H_max = (v₀²sin²θ) / 2g   |   Range R = (v₀²sin2θ) / g',
    steps: [
      '1. Launch velocity v₀ splits into v_x = v₀cosθ & v_y = v₀sinθ',
      '2. Gravity g = 9.8 m/s² accelerates only downward (-y)',
      '3. At Peak H_max, vertical velocity v_y = 0 (only v_x remains)',
      '4. Maximum Horizontal Range occurs at launch angle θ = 45°',
    ],
    primitives: [
      {
        type: 'coordinate_graph',
        title: 'Trajectory y(x) = x - 0.1x² (θ = 45°)',
        xMin: -1,
        xMax: 11,
        yMin: -1,
        yMax: 4,
        xLabel: 'Distance x (m)',
        yLabel: 'Height y (m)',
        curves: [
          {
            expression: 'x - 0.1*x^2',
            label: 'Parabolic Path',
            color: '#2563eb',
          },
        ],
        vectors: [
          { x1: 0, y1: 0, x2: 2.2, y2: 2.2, label: 'v₀ (45°)', color: '#dc2626' },
          { x1: 5, y1: 2.5, x2: 7, y2: 2.5, label: 'v_x (v_y=0)', color: '#059669' },
        ],
        points: [
          { x: 5, y: 2.5, label: 'H_max (5, 2.5)', color: '#d97706' },
          { x: 10, y: 0, label: 'Range R = 10m', color: '#7c3aed' },
        ],
      },
    ],
    spokenSummary:
      'Rendered projectile motion trajectory showing launch vector components, zero vertical velocity at peak height H max, and full horizontal range R.',
  };
}

function buildElectricCircuitScene(): WhiteboardVisualScene {
  return {
    title: 'DC Electric Circuit & Ohm’s Law (V = I · R)',
    subtitle: 'Series Loop • Voltage Source, Ammeter, Resistor Load',
    formulaBox: 'V = I × R   |   I = V / R   |   Power P = V·I = I²R',
    steps: [
      '1. Battery supplies 12V potential difference (EMF)',
      '2. Conventional current I flows from + to − terminal',
      '3. Resistor R = 4Ω opposes flow: I = 12V / 4Ω = 3A',
      '4. Power dissipated across resistor: P = 12V × 3A = 36W',
    ],
    primitives: [
      // Loop wire rectangle
      { type: 'rect', x: 170, y: 210, width: 660, height: 520, stroke: '#2563eb', fill: 'transparent' },
      // Battery symbol on left
      { type: 'rect', x: 120, y: 410, width: 100, height: 120, fill: '#f8fafc', stroke: 'transparent' },
      { type: 'line', x1: 130, y1: 445, x2: 210, y2: 445, stroke: '#dc2626', lineWidth: 6 },
      { type: 'line', x1: 150, y1: 485, x2: 190, y2: 485, stroke: '#0f172a', lineWidth: 6 },
      { type: 'text', x: 78, y: 472, text: '12V (+)', bold: true, color: '#dc2626', fontSize: 20 },
      // Resistor zigzag along top
      {
        type: 'curve_path',
        points: [
          { x: 390, y: 210 },
          { x: 415, y: 175 },
          { x: 445, y: 245 },
          { x: 475, y: 175 },
          { x: 505, y: 245 },
          { x: 535, y: 175 },
          { x: 565, y: 245 },
          { x: 590, y: 210 },
        ],
        stroke: '#d97706',
        lineWidth: 5,
        label: 'Resistor R = 4Ω',
      },
      { type: 'text', x: 495, y: 135, text: 'Resistor R = 4Ω', bold: true, align: 'center', color: '#d97706', fontSize: 22 },
      // Ammeter on bottom
      { type: 'circle', cx: 500, cy: 730, r: 58, fill: '#eff6ff', stroke: '#059669', showCenter: false },
      { type: 'text', x: 500, y: 738, text: 'A (3A)', bold: true, align: 'center', color: '#059669', fontSize: 22 },
      // Current Flow Arrow
      { type: 'line', x1: 680, y1: 175, x2: 790, y2: 175, stroke: '#059669', arrowEnd: true, lineWidth: 4, label: 'I = 3A' },
    ],
    spokenSummary: 'Drawn a DC circuit loop with a 12-volt battery, a 4-ohm resistor, and a 3-amp ammeter demonstrating Ohm’s law V equals I R.',
  };
}

function buildDnaHelixScene(): WhiteboardVisualScene {
  const ptsA: Array<{ x: number; y: number }> = [];
  const ptsB: Array<{ x: number; y: number }> = [];
  const rungs: WhiteboardPrimitive[] = [];

  for (let i = 0; i <= 36; i++) {
    const t = (i / 36) * Math.PI * 3.2;
    const x = 140 + i * 20;
    const yA = 490 + Math.sin(t) * 145;
    const yB = 490 - Math.sin(t) * 145;
    ptsA.push({ x, y: yA });
    ptsB.push({ x, y: yB });

    if (i % 3 === 1 && Math.abs(yA - yB) > 45) {
      const isGC = i % 2 === 0;
      rungs.push({
        type: 'line',
        x1: x,
        y1: yA,
        x2: x,
        y2: yB,
        stroke: isGC ? '#059669' : '#d97706',
        lineWidth: 3.5,
        label: i === 4 ? (isGC ? 'G≡C' : 'A=T') : i === 16 ? 'A=T' : undefined,
      });
    }
  }

  return {
    title: 'DNA Double Helix & Base Pairing (Watson–Crick Model)',
    subtitle: 'Antiparallel 5′→3′ Sugar-Phosphate Backbones • Hydrogen Bonds',
    formulaBox: 'Adenine (A) = Thymine (T) [2 H-bonds]   |   Guanine (G) ≡ Cytosine (C) [3 H-bonds]',
    steps: [
      '1. Twin helical backbones built of Deoxyribose sugar + Phosphate',
      '2. Purine-Pyrimidine pairing: A binds only T; G binds only C',
      '3. One full helical turn spans 3.4 nm (10 base pairs)',
      '4. Semiconservative replication unzips H-bonds via Helicase',
    ],
    primitives: [
      ...rungs,
      { type: 'curve_path', points: ptsA, smooth: true, stroke: '#2563eb', lineWidth: 6, label: "5' → 3' Strand" },
      { type: 'curve_path', points: ptsB, smooth: true, stroke: '#e11d48', lineWidth: 6, label: "3' ← 5' Strand" },
      { type: 'text', x: 500, y: 120, text: 'DNA Double Helix Architecture', bold: true, align: 'center', fontSize: 26, color: '#2563eb' },
      { type: 'text', x: 500, y: 810, text: '1 Complete Turn = 3.4 nm (10 bp)', align: 'center', fontSize: 20, boxed: true, color: '#059669' },
    ],
    spokenSummary: 'Rendered the DNA double helix with sugar-phosphate strands and complementary Adenine-Thymine and Guanine-Cytosine hydrogen base pairs.',
  };
}

function buildPunnettSquareScene(): WhiteboardVisualScene {
  return {
    title: 'Mendelian Genetics: Monohybrid Punnett Square (Tt × Tt)',
    subtitle: 'T = Dominant Tall Allele   •   t = Recessive Dwarf Allele',
    formulaBox: 'Phenotype Ratio = 3 Tall : 1 Dwarf   |   Genotype Ratio = 1 TT : 2 Tt : 1 tt',
    steps: [
      '1. Each heterozygous Tall parent (Tt) produces T and t gametes',
      '2. Cross gametes inside 2×2 Punnett grid to predict zygotes',
      '3. TT (25%) & Tt (50%) express dominant Tall phenotype (75%)',
      '4. Only homozygous tt (25%) expresses recessive Dwarf trait',
    ],
    primitives: [
      { type: 'rect', x: 300, y: 260, width: 250, height: 250, stroke: '#059669', fill: 'rgba(5,150,105,0.14)', label: 'TT (Tall)' },
      { type: 'rect', x: 550, y: 260, width: 250, height: 250, stroke: '#2563eb', fill: 'rgba(37,99,235,0.10)', label: 'Tt (Tall)' },
      { type: 'rect', x: 300, y: 510, width: 250, height: 250, stroke: '#2563eb', fill: 'rgba(37,99,235,0.10)', label: 'Tt (Tall)' },
      { type: 'rect', x: 550, y: 510, width: 250, height: 250, stroke: '#d97706', fill: 'rgba(217,119,6,0.16)', label: 'tt (Dwarf)' },
      { type: 'text', x: 425, y: 215, text: 'T (Parent 1)', bold: true, align: 'center', color: '#059669', fontSize: 26 },
      { type: 'text', x: 675, y: 215, text: 't (Parent 1)', bold: true, align: 'center', color: '#d97706', fontSize: 26 },
      { type: 'text', x: 205, y: 390, text: 'T', bold: true, align: 'center', color: '#059669', fontSize: 28 },
      { type: 'text', x: 205, y: 640, text: 't', bold: true, align: 'center', color: '#d97706', fontSize: 28 },
      { type: 'text', x: 550, y: 120, text: 'Punnett Cross: Tt × Tt', bold: true, align: 'center', fontSize: 26, color: '#059669' },
      { type: 'text', x: 550, y: 845, text: '75% Tall (TT, Tt) : 25% Dwarf (tt)', boxed: true, align: 'center', fontSize: 22, color: '#2563eb' },
    ],
    spokenSummary: 'Drawn the 2-by-2 Mendelian Punnett square for Tt crossed with Tt, yielding a 3-to-1 Tall-to-Dwarf phenotype ratio.',
  };
}

function buildTitrationCurveScene(): WhiteboardVisualScene {
  // Smooth S-shaped logistic titration curve: 2 + 10 / (1 + exp(-(x - 5)*2.5))
  const curveExpr = '2 + 10 / (1 + exp(-2.5 * (x - 5)))';
  return {
    title: 'Acid–Base Titration Curve (Strong Acid + Strong Base)',
    subtitle: 'Adding NaOH Base to HCl Acid • Equivalence Point at pH 7.0',
    formulaBox: 'HCl + NaOH → NaCl + H₂O   |   M₁V₁ = M₂V₂ at Equivalence Point',
    steps: [
      '1. Initial pH ≈ 2.0 (excess H⁺ ions in HCl flask)',
      '2. Buffer/gradual rise until volume nears Equivalence (50 mL)',
      '3. Steep vertical jump crosses Equivalence Point at pH = 7.0',
      '4. Excess OH⁻ flattens curve near pH 12.0 (basic plateau)',
    ],
    primitives: [
      {
        type: 'coordinate_graph',
        title: 'pH vs Volume of NaOH Added (×10 mL)',
        xMin: 0,
        xMax: 10,
        yMin: 0,
        yMax: 14,
        xLabel: 'Vol NaOH (×10mL)',
        yLabel: 'pH',
        curves: [{ expression: curveExpr, label: 'Titration pH Curve', color: '#059669' }],
        points: [
          { x: 5, y: 7, label: 'Equivalence (pH 7)', color: '#dc2626' },
          { x: 0.4, y: 2, label: 'Initial Acid pH 2', color: '#d97706' },
        ],
      },
    ],
    spokenSummary: 'Plotted an acid-base titration S-curve showing the sharp vertical rise through the equivalence point at pH 7.',
  };
}

function buildActionPotentialScene(): WhiteboardVisualScene {
  return {
    title: 'Neuronal Action Potential Voltage Spike (-70 mV → +30 mV)',
    subtitle: 'Ion Channel Dynamics Across Axon Membrane',
    formulaBox: 'Resting (-70 mV) → Threshold (-55 mV) → Na⁺ Spike (+30 mV) → K⁺ Repolarization',
    steps: [
      '1. Resting State: Na⁺/K⁺ pump holds axon inside at -70 mV',
      '2. Depolarization: Voltage-gated Na⁺ channels open → spike to +30 mV',
      '3. Repolarization: K⁺ ions efflux out, restoring negative potential',
      '4. Hyperpolarization refractory dip prevents backward firing',
    ],
    primitives: [
      {
        type: 'curve_path',
        points: [
          { x: 110, y: 690 },
          { x: 250, y: 690 },
          { x: 330, y: 620 }, // -55 mV threshold
          { x: 430, y: 170 }, // +30 mV spike
          { x: 560, y: 770 }, // hyperpolarization overshoot -80mV
          { x: 690, y: 690 },
          { x: 890, y: 690 },
        ],
        stroke: '#e11d48',
        lineWidth: 6,
        label: 'Membrane Voltage',
      },
      // Axes
      { type: 'line', x1: 100, y1: 130, x2: 100, y2: 830, stroke: '#64748b', arrowStart: true, lineWidth: 3 },
      { type: 'line', x1: 100, y1: 620, x2: 910, y2: 620, stroke: '#d97706', dashed: true, lineWidth: 2, label: 'Threshold (-55 mV)' },
      { type: 'circle', cx: 430, cy: 170, r: 16, fill: '#e11d48', stroke: '#e11d48' },
      { type: 'text', x: 430, y: 120, text: 'Peak +30 mV (Na⁺ Influx)', bold: true, align: 'center', color: '#e11d48', fontSize: 22 },
      { type: 'text', x: 200, y: 745, text: 'Resting -70 mV', bold: true, color: '#2563eb', fontSize: 20 },
      { type: 'text', x: 620, y: 825, text: 'Hyperpolarization Dip', bold: true, align: 'center', color: '#7c3aed', fontSize: 20 },
    ],
    spokenSummary: 'Drawn the neuronal action potential waveform showing threshold at minus 55 millivolts, rapid sodium depolarization to plus 30 millivolts, and potassium repolarization.',
  };
}

export function buildSceneForDiagramStamp(
  stamp: DiagramStampType,
  subject: SubjectDefinition,
  concept?: ConceptNode
): WhiteboardVisualScene {
  const conceptTitle = concept?.title || subject.name;
  const formula = concept?.keyFormulaOrQuote || subject.concepts[0]?.keyFormulaOrQuote || '';
  const summary = concept?.summary || subject.tagline;

  switch (stamp) {
    case 'parabola':
      return buildCurveGraphScene('x^2 - 4', 1.5, `${conceptTitle}: Quadratic Parabola`);
    case 'sine_wave':
      return buildCurveGraphScene('3*sin(x)', 1.0, `${conceptTitle}: Harmonic Sine Wave`);
    case 'free_body':
      return {
        title: 'Inclined Plane Free-Body Vector Diagram',
        subtitle: 'Force Resolution Parallel & Perpendicular to Ramp (θ)',
        formulaBox: formula || 'F∥ = m·g·sinθ   |   Normal N = m·g·cosθ',
        steps: [
          '1. Weight vector mg pulls straight vertically downward',
          '2. Parallel component mg·sinθ accelerates block down slope',
          '3. Normal reaction N balances perpendicular mg·cosθ',
          '4. Kinetic friction f_k = μN opposes downward slip',
        ],
        primitives: [
          {
            type: 'polygon',
            points: [
              { x: 160, y: 760, vertexLabel: 'θ' },
              { x: 840, y: 760 },
              { x: 840, y: 290 },
            ],
            rightAngleAtVertex: 1,
            stroke: '#2563eb',
            fill: 'rgba(37,99,235,0.08)',
          },
          { type: 'polygon', points: [{ x: 460, y: 550 }, { x: 575, y: 472 }, { x: 525, y: 398 }, { x: 410, y: 476 }], stroke: '#d97706', fill: 'rgba(217,119,6,0.22)', label: 'Mass m' },
          { type: 'line', x1: 495, y1: 475, x2: 495, y2: 710, stroke: '#dc2626', arrowEnd: true, lineWidth: 5, label: 'mg ↓' },
          { type: 'line', x1: 495, y1: 475, x2: 395, y2: 325, stroke: '#059669', arrowEnd: true, lineWidth: 5, label: 'Normal N' },
          { type: 'line', x1: 495, y1: 475, x2: 335, y2: 585, stroke: '#7c3aed', arrowEnd: true, lineWidth: 5, label: 'mg·sinθ' },
        ],
        spokenSummary: 'Drawn a free-body diagram on an inclined ramp resolving weight into normal and down-slope components.',
      };
    case 'ray_optics':
      return {
        title: 'Convex Converging Lens — Ray Optics',
        subtitle: 'Refraction of Parallel Rays Through Principal Focus F',
        formulaBox: formula || '1/f = 1/v - 1/u   |   Snell: n₁sinθ₁ = n₂sinθ₂',
        steps: [
          '1. Paraxial light rays enter parallel to the Principal Axis',
          '2. Convex glass slows wavefront centerline & bends rays inward',
          '3. All refracted rays converge crisply at Principal Focus F',
          '4. Focal length f depends on lens curvature & refractive index',
        ],
        primitives: [
          { type: 'line', x1: 90, y1: 500, x2: 910, y2: 500, stroke: '#64748b', dashed: true, lineWidth: 2, label: 'Principal Axis' },
          { type: 'ellipse', cx: 450, cy: 500, rx: 46, ry: 270, stroke: '#2563eb', fill: 'rgba(56,189,248,0.18)', label: 'Convex Lens' },
          { type: 'line', x1: 110, y1: 310, x2: 450, y2: 310, stroke: '#d97706', arrowEnd: true, lineWidth: 3.5 },
          { type: 'line', x1: 450, y1: 310, x2: 810, y2: 540, stroke: '#d97706', arrowEnd: true, lineWidth: 3.5 },
          { type: 'line', x1: 110, y1: 690, x2: 450, y2: 690, stroke: '#d97706', arrowEnd: true, lineWidth: 3.5 },
          { type: 'line', x1: 450, y1: 690, x2: 810, y2: 460, stroke: '#d97706', arrowEnd: true, lineWidth: 3.5 },
          { type: 'circle', cx: 748, cy: 500, r: 14, fill: '#dc2626', stroke: '#dc2626' },
          { type: 'text', x: 750, y: 448, text: 'Focus F', bold: true, align: 'center', color: '#dc2626', fontSize: 24 },
        ],
        spokenSummary: 'Drawn convex lens converging ray optics showing parallel incident rays focusing at the principal focus F.',
      };
    case 'bohr_atom':
      return {
        title: 'Bohr Atomic Orbitals & Quantized Shells',
        subtitle: 'Nucleus (p⁺ + n⁰) Surrounded by K (n=1), L (n=2), M (n=3) Shells',
        formulaBox: formula || 'Max Electrons = 2n²   |   E_n = -13.6 / n² eV',
        steps: [
          '1. Dense central nucleus holds protons (+) & neutrons',
          '2. Electrons occupy discrete quantized energy orbits (n = 1,2,3)',
          '3. Shell capacities follow 2n²: K=2, L=8, M=18 electrons',
          '4. Quantum jumps emit/absorb photon energy ΔE = hν',
        ],
        primitives: [
          { type: 'circle', cx: 500, cy: 500, r: 42, fill: '#dc2626', stroke: '#dc2626', label: 'Nucleus' },
          { type: 'circle', cx: 500, cy: 500, r: 135, stroke: '#059669', dashed: false },
          { type: 'circle', cx: 500, cy: 500, r: 245, stroke: '#2563eb', dashed: false },
          { type: 'circle', cx: 500, cy: 500, r: 360, stroke: '#7c3aed', dashed: true, label: 'M Shell (n=3)' },
          // Electrons
          { type: 'circle', cx: 500, cy: 365, r: 14, fill: '#d97706', stroke: '#d97706' },
          { type: 'circle', cx: 500, cy: 635, r: 14, fill: '#d97706', stroke: '#d97706' },
          { type: 'circle', cx: 255, cy: 500, r: 14, fill: '#2563eb', stroke: '#2563eb' },
          { type: 'circle', cx: 745, cy: 500, r: 14, fill: '#2563eb', stroke: '#2563eb' },
          { type: 'circle', cx: 500, cy: 140, r: 14, fill: '#7c3aed', stroke: '#7c3aed', label: 'Valence e⁻' },
        ],
        spokenSummary: 'Drawn the Bohr atomic model with central nucleus and quantized K, L, and M electron shells.',
      };
    case 'benzene_ring': {
      const hexPts = Array.from({ length: 6 }, (_, i) => {
        const ang = (i * Math.PI) / 3 - Math.PI / 2;
        return { x: 500 + Math.cos(ang) * 260, y: 500 + Math.sin(ang) * 260, vertexLabel: `C${i + 1}` };
      });
      return {
        title: 'Benzene C₆H₆ — Aromatic 6π Resonance Ring',
        subtitle: 'Planar sp² Carbon Hexagon • 120° Bond Angles',
        formulaBox: formula || 'Hückel Rule: (4n + 2) π electrons = 6π (n = 1)',
        steps: [
          '1. Six sp² carbon atoms form a flat 120° regular hexagon',
          '2. Unhybridized p-orbitals overlap continuously above/below ring',
          '3. Inner circle depicts delocalized 6π electron resonance cloud',
          '4. High resonance stability favors substitution over addition',
        ],
        primitives: [
          { type: 'polygon', points: hexPts, stroke: '#059669', fill: 'rgba(5,150,105,0.08)', label: 'C₆H₆ (120°)' },
          { type: 'circle', cx: 500, cy: 500, r: 155, stroke: '#d97706', dashed: true, label: '6π Cloud' },
        ],
        spokenSummary: 'Rendered the planar hexagon structure of Benzene with its delocalized 6-pi aromatic resonance ring.',
      };
    }
    case 'plant_cell':
      return {
        title: 'Plant Cell & Chloroplast Ultrastructure',
        subtitle: 'Cellulose Wall • Central Vacuole • Photosynthetic Plastids',
        formulaBox: formula || 'Cell Wall + Large Central Vacuole + Chloroplasts',
        steps: [
          '1. Rigid outer Cellulose Cell Wall provides structural support',
          '2. Large Central Vacuole maintains osmotic turgor pressure',
          '3. Green Chloroplasts convert solar photons into glucose',
          '4. Nucleus & mitochondria coordinate genetics and ATP',
        ],
        primitives: [
          { type: 'rect', x: 140, y: 170, width: 720, height: 640, rounded: 28, stroke: '#059669', fill: 'rgba(5,150,105,0.10)', widthLabel: 'Cellulose Wall', heightLabel: 'Plasma Membrane' },
          { type: 'ellipse', cx: 420, cy: 520, rx: 190, ry: 170, stroke: '#2563eb', fill: 'rgba(37,99,235,0.16)', label: 'Central Vacuole (Turgor)' },
          { type: 'circle', cx: 700, cy: 360, r: 82, stroke: '#7c3aed', fill: 'rgba(124,58,237,0.2)', label: 'Nucleus' },
          { type: 'ellipse', cx: 250, cy: 290, rx: 58, ry: 30, rotationDeg: 22, stroke: '#15803d', fill: '#22c55e', label: 'Chloroplast' },
          { type: 'ellipse', cx: 710, cy: 670, rx: 58, ry: 30, rotationDeg: -20, stroke: '#15803d', fill: '#22c55e', label: 'Chloroplast' },
        ],
        spokenSummary: 'Drawn the plant cell ultrastructure highlighting the cellulose cell wall, central vacuole, nucleus, and green chloroplasts.',
      };
    case 'photosynthesis':
      return {
        title: 'Photosynthesis Reaction & Calvin Cycle',
        subtitle: 'Thylakoid Light Capture → Stroma Sugar Synthesis',
        formulaBox: '6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂ ↑',
        steps: [
          '1. Chlorophyll absorbs sunlight; Water splits via Photolysis (O₂ released)',
          '2. ATP & NADPH energy carriers shuttle to Chloroplast Stroma',
          '3. RuBisCO enzyme fixes atmospheric CO₂ in the Calvin Cycle',
          '4. Synthesizes Glucose (C₆H₁₂O₆) powering all plant growth',
        ],
        primitives: [
          { type: 'circle', cx: 210, cy: 230, r: 82, fill: 'rgba(245,158,11,0.3)', stroke: '#d97706', label: 'Solar Light' },
          { type: 'rect', x: 350, y: 310, width: 320, height: 340, rounded: 32, stroke: '#059669', fill: 'rgba(5,150,105,0.15)', label: 'Chloroplast' },
          { type: 'line', x1: 270, y1: 290, x2: 355, y2: 390, stroke: '#d97706', arrowEnd: true, lineWidth: 5, label: 'Photons' },
          { type: 'line', x1: 120, y1: 520, x2: 345, y2: 520, stroke: '#2563eb', arrowEnd: true, lineWidth: 5, label: '6CO₂ + 6H₂O' },
          { type: 'line', x1: 675, y1: 420, x2: 880, y2: 320, stroke: '#059669', arrowEnd: true, lineWidth: 5, label: '6O₂ ↑' },
          { type: 'line', x1: 675, y1: 540, x2: 880, y2: 600, stroke: '#7c3aed', arrowEnd: true, lineWidth: 5, label: 'C₆H₁₂O₆' },
        ],
        spokenSummary: 'Visualized photosynthesis showing sunlight and water entering the chloroplast to yield oxygen gas and glucose.',
      };
    case 'neuron_synapse':
      return {
        title: 'Neuron & Saltatory Synaptic Conduction',
        subtitle: 'Action Potential Propagation & Chemical Neurotransmitter Release',
        formulaBox: formula || '-70 mV Resting → +30 mV Na⁺ Spike → Synaptic Cleft',
        steps: [
          '1. Dendrites receive incoming signals into the cell Soma',
          '2. Action potential leaps between insulated Myelin Nodes (Saltatory)',
          '3. Impulse reaches Axon Terminal opening Voltage-gated Ca²⁺ channels',
          '4. Vesicles release neurotransmitters across the Synaptic Cleft',
        ],
        primitives: [
          { type: 'circle', cx: 190, cy: 500, r: 90, stroke: '#e11d48', fill: 'rgba(225,29,72,0.16)', label: 'Soma' },
          { type: 'line', x1: 280, y1: 500, x2: 790, y2: 500, stroke: '#d97706', lineWidth: 6 },
          { type: 'rect', x: 320, y: 455, width: 110, height: 90, rounded: 16, stroke: '#2563eb', fill: 'rgba(37,99,235,0.2)', label: 'Myelin' },
          { type: 'rect', x: 465, y: 455, width: 110, height: 90, rounded: 16, stroke: '#2563eb', fill: 'rgba(37,99,235,0.2)', label: 'Myelin' },
          { type: 'rect', x: 610, y: 455, width: 110, height: 90, rounded: 16, stroke: '#2563eb', fill: 'rgba(37,99,235,0.2)', label: 'Myelin' },
          { type: 'line', x1: 790, y1: 500, x2: 890, y2: 390, stroke: '#7c3aed', arrowEnd: true, lineWidth: 5 },
          { type: 'line', x1: 790, y1: 500, x2: 890, y2: 610, stroke: '#7c3aed', arrowEnd: true, lineWidth: 5 },
          { type: 'text', x: 520, y: 375, text: 'Nodes of Ranvier (Fast Leap)', bold: true, align: 'center', color: '#2563eb', fontSize: 22 },
          { type: 'text', x: 850, y: 330, text: 'Synapse', bold: true, color: '#7c3aed', fontSize: 22 },
        ],
        spokenSummary: 'Rendered a myelinated neuron diagram showing the soma, Nodes of Ranvier, and synaptic terminal output.',
      };
    case 'heart_chambers':
      return {
        title: 'Human 4-Chambered Heart & Double Circulation',
        subtitle: 'Pulmonary Oxygenation Loop + Systemic Aortic Pump',
        formulaBox: formula || 'RA → RV → Lungs (O₂) → LA → LV (Thick Wall) → Aorta',
        steps: [
          '1. Deoxygenated venous blood enters Right Atrium (RA) → RV',
          '2. Right Ventricle pumps blood via Pulmonary Artery to Lungs',
          '3. Oxygen-rich blood returns to Left Atrium (LA) → Left Ventricle',
          '4. Muscular Left Ventricle drives systemic circulation through Aorta',
        ],
        primitives: [
          { type: 'rect', x: 240, y: 210, width: 255, height: 270, rounded: 18, stroke: '#2563eb', fill: 'rgba(37,99,235,0.16)', label: 'Right Atrium (RA)' },
          { type: 'rect', x: 240, y: 495, width: 255, height: 300, rounded: 18, stroke: '#2563eb', fill: 'rgba(37,99,235,0.22)', label: 'Right Ventricle (RV)' },
          { type: 'rect', x: 515, y: 210, width: 255, height: 270, rounded: 18, stroke: '#dc2626', fill: 'rgba(220,38,38,0.16)', label: 'Left Atrium (LA)' },
          { type: 'rect', x: 515, y: 495, width: 255, height: 300, rounded: 18, stroke: '#dc2626', fill: 'rgba(220,38,38,0.26)', label: 'Left Ventricle (LV)' },
          { type: 'line', x1: 365, y1: 420, x2: 365, y2: 560, stroke: '#1d4ed8', arrowEnd: true, lineWidth: 5 },
          { type: 'line', x1: 645, y1: 420, x2: 645, y2: 560, stroke: '#dc2626', arrowEnd: true, lineWidth: 5 },
          { type: 'text', x: 365, y: 155, text: 'Deoxygenated (Blue)', bold: true, align: 'center', color: '#2563eb', fontSize: 20 },
          { type: 'text', x: 645, y: 155, text: 'Oxygenated (Red)', bold: true, align: 'center', color: '#dc2626', fontSize: 20 },
        ],
        spokenSummary: 'Drawn the 4-chambered human heart separating deoxygenated right chambers and oxygenated left chambers.',
      };
    case 'thirukkural_frame':
      return {
        title: 'திருக்குறள் — குறள் வெண்பா அமைப்பு (Thirukkural)',
        subtitle: 'ஈரடி வெண்பா • முதல் அடி 4 சீர் • இரண்டாம் அடி 3 சீர்',
        formulaBox: formula || 'கற்க கசடறக் கற்பவை கற்றபின் / நிற்க அதற்குத் தக (குறள் 391)',
        steps: [
          '1. ஈரடிகள் (2 Lines) மற்றும் மொத்தம் 7 சீர்கள் கொண்டது',
          '2. முதல் அடி (அளவடி): 4 சீர்கள்; இரண்டாம் அடி (சிந்தடி): 3 சீர்கள்',
          '3. ஈற்றுச் சீர் நாள், மலர், காசு, பிறப்பு வாய்பாடுகளில் முடியும்',
          '4. கருத்து: குற்றமின்றித் தெளிவாகக் கற்று அறவழியில் நிற்க வேண்டும்',
        ],
        primitives: [
          { type: 'rect', x: 90, y: 190, width: 820, height: 560, rounded: 28, stroke: '#d97706', fill: 'rgba(245,158,11,0.10)' },
          { type: 'rect', x: 120, y: 220, width: 760, height: 500, rounded: 20, stroke: '#f59e0b', fill: 'transparent' },
          { type: 'text', x: 500, y: 310, text: 'திருக்குறள் (குறள் 391 — கல்வி)', bold: true, align: 'center', color: '#d97706', fontSize: 26 },
          { type: 'text', x: 500, y: 425, text: 'கற்க   கசடறக்   கற்பவை   கற்றபின்', bold: true, align: 'center', fontSize: 26, boxed: true },
          { type: 'text', x: 500, y: 530, text: 'நிற்க   அதற்குத்   தக.', bold: true, align: 'center', fontSize: 26, boxed: true },
          { type: 'text', x: 500, y: 655, text: 'அடி 1: 4 சீர்கள்   |   அடி 2: 3 சீர்கள்', align: 'center', color: '#059669', bold: true, fontSize: 21 },
        ],
        spokenSummary: 'திருக்குறள் குறள் வெண்பா அமைப்பும் கல்வியின் மேன்மையை உணர்த்தும் 391-ஆம் குறளும் வெண்பலகையில் வரையப்பட்டுள்ளன.',
      };
    case 'story_arc':
    default:
      return {
        title: `${conceptTitle} — Visual Story Arc & Structure`,
        subtitle: summary.slice(0, 72),
        formulaBox: formula || 'Exposition → Rising Action → Climax → Falling Action → Resolution',
        steps: [
          '1. Exposition introduces setting, characters, and equilibrium',
          '2. Inciting Incident & Rising Action escalate narrative tension',
          '3. Climax forms the decisive dramatic turning point',
          '4. Falling Action resolves conflicts into new equilibrium',
        ],
        primitives: [
          {
            type: 'curve_path',
            points: [
              { x: 100, y: 740 },
              { x: 260, y: 740 },
              { x: 520, y: 210 },
              { x: 750, y: 740 },
              { x: 900, y: 740 },
            ],
            stroke: '#2563eb',
            lineWidth: 6,
          },
          { type: 'circle', cx: 520, cy: 210, r: 18, fill: '#dc2626', stroke: '#dc2626' },
          { type: 'text', x: 520, y: 155, text: 'CLIMAX (Turning Point)', bold: true, align: 'center', color: '#dc2626', fontSize: 24 },
          { type: 'text', x: 180, y: 800, text: 'Exposition', bold: true, align: 'center', color: '#059669', fontSize: 20 },
          { type: 'text', x: 350, y: 480, text: 'Rising Action', bold: true, align: 'center', color: '#2563eb', fontSize: 20 },
          { type: 'text', x: 820, y: 800, text: 'Resolution', bold: true, align: 'center', color: '#7c3aed', fontSize: 20 },
        ],
        spokenSummary: 'Drawn Freytag’s Story Arc pyramid illustrating exposition, rising action, climax turning point, and resolution.',
      };
  }
}

// ============================================================================
// 4. NATURAL LANGUAGE VISUAL PARSER FOR ANY SHAPE, GRAPH OR CONCEPT
// ============================================================================

export function buildParametricVisualScene(
  rawQuery: string,
  subject: SubjectDefinition
): { scene: WhiteboardVisualScene; isExactMatch: boolean } {
  const q = rawQuery.trim();
  const lower = q.toLowerCase();

  // Extract optional unit (cm, m, mm, in, ft, units)
  const unitMatch = lower.match(/\b(cm|mm|m|km|in|inch|ft|units?)\b/);
  const unit = unitMatch ? unitMatch[1] : 'cm';

  // Extract all numbers in text
  const numMatches = lower.match(/-?\d+(?:\.\d+)?/g) || [];
  const nums = numMatches.map(Number).filter((n) => Number.isFinite(n));

  // A. STRAIGHT LINE / SLOPE / GRAPH AND DRAW A SLOPE
  const hasExplicitCoords = q.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g);
  if (
    lower.includes('slope') ||
    lower.includes('straight line') ||
    lower.includes('linear') ||
    /y\s*=\s*-?\d*\.?\d*\s*x/i.test(lower) ||
    (lower.includes('graph') && (lower.includes('line') || lower.includes('intercept')))
  ) {
    // 1. Two points given: (x1, y1) and (x2, y2)
    if (hasExplicitCoords && hasExplicitCoords.length >= 2) {
      const p1 = hasExplicitCoords[0].match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const p2 = hasExplicitCoords[1].match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const dx = p2[0] - p1[0];
      const m = dx !== 0 ? (p2[1] - p1[1]) / dx : 0;
      const c = p1[1] - m * p1[0];
      return {
        scene: buildLinearSlopeGraphScene(m, c, { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] }),
        isExactMatch: true,
      };
    }

    // 2. Equation form y = mx + c
    const eqMatch = lower.match(/y\s*=\s*([+-]?\d*\.?\d*)\s*\*?\s*x\s*([+-]\s*\d+(?:\.\d+)?)?/i);
    if (eqMatch) {
      let rawM = eqMatch[1].replace(/\s+/g, '');
      const m = rawM === '' || rawM === '+' ? 1 : rawM === '-' ? -1 : parseFloat(rawM);
      const c = eqMatch[2] ? parseFloat(eqMatch[2].replace(/\s+/g, '')) : 0;
      return {
        scene: buildLinearSlopeGraphScene(m, c),
        isExactMatch: true,
      };
    }

    // 3. "slope 2 intercept 3" or "draw a slope"
    const slopeMatch = lower.match(/slope\s*(?:=|of|is)?\s*(-?\d+(?:\.\d+)?)/);
    const intMatch = lower.match(/intercept\s*(?:=|of|is)?\s*(-?\d+(?:\.\d+)?)/);
    const m = slopeMatch ? parseFloat(slopeMatch[1]) : 1.5;
    const c = intMatch ? parseFloat(intMatch[1]) : 1;
    return {
      scene: buildLinearSlopeGraphScene(m, c),
      isExactMatch: true,
    };
  }

  // B. CIRCLE WITH GIVEN RADIUS OR DIAMETER
  if (lower.includes('circle') || lower.includes('வட்டம்')) {
    const rMatch = lower.match(/(?:radius|r)\s*(?:=|of|is)?\s*(\d+(?:\.\d+)?)/);
    const dMatch = lower.match(/(?:diameter|d)\s*(?:=|of|is)?\s*(\d+(?:\.\d+)?)/);
    const radius = rMatch
      ? parseFloat(rMatch[1])
      : dMatch
      ? parseFloat(dMatch[1]) / 2
      : nums.find((n) => n > 0) ?? 7;
    return {
      scene: buildCircleScene(radius, unit),
      isExactMatch: true,
    };
  }

  // C. SQUARE WITH SIDE
  if (lower.includes('square') && !lower.includes('punnett')) {
    const sideMatch = lower.match(/(?:side|length|s|a)\s*(?:=|of|is)?\s*(\d+(?:\.\d+)?)/);
    const side = sideMatch ? parseFloat(sideMatch[1]) : nums.find((n) => n > 0) ?? 6;
    return {
      scene: buildSquareScene(side, unit),
      isExactMatch: true,
    };
  }

  // D. RECTANGLE WITH LENGTH & WIDTH
  if (lower.includes('rectangle') || lower.includes('rect ') || lower.includes('செவ்வகம்')) {
    const lMatch = lower.match(/(?:length|l)\s*(?:=|of|is)?\s*(\d+(?:\.\d+)?)/);
    const wMatch = lower.match(/(?:width|breadth|w|b)\s*(?:=|of|is)?\s*(\d+(?:\.\d+)?)/);
    const byMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)/);
    let length = 10;
    let width = 6;
    if (lMatch && wMatch) {
      length = parseFloat(lMatch[1]);
      width = parseFloat(wMatch[1]);
    } else if (byMatch) {
      length = parseFloat(byMatch[1]);
      width = parseFloat(byMatch[2]);
    } else if (nums.length >= 2) {
      length = Math.abs(nums[0]) || 10;
      width = Math.abs(nums[1]) || 6;
    } else if (nums.length === 1 && nums[0] > 0) {
      length = nums[0];
      width = Number((nums[0] * 0.6).toFixed(1));
    }
    return {
      scene: buildRectangleScene(length, width, unit),
      isExactMatch: true,
    };
  }

  // E. TRIANGLE (Right, Equilateral, Isosceles, or 3 Sides)
  if (lower.includes('triangle') || lower.includes('முக்கோணம்')) {
    const baseMatch = lower.match(/base\s*(?:=|of|is)?\s*(\d+(?:\.\d+)?)/);
    const heightMatch = lower.match(/height\s*(?:=|of|is)?\s*(\d+(?:\.\d+)?)/);
    const type: 'right' | 'equilateral' | 'isosceles' = lower.includes('equilateral')
      ? 'equilateral'
      : lower.includes('isosceles')
      ? 'isosceles'
      : 'right';

    if (!baseMatch && !heightMatch && nums.length >= 3) {
      return {
        scene: buildTriangleScene(nums[0], nums[1], type, unit, [nums[0], nums[1], nums[2]]),
        isExactMatch: true,
      };
    }

    const base = baseMatch ? parseFloat(baseMatch[1]) : nums[0] > 0 ? nums[0] : 8;
    const height = heightMatch ? parseFloat(heightMatch[1]) : nums[1] > 0 ? nums[1] : 6;
    return {
      scene: buildTriangleScene(base, height, type, unit),
      isExactMatch: true,
    };
  }

  // F. EQUATION / FUNCTION / PARABOLA / TRIG CURVE / TANGENT GRAPH
  const funcEqMatch = lower.match(/y\s*=\s*([a-z0-9^+\-*/().\s]+)/i);
  if (
    funcEqMatch ||
    lower.includes('parabola') ||
    lower.includes('sine') ||
    lower.includes('cosine') ||
    lower.includes('tangent') ||
    lower.includes('quadratic') ||
    lower.includes('cubic') ||
    lower.includes('exponential') ||
    (lower.includes('graph') && (lower.includes('sin') || lower.includes('cos') || lower.includes('x^')))
  ) {
    let expr = 'x^2 - 4';
    let title = undefined;
    if (funcEqMatch) {
      expr = funcEqMatch[1].trim();
    } else if (lower.includes('sine') || lower.includes('sin(')) {
      expr = '3*sin(x)';
      title = 'Harmonic Wave: y = 3·sin(x)';
    } else if (lower.includes('cosine') || lower.includes('cos(')) {
      expr = '3*cos(x)';
      title = 'Cosine Wave: y = 3·cos(x)';
    } else if (lower.includes('cubic')) {
      expr = '0.2*x^3 - 1.5*x';
      title = 'Cubic Curve: y = 0.2x³ - 1.5x';
    } else if (lower.includes('exponential')) {
      expr = '0.5*exp(0.5*x)';
      title = 'Exponential Growth Curve';
    }
    const tanMatch = lower.match(/(?:tangent|at)\s*(?:x\s*=\s*)?(-?\d+(?:\.\d+)?)/);
    const x0 = tanMatch ? parseFloat(tanMatch[1]) : 1.5;
    return {
      scene: buildCurveGraphScene(expr, x0, title),
      isExactMatch: true,
    };
  }

  // G. SUBJECT ADVANCED CONCEPT SCENES
  if (lower.includes('projectile') || lower.includes('trajectory')) {
    return { scene: buildProjectileMotionScene(), isExactMatch: true };
  }
  if (lower.includes('circuit') || lower.includes('ohm') || lower.includes('resistor')) {
    return { scene: buildElectricCircuitScene(), isExactMatch: true };
  }
  if (lower.includes('dna') || lower.includes('helix') || lower.includes('watson')) {
    return { scene: buildDnaHelixScene(), isExactMatch: true };
  }
  if (lower.includes('punnett') || lower.includes('mendel') || lower.includes('dihybrid')) {
    return { scene: buildPunnettSquareScene(), isExactMatch: true };
  }
  if (lower.includes('titration') || lower.includes('ph curve') || lower.includes('equivalence point')) {
    return { scene: buildTitrationCurveScene(), isExactMatch: true };
  }
  if (lower.includes('action potential') || lower.includes('-70') || lower.includes('depolariz')) {
    return { scene: buildActionPotentialScene(), isExactMatch: true };
  }
  if (lower.includes('incline') || lower.includes('free body') || lower.includes('ramp')) {
    return { scene: buildSceneForDiagramStamp('free_body', subject), isExactMatch: true };
  }
  if (lower.includes('lens') || lower.includes('refraction') || lower.includes('optic')) {
    return { scene: buildSceneForDiagramStamp('ray_optics', subject), isExactMatch: true };
  }
  if (lower.includes('bohr') || lower.includes('atom') || lower.includes('orbital')) {
    return { scene: buildSceneForDiagramStamp('bohr_atom', subject), isExactMatch: true };
  }
  if (lower.includes('benzene') || lower.includes('aromatic')) {
    return { scene: buildSceneForDiagramStamp('benzene_ring', subject), isExactMatch: true };
  }
  if (lower.includes('plant cell') || lower.includes('chloroplast')) {
    return { scene: buildSceneForDiagramStamp('plant_cell', subject), isExactMatch: true };
  }
  if (lower.includes('photosynth')) {
    return { scene: buildSceneForDiagramStamp('photosynthesis', subject), isExactMatch: true };
  }
  if (lower.includes('neuron') || lower.includes('synapse')) {
    return { scene: buildSceneForDiagramStamp('neuron_synapse', subject), isExactMatch: true };
  }
  if (lower.includes('heart') || lower.includes('circulation') || lower.includes('ventricle')) {
    return { scene: buildSceneForDiagramStamp('heart_chambers', subject), isExactMatch: true };
  }
  if (lower.includes('kural') || lower.includes('திருக்குறள்')) {
    return { scene: buildSceneForDiagramStamp('thirukkural_frame', subject), isExactMatch: true };
  }
  if (lower.includes('story arc') || lower.includes('climax') || lower.includes('pyramid')) {
    return { scene: buildSceneForDiagramStamp('story_arc', subject), isExactMatch: true };
  }

  // Fallback contextual scene for any unrecognized free-form request (allows AI enrichment step)
  const fallbackStamp = subject.concepts[0]?.diagramStamp || 'parabola';
  const baseScene = buildSceneForDiagramStamp(fallbackStamp, subject, subject.concepts[0]);
  return {
    scene: {
      ...baseScene,
      title: `${subject.name}: ${q.slice(0, 48)}`,
    },
    isExactMatch: false,
  };
}

// ============================================================================
// 5. THEME-AWARE ANIMATED CANVAS RENDERER
// ============================================================================

export interface RenderSceneOptions {
  theme: BoardTheme;
  bgStyle: 'plain' | 'grid' | 'lined' | 'dots';
  boardWidth: number;
  boardHeight: number;
  subjectName: string;
  animate?: boolean;
  onComplete?: () => void;
}

interface ThemePalette {
  surfaceTop: string;
  surfaceBottom: string;
  gridStroke: string;
  textPrimary: string;
  textMuted: string;
  panelBg: string;
  panelBorder: string;
  formulaBg: string;
  formulaText: string;
  accentBlue: string;
  accentRed: string;
  accentGreen: string;
  accentAmber: string;
  accentPurple: string;
  glowBlur: number;
}

function getThemePalette(theme: BoardTheme): ThemePalette {
  if (theme === 'whiteboard') {
    return {
      surfaceTop: '#ffffff',
      surfaceBottom: '#f8fafc',
      gridStroke: 'rgba(148, 163, 184, 0.22)',
      textPrimary: '#0f172a',
      textMuted: '#475569',
      panelBg: 'rgba(241, 245, 249, 0.85)',
      panelBorder: 'rgba(148, 163, 184, 0.45)',
      formulaBg: 'rgba(254, 243, 199, 0.88)',
      formulaText: '#92400e',
      accentBlue: '#2563eb',
      accentRed: '#dc2626',
      accentGreen: '#059669',
      accentAmber: '#d97706',
      accentPurple: '#7c3aed',
      glowBlur: 0,
    };
  }

  return {
    surfaceTop: '#0b1322',
    surfaceBottom: '#060a12',
    gridStroke: 'rgba(56, 189, 248, 0.11)',
    textPrimary: '#f8fafc',
    textMuted: '#94a3b8',
    panelBg: 'rgba(15, 23, 42, 0.72)',
    panelBorder: 'rgba(148, 163, 184, 0.26)',
    formulaBg: 'rgba(120, 53, 15, 0.35)',
    formulaText: '#fde68a',
    accentBlue: '#38bdf8',
    accentRed: '#fb7185',
    accentGreen: '#34d399',
    accentAmber: '#fbbf24',
    accentPurple: '#c084fc',
    glowBlur: 7,
  };
}

// Automatically guarantees crisp contrast when switching between Whiteboard & Blackboard
function adaptStrokeColor(raw: string | undefined, theme: BoardTheme, fallback: string): string {
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (theme === 'whiteboard') {
    if (lower === '#ffffff' || lower === '#f8fafc' || lower === '#e2e8f0') return '#0f172a';
    if (lower === '#22d3ee') return '#0284c7';
    if (lower === '#fbbf24' || lower === '#fde68a') return '#b45309';
    if (lower === '#34d399') return '#059669';
    if (lower === '#c084fc') return '#7c3aed';
  } else {
    if (lower === '#0f172a' || lower === '#1e293b' || lower === '#000000') return '#f8fafc';
    if (lower === '#2563eb' || lower === '#1d4ed8') return '#38bdf8';
    if (lower === '#dc2626') return '#fb7185';
    if (lower === '#059669') return '#34d399';
    if (lower === '#7c3aed') return '#c084fc';
    if (lower === '#d97706') return '#fbbf24';
  }
  return raw;
}

export function paintBoardSurface(
  ctx: CanvasRenderingContext2D,
  theme: BoardTheme,
  bgStyle: 'plain' | 'grid' | 'lined' | 'dots',
  boardWidth: number,
  boardHeight: number,
  subjectName: string
): void {
  const pal = getThemePalette(theme);
  const grad = ctx.createLinearGradient(0, 0, boardWidth, boardHeight);
  grad.addColorStop(0, pal.surfaceTop);
  grad.addColorStop(1, pal.surfaceBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, boardWidth, boardHeight);

  if (bgStyle === 'grid') {
    ctx.strokeStyle = pal.gridStroke;
    ctx.lineWidth = 1;
    for (let x = 0; x <= boardWidth; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, boardHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= boardHeight; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(boardWidth, y);
      ctx.stroke();
    }
  } else if (bgStyle === 'lined') {
    ctx.strokeStyle = pal.gridStroke;
    ctx.lineWidth = 1;
    for (let y = 64; y < boardHeight; y += 44) {
      ctx.beginPath();
      ctx.moveTo(28, y);
      ctx.lineTo(boardWidth - 28, y);
      ctx.stroke();
    }
  } else if (bgStyle === 'dots') {
    ctx.fillStyle = pal.gridStroke;
    for (let x = 28; x < boardWidth; x += 34) {
      for (let y = 28; y < boardHeight; y += 34) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.save();
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = pal.textMuted;
  ctx.fillText(
    `AURA SMART ${theme.toUpperCase()} • ${subjectName.toUpperCase()} STUDIO`,
    28,
    30
  );
  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  size = 11
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWrappedTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/);
  let line = '';
  let y = startY;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = words[i];
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function renderSinglePrimitive(
  ctx: CanvasRenderingContext2D,
  prim: WhiteboardPrimitive,
  pal: ThemePalette,
  theme: BoardTheme,
  stageX: number,
  stageY: number,
  stageW: number,
  stageH: number
) {
  // Maps normalized 0..1000 stage coords uniformly preserving aspect ratio
  const side = Math.min(stageW, stageH);
  const offX = stageX + (stageW - side) / 2;
  const offY = stageY + (stageH - side) / 2;
  const mx = (nx: number) => offX + (nx / 1000) * side;
  const my = (ny: number) => offY + (ny / 1000) * side;
  const ms = (len: number) => (len / 1000) * side;

  ctx.save();

  if (prim.type === 'circle') {
    const stroke = adaptStrokeColor(prim.stroke, theme, pal.accentBlue);
    const cx = mx(prim.cx);
    const cy = my(prim.cy);
    const r = Math.max(4, ms(prim.r));

    if (prim.fill && prim.fill !== 'transparent') {
      ctx.fillStyle = prim.fill;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3.2;
    ctx.shadowColor = stroke;
    ctx.shadowBlur = pal.glowBlur;
    if (prim.dashed) ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    if (prim.showCenter !== false && r > 22) {
      ctx.fillStyle = pal.accentRed;
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('O', cx - 14, cy - 8);
    }

    if (prim.showDiameter && r > 40) {
      ctx.strokeStyle = pal.accentPurple;
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (prim.radiusLabel && r > 35) {
      const ang = -Math.PI / 5;
      const ex = cx + Math.cos(ang) * r;
      const ey = cy + Math.sin(ang) * r;
      ctx.strokeStyle = pal.accentRed;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      drawArrowHead(ctx, cx, cy, ex, ey, pal.accentRed, 9);
      ctx.fillStyle = pal.accentRed;
      ctx.font = 'bold 14px monospace';
      ctx.fillText(prim.radiusLabel, (cx + ex) / 2 - 18, (cy + ey) / 2 - 12);
    }

    if (prim.label) {
      ctx.fillStyle = pal.textPrimary;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(prim.label, cx, cy + r + 22);
      ctx.textAlign = 'left';
    }
  } else if (prim.type === 'ellipse') {
    const stroke = adaptStrokeColor(prim.stroke, theme, pal.accentBlue);
    const cx = mx(prim.cx);
    const cy = my(prim.cy);
    const rx = Math.max(4, ms(prim.rx));
    const ry = Math.max(4, ms(prim.ry));
    const rot = ((prim.rotationDeg || 0) * Math.PI) / 180;

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    if (prim.fill && prim.fill !== 'transparent') {
      ctx.fillStyle = prim.fill;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.8;
    if (prim.dashed) ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (prim.label) {
      ctx.fillStyle = pal.textPrimary;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(prim.label, cx, cy + 4);
      ctx.textAlign = 'left';
    }
  } else if (prim.type === 'rect') {
    const stroke = adaptStrokeColor(prim.stroke, theme, pal.accentGreen);
    const rx = mx(prim.x);
    const ry = my(prim.y);
    const rw = ms(prim.width);
    const rh = ms(prim.height);
    const radius = prim.rounded ? ms(prim.rounded) : 0;

    ctx.beginPath();
    if (radius > 0) ctx.roundRect(rx, ry, rw, rh, radius);
    else ctx.rect(rx, ry, rw, rh);

    if (prim.fill && prim.fill !== 'transparent') {
      ctx.fillStyle = prim.fill;
      ctx.fill();
    }
    if (stroke !== 'transparent') {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.shadowColor = stroke;
      ctx.shadowBlur = pal.glowBlur;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (prim.showDiagonal) {
      ctx.strokeStyle = pal.accentAmber;
      ctx.lineWidth = 2.4;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(rx, ry + rh);
      ctx.lineTo(rx + rw, ry);
      ctx.stroke();
      ctx.setLineDash([]);
      // Right angle corner square
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry + rh - 18, 18, 18);
    }

    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = stroke !== 'transparent' ? stroke : pal.textPrimary;
    if (prim.widthLabel) {
      ctx.textAlign = 'center';
      ctx.fillText(prim.widthLabel, rx + rw / 2, ry + rh + 24);
      ctx.textAlign = 'left';
    }
    if (prim.heightLabel) {
      ctx.fillText(prim.heightLabel, rx + rw + 10, ry + rh / 2 + 5);
    }
    if (prim.label) {
      ctx.fillStyle = pal.textPrimary;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(prim.label, rx + rw / 2, ry + rh / 2 + 5);
      ctx.textAlign = 'left';
    }
  } else if (prim.type === 'polygon') {
    if (prim.points.length >= 2) {
      const stroke = adaptStrokeColor(prim.stroke, theme, pal.accentRed);
      const pts = prim.points.map((p) => ({ x: mx(p.x), y: my(p.y), lbl: p.vertexLabel }));

      ctx.beginPath();
      pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();

      if (prim.fill && prim.fill !== 'transparent') {
        ctx.fillStyle = prim.fill;
        ctx.fill();
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3.2;
      ctx.shadowColor = stroke;
      ctx.shadowBlur = pal.glowBlur;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Optional right-angle corner marker
      if (prim.rightAngleAtVertex !== undefined && pts[prim.rightAngleAtVertex]) {
        const idx = prim.rightAngleAtVertex;
        const curr = pts[idx];
        const prev = pts[(idx - 1 + pts.length) % pts.length];
        const next = pts[(idx + 1) % pts.length];
        const u1x = (prev.x - curr.x) / (Math.hypot(prev.x - curr.x, prev.y - curr.y) || 1);
        const u1y = (prev.y - curr.y) / (Math.hypot(prev.x - curr.x, prev.y - curr.y) || 1);
        const u2x = (next.x - curr.x) / (Math.hypot(next.x - curr.x, next.y - curr.y) || 1);
        const u2y = (next.y - curr.y) / (Math.hypot(next.x - curr.x, next.y - curr.y) || 1);
        const s = 18;
        ctx.strokeStyle = pal.accentBlue;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(curr.x + u1x * s, curr.y + u1y * s);
        ctx.lineTo(curr.x + (u1x + u2x) * s, curr.y + (u1y + u2y) * s);
        ctx.lineTo(curr.x + u2x * s, curr.y + u2y * s);
        ctx.stroke();
      }

      // Edge labels
      if (prim.edgeLabels) {
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = pal.textPrimary;
        prim.edgeLabels.forEach((elabel, idx) => {
          const pA = pts[idx];
          const pB = pts[(idx + 1) % pts.length];
          if (!pA || !pB) return;
          const midX = (pA.x + pB.x) / 2;
          const midY = (pA.y + pB.y) / 2;
          ctx.textAlign = 'center';
          ctx.fillText(elabel, midX, midY + (Math.abs(pA.y - pB.y) < 12 ? 22 : -10));
        });
        ctx.textAlign = 'left';
      }

      // Vertex dots + labels
      pts.forEach((p, idx) => {
        ctx.fillStyle = stroke;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        if (p.lbl) {
          ctx.fillStyle = pal.textPrimary;
          ctx.font = 'bold 14px sans-serif';
          ctx.fillText(p.lbl, p.x - 14, p.y - 10);
        }
        const angLbl = prim.angleLabels?.find((a) => a.vertexIndex === idx);
        if (angLbl) {
          ctx.fillStyle = pal.accentAmber;
          ctx.font = 'bold 12px monospace';
          ctx.fillText(angLbl.text, p.x + 12, p.y - 12);
        }
      });
    }
  } else if (prim.type === 'line') {
    const stroke = adaptStrokeColor(prim.stroke, theme, pal.accentAmber);
    const x1 = mx(prim.x1);
    const y1 = my(prim.y1);
    const x2 = mx(prim.x2);
    const y2 = my(prim.y2);

    ctx.strokeStyle = stroke;
    ctx.lineWidth = prim.lineWidth || 3;
    if (prim.dashed) ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (prim.arrowEnd) drawArrowHead(ctx, x1, y1, x2, y2, stroke, 10);
    if (prim.arrowStart) drawArrowHead(ctx, x2, y2, x1, y1, stroke, 10);

    if (prim.label) {
      ctx.fillStyle = stroke;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(prim.label, (x1 + x2) / 2, (y1 + y2) / 2 - 10);
      ctx.textAlign = 'left';
    }
  } else if (prim.type === 'curve_path') {
    if (prim.points.length >= 2) {
      const stroke = adaptStrokeColor(prim.stroke, theme, pal.accentBlue);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = prim.lineWidth || 3.5;
      ctx.shadowColor = stroke;
      ctx.shadowBlur = pal.glowBlur;
      if (prim.dashed) ctx.setLineDash([7, 5]);
      ctx.beginPath();
      prim.points.forEach((p, idx) => {
        const px = mx(p.x);
        const py = my(p.y);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      if (prim.closed) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      if (prim.label) {
        const last = prim.points[prim.points.length - 1];
        ctx.fillStyle = stroke;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(prim.label, mx(last.x) - 55, my(last.y) - 12);
      }
    }
  } else if (prim.type === 'bar_chart') {
    const bars = prim.bars || [];
    const padX = stageX + 55;
    const padY = stageY + 45;
    const chartW = stageW - 90;
    const chartH = stageH - 110;
    const maxVal = Math.max(1, ...bars.map((b) => Math.abs(b.value)));

    // Axes
    ctx.strokeStyle = pal.textMuted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padX, padY);
    ctx.lineTo(padX, padY + chartH);
    ctx.lineTo(padX + chartW, padY + chartH);
    ctx.stroke();

    const slotW = chartW / Math.max(1, bars.length);
    bars.forEach((bar, idx) => {
      const bw = Math.min(64, slotW * 0.62);
      const bh = (Math.abs(bar.value) / maxVal) * (chartH - 25);
      const bx = padX + idx * slotW + (slotW - bw) / 2;
      const by = padY + chartH - bh;
      const col = adaptStrokeColor(bar.color, theme, pal.accentBlue);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, [8, 8, 0, 0]);
      ctx.fill();

      ctx.fillStyle = pal.textPrimary;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(bar.value), bx + bw / 2, by - 6);
      ctx.fillText(bar.label.slice(0, 10), bx + bw / 2, padY + chartH + 20);
    });
    ctx.textAlign = 'left';
  } else if (prim.type === 'coordinate_graph') {
    const gx = stageX + 48;
    const gy = stageY + 34;
    const gw = stageW - 84;
    const gh = stageH - 72;

    const spanX = Math.max(1, prim.xMax - prim.xMin);
    const spanY = Math.max(1, prim.yMax - prim.yMin);
    const toPx = (vx: number) => gx + ((vx - prim.xMin) / spanX) * gw;
    const toPy = (vy: number) => gy + gh - ((vy - prim.yMin) / spanY) * gh;

    if (prim.title) {
      ctx.fillStyle = pal.textPrimary;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(prim.title, gx + gw / 2, gy - 12);
      ctx.textAlign = 'left';
    }

    // Graph Grid & Numbered Ticks
    const tickStepX = Math.max(1, Math.round(spanX / 10));
    const tickStepY = Math.max(1, Math.round(spanY / 8));
    const originX = Math.min(gx + gw, Math.max(gx, toPx(0)));
    const originY = Math.min(gy + gh, Math.max(gy, toPy(0)));

    ctx.strokeStyle = pal.gridStroke;
    ctx.lineWidth = 1;
    ctx.font = '11px monospace';
    ctx.fillStyle = pal.textMuted;

    for (let vx = Math.ceil(prim.xMin / tickStepX) * tickStepX; vx <= prim.xMax; vx += tickStepX) {
      const px = toPx(vx);
      ctx.beginPath();
      ctx.moveTo(px, gy);
      ctx.lineTo(px, gy + gh);
      ctx.stroke();
      if (vx !== 0) {
        ctx.textAlign = 'center';
        ctx.fillText(String(vx), px, Math.min(gy + gh + 14, originY + 15));
      }
    }

    for (let vy = Math.ceil(prim.yMin / tickStepY) * tickStepY; vy <= prim.yMax; vy += tickStepY) {
      const py = toPy(vy);
      ctx.beginPath();
      ctx.moveTo(gx, py);
      ctx.lineTo(gx + gw, py);
      ctx.stroke();
      if (vy !== 0) {
        ctx.textAlign = 'right';
        ctx.fillText(String(vy), Math.max(gx - 6, originX - 6), py + 4);
      }
    }
    ctx.textAlign = 'left';

    // X & Y Axes
    ctx.strokeStyle = pal.textPrimary;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(gx, originY);
    ctx.lineTo(gx + gw, originY);
    ctx.moveTo(originX, gy + gh);
    ctx.lineTo(originX, gy);
    ctx.stroke();

    drawArrowHead(ctx, gx, originY, gx + gw + 4, originY, pal.textPrimary, 8);
    drawArrowHead(ctx, originX, gy + gh, originX, gy - 4, pal.textPrimary, 8);

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = pal.textPrimary;
    ctx.fillText(prim.xLabel || 'x', gx + gw - 16, originY - 8);
    ctx.fillText(prim.yLabel || 'y', originX + 8, gy + 12);

    // Clip curves smoothly inside plot box
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, gy, gw, gh);
    ctx.clip();

    // Draw Equations / Curves
    (prim.curves || []).forEach((curve) => {
      const col = adaptStrokeColor(curve.color, theme, pal.accentBlue);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3.2;
      ctx.shadowColor = col;
      ctx.shadowBlur = pal.glowBlur;
      if (curve.dashed) ctx.setLineDash([7, 5]);
      ctx.beginPath();
      let started = false;
      const steps = 160;
      for (let i = 0; i <= steps; i++) {
        const vx = prim.xMin + (i / steps) * spanX;
        const vy = evaluateMathExpression(curve.expression, vx);
        if (!Number.isFinite(vy) || vy < prim.yMin - spanY || vy > prim.yMax + spanY) {
          started = false;
          continue;
        }
        const px = toPx(vx);
        const py = toPy(vy);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    });

    // Draw Slope Rise/Run Triangle
    if (prim.slopeSegment) {
      const seg = prim.slopeSegment;
      const x1p = toPx(seg.x1);
      const y1p = toPy(seg.y1);
      const x2p = toPx(seg.x2);
      const y2p = toPy(seg.y2);

      if (seg.showTriangle !== false) {
        // Horizontal Run
        ctx.strokeStyle = pal.accentGreen;
        ctx.lineWidth = 2.8;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(x1p, y1p);
        ctx.lineTo(x2p, y1p);
        ctx.stroke();

        // Vertical Rise
        ctx.strokeStyle = pal.accentAmber;
        ctx.beginPath();
        ctx.moveTo(x2p, y1p);
        ctx.lineTo(x2p, y2p);
        ctx.stroke();
        ctx.setLineDash([]);

        // Triangle fill tint
        ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
        ctx.beginPath();
        ctx.moveTo(x1p, y1p);
        ctx.lineTo(x2p, y1p);
        ctx.lineTo(x2p, y2p);
        ctx.closePath();
        ctx.fill();

        const dx = Number((seg.x2 - seg.x1).toFixed(2));
        const dy = Number((seg.y2 - seg.y1).toFixed(2));
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = pal.accentGreen;
        ctx.fillText(`Run Δx=${dx}`, (x1p + x2p) / 2 - 28, y1p + (y2p < y1p ? 16 : -10));
        ctx.fillStyle = pal.accentAmber;
        ctx.fillText(`Rise Δy=${dy}`, x2p + 8, (y1p + y2p) / 2);
      }
    }

    // Draw Tangent Line at x0
    if (prim.tangentAtX) {
      const { expression, x0, label } = prim.tangentAtX;
      const y0 = evaluateMathExpression(expression, x0);
      const slope = computeDerivativeAt(expression, x0);
      if (Number.isFinite(y0) && Number.isFinite(slope)) {
        const tx1 = x0 - spanX * 0.35;
        const ty1 = y0 + slope * (tx1 - x0);
        const tx2 = x0 + spanX * 0.35;
        const ty2 = y0 + slope * (tx2 - x0);

        ctx.strokeStyle = pal.accentAmber;
        ctx.lineWidth = 2.8;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.moveTo(toPx(tx1), toPy(ty1));
        ctx.lineTo(toPx(tx2), toPy(ty2));
        ctx.stroke();
        ctx.setLineDash([]);

        if (label) {
          ctx.fillStyle = pal.accentAmber;
          ctx.font = 'bold 12px monospace';
          ctx.fillText(label, toPx(x0) + 10, toPy(y0) - 12);
        }
      }
    }

    // Vectors inside coordinate graph
    (prim.vectors || []).forEach((v) => {
      const col = adaptStrokeColor(v.color, theme, pal.accentRed);
      const x1 = toPx(v.x1);
      const y1 = toPy(v.y1);
      const x2 = toPx(v.x2);
      const y2 = toPy(v.y2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      drawArrowHead(ctx, x1, y1, x2, y2, col, 9);
      if (v.label) {
        ctx.fillStyle = col;
        ctx.font = 'bold 12px monospace';
        ctx.fillText(v.label, x2 + 6, y2 - 6);
      }
    });

    // Plotted labeled points
    (prim.points || []).forEach((pt) => {
      const col = adaptStrokeColor(pt.color, theme, pal.accentRed);
      const px = toPx(pt.x);
      const py = toPy(pt.y);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, 5.5, 0, Math.PI * 2);
      ctx.fill();
      if (pt.label) {
        ctx.font = 'bold 11.5px monospace';
        ctx.fillStyle = pal.textPrimary;
        ctx.fillText(pt.label, px + 8, py - 8);
      }
    });

    ctx.restore();
  } else if (prim.type === 'text') {
    const col = adaptStrokeColor(prim.color, theme, pal.textPrimary);
    const tx = mx(prim.x);
    const ty = my(prim.y);
    const fs = Math.max(12, Math.round(ms(prim.fontSize || 20)));
    ctx.font = `${prim.bold ? 'bold ' : ''}${fs}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = prim.align || 'left';

    if (prim.boxed) {
      const metrics = ctx.measureText(prim.text);
      const bw = metrics.width + 24;
      const bh = fs + 16;
      const bx =
        prim.align === 'center' ? tx - bw / 2 : prim.align === 'right' ? tx - bw : tx - 10;
      ctx.fillStyle = pal.panelBg;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, ty - fs, bw, bh, 10);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = col;
    ctx.fillText(prim.text, tx, ty);
    ctx.textAlign = 'left';
  }

  ctx.restore();
}

export function renderWhiteboardSceneToCanvas(
  ctx: CanvasRenderingContext2D,
  scene: WhiteboardVisualScene,
  options: RenderSceneOptions
): () => void {
  const { theme, bgStyle, boardWidth, boardHeight, subjectName, animate = true, onComplete } = options;
  const pal = getThemePalette(theme);

  const stageX = 472;
  const stageY = 82;
  const stageW = boardWidth - stageX - 24;
  const stageH = boardHeight - stageY - 24;

  let cancelled = false;
  let rafId = 0;

  const drawFrame = (progress: number) => {
    paintBoardSurface(ctx, theme, bgStyle, boardWidth, boardHeight, subjectName);

    // 1. Left Notes Panel Container
    ctx.save();
    ctx.fillStyle = pal.panelBg;
    ctx.strokeStyle = pal.panelBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(24, 52, 428, boardHeight - 76, 18);
    ctx.fill();
    ctx.stroke();

    // Right Visual Stage Container
    ctx.beginPath();
    ctx.roundRect(stageX, stageY - 28, stageW, stageH + 28, 18);
    ctx.fill();
    ctx.stroke();

    // Title Banner inside Left Panel
    ctx.fillStyle = pal.accentBlue;
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    let curY = drawWrappedTextLines(ctx, scene.title, 42, 86, 392, 26);

    if (scene.subtitle) {
      ctx.fillStyle = pal.textMuted;
      ctx.font = '13px "Plus Jakarta Sans", sans-serif';
      curY = drawWrappedTextLines(ctx, scene.subtitle, 42, curY + 4, 392, 18);
    }

    curY += 12;

    // Steps progressively revealed when animated
    const totalSteps = scene.steps.length;
    const stepsVisible = animate ? Math.ceil(progress * totalSteps) : totalSteps;
    ctx.fillStyle = pal.textPrimary;
    ctx.font = '14px "Plus Jakarta Sans", sans-serif';

    for (let i = 0; i < stepsVisible && i < totalSteps; i++) {
      if (curY > boardHeight - 135) break;
      curY = drawWrappedTextLines(ctx, scene.steps[i], 42, curY, 392, 20) + 6;
    }

    // Highlighted Formula Box anchored near bottom of Left Panel
    if (scene.formulaBox && (!animate || progress > 0.35)) {
      const boxY = Math.max(curY + 8, boardHeight - 108);
      ctx.fillStyle = pal.formulaBg;
      ctx.strokeStyle = pal.accentAmber;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(38, boxY, 400, 68, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = pal.formulaText;
      ctx.font = 'bold 13.5px monospace';
      drawWrappedTextLines(ctx, scene.formulaBox, 50, boxY + 26, 376, 19);
    }
    ctx.restore();

    // 2. Render Declarative Visual Primitives progressively
    const totalPrims = scene.primitives.length;
    const primsVisible = animate
      ? Math.max(1, Math.ceil(progress * totalPrims))
      : totalPrims;

    for (let i = 0; i < primsVisible && i < totalPrims; i++) {
      renderSinglePrimitive(
        ctx,
        scene.primitives[i],
        pal,
        theme,
        stageX,
        stageY,
        stageW,
        stageH
      );
    }
  };

  if (!animate) {
    drawFrame(1);
    onComplete?.();
    return () => {};
  }

  const startMs = performance.now();
  const durationMs = 520;

  const tick = (now: number) => {
    if (cancelled) return;
    const rawP = Math.min(1, (now - startMs) / durationMs);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - rawP, 3);
    drawFrame(eased);
    if (rawP < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      onComplete?.();
    }
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}

