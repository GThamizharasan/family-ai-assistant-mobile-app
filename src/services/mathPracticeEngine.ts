// Paperless Kid-Friendly Math Practice Engine (+ − × ÷)
// Provides randomized problem & 10-question worksheet generation, theme-aware Canvas worksheet
// & visual hint rendering, zone clipping, eraser-safe snapshotting, and dual-layer OCR checking.

import {
  ArithmeticFilter,
  ArithmeticLayout,
  ArithmeticOp,
  ArithmeticProblem,
  ArithmeticTier,
  BoardTheme,
  InkStroke,
  MathAnswerCheckResult,
} from '../types/adaptiveLearning';
import { getApiUrl } from './api';
import { getActiveAiModel, getActiveAiProvider } from './aiConfig';
import { paintBoardSurface } from './whiteboardVisualEngine';

// ============================================================================
// 1. BOARD ZONE GEOMETRY (1200 × 680 INTERNAL CANVAS COORDINATES)
// ============================================================================

export const PRACTICE_ZONES = {
  problemCard: { x: 32, y: 66, width: 576, height: 582 },
  answerBox: { x: 76, y: 422, width: 488, height: 158 },
  roughWork: { x: 634, y: 66, width: 534, height: 582 },
} as const;

function getStrokeCenter(stroke: InkStroke): { x: number; y: number } {
  if (!stroke.points.length) return { x: 0, y: 0 };
  let sumX = 0;
  let sumY = 0;
  for (const p of stroke.points) {
    sumX += p.x;
    sumY += p.y;
  }
  return {
    x: sumX / stroke.points.length,
    y: sumY / stroke.points.length,
  };
}

function isPointInsideRect(
  pt: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
  padX = 0,
  padY = 0
): boolean {
  return (
    pt.x >= rect.x - padX &&
    pt.x <= rect.x + rect.width + padX &&
    pt.y >= rect.y - padY &&
    pt.y <= rect.y + rect.height + padY
  );
}

export function isStrokeInAnswerBox(stroke: InkStroke): boolean {
  if (!stroke.points.length) return false;
  const center = getStrokeCenter(stroke);
  if (isPointInsideRect(center, PRACTICE_ZONES.answerBox, 24, 20)) {
    return true;
  }
  let insideCount = 0;
  for (const pt of stroke.points) {
    if (isPointInsideRect(pt, PRACTICE_ZONES.answerBox, 24, 20)) {
      insideCount++;
    }
  }
  return insideCount / stroke.points.length >= 0.35;
}

export function isStrokeInRoughWork(stroke: InkStroke): boolean {
  if (!stroke.points.length) return false;
  const center = getStrokeCenter(stroke);
  return isPointInsideRect(center, PRACTICE_ZONES.roughWork, 8, 8);
}

// ============================================================================
// 2. RANDOM PROBLEM & 10-QUESTION WORKSHEET GENERATORS
// ============================================================================

const OP_SYMBOL_MAP: Record<ArithmeticOp, '+' | '−' | '×' | '÷'> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
};

function randInt(min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function buildHintSteps(
  op: ArithmeticOp,
  a: number,
  b: number,
  ans: number,
  tier: ArithmeticTier
): string[] {
  if (op === 'add') {
    if (tier === 'starter' && a + b <= 20) {
      return [
        `Start at ${a} on your fingers or number line.`,
        `Count up ${b} more steps: ${a} + ${b}.`,
        `Put both groups together to count the total!`,
      ];
    }
    const onesA = a % 10;
    const onesB = b % 10;
    const onesSum = onesA + onesB;
    return [
      `Step 1 (Ones): Add ${onesA} + ${onesB} = ${onesSum}.`,
      onesSum >= 10
        ? `Carry ${Math.floor(onesSum / 10)} ten to the Tens column, keep ${onesSum % 10} in Ones.`
        : `Write ${onesSum} in the Ones place cleanly.`,
      `Step 2 (Tens/Hundreds): Add the remaining left columns together!`,
    ];
  }

  if (op === 'sub') {
    if (tier === 'starter' && a <= 20) {
      return [
        `Start with ${a} dots in total.`,
        `Cross out ${b} dots to take them away.`,
        `Count how many dots are still left!`,
      ];
    }
    const onesA = a % 10;
    const onesB = b % 10;
    return [
      `Step 1 (Ones): Look at ${onesA} − ${onesB}.`,
      onesA < onesB
        ? `${onesA} is smaller than ${onesB}, so borrow 1 ten (make it ${onesA + 10} − ${onesB} = ${onesA + 10 - onesB}).`
        : `${onesA} − ${onesB} = ${onesA - onesB} in the Ones place.`,
      `Step 2: Now subtract the Tens and Hundreds columns carefully.`,
    ];
  }

  if (op === 'mul') {
    if (a <= 12 && b <= 12) {
      return [
        `Think of ${a} equal groups with ${b} in each group.`,
        `Skip-count by ${b} exactly ${a} times!`,
        a > 2 ? `Or split it: (${Math.floor(a / 2)} × ${b}) + (${Math.ceil(a / 2)} × ${b}).` : `Add ${b} + ${b}.`,
      ];
    }
    const tensB = Math.floor(b / 10) * 10;
    const onesB = b % 10;
    return [
      `Break ${b} apart into ${tensB} + ${onesB}.`,
      `Multiply ${a} × ${onesB} = ${a * onesB}, then ${a} × ${tensB} = ${a * tensB}.`,
      `Add both partial products together in Rough Work!`,
    ];
  }

  // Division
  return [
    `Think backward using multiplication: ${b} × ? = ${a}.`,
    `Share ${a} items fairly into ${b} equal groups.`,
    `Skip-count by ${b} (${b}, ${b * 2}, ${b * 3}...) until you land on ${a}!`,
  ];
}

function resolveVisualHintKind(
  op: ArithmeticOp,
  a: number,
  b: number,
  ans: number
): ArithmeticProblem['visualHintKind'] {
  if (op === 'add' && ans <= 20) return 'dots_add';
  if (op === 'sub' && a <= 20) return 'dots_sub';
  if (op === 'mul' && a <= 6 && b <= 9) return 'array_mul';
  if (op === 'div' && a <= 30) return 'groups_div';
  return 'place_value';
}

export function generateArithmeticProblem(
  filter: ArithmeticFilter,
  tier: ArithmeticTier,
  excludeKeys?: Set<string>
): ArithmeticProblem {
  const ops: ArithmeticOp[] = ['add', 'sub', 'mul', 'div'];
  const pickedOp: ArithmeticOp =
    filter === 'mixed' ? ops[randInt(0, ops.length - 1)] : filter;

  let operandA = 2;
  let operandB = 2;
  let correctAnswer = 4;

  for (let attempt = 0; attempt < 25; attempt++) {
    if (pickedOp === 'add') {
      if (tier === 'starter') {
        operandA = randInt(2, 9);
        operandB = randInt(1, 9);
      } else if (tier === 'builder') {
        operandA = randInt(12, 89);
        operandB = randInt(11, 89);
      } else {
        operandA = randInt(125, 689);
        operandB = randInt(115, 499);
      }
      correctAnswer = operandA + operandB;
    } else if (pickedOp === 'sub') {
      if (tier === 'starter') {
        operandA = randInt(4, 18);
        operandB = randInt(1, Math.min(9, operandA - 1));
      } else if (tier === 'builder') {
        operandA = randInt(25, 99);
        operandB = randInt(11, Math.max(12, operandA - 3));
      } else {
        operandA = randInt(310, 985);
        operandB = randInt(115, Math.max(120, operandA - 25));
      }
      correctAnswer = operandA - operandB;
    } else if (pickedOp === 'mul') {
      if (tier === 'starter') {
        operandA = randInt(2, 5);
        operandB = randInt(1, 9);
      } else if (tier === 'builder') {
        if (Math.random() < 0.5) {
          operandA = randInt(6, 12);
          operandB = randInt(3, 12);
        } else {
          operandA = randInt(12, 29);
          operandB = randInt(2, 9);
        }
      } else {
        operandA = randInt(12, 49);
        operandB = randInt(11, 25);
      }
      correctAnswer = operandA * operandB;
    } else {
      // Division — guaranteed exact whole quotient
      let divisor = 2;
      let quotient = 2;
      if (tier === 'starter') {
        divisor = randInt(2, 5);
        quotient = randInt(1, 9);
      } else if (tier === 'builder') {
        divisor = randInt(2, 12);
        quotient = randInt(2, 12);
      } else {
        divisor = randInt(3, 15);
        quotient = randInt(6, 24);
      }
      operandA = divisor * quotient;
      operandB = divisor;
      correctAnswer = quotient;
    }

    const key = `${pickedOp}:${operandA}:${operandB}`;
    if (!excludeKeys || !excludeKeys.has(key)) {
      excludeKeys?.add(key);
      break;
    }
  }

  const symbol = OP_SYMBOL_MAP[pickedOp];
  return {
    id: `math-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    op: pickedOp,
    symbol,
    operandA,
    operandB,
    correctAnswer,
    tier,
    displayHorizontal: `${operandA} ${symbol} ${operandB} = ?`,
    hintSteps: buildHintSteps(pickedOp, operandA, operandB, correctAnswer, tier),
    visualHintKind: resolveVisualHintKind(pickedOp, operandA, operandB, correctAnswer),
    status: 'pending',
    attempts: 0,
  };
}

export function generateWorksheetBatch(
  filter: ArithmeticFilter,
  tier: ArithmeticTier,
  count = 10
): ArithmeticProblem[] {
  const seenKeys = new Set<string>();
  const batch: ArithmeticProblem[] = [];

  if (filter === 'mixed') {
    const ops: ArithmeticOp[] = ['add', 'sub', 'mul', 'div'];
    // Guarantee balanced coverage of all 4 operations
    const opSchedule: ArithmeticOp[] = [];
    for (let i = 0; i < count; i++) {
      opSchedule.push(ops[i % ops.length]);
    }
    // Fisher-Yates shuffle
    for (let i = opSchedule.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opSchedule[i], opSchedule[j]] = [opSchedule[j], opSchedule[i]];
    }
    for (const op of opSchedule) {
      batch.push(generateArithmeticProblem(op, tier, seenKeys));
    }
    return batch;
  }

  for (let i = 0; i < count; i++) {
    batch.push(generateArithmeticProblem(filter, tier, seenKeys));
  }
  return batch;
}

// ============================================================================
// 3. THEME-AWARE CANVAS WORKSHEET RENDERER & PARTIAL ZONE CLIPPER
// ============================================================================

export interface WorksheetRenderOptions {
  theme: BoardTheme;
  bgStyle: 'grid' | 'plain' | 'lined' | 'dots';
  boardWidth: number;
  boardHeight: number;
  questionIndex: number;
  totalQuestions: number;
  layout: ArithmeticLayout;
  showHint: boolean;
  checkState?: {
    status: 'correct' | 'wrong';
    recognized?: number;
    revealed?: boolean;
  };
}

const OP_LABEL_MAP: Record<ArithmeticOp, { title: string; colorLight: string; colorDark: string }> = {
  add: { title: 'ADDITION +', colorLight: '#2563eb', colorDark: '#38bdf8' },
  sub: { title: 'SUBTRACTION −', colorLight: '#e11d48', colorDark: '#fb7185' },
  mul: { title: 'MULTIPLICATION ×', colorLight: '#7c3aed', colorDark: '#c084fc' },
  div: { title: 'DIVISION ÷', colorLight: '#059669', colorDark: '#34d399' },
};

const TIER_LABEL_MAP: Record<ArithmeticTier, string> = {
  starter: '⭐ Starter',
  builder: '⭐⭐ Builder',
  champion: '⭐⭐⭐ Champion',
};

function drawDotRow(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  count: number,
  cols: number,
  radius: number,
  gap: number,
  fillColor: string,
  crossCountFromEnd = 0
): number {
  let maxY = startY;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * gap;
    const cy = startY + row * gap;
    if (cy > maxY) maxY = cy;

    const isCrossed = crossCountFromEnd > 0 && i >= count - crossCountFromEnd;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = isCrossed ? 'rgba(148, 163, 184, 0.35)' : fillColor;
    ctx.fill();
    ctx.strokeStyle = isCrossed ? '#ef4444' : fillColor;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    if (isCrossed) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx - radius - 2, cy - radius - 2);
      ctx.lineTo(cx + radius + 2, cy + radius + 2);
      ctx.moveTo(cx + radius + 2, cy - radius - 2);
      ctx.lineTo(cx - radius - 2, cy + radius + 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  return maxY + radius;
}

export function paintMathPracticeWorksheet(
  ctx: CanvasRenderingContext2D,
  problem: ArithmeticProblem,
  opts: WorksheetRenderOptions
): void {
  const {
    theme,
    bgStyle,
    boardWidth,
    boardHeight,
    questionIndex,
    totalQuestions,
    layout,
    showHint,
    checkState,
  } = opts;

  paintBoardSurface(
    ctx,
    theme,
    bgStyle,
    boardWidth,
    boardHeight,
    'Paperless Math Practice (+ − × ÷)'
  );

  const isLight = theme === 'whiteboard';
  const cardBg = isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(15, 23, 42, 0.84)';
  const cardBorder = isLight ? '#cbd5e1' : '#334155';
  const primaryText = isLight ? '#0f172a' : '#f8fafc';
  const mutedText = isLight ? '#64748b' : '#94a3b8';
  const opMeta = OP_LABEL_MAP[problem.op];
  const opAccent = isLight ? opMeta.colorLight : opMeta.colorDark;

  // =========================================================================
  // A. LEFT PROBLEM CARD
  // =========================================================================
  const pc = PRACTICE_ZONES.problemCard;
  ctx.save();
  ctx.fillStyle = cardBg;
  ctx.strokeStyle = cardBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(pc.x, pc.y, pc.width, pc.height, 22);
  ctx.fill();
  ctx.stroke();

  // Top Header Badges inside Problem Card
  const qBadgeText = `Q${questionIndex + 1}/${totalQuestions}`;
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = isLight ? '#e2e8f0' : '#1e293b';
  ctx.beginPath();
  ctx.roundRect(pc.x + 20, pc.y + 18, 76, 28, 14);
  ctx.fill();
  ctx.fillStyle = primaryText;
  ctx.textAlign = 'center';
  ctx.fillText(qBadgeText, pc.x + 58, pc.y + 37);

  // Operation badge
  ctx.font = 'bold 13px sans-serif';
  const opW = ctx.measureText(opMeta.title).width + 26;
  ctx.fillStyle = `${opAccent}22`;
  ctx.strokeStyle = opAccent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(pc.x + 106, pc.y + 18, opW, 28, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = opAccent;
  ctx.fillText(opMeta.title, pc.x + 106 + opW / 2, pc.y + 37);

  // Tier stars badge (right-aligned)
  const tierLabel = TIER_LABEL_MAP[problem.tier];
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = isLight ? '#d97706' : '#fbbf24';
  ctx.textAlign = 'right';
  ctx.fillText(tierLabel, pc.x + pc.width - 22, pc.y + 37);
  ctx.textAlign = 'left';

  // Problem Expression Area
  if (layout === 'horizontal') {
    const eqText = `${problem.operandA} ${problem.symbol} ${problem.operandB} =`;
    const eqFontPx = eqText.length > 11 ? 58 : eqText.length > 8 ? 68 : 76;
    ctx.font = `800 ${eqFontPx}px "Plus Jakarta Sans", monospace`;
    ctx.fillStyle = primaryText;
    ctx.textAlign = 'center';
    ctx.fillText(eqText, pc.x + pc.width / 2, pc.y + 215);
    ctx.font = '600 15px sans-serif';
    ctx.fillStyle = mutedText;
    ctx.fillText('Write the final number inside the dashed box below', pc.x + pc.width / 2, pc.y + 270);
    ctx.textAlign = 'left';
  } else if (problem.op === 'div') {
    // Crisp Long-Division Bracket Layout
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = mutedText;
    ctx.textAlign = 'center';
    ctx.fillText(
      `${problem.operandA} ÷ ${problem.operandB} = ?`,
      pc.x + pc.width / 2,
      pc.y + 92
    );
    ctx.textAlign = 'left';

    const divisorStr = String(problem.operandB);
    const dividendStr = String(problem.operandA);
    const bracketX = pc.x + 225;
    const bracketTopY = pc.y + 178;
    const dividendW = Math.max(120, dividendStr.length * 44 + 28);

    // Quotient guide label above vinculum
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = opAccent;
    ctx.textAlign = 'center';
    ctx.fillText('QUOTIENT ↑ (write in answer box)', bracketX + dividendW / 2, bracketTopY - 22);

    // Quotient placeholder underline
    ctx.strokeStyle = isLight ? 'rgba(5,150,105,0.35)' : 'rgba(52,211,153,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(bracketX + 12, bracketTopY - 14, dividendW - 20, 6);
    ctx.setLineDash([]);

    // Division frame (curved bracket + horizontal vinculum)
    ctx.strokeStyle = opAccent;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bracketX + dividendW, bracketTopY);
    ctx.lineTo(bracketX, bracketTopY);
    ctx.quadraticCurveTo(bracketX - 24, bracketTopY + 38, bracketX, bracketTopY + 76);
    ctx.stroke();

    // Divisor & Dividend
    ctx.font = '800 58px monospace';
    ctx.fillStyle = opAccent;
    ctx.textAlign = 'right';
    ctx.fillText(divisorStr, bracketX - 22, bracketTopY + 58);

    ctx.fillStyle = primaryText;
    ctx.textAlign = 'left';
    ctx.fillText(dividendStr, bracketX + 18, bracketTopY + 58);
  } else {
    // Stacked Column Arithmetic (+, −, ×) with Place Value & Carry/Borrow Boxes
    const strA = String(problem.operandA);
    const strB = String(problem.operandB);
    const maxCols = Math.max(strA.length, strB.length, String(problem.correctAnswer).length);
    const colW = 58;
    const rightEdgeX = pc.x + pc.width / 2 + (maxCols * colW) / 2 + 12;
    const placeNames = ['O', 'T', 'H', 'Th'];

    // Faint vertical place-value column dividers + headers
    for (let c = 0; c < maxCols; c++) {
      const colRightX = rightEdgeX - c * colW;
      const colCenterX = colRightX - colW / 2;
      const colLeftX = colRightX - colW;

      ctx.strokeStyle = isLight ? 'rgba(148,163,184,0.28)' : 'rgba(148,163,184,0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(colLeftX, pc.y + 72);
      ctx.lineTo(colLeftX, pc.y + 300);
      ctx.stroke();
      ctx.setLineDash([]);

      // Place label (H / T / O)
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = mutedText;
      ctx.textAlign = 'center';
      ctx.fillText(placeNames[c] || '', colCenterX, pc.y + 88);

      // Faint dashed carry / borrow box above columns
      ctx.strokeStyle = isLight ? 'rgba(37,99,235,0.28)' : 'rgba(56,189,248,0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(colCenterX - 16, pc.y + 98, 32, 28);
      ctx.setLineDash([]);
    }

    // Carry hint label on far left
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = mutedText;
    ctx.textAlign = 'right';
    ctx.fillText('carry/borrow →', rightEdgeX - maxCols * colW - 10, pc.y + 116);

    // Top operand digits aligned per column
    ctx.font = '800 66px monospace';
    ctx.fillStyle = primaryText;
    ctx.textAlign = 'center';
    for (let idx = 0; idx < strA.length; idx++) {
      const digit = strA[strA.length - 1 - idx];
      const colCenterX = rightEdgeX - idx * colW - colW / 2;
      ctx.fillText(digit, colCenterX, pc.y + 190);
    }

    // Bottom operand digits aligned per column
    for (let idx = 0; idx < strB.length; idx++) {
      const digit = strB[strB.length - 1 - idx];
      const colCenterX = rightEdgeX - idx * colW - colW / 2;
      ctx.fillText(digit, colCenterX, pc.y + 266);
    }

    // Operator symbol to left of second row
    ctx.fillStyle = opAccent;
    ctx.fillText(problem.symbol, rightEdgeX - maxCols * colW - 28, pc.y + 266);

    // Equals horizontal bar
    ctx.strokeStyle = primaryText;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rightEdgeX - maxCols * colW - 52, pc.y + 292);
    ctx.lineTo(rightEdgeX + 6, pc.y + 292);
    ctx.stroke();
    ctx.textAlign = 'left';
  }

  // =========================================================================
  // B. DASHED ANSWER BOX INSIDE PROBLEM CARD
  // =========================================================================
  const ab = PRACTICE_ZONES.answerBox;
  const isCorrect = checkState?.status === 'correct';
  const isWrong = checkState?.status === 'wrong';
  const isRevealed = Boolean(checkState?.revealed);

  ctx.save();
  if (isCorrect) {
    ctx.fillStyle = isLight ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.2)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3.5;
  } else if (isRevealed) {
    ctx.fillStyle = isLight ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.2)';
    ctx.strokeStyle = isLight ? '#4f46e5' : '#818cf8';
    ctx.lineWidth = 3;
  } else if (isWrong) {
    ctx.fillStyle = isLight ? 'rgba(244, 63, 94, 0.08)' : 'rgba(244, 63, 94, 0.15)';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
  } else {
    ctx.fillStyle = isLight ? 'rgba(248, 250, 252, 0.85)' : 'rgba(2, 6, 23, 0.55)';
    ctx.strokeStyle = isLight ? '#3b82f6' : '#22d3ee';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([10, 7]);
  }

  ctx.beginPath();
  ctx.roundRect(ab.x, ab.y, ab.width, ab.height, 18);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  // Corner prompt label
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = isCorrect
    ? '#059669'
    : isRevealed
    ? isLight
      ? '#4f46e5'
      : '#a5b4fc'
    : isWrong
    ? '#f43f5e'
    : mutedText;
  ctx.fillText(
    isCorrect
      ? '✅ AWESOME! CORRECT ANSWER'
      : isRevealed
      ? '👀 CORRECT ANSWER'
      : '✍️ WRITE YOUR ANSWER HERE',
    ab.x + 16,
    ab.y + 24
  );

  if (isCorrect) {
    ctx.font = '800 58px monospace';
    ctx.fillStyle = isLight ? '#059669' : '#34d399';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${checkState?.recognized ?? problem.correctAnswer}  ✓ ⭐`,
      ab.x + ab.width / 2,
      ab.y + 110
    );
    ctx.textAlign = 'left';
  } else if (isRevealed) {
    ctx.font = '800 58px monospace';
    ctx.fillStyle = isLight ? '#4338ca' : '#c7d2fe';
    ctx.textAlign = 'center';
    ctx.fillText(`${problem.correctAnswer}`, ab.x + ab.width / 2, ab.y + 110);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  ctx.restore();

  // =========================================================================
  // C. RIGHT ROUGH WORK / SCRATCHPAD PANEL (+ VISUAL HINT ZONE)
  // =========================================================================
  const rw = PRACTICE_ZONES.roughWork;
  ctx.save();
  ctx.fillStyle = cardBg;
  ctx.strokeStyle = cardBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rw.x, rw.y, rw.width, rw.height, 22);
  ctx.fill();
  ctx.stroke();

  // Panel Header
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = mutedText;
  ctx.fillText('📝 ROUGH WORK / SCRATCHPAD', rw.x + 22, rw.y + 34);

  // Subtle horizontal scratchpad rules
  ctx.strokeStyle = isLight ? 'rgba(148,163,184,0.22)' : 'rgba(148,163,184,0.14)';
  ctx.lineWidth = 1;
  for (let y = rw.y + 62; y <= rw.y + rw.height - 20; y += 48) {
    ctx.beginPath();
    ctx.moveTo(rw.x + 18, y);
    ctx.lineTo(rw.x + rw.width - 18, y);
    ctx.stroke();
  }

  // Visual Step-by-Step Hint in Top Half (leaves bottom half open for scribbling!)
  if (showHint) {
    const hintBoxH = 264;
    ctx.fillStyle = isLight ? 'rgba(254, 243, 199, 0.72)' : 'rgba(30, 41, 59, 0.92)';
    ctx.strokeStyle = isLight ? '#f59e0b' : '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rw.x + 18, rw.y + 48, rw.width - 36, hintBoxH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = isLight ? '#b45309' : '#fbbf24';
    ctx.fillText('💡 VISUAL STEP HINT', rw.x + 34, rw.y + 74);

    if (problem.visualHintKind === 'dots_add') {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = primaryText;
      ctx.fillText(
        `Group 1 (${problem.operandA})  +  Group 2 (${problem.operandB}) — count all dots!`,
        rw.x + 34,
        rw.y + 98
      );
      const yAfterA = drawDotRow(
        ctx,
        rw.x + 48,
        rw.y + 124,
        problem.operandA,
        10,
        10,
        28,
        isLight ? '#2563eb' : '#38bdf8'
      );
      drawDotRow(
        ctx,
        rw.x + 48,
        Math.max(yAfterA + 22, rw.y + 178),
        problem.operandB,
        10,
        10,
        28,
        isLight ? '#d97706' : '#fbbf24'
      );
    } else if (problem.visualHintKind === 'dots_sub') {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = primaryText;
      ctx.fillText(
        `Start with ${problem.operandA} dots, cross out ${problem.operandB}:`,
        rw.x + 34,
        rw.y + 98
      );
      drawDotRow(
        ctx,
        rw.x + 48,
        rw.y + 128,
        problem.operandA,
        10,
        10,
        28,
        isLight ? '#e11d48' : '#fb7185',
        problem.operandB
      );
    } else if (problem.visualHintKind === 'array_mul') {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = primaryText;
      ctx.fillText(
        `Array of ${problem.operandA} rows × ${problem.operandB} columns:`,
        rw.x + 34,
        rw.y + 98
      );
      for (let r = 0; r < problem.operandA; r++) {
        drawDotRow(
          ctx,
          rw.x + 52,
          rw.y + 122 + r * 24,
          problem.operandB,
          problem.operandB,
          8,
          26,
          isLight ? '#7c3aed' : '#c084fc'
        );
      }
    } else if (problem.visualHintKind === 'groups_div') {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = primaryText;
      ctx.fillText(
        `Share ${problem.operandA} equally into ${problem.operandB} groups (${problem.operandB} × ? = ${problem.operandA}):`,
        rw.x + 34,
        rw.y + 98
      );
      const count = Math.min(problem.operandB, 6);
      const boxW = Math.min(72, Math.floor((rw.width - 76 - (count - 1) * 10) / count));
      for (let g = 0; g < count; g++) {
        const bx = rw.x + 36 + g * (boxW + 10);
        const by = rw.y + 120;
        ctx.strokeStyle = opAccent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, 56, 12);
        ctx.stroke();
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = mutedText;
        ctx.textAlign = 'center';
        ctx.fillText(`Grp ${g + 1}`, bx + boxW / 2, by + 20);
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = opAccent;
        ctx.fillText('?', bx + boxW / 2, by + 44);
        ctx.textAlign = 'left';
      }
      if (problem.operandB > 6) {
        ctx.font = 'italic 12px sans-serif';
        ctx.fillStyle = mutedText;
        ctx.fillText(`(+ ${problem.operandB - 6} more equal groups)`, rw.x + 36, rw.y + 196);
      }
    } else {
      ctx.font = '600 14px sans-serif';
      ctx.fillStyle = primaryText;
      problem.hintSteps.forEach((step, i) => {
        ctx.fillText(`${i + 1}. ${step.slice(0, 56)}`, rw.x + 34, rw.y + 114 + i * 36);
        if (step.length > 56) {
          ctx.fillText(`   ${step.slice(56, 110)}`, rw.x + 34, rw.y + 132 + i * 36);
        }
      });
    }

    // Bottom hint step footer + scratchpad marker
    ctx.font = '600 12.5px sans-serif';
    ctx.fillStyle = isLight ? '#92400e' : '#fde68a';
    const lastStep = problem.hintSteps[problem.hintSteps.length - 1] || '';
    if (problem.visualHintKind !== 'place_value' && lastStep) {
      ctx.fillText(`Tip: ${lastStep.slice(0, 62)}`, rw.x + 34, rw.y + 294);
    }

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = mutedText;
    ctx.fillText('✍️ SCRATCHPAD SPACE BELOW:', rw.x + 24, rw.y + 344);
  }

  ctx.restore();
}

export function repaintPracticeZoneOnly(
  ctx: CanvasRenderingContext2D,
  zone: 'answerBox' | 'roughWork',
  problem: ArithmeticProblem,
  opts: WorksheetRenderOptions
): void {
  const rect = PRACTICE_ZONES[zone];
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x - 4, rect.y - 4, rect.width + 8, rect.height + 8);
  ctx.clip();
  paintMathPracticeWorksheet(ctx, problem, opts);
  ctx.restore();
}

// ============================================================================
// 4. ERASER-SAFE SNAPSHOT & DUAL-LAYER HANDWRITTEN NUMBER CHECKER
// ============================================================================

function distanceSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function pruneErasedStrokes(strokes: InkStroke[]): InkStroke[] {
  const surviving: InkStroke[] = [];
  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i];
    if (s.isEraser || s.points.length === 0) continue;

    let erasedPoints = 0;
    for (const pt of s.points) {
      let ptErased = false;
      for (let j = i + 1; j < strokes.length; j++) {
        const eraser = strokes[j];
        if (!eraser.isEraser) continue;
        const radiusSq = Math.pow(Math.max(18, eraser.size * 2.8), 2);
        for (const ep of eraser.points) {
          if (distanceSq(pt, ep) <= radiusSq) {
            ptErased = true;
            break;
          }
        }
        if (ptErased) break;
      }
      if (ptErased) erasedPoints++;
    }

    if (erasedPoints / s.points.length < 0.65) {
      surviving.push(s);
    }
  }
  return surviving;
}

export function buildPracticeAnswerSnapshot(strokes: InkStroke[]): {
  imageBase64: string;
  hasInk: boolean;
  activeInkStrokes: InkStroke[];
} {
  const activeInkStrokes = pruneErasedStrokes(strokes);
  if (typeof document === 'undefined' || activeInkStrokes.length === 0) {
    return { imageBase64: '', hasInk: false, activeInkStrokes };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of activeInkStrokes) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const width = Math.max(20, maxX - minX);
  const height = Math.max(20, maxY - minY);
  const maxW = 540;
  const maxH = 260;
  const pad = 32;
  const scale = Math.min((maxW - pad * 2) / width, (maxH - pad * 2) / height, 2.2);
  const canvasW = Math.min(maxW, Math.max(150, Math.ceil(width * scale + pad * 2)));
  const canvasH = Math.min(maxH, Math.max(120, Math.ceil(height * scale + pad * 2)));

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { imageBase64: '', hasInk: false, activeInkStrokes };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const activeSet = new Set(activeInkStrokes);
  for (const s of strokes) {
    if (!s.isEraser && !activeSet.has(s)) continue;
    if (s.points.length < 2) {
      if (!s.isEraser && s.points.length === 1) {
        const px = pad + (s.points[0].x - minX) * scale;
        const py = pad + (s.points[0].y - minY) * scale;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    ctx.strokeStyle = s.isEraser ? '#ffffff' : '#0f172a';
    ctx.lineWidth = s.isEraser
      ? Math.max(12, s.size * 5 * scale)
      : Math.max(6, Math.min(10, s.size * scale * 1.25));
    ctx.beginPath();
    s.points.forEach((p, idx) => {
      const px = pad + (p.x - minX) * scale;
      const py = pad + (p.y - minY) * scale;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  return {
    imageBase64: canvas.toDataURL('image/png'),
    hasInk: true,
    activeInkStrokes,
  };
}

export function extractNumericAnswer(rawText: string): number | null {
  if (!rawText || typeof rawText !== 'string') return null;
  // Normalize common handwritten OCR lookalikes safely
  let cleaned = rawText
    .trim()
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/B/g, '8')
    .replace(/^[=\s]+/, '')
    .replace(/\s+/g, '');

  const exactMatch = cleaned.match(/^-?\d+$/);
  if (exactMatch) {
    const val = parseInt(exactMatch[0], 10);
    return Number.isFinite(val) ? val : null;
  }

  // Extract trailing/standalone integer if model included prefix words
  const fallbackMatch = cleaned.match(/-?\d+/);
  if (fallbackMatch) {
    const val = parseInt(fallbackMatch[0], 10);
    return Number.isFinite(val) ? val : null;
  }
  return null;
}

// Geometric offline multi-digit classifier when cloud Vision API is offline
function classifySingleDigitCluster(cluster: InkStroke[]): string {
  const allPts = cluster.flatMap((s) => s.points);
  if (allPts.length < 2) return '';

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of allPts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const w = Math.max(4, maxX - minX);
  const h = Math.max(4, maxY - minY);
  const aspect = w / h;

  // Flat dash / minus sign
  if (h < 18 && w > 18 && aspect > 2.4) return '-';
  // Vertical thin stroke -> '1'
  if (aspect < 0.42) return '1';

  // Normalize points to [0, 1] x [0, 1]
  const norm = (p: { x: number; y: number }) => ({
    x: (p.x - minX) / w,
    y: (p.y - minY) / h,
  });

  const mainPts = cluster[0].points.map(norm);
  const start = mainPts[0];
  const end = mainPts[mainPts.length - 1];
  const startEndDist = Math.hypot(end.x - start.x, end.y - start.y);

  let horizMidCross = 0;
  let vertMidCross = 0;
  let topCount = 0;
  let bottomCount = 0;
  let leftCount = 0;
  let rightCount = 0;

  for (const s of cluster) {
    const sNorm = s.points.map(norm);
    for (let i = 0; i < sNorm.length; i++) {
      const p = sNorm[i];
      if (p.y < 0.5) topCount++;
      else bottomCount++;
      if (p.x < 0.5) leftCount++;
      else rightCount++;
      if (i > 0) {
        const prev = sNorm[i - 1];
        if ((prev.y - 0.5) * (p.y - 0.5) <= 0 && Math.abs(p.y - prev.y) > 1e-4) {
          horizMidCross++;
        }
        if ((prev.x - 0.5) * (p.x - 0.5) <= 0 && Math.abs(p.x - prev.x) > 1e-4) {
          vertMidCross++;
        }
      }
    }
  }

  // Two strokes commonly represent 4, 5, or crossed 7
  if (cluster.length >= 2) {
    if (topCount > bottomCount * 1.35 && end.y > 0.65) return '7';
    if (start.x < 0.5 && rightCount >= leftCount * 0.85) return '4';
    return '5';
  }

  // Single-stroke closed loop: '0' vs '8' vs '6' vs '9'
  if (startEndDist < 0.34) {
    if (horizMidCross >= 3) return '8';
    if (bottomCount > topCount * 1.45) return '6';
    if (topCount > bottomCount * 1.45) return '9';
    return '0';
  }

  // Single-stroke open shapes
  if (start.y < 0.35 && end.y > 0.72 && end.x < 0.55 && vertMidCross <= 2 && topCount > bottomCount) {
    return '7';
  }
  if (start.y < 0.38 && end.y > 0.75 && end.x > 0.6) {
    return '2';
  }
  if (rightCount > leftCount * 1.35 && horizMidCross >= 2) {
    return '3';
  }
  if (end.y < 0.55 && startEndDist < 0.55 && bottomCount > topCount * 1.15) {
    return '6';
  }
  if (topCount > bottomCount * 1.3 && start.y < 0.4 && end.y > 0.7) {
    return '9';
  }
  if (vertMidCross >= 2 && horizMidCross >= 2) {
    return '5';
  }
  return start.y < 0.4 && end.y > 0.65 ? '1' : '0';
}

export function classifyHandwrittenNumberOffline(strokes: InkStroke[]): {
  value: number | null;
  raw: string;
  confidence: number;
} {
  const active = pruneErasedStrokes(strokes).filter((s) => s.points.length >= 2);
  if (active.length === 0) {
    return { value: null, raw: '', confidence: 0 };
  }

  const withBox = active.map((stroke) => {
    let minX = Infinity;
    let maxX = -Infinity;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
    return { stroke, minX, maxX };
  });

  // Sort strokes left-to-right before X-interval clustering
  withBox.sort((a, b) => a.minX - b.minX);

  const clusters: Array<{ strokes: InkStroke[]; minX: number; maxX: number }> = [];
  for (const item of withBox) {
    const itemW = Math.max(8, item.maxX - item.minX);
    const existing = clusters.find((cl) => {
      const clW = Math.max(8, cl.maxX - cl.minX);
      const overlap = Math.min(cl.maxX, item.maxX) - Math.max(cl.minX, item.minX);
      const minW = Math.min(clW, itemW);
      const itemMid = (item.minX + item.maxX) / 2;
      return overlap >= 0.2 * minW || (itemMid >= cl.minX - 6 && itemMid <= cl.maxX + 6);
    });
    if (existing) {
      existing.strokes.push(item.stroke);
      existing.minX = Math.min(existing.minX, item.minX);
      existing.maxX = Math.max(existing.maxX, item.maxX);
    } else {
      clusters.push({ strokes: [item.stroke], minX: item.minX, maxX: item.maxX });
    }
  }

  clusters.sort((a, b) => a.minX - b.minX);
  const chars = clusters.map((c) => classifySingleDigitCluster(c.strokes)).join('');
  const value = extractNumericAnswer(chars);

  return {
    value,
    raw: chars,
    confidence: value !== null ? 0.62 : 0.25,
  };
}

export async function checkHandwrittenMathAnswer(
  allStrokes: InkStroke[],
  problem: ArithmeticProblem,
  language = 'en-IN'
): Promise<MathAnswerCheckResult> {
  const isTamil = String(language).toLowerCase().startsWith('ta');
  const boxStrokes = allStrokes.filter(isStrokeInAnswerBox);
  let snapshot = buildPracticeAnswerSnapshot(boxStrokes);

  if (!snapshot.hasInk) {
    const allSnapshot = buildPracticeAnswerSnapshot(allStrokes);
    if (allSnapshot.hasInk) {
      snapshot = allSnapshot;
    } else {
      return {
        recognizedNumber: null,
        rawRecognizedText: '',
        isCorrect: false,
        expectedAnswer: problem.correctAnswer,
        feedbackMessage: isTamil
          ? 'முதலில் பெட்டிக்குள் உங்கள் விடையை கையால் எழுதுங்கள்!'
          : 'Write your answer inside the dashed box first!',
        spokenFeedback: 'Write your answer inside the dashed box first!',
        confidence: 0,
        usedOfflineFallback: true,
        modelUsed: 'Practice Guard',
      };
    }
  }

  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);
  const customGeminiKey =
    typeof window !== 'undefined' ? localStorage.getItem('aura_custom_gemini_api_key') : null;

  let recognizedNumber: number | null = null;
  let rawRecognizedText = '';
  let confidence = 0.85;
  let usedOfflineFallback = false;
  let modelUsed = 'Gemini Vision Digit Reader';

  try {
    const res = await fetch(getApiUrl('/api/adaptive-learning/recognize-ink'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: snapshot.imageBase64,
        subjectId: 'maths',
        subjectName: 'Mathematics',
        conceptTitle: problem.displayHorizontal,
        language,
        practiceMode: 'math_answer_check',
        geminiApiKey: customGeminiKey || undefined,
        modelOverride: provider === 'gemini' ? model : undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.result) {
        rawRecognizedText = String(data.result.recognizedText || '').trim();
        recognizedNumber = extractNumericAnswer(rawRecognizedText);
        confidence = Number(data.result.confidence) || 0.92;
        modelUsed = data.modelUsed || modelUsed;
      } else {
        usedOfflineFallback = true;
      }
    } else {
      usedOfflineFallback = true;
    }
  } catch {
    usedOfflineFallback = true;
  }

  if (usedOfflineFallback || recognizedNumber === null) {
    const offline = classifyHandwrittenNumberOffline(
      boxStrokes.length > 0 ? boxStrokes : allStrokes
    );
    if (recognizedNumber === null) {
      recognizedNumber = offline.value;
      if (!rawRecognizedText) rawRecognizedText = offline.raw;
      confidence = offline.confidence;
      usedOfflineFallback = true;
      modelUsed = 'Offline Stroke Digit Classifier';
    }
  }

  if (recognizedNumber === null) {
    return {
      recognizedNumber: null,
      rawRecognizedText,
      isCorrect: false,
      expectedAnswer: problem.correctAnswer,
      feedbackMessage: isTamil
        ? 'எண் தெளிவாகப் புரியவில்லை — அழித்து மீண்டும் பெரியதாக எழுதுங்கள்!'
        : "I couldn't clearly read that number — try writing each digit nice and clear!",
      spokenFeedback: "I couldn't clearly read that number. Try writing it neatly!",
      confidence: 0.2,
      usedOfflineFallback,
      modelUsed,
    };
  }

  const isCorrect = recognizedNumber === problem.correctAnswer;
  if (isCorrect) {
    return {
      recognizedNumber,
      rawRecognizedText: rawRecognizedText || String(recognizedNumber),
      isCorrect: true,
      expectedAnswer: problem.correctAnswer,
      feedbackMessage: isTamil
        ? `சூப்பர்! ${problem.operandA} ${problem.symbol} ${problem.operandB} = ${problem.correctAnswer} என்பது சரியான விடை! ⭐`
        : `Awesome! ${problem.operandA} ${problem.symbol} ${problem.operandB} = ${problem.correctAnswer} is spot on! ⭐`,
      spokenFeedback: `Awesome job! ${problem.operandA} and ${problem.operandB} equals ${problem.correctAnswer}. You earned stars!`,
      confidence,
      usedOfflineFallback,
      modelUsed,
    };
  }

  const directionTip =
    recognizedNumber < problem.correctAnswer
      ? 'Hint: the true answer is a bit higher!'
      : 'Hint: the true answer is a bit smaller!';

  return {
    recognizedNumber,
    rawRecognizedText: rawRecognizedText || String(recognizedNumber),
    isCorrect: false,
    expectedAnswer: problem.correctAnswer,
    feedbackMessage: isTamil
      ? `நல்ல முயற்சி! நீங்கள் எழுதியது ${recognizedNumber}. சரி செய்து மீண்டும் முயற்சிக்கவும் அல்லது 💡 Hint பார்க்கவும்.`
      : `Good try! I read ${recognizedNumber}. ${directionTip} Tap "Show Step Hint" or try again!`,
    spokenFeedback: `Good try! I read ${recognizedNumber}. ${directionTip}`,
    confidence,
    usedOfflineFallback,
    modelUsed,
  };
}

// ============================================================================
// 5. STANDARD MULTIPLICATION TABLES (1 TO 10) DAILY MEMORIZATION CHART
// ============================================================================

const TABLE_ACCENTS: Array<{ light: string; dark: string; tintLight: string; tintDark: string }> = [
  { light: '#2563eb', dark: '#38bdf8', tintLight: 'rgba(37, 99, 235, 0.10)', tintDark: 'rgba(56, 189, 248, 0.14)' }, // 1
  { light: '#059669', dark: '#34d399', tintLight: 'rgba(5, 150, 105, 0.10)', tintDark: 'rgba(52, 211, 153, 0.14)' }, // 2
  { light: '#7c3aed', dark: '#c084fc', tintLight: 'rgba(124, 58, 237, 0.10)', tintDark: 'rgba(192, 132, 252, 0.14)' }, // 3
  { light: '#e11d48', dark: '#fb7185', tintLight: 'rgba(225, 29, 72, 0.10)', tintDark: 'rgba(251, 113, 133, 0.14)' }, // 4
  { light: '#d97706', dark: '#fbbf24', tintLight: 'rgba(217, 119, 6, 0.10)', tintDark: 'rgba(251, 191, 36, 0.14)' }, // 5
  { light: '#0891b2', dark: '#22d3ee', tintLight: 'rgba(8, 145, 178, 0.10)', tintDark: 'rgba(34, 211, 238, 0.14)' }, // 6
  { light: '#db2777', dark: '#f472b6', tintLight: 'rgba(219, 39, 119, 0.10)', tintDark: 'rgba(244, 114, 182, 0.14)' }, // 7
  { light: '#4f46e5', dark: '#818cf8', tintLight: 'rgba(79, 70, 229, 0.10)', tintDark: 'rgba(129, 140, 248, 0.14)' }, // 8
  { light: '#16a34a', dark: '#4ade80', tintLight: 'rgba(22, 163, 74, 0.10)', tintDark: 'rgba(74, 222, 128, 0.14)' }, // 9
  { light: '#ea580c', dark: '#fb923c', tintLight: 'rgba(234, 88, 12, 0.10)', tintDark: 'rgba(251, 146, 60, 0.14)' }, // 10
];

export function paintMultiplicationTablesChart(
  ctx: CanvasRenderingContext2D,
  opts: {
    theme: BoardTheme;
    bgStyle: 'grid' | 'plain' | 'lined' | 'dots';
    boardWidth: number;
    boardHeight: number;
    highlightedTable?: number | null;
    hideAnswers?: boolean;
  }
): void {
  const {
    theme,
    bgStyle,
    boardWidth,
    boardHeight,
    highlightedTable = null,
    hideAnswers = false,
  } = opts;

  paintBoardSurface(
    ctx,
    theme,
    bgStyle,
    boardWidth,
    boardHeight,
    'Standard Multiplication Tables (1 to 10)'
  );

  const isLight = theme === 'whiteboard';
  const baseCardBg = isLight ? 'rgba(255, 255, 255, 0.90)' : 'rgba(15, 23, 42, 0.86)';
  const baseBorder = isLight ? '#cbd5e1' : '#334155';
  const primaryText = isLight ? '#0f172a' : '#f8fafc';
  const mutedText = isLight ? '#64748b' : '#94a3b8';

  // Header banner (y: 42..70)
  ctx.save();
  ctx.fillStyle = isLight ? 'rgba(241, 245, 249, 0.92)' : 'rgba(30, 41, 59, 0.88)';
  ctx.strokeStyle = isLight ? '#94a3b8' : '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(24, 42, boardWidth - 48, 28, 12);
  ctx.fill();
  ctx.stroke();

  ctx.font = '800 13.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = isLight ? '#1e293b' : '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.fillText(
    hideAnswers
      ? '🌟 STANDARD MULTIPLICATION TABLES (1 TO 10) — MEMORY SELF-TEST (WRITE ANSWERS IN BLANKS!)'
      : '🌟 STANDARD MULTIPLICATION TABLES (1 TO 10) — DAILY MEMORIZATION BOARD',
    boardWidth / 2,
    60
  );
  ctx.textAlign = 'left';
  ctx.restore();

  // 5-column × 2-row grid across 1200 × 680 canvas
  const marginX = 24;
  const gapX = 14;
  const startY = 78;
  const gapY = 14;
  const cardW = Math.floor((boardWidth - marginX * 2 - gapX * 4) / 5); // 219px on 1200w
  const cardH = Math.floor((boardHeight - 14 - startY - gapY) / 2); // 287px on 680h

  for (let tableNum = 1; tableNum <= 10; tableNum++) {
    const idx = tableNum - 1;
    const col = idx % 5;
    const row = Math.floor(idx / 5);
    const x = marginX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    const palette = TABLE_ACCENTS[idx];
    const accent = isLight ? palette.light : palette.dark;
    const headerTint = isLight ? palette.tintLight : palette.tintDark;
    const isHighlighted = highlightedTable === tableNum;

    ctx.save();
    if (isHighlighted) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 18;
    }

    ctx.fillStyle = isHighlighted ? headerTint : baseCardBg;
    ctx.strokeStyle = isHighlighted ? accent : baseBorder;
    ctx.lineWidth = isHighlighted ? 3.5 : 1.8;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Header pill at top of card (height: 34px)
    ctx.fillStyle = headerTint;
    ctx.beginPath();
    ctx.roundRect(x + 6, y + 6, cardW - 12, 30, 10);
    ctx.fill();

    ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.fillText(`Table of ${tableNum}`, x + cardW / 2, y + 26);

    // 10 cleanly aligned rows (k = 1..10)
    const rowStep = 23.5;
    const firstRowY = y + 57;

    for (let k = 1; k <= 10; k++) {
      const rowY = firstRowY + (k - 1) * rowStep;

      // Left factor, ×, multiplier, =
      ctx.font = 'bold 16.5px monospace';
      ctx.fillStyle = primaryText;
      ctx.textAlign = 'right';
      ctx.fillText(String(tableNum), x + 46, rowY);

      ctx.fillStyle = mutedText;
      ctx.textAlign = 'center';
      ctx.fillText('×', x + 64, rowY);

      ctx.fillStyle = primaryText;
      ctx.textAlign = 'right';
      ctx.fillText(String(k), x + 100, rowY);

      ctx.fillStyle = mutedText;
      ctx.textAlign = 'center';
      ctx.fillText('=', x + 118, rowY);

      if (hideAnswers) {
        // Neat fill-in-the-blank underline so the child can write on-board
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x + 136, rowY + 3);
        ctx.lineTo(x + cardW - 20, rowY + 3);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.font = '800 17px monospace';
        ctx.fillStyle = accent;
        ctx.textAlign = 'right';
        ctx.fillText(String(tableNum * k), x + cardW - 22, rowY);
      }
    }

    ctx.textAlign = 'left';
    ctx.restore();
  }
}

export function buildTableRecitationText(tableNum: number, language = 'en-IN'): string {
  const safeTable = Math.max(1, Math.min(10, Math.round(tableNum)));
  const isTamil = String(language).toLowerCase().startsWith('ta');

  if (isTamil) {
    const parts = Array.from({ length: 10 }, (_, i) => {
      const k = i + 1;
      return `${safeTable} பெருக்கல் ${k}, ${safeTable * k}.`;
    });
    return `${safeTable}-ஆம் வாய்ப்பாடு. ${parts.join(' ')}`;
  }

  const parts = Array.from({ length: 10 }, (_, i) => {
    const k = i + 1;
    return `${safeTable} times ${k} is ${safeTable * k}.`;
  });
  return `Table of ${safeTable}. ${parts.join(' ')}`;
}


