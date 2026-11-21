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

function generateClockProblem(tier: ArithmeticTier): ArithmeticProblem {
  const hours = randInt(1, 12);
  const minuteOptions =
    tier === 'starter'
      ? [0, 30]
      : tier === 'builder'
      ? [0, 15, 30, 45, 5, 10, 20, 25, 35, 40, 50, 55]
      : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const minutes = minuteOptions[randInt(0, minuteOptions.length - 1)];
  const isElapsed = tier === 'champion' && Math.random() < 0.45;
  const elapsedMins = isElapsed ? [15, 20, 30][randInt(0, 2)] : 0;

  let ansTotalMins = hours * 60 + minutes + elapsedMins;
  let ansH = Math.floor(ansTotalMins / 60) % 12;
  if (ansH === 0) ansH = 12;
  const ansM = ansTotalMins % 60;
  const timeStr = `${ansH}:${String(ansM).padStart(2, '0')}`;
  const startStr = `${hours}:${String(minutes).padStart(2, '0')}`;

  return {
    id: `clock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    op: 'add',
    symbol: '+',
    operandA: ansH,
    operandB: ansM,
    correctAnswer: ansH * 100 + ansM,
    answerKind: 'time',
    expectedText: timeStr,
    topicCategory: 'clock',
    tier,
    displayHorizontal: isElapsed
      ? `Clock shows ${startStr}. Time after +${elapsedMins} mins?`
      : `Read the clock time (H:MM)`,
    clockData: {
      hours,
      minutes,
      mode: isElapsed ? 'elapsed' : 'read',
      elapsedMins: isElapsed ? elapsedMins : undefined,
    },
    hintSteps: isElapsed
      ? [
          `Red short hand = hour (${hours}), blue long hand = minutes (${String(minutes).padStart(2, '0')}).`,
          `Add ${elapsedMins} minutes to ${startStr}.`,
          `Remember: 60 minutes = 1 full hour!`,
        ]
      : [
          `Short RED hand points to the Hour (${hours}).`,
          `Long BLUE hand counts by 5s around the clock (1=05, 3=15, 6=30, 9=45).`,
          `Write Hour : Minutes (like ${timeStr.slice(0, 2)}xx).`,
        ],
    visualHintKind: 'clock_visual',
    status: 'pending',
    attempts: 0,
  };
}

function generateFractionProblem(tier: ArithmeticTier): ArithmeticProblem {
  const denomPool =
    tier === 'starter'
      ? [2, 3, 4]
      : tier === 'builder'
      ? [3, 4, 5, 6, 8]
      : [4, 5, 6, 8, 10, 12];
  const denominator = denomPool[randInt(0, denomPool.length - 1)];
  const numerator = randInt(1, denominator - 1);
  const shape: 'pizza' | 'chocolate' = Math.random() < 0.55 ? 'pizza' : 'chocolate';
  const expectedText = `${numerator}/${denominator}`;

  return {
    id: `frac-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    op: 'div',
    symbol: '÷',
    operandA: numerator,
    operandB: denominator,
    correctAnswer: numerator,
    answerKind: 'fraction',
    expectedText,
    topicCategory: 'fractions',
    tier,
    displayHorizontal: `What fraction of the ${shape} is shaded?`,
    fractionData: { numerator, denominator, shape },
    hintSteps: [
      `Top number (Numerator) = count ONLY the colored/shaded pieces (${numerator}).`,
      `Bottom number (Denominator) = count ALL equal pieces in total (${denominator}).`,
      `Write it as shaded / total (e.g. 1/2 or 3/4).`,
    ],
    visualHintKind: 'fraction_visual',
    status: 'pending',
    attempts: 0,
  };
}

function generateMoneyProblem(tier: ArithmeticTier): ArithmeticProblem {
  const shopItems = [
    { name: 'Mango Juice', emoji: '🥭' },
    { name: 'Toy Rocket', emoji: '🚀' },
    { name: 'Story Book', emoji: '📘' },
    { name: 'Cricket Ball', emoji: '🏏' },
    { name: 'Color Pencils', emoji: '🖍️' },
    { name: 'Ice Cream', emoji: '🍦' },
    { name: 'Puzzle Box', emoji: '🧩' },
    { name: 'Soccer Ball', emoji: '⚽' },
  ];
  const item = shopItems[randInt(0, shopItems.length - 1)];

  if (tier === 'starter') {
    const paidOptions = [10, 20];
    const paid = paidOptions[randInt(0, paidOptions.length - 1)];
    const price = randInt(3, paid - 2);
    const change = paid - price;
    return {
      id: `money-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      op: 'sub',
      symbol: '−',
      operandA: paid,
      operandB: price,
      correctAnswer: change,
      answerKind: 'number',
      expectedText: String(change),
      topicCategory: 'money',
      tier,
      displayHorizontal: `${item.name} costs ₹${price}. You pay ₹${paid}. Change = ?`,
      moneyData: { itemName: item.name, itemEmoji: item.emoji, price, paid, currency: '₹', askKind: 'change' },
      hintSteps: [
        `You gave ₹${paid} to the shopkeeper.`,
        `Subtract the price ₹${price}: ${paid} − ${price}.`,
        `Count up from ₹${price} to ₹${paid} to check your change!`,
      ],
      visualHintKind: 'money_visual',
      status: 'pending',
      attempts: 0,
    };
  }

  if (tier === 'builder') {
    const paidOptions = [50, 100];
    const paid = paidOptions[randInt(0, paidOptions.length - 1)];
    const price = randInt(12, paid - 8);
    const change = paid - price;
    return {
      id: `money-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      op: 'sub',
      symbol: '−',
      operandA: paid,
      operandB: price,
      correctAnswer: change,
      answerKind: 'number',
      expectedText: String(change),
      topicCategory: 'money',
      tier,
      displayHorizontal: `${item.name} costs ₹${price}. You pay ₹${paid}. Change = ?`,
      moneyData: { itemName: item.name, itemEmoji: item.emoji, price, paid, currency: '₹', askKind: 'change' },
      hintSteps: [
        `Change = Money Paid (₹${paid}) − Cost (₹${price}).`,
        `Try counting up to the next 10 first, then up to ₹${paid}!`,
      ],
      visualHintKind: 'money_visual',
      status: 'pending',
      attempts: 0,
    };
  }

  // Champion (Age 9-10): either 2-item total OR change from ₹200 / ₹500
  const askTotal = Math.random() < 0.45;
  if (askTotal) {
    const item2 = shopItems[(shopItems.indexOf(item) + 3) % shopItems.length];
    const p1 = randInt(45, 165);
    const p2 = randInt(35, 145);
    const total = p1 + p2;
    return {
      id: `money-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      op: 'add',
      symbol: '+',
      operandA: p1,
      operandB: p2,
      correctAnswer: total,
      answerKind: 'number',
      expectedText: String(total),
      topicCategory: 'money',
      tier,
      displayHorizontal: `${item.name} (₹${p1}) + ${item2.name} (₹${p2}) = ₹?`,
      moneyData: {
        itemName: item.name,
        itemEmoji: item.emoji,
        price: p1,
        paid: total,
        currency: '₹',
        askKind: 'total',
        secondItemName: item2.name,
        secondItemPrice: p2,
      },
      hintSteps: [
        `Add both prices together: ₹${p1} + ₹${p2}.`,
        `Add Ones first, then Tens, then Hundreds!`,
      ],
      visualHintKind: 'money_visual',
      status: 'pending',
      attempts: 0,
    };
  }

  const paid = Math.random() < 0.5 ? 200 : 500;
  const price = paid === 200 ? randInt(48, 175) : randInt(125, 435);
  const change = paid - price;
  return {
    id: `money-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    op: 'sub',
    symbol: '−',
    operandA: paid,
    operandB: price,
    correctAnswer: change,
    answerKind: 'number',
    expectedText: String(change),
    topicCategory: 'money',
    tier,
    displayHorizontal: `${item.name} costs ₹${price}. Paid ₹${paid}. Change = ₹?`,
    moneyData: { itemName: item.name, itemEmoji: item.emoji, price, paid, currency: '₹', askKind: 'change' },
    hintSteps: [
      `Subtract ₹${price} from ₹${paid}.`,
      `Tip: Jump from ${price} to the next hundred, then to ${paid}!`,
    ],
    visualHintKind: 'money_visual',
    status: 'pending',
    attempts: 0,
  };
}

function generateCompareOrPatternProblem(tier: ArithmeticTier, preferCompare?: boolean): ArithmeticProblem {
  const isCompare = preferCompare !== undefined ? preferCompare : Math.random() < 0.5;
  if (isCompare) {
    const maxN = tier === 'starter' ? 30 : tier === 'builder' ? 250 : 999;
    const minN = tier === 'starter' ? 2 : tier === 'builder' ? 25 : 100;
    const leftVal = randInt(minN, maxN);
    const forceEqual = Math.random() < 0.16;
    const rightVal = forceEqual ? leftVal : randInt(minN, maxN);
    const expectedSymbol = leftVal > rightVal ? '>' : leftVal < rightVal ? '<' : '=';

    return {
      id: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      op: 'add',
      symbol: '+',
      operandA: leftVal,
      operandB: rightVal,
      correctAnswer: 0,
      answerKind: 'compare',
      expectedText: expectedSymbol,
      topicCategory: 'compare_pattern',
      tier,
      displayHorizontal: `Compare: ${leftVal}  [ ? ]  ${rightVal}`,
      compareData: { leftVal, rightVal, kind: 'compare' },
      hintSteps: [
        `The Hungry Alligator mouth ALWAYS opens wide toward the BIGGER number!`,
        `Compare ${leftVal} and ${rightVal}: ${leftVal > rightVal ? `${leftVal} is bigger → >` : leftVal < rightVal ? `${rightVal} is bigger → <` : 'Both are equal → ='}`,
      ],
      visualHintKind: 'compare_visual',
      status: 'pending',
      attempts: 0,
    };
  }

  // Skip-counting / number pattern
  const stepOptions =
    tier === 'starter' ? [2, 5, 10] : tier === 'builder' ? [3, 4, 6, 7, 8, 9] : [6, 7, 8, 9, 11, 12, 15];
  const step = stepOptions[randInt(0, stepOptions.length - 1)];
  const start = tier === 'starter' ? step * randInt(1, 3) : randInt(4, 35);
  const fullSeq = Array.from({ length: 5 }, (_, i) => start + i * step);
  const missingIdx = randInt(2, 4);
  const missingVal = fullSeq[missingIdx];
  const seqWithHole: Array<number | null> = fullSeq.map((v, i) => (i === missingIdx ? null : v));

  return {
    id: `pat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    op: 'add',
    symbol: '+',
    operandA: fullSeq[missingIdx - 1],
    operandB: step,
    correctAnswer: missingVal,
    answerKind: 'number',
    expectedText: String(missingVal),
    topicCategory: 'compare_pattern',
    tier,
    displayHorizontal: `Pattern: ${seqWithHole.map((v) => (v === null ? '?' : v)).join(', ')}`,
    compareData: {
      leftVal: fullSeq[0],
      rightVal: fullSeq[1],
      kind: 'pattern',
      sequence: seqWithHole,
      stepRule: `+${step} each jump`,
    },
    hintSteps: [
      `Find the jump between the first two stones: ${fullSeq[1]} − ${fullSeq[0]} = +${step}.`,
      `Add +${step} to the stone right before "?" (${fullSeq[missingIdx - 1]} + ${step}).`,
    ],
    visualHintKind: 'compare_visual',
    status: 'pending',
    attempts: 0,
  };
}

function generateTablesQuizProblem(
  tableNum: number | 'mixed',
  tier: ArithmeticTier,
  excludeKeys?: Set<string>
): ArithmeticProblem {
  let a = 2;
  let b = 2;
  for (let attempt = 0; attempt < 20; attempt++) {
    a =
      tableNum === 'mixed'
        ? tier === 'starter'
          ? randInt(2, 5)
          : tier === 'builder'
          ? randInt(2, 10)
          : randInt(4, 10)
        : tableNum;
    b = randInt(1, 10);
    const k = `tq:${a}:${b}`;
    if (!excludeKeys || !excludeKeys.has(k)) {
      excludeKeys?.add(k);
      break;
    }
  }
  const ans = a * b;
  return {
    id: `tq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    op: 'mul',
    symbol: '×',
    operandA: a,
    operandB: b,
    correctAnswer: ans,
    answerKind: 'number',
    expectedText: String(ans),
    topicCategory: 'tables_quiz',
    tier,
    displayHorizontal: `${a} × ${b} = ?`,
    hintSteps: [
      `Recall Table of ${a}: skip-count by ${a} exactly ${b} times.`,
      `${a} × ${Math.max(1, b - 1)} = ${a * Math.max(1, b - 1)}, then add ${a} more!`,
    ],
    visualHintKind: a <= 6 && b <= 9 ? 'array_mul' : 'place_value',
    status: 'pending',
    attempts: 0,
  };
}

function generateLocalStoryWordProblem(tier: ArithmeticTier, idxSeed: number): ArithmeticProblem {
  const templates = [
    {
      op: 'add' as const,
      symbol: '+' as const,
      a: tier === 'starter' ? randInt(4, 9) : tier === 'builder' ? randInt(18, 48) : randInt(115, 240),
      b: tier === 'starter' ? randInt(3, 8) : tier === 'builder' ? randInt(14, 39) : randInt(65, 145),
      makeEn: (a: number, b: number) =>
        `Diya collected ${a} shiny seashells on Saturday and ${b} more on Sunday. How many seashells does Diya have altogether?`,
      makeTa: (a: number, b: number) =>
        `தியா சனிக்கிழமை ${a} சிப்பிகளும் ஞாயிற்றுக்கிழமை ${b} சிப்பிகளும் சேகரித்தாள். மொத்தம் எத்தனை சிப்பிகள்?`,
    },
    {
      op: 'sub' as const,
      symbol: '−' as const,
      a: tier === 'starter' ? randInt(11, 18) : tier === 'builder' ? randInt(45, 92) : randInt(160, 340),
      b: tier === 'starter' ? randInt(3, 8) : tier === 'builder' ? randInt(14, 34) : randInt(48, 125),
      makeEn: (a: number, b: number) =>
        `A fruit basket had ${a} juicy mangoes. The family shared ${b} mangoes with neighbors. How many mangoes are left?`,
      makeTa: (a: number, b: number) =>
        `ஒரு கூடையில் ${a} மாம்பழங்கள் இருந்தன. அக்கம்பக்கத்தாருக்கு ${b} பழங்கள் கொடுத்தனர். மீதம் எத்தனை பழங்கள் உள்ளன?`,
    },
    {
      op: 'mul' as const,
      symbol: '×' as const,
      a: tier === 'starter' ? randInt(2, 5) : tier === 'builder' ? randInt(4, 9) : randInt(7, 12),
      b: tier === 'starter' ? randInt(2, 5) : tier === 'builder' ? randInt(3, 8) : randInt(5, 9),
      makeEn: (a: number, b: number) =>
        `There are ${a} cricket kits and each kit holds ${b} tennis balls. How many balls are there in total?`,
      makeTa: (a: number, b: number) =>
        `${a} கிரிக்கெட் பைகளில் ஒவ்வொன்றிலும் ${b} பந்துகள் உள்ளன. மொத்தம் எத்தனை பந்துகள் உள்ளன?`,
    },
    {
      op: 'div' as const,
      symbol: '÷' as const,
      a: 0,
      b: tier === 'starter' ? randInt(2, 4) : tier === 'builder' ? randInt(3, 8) : randInt(6, 9),
      makeEn: (a: number, b: number) =>
        `Grandma made ${a} sweet laddoos and packed them equally into ${b} boxes. How many laddoos go in each box?`,
      makeTa: (a: number, b: number) =>
        `பாட்டி ${a} லட்டுகள் செய்து ${b} பெட்டிகளில் சமமாக வைத்தார். ஒவ்வொரு பெட்டியிலும் எத்தனை லட்டுகள்?`,
    },
  ];

  const tpl = templates[idxSeed % templates.length];
  let a = tpl.a;
  const b = tpl.b;
  if (tpl.op === 'div') {
    const q = tier === 'starter' ? randInt(2, 5) : tier === 'builder' ? randInt(3, 9) : randInt(5, 12);
    a = b * q;
  }
  const ans = tpl.op === 'add' ? a + b : tpl.op === 'sub' ? a - b : tpl.op === 'mul' ? a * b : a / b;

  return {
    id: `story-${Date.now()}-${idxSeed}-${Math.random().toString(36).slice(2, 5)}`,
    op: tpl.op,
    symbol: tpl.symbol,
    operandA: a,
    operandB: b,
    correctAnswer: ans,
    answerKind: 'number',
    expectedText: String(ans),
    topicCategory: 'word_story',
    tier,
    displayHorizontal: `${a} ${tpl.symbol} ${b} = ?`,
    storyText: tpl.makeEn(a, b),
    storyTamil: tpl.makeTa(a, b),
    hintSteps: [
      `Spot the two numbers in the story: ${a} and ${b}.`,
      `Operation needed: ${a} ${tpl.symbol} ${b}.`,
    ],
    visualHintKind: 'story_visual',
    status: 'pending',
    attempts: 0,
  };
}

export function generateArithmeticProblem(
  filter: ArithmeticFilter,
  tier: ArithmeticTier,
  excludeKeys?: Set<string>,
  tableNum: number | 'mixed' = 'mixed'
): ArithmeticProblem {
  if (filter === 'clock') return generateClockProblem(tier);
  if (filter === 'fractions') return generateFractionProblem(tier);
  if (filter === 'money') return generateMoneyProblem(tier);
  if (filter === 'compare_pattern') return generateCompareOrPatternProblem(tier);
  if (filter === 'tables_quiz') return generateTablesQuizProblem(tableNum, tier, excludeKeys);
  if (filter === 'word_story') return generateLocalStoryWordProblem(tier, randInt(0, 12));

  const ops: ArithmeticOp[] = ['add', 'sub', 'mul', 'div'];
  const pickedOp: ArithmeticOp =
    filter === 'mixed' || filter === 'mistake_bank' ? ops[randInt(0, ops.length - 1)] : filter;

  let operandA = 2;
  let operandB = 2;
  let correctAnswer = 4;

  // Tuned specifically for Ages 6–10:
  // starter = Age 6–7 | builder = Age 7–9 | champion = Age 9–10
  for (let attempt = 0; attempt < 25; attempt++) {
    if (pickedOp === 'add') {
      if (tier === 'starter') {
        operandA = randInt(2, 12);
        operandB = randInt(1, 9);
      } else if (tier === 'builder') {
        operandA = randInt(14, 89);
        operandB = randInt(12, 79);
      } else {
        operandA = randInt(125, 589);
        operandB = randInt(115, 399);
      }
      correctAnswer = operandA + operandB;
    } else if (pickedOp === 'sub') {
      if (tier === 'starter') {
        operandA = randInt(5, 19);
        operandB = randInt(1, Math.min(9, operandA - 1));
      } else if (tier === 'builder') {
        operandA = randInt(28, 98);
        operandB = randInt(12, Math.max(13, operandA - 4));
      } else {
        operandA = randInt(240, 895);
        operandB = randInt(115, Math.max(120, operandA - 25));
      }
      correctAnswer = operandA - operandB;
    } else if (pickedOp === 'mul') {
      if (tier === 'starter') {
        operandA = randInt(2, 5);
        operandB = randInt(1, 9);
      } else if (tier === 'builder') {
        if (Math.random() < 0.6) {
          operandA = randInt(3, 10);
          operandB = randInt(2, 10);
        } else {
          operandA = randInt(11, 24);
          operandB = randInt(2, 6);
        }
      } else {
        operandA = randInt(12, 35);
        operandB = randInt(4, 12);
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
        divisor = randInt(2, 10);
        quotient = randInt(2, 10);
      } else {
        divisor = randInt(3, 12);
        quotient = randInt(5, 16);
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
    answerKind: 'number',
    expectedText: String(correctAnswer),
    topicCategory: pickedOp,
    tier,
    showCarryBoxes: tier !== 'starter' && pickedOp !== 'div',
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
  count = 10,
  opts?: { tableNum?: number | 'mixed'; mistakes?: ArithmeticProblem[] }
): ArithmeticProblem[] {
  const seenKeys = new Set<string>();
  const batch: ArithmeticProblem[] = [];

  if (filter === 'mistake_bank' && opts?.mistakes && opts.mistakes.length > 0) {
    return opts.mistakes.slice(0, count).map((m) => ({
      ...m,
      status: 'pending',
      attempts: 0,
    }));
  }

  if (filter === 'mixed') {
    const ops: ArithmeticOp[] = ['add', 'sub', 'mul', 'div'];
    const opSchedule: ArithmeticOp[] = [];
    for (let i = 0; i < count; i++) {
      opSchedule.push(ops[i % ops.length]);
    }
    for (let i = opSchedule.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opSchedule[i], opSchedule[j]] = [opSchedule[j], opSchedule[i]];
    }
    for (const op of opSchedule) {
      batch.push(generateArithmeticProblem(op, tier, seenKeys));
    }
    return batch;
  }

  if (filter === 'compare_pattern') {
    for (let i = 0; i < count; i++) {
      batch.push(generateCompareOrPatternProblem(tier, i % 2 === 0));
    }
    return batch;
  }

  if (filter === 'word_story') {
    for (let i = 0; i < count; i++) {
      batch.push(generateLocalStoryWordProblem(tier, i));
    }
    return batch;
  }

  for (let i = 0; i < count; i++) {
    batch.push(generateArithmeticProblem(filter, tier, seenKeys, opts?.tableNum ?? 'mixed'));
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
    recognizedText?: string;
    revealed?: boolean;
  };
}

const OP_LABEL_MAP: Record<ArithmeticOp, { title: string; colorLight: string; colorDark: string }> = {
  add: { title: 'ADDITION +', colorLight: '#2563eb', colorDark: '#38bdf8' },
  sub: { title: 'SUBTRACTION −', colorLight: '#e11d48', colorDark: '#fb7185' },
  mul: { title: 'MULTIPLICATION ×', colorLight: '#7c3aed', colorDark: '#c084fc' },
  div: { title: 'DIVISION ÷', colorLight: '#059669', colorDark: '#34d399' },
};

const TOPIC_BADGE_MAP: Record<string, { title: string; colorLight: string; colorDark: string }> = {
  clock: { title: '🕐 CLOCK LAB', colorLight: '#0284c7', colorDark: '#38bdf8' },
  fractions: { title: '🍕 FRACTIONS LAB', colorLight: '#db2777', colorDark: '#f472b6' },
  money: { title: '💰 ₹ MONEY SHOP', colorLight: '#059669', colorDark: '#34d399' },
  compare_pattern: { title: '🐊 COMPARE & PATTERNS', colorLight: '#65a30d', colorDark: '#a3e635' },
  tables_quiz: { title: '⚡ TABLES QUIZ', colorLight: '#d97706', colorDark: '#fbbf24' },
  word_story: { title: '📖 STORY MATH', colorLight: '#7c3aed', colorDark: '#c084fc' },
};

const TIER_LABEL_MAP: Record<ArithmeticTier, string> = {
  starter: '🌱 Age 6–7',
  builder: '🚀 Age 7–9',
  champion: '🏆 Age 9–10',
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

function drawWrappedCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 5
): number {
  const words = text.split(/\s+/);
  let line = '';
  let currY = y;
  let count = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currY);
      line = words[i];
      currY += lineHeight;
      count++;
      if (count >= maxLines - 1) break;
    } else {
      line = testLine;
    }
  }
  if (line && count < maxLines) {
    ctx.fillText(line, x, currY);
    currY += lineHeight;
  }
  return currY;
}

function paintClockLabOnCard(
  ctx: CanvasRenderingContext2D,
  problem: ArithmeticProblem,
  pc: { x: number; y: number; width: number; height: number },
  isLight: boolean,
  primaryText: string,
  mutedText: string
) {
  if (!problem.clockData) return;
  const { hours, minutes, mode, elapsedMins } = problem.clockData;
  const cx = pc.x + pc.width / 2;
  const cy = pc.y + 186;
  const r = 104;

  ctx.save();
  // Colorful outer clock rim
  ctx.beginPath();
  ctx.arc(cx, cy, r + 9, 0, Math.PI * 2);
  ctx.fillStyle = isLight ? '#0284c7' : '#0ea5e9';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = isLight ? '#ffffff' : '#0f172a';
  ctx.fill();

  // 60 minute ticks
  for (let m = 0; m < 60; m++) {
    const ang = (m / 60) * Math.PI * 2 - Math.PI / 2;
    const isMajor = m % 5 === 0;
    const r1 = r - (isMajor ? 12 : 6);
    const r2 = r - 2;
    ctx.strokeStyle = isMajor ? primaryText : mutedText;
    ctx.lineWidth = isMajor ? 2.6 : 1.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
    ctx.stroke();
  }

  // Numbers 1..12
  ctx.font = '800 17px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = primaryText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let h = 1; h <= 12; h++) {
    const ang = (h / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(String(h), cx + Math.cos(ang) * (r - 26), cy + Math.sin(ang) * (r - 26));
  }

  // Hour hand (short, bold red)
  const hAngle = (((hours % 12) + minutes / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(hAngle) * (r * 0.5), cy + Math.sin(hAngle) * (r * 0.5));
  ctx.stroke();

  // Minute hand (long, bold blue)
  const mAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(mAngle) * (r * 0.74), cy + Math.sin(mAngle) * (r * 0.74));
  ctx.stroke();

  // Center pin
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = mode === 'elapsed' ? '#f59e0b' : primaryText;
  ctx.fillText(
    mode === 'elapsed'
      ? `⏱️ What time will it be after +${elapsedMins} minutes?`
      : '🕐 Red = Hour   •   Blue = Minutes   (Write H:MM)',
    cx,
    pc.y + 324
  );
  ctx.textAlign = 'left';
  ctx.restore();
}

function paintFractionLabOnCard(
  ctx: CanvasRenderingContext2D,
  problem: ArithmeticProblem,
  pc: { x: number; y: number; width: number; height: number },
  isLight: boolean,
  primaryText: string
) {
  if (!problem.fractionData) return;
  const { numerator, denominator, shape } = problem.fractionData;
  const cx = pc.x + pc.width / 2;
  const cy = pc.y + 186;

  ctx.save();
  if (shape === 'pizza') {
    const r = 98;
    // Golden pizza crust ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 11, 0, Math.PI * 2);
    ctx.fillStyle = '#d97706';
    ctx.fill();

    for (let i = 0; i < denominator; i++) {
      const a0 = (i / denominator) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / denominator) * Math.PI * 2 - Math.PI / 2;
      const shaded = i < numerator;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = shaded
        ? '#f43f5e'
        : isLight
        ? '#fef3c7'
        : '#1e293b';
      ctx.fill();
      ctx.strokeStyle = isLight ? '#78350f' : '#fbbf24';
      ctx.lineWidth = 2.6;
      ctx.stroke();

      // Pepperoni dot on shaded slices
      if (shaded) {
        const midA = (a0 + a1) / 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(midA) * (r * 0.56), cy + Math.sin(midA) * (r * 0.56), 7, 0, Math.PI * 2);
        ctx.fillStyle = '#fde047';
        ctx.fill();
      }
    }
  } else {
    // Chocolate Bar Grid
    const barW = 420;
    const barH = 112;
    const startX = cx - barW / 2;
    const startY = cy - barH / 2;
    const cols = denominator > 6 ? Math.ceil(denominator / 2) : denominator;
    const rows = denominator > 6 ? 2 : 1;
    const cellW = barW / cols;
    const cellH = barH / rows;

    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (idx >= denominator) break;
        const shaded = idx < numerator;
        const bx = startX + c * cellW;
        const by = startY + r * cellH;
        ctx.fillStyle = shaded ? '#ec4899' : isLight ? '#f1f5f9' : '#1e293b';
        ctx.strokeStyle = isLight ? '#475569' : '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(bx + 3, by + 3, cellW - 6, cellH - 6, 8);
        ctx.fill();
        ctx.stroke();
        idx++;
      }
    }
  }

  ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = primaryText;
  ctx.textAlign = 'center';
  ctx.fillText(
    `🍕 What fraction of the ${shape} is colored? (Write e.g. 3/4)`,
    cx,
    pc.y + 324
  );
  ctx.textAlign = 'left';
  ctx.restore();
}

function paintMoneyLabOnCard(
  ctx: CanvasRenderingContext2D,
  problem: ArithmeticProblem,
  pc: { x: number; y: number; width: number; height: number },
  isLight: boolean,
  primaryText: string,
  mutedText: string
) {
  if (!problem.moneyData) return;
  const m = problem.moneyData;
  const cx = pc.x + pc.width / 2;

  ctx.save();
  // Item price card
  ctx.fillStyle = isLight ? 'rgba(236, 253, 245, 0.9)' : 'rgba(6, 78, 59, 0.45)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(pc.x + 36, pc.y + 78, pc.width - 72, 114, 18);
  ctx.fill();
  ctx.stroke();

  ctx.font = '46px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(m.itemEmoji, pc.x + 56, pc.y + 148);

  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = primaryText;
  if (m.askKind === 'total' && m.secondItemName) {
    ctx.fillText(`${m.itemName}: ${m.currency}${m.price}`, pc.x + 124, pc.y + 122);
    ctx.fillText(`${m.secondItemName}: ${m.currency}${m.secondItemPrice}`, pc.x + 124, pc.y + 158);
  } else {
    ctx.fillText(m.itemName, pc.x + 124, pc.y + 124);
    ctx.font = '800 28px monospace';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`Price: ${m.currency}${m.price}`, pc.x + 124, pc.y + 164);
  }

  // Stylized Note/Coin graphic below
  if (m.askKind === 'change') {
    const noteW = 220;
    const noteH = 74;
    const nx = cx - noteW / 2;
    const ny = pc.y + 214;
    ctx.fillStyle = m.paid >= 100 ? '#7c3aed' : m.paid >= 50 ? '#0284c7' : '#d97706';
    ctx.beginPath();
    ctx.roundRect(nx, ny, noteW, noteH, 14);
    ctx.fill();
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(nx + 8, ny + 8, noteW - 16, noteH - 16);

    ctx.font = '800 28px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`PAID ${m.currency}${m.paid}`, cx, ny + 47);

    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = primaryText;
    ctx.fillText('💰 How much CHANGE will you get back? (Write number)', cx, pc.y + 324);
  } else {
    ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = mutedText;
    ctx.textAlign = 'center';
    ctx.fillText('🛍️ Add both item prices together!', cx, pc.y + 256);
    ctx.font = '800 22px monospace';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`${m.currency}${m.price} + ${m.currency}${m.secondItemPrice} = ${m.currency}?`, cx, pc.y + 300);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

function paintCompareOrPatternOnCard(
  ctx: CanvasRenderingContext2D,
  problem: ArithmeticProblem,
  pc: { x: number; y: number; width: number; height: number },
  isLight: boolean,
  primaryText: string
) {
  if (!problem.compareData) return;
  const cd = problem.compareData;
  const cx = pc.x + pc.width / 2;

  ctx.save();
  if (cd.kind === 'compare') {
    const boxW = 156;
    const boxH = 126;
    const y = pc.y + 120;

    // Left number card
    ctx.fillStyle = isLight ? '#dbeafe' : '#1e3a8a';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(pc.x + 36, y, boxW, boxH, 20);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 54px monospace';
    ctx.fillStyle = primaryText;
    ctx.textAlign = 'center';
    ctx.fillText(String(cd.leftVal), pc.x + 36 + boxW / 2, y + 80);

    // Center alligator mouth circle
    ctx.beginPath();
    ctx.arc(cx, y + boxH / 2, 46, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? '#ecfccb' : '#365314';
    ctx.fill();
    ctx.strokeStyle = '#84cc16';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '800 34px sans-serif';
    ctx.fillStyle = '#84cc16';
    ctx.fillText('?', cx, y + boxH / 2 + 12);

    // Right number card
    ctx.fillStyle = isLight ? '#fce7f3' : '#831843';
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(pc.x + pc.width - 36 - boxW, y, boxW, boxH, 20);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 54px monospace';
    ctx.fillStyle = primaryText;
    ctx.fillText(String(cd.rightVal), pc.x + pc.width - 36 - boxW / 2, y + 80);

    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = primaryText;
    ctx.fillText('🐊 Hungry Alligator eats the BIGGER number! Draw < , > or =', cx, pc.y + 308);
  } else if (cd.sequence) {
    // Stepping stones skip-counting sequence
    const stones = cd.sequence;
    const stoneW = 86;
    const gap = 16;
    const totalW = stones.length * stoneW + (stones.length - 1) * gap;
    const startX = cx - totalW / 2;
    const sy = pc.y + 150;

    stones.forEach((val, idx) => {
      const sx = startX + idx * (stoneW + gap);
      const isMissing = val === null;
      ctx.fillStyle = isMissing
        ? isLight
          ? '#fef08a'
          : '#854d0e'
        : isLight
        ? '#e0e7ff'
        : '#312e81';
      ctx.strokeStyle = isMissing ? '#f59e0b' : '#6366f1';
      ctx.lineWidth = isMissing ? 3.5 : 2.2;
      ctx.beginPath();
      ctx.roundRect(sx, sy, stoneW, 86, 18);
      ctx.fill();
      ctx.stroke();

      ctx.font = '900 32px monospace';
      ctx.fillStyle = isMissing ? '#f59e0b' : primaryText;
      ctx.textAlign = 'center';
      ctx.fillText(isMissing ? '?' : String(val), sx + stoneW / 2, sy + 54);
    });

    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = primaryText;
    ctx.textAlign = 'center';
    ctx.fillText('🔢 Find the skip-counting pattern & write the missing number!', cx, pc.y + 300);
  }

  ctx.textAlign = 'left';
  ctx.restore();
}

function paintStoryProblemOnCard(
  ctx: CanvasRenderingContext2D,
  problem: ArithmeticProblem,
  pc: { x: number; y: number; width: number; height: number },
  isLight: boolean,
  primaryText: string
) {
  ctx.save();
  ctx.fillStyle = isLight ? 'rgba(245, 243, 255, 0.9)' : 'rgba(46, 16, 101, 0.45)';
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(pc.x + 24, pc.y + 72, pc.width - 48, 252, 18);
  ctx.fill();
  ctx.stroke();

  ctx.font = '700 19px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = primaryText;
  const nextY = drawWrappedCanvasText(
    ctx,
    problem.storyText || problem.displayHorizontal,
    pc.x + 42,
    pc.y + 112,
    pc.width - 84,
    29,
    4
  );

  if (problem.storyTamil) {
    ctx.font = '600 15px "Noto Sans Tamil", sans-serif';
    ctx.fillStyle = isLight ? '#6d28d9' : '#ddd6fe';
    drawWrappedCanvasText(
      ctx,
      problem.storyTamil,
      pc.x + 42,
      Math.max(nextY + 12, pc.y + 216),
      pc.width - 84,
      24,
      3
    );
  }
  ctx.restore();
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
    'Kids Paperless Math Studio (Ages 6–10)'
  );

  const isLight = theme === 'whiteboard';
  const cardBg = isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(15, 23, 42, 0.84)';
  const cardBorder = isLight ? '#cbd5e1' : '#334155';
  const primaryText = isLight ? '#0f172a' : '#f8fafc';
  const mutedText = isLight ? '#64748b' : '#94a3b8';
  const opMeta =
    (problem.topicCategory && TOPIC_BADGE_MAP[problem.topicCategory]) ||
    OP_LABEL_MAP[problem.op];
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

  // Operation / Lab badge
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

  // Age Tier badge (right-aligned)
  const tierLabel = TIER_LABEL_MAP[problem.tier];
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = isLight ? '#d97706' : '#fbbf24';
  ctx.textAlign = 'right';
  ctx.fillText(tierLabel, pc.x + pc.width - 22, pc.y + 37);
  ctx.textAlign = 'left';

  // Problem Expression / Visual Lab Renderer
  if (problem.clockData) {
    paintClockLabOnCard(ctx, problem, pc, isLight, primaryText, mutedText);
  } else if (problem.fractionData) {
    paintFractionLabOnCard(ctx, problem, pc, isLight, primaryText);
  } else if (problem.moneyData) {
    paintMoneyLabOnCard(ctx, problem, pc, isLight, primaryText, mutedText);
  } else if (problem.compareData) {
    paintCompareOrPatternOnCard(ctx, problem, pc, isLight, primaryText);
  } else if (problem.storyText) {
    paintStoryProblemOnCard(ctx, problem, pc, isLight, primaryText);
  } else if (layout === 'horizontal') {
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

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = opAccent;
    ctx.textAlign = 'center';
    ctx.fillText('QUOTIENT ↑ (write in answer box)', bracketX + dividendW / 2, bracketTopY - 22);

    ctx.strokeStyle = isLight ? 'rgba(5,150,105,0.35)' : 'rgba(52,211,153,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(bracketX + 12, bracketTopY - 14, dividendW - 20, 6);
    ctx.setLineDash([]);

    ctx.strokeStyle = opAccent;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bracketX + dividendW, bracketTopY);
    ctx.lineTo(bracketX, bracketTopY);
    ctx.quadraticCurveTo(bracketX - 24, bracketTopY + 38, bracketX, bracketTopY + 76);
    ctx.stroke();

    ctx.font = '800 58px monospace';
    ctx.fillStyle = opAccent;
    ctx.textAlign = 'right';
    ctx.fillText(divisorStr, bracketX - 22, bracketTopY + 58);

    ctx.fillStyle = primaryText;
    ctx.textAlign = 'left';
    ctx.fillText(dividendStr, bracketX + 18, bracketTopY + 58);
  } else {
    // Stacked Column Arithmetic (+, −, ×) with Color-Coded Place Value & Carry/Borrow Boxes
    const strA = String(problem.operandA);
    const strB = String(problem.operandB);
    const maxCols = Math.max(strA.length, strB.length, String(problem.correctAnswer).length);
    const colW = 62;
    const rightEdgeX = pc.x + pc.width / 2 + (maxCols * colW) / 2 + 12;
    const placeNames = ['O', 'T', 'H', 'Th'];
    const placeColors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

    for (let c = 0; c < maxCols; c++) {
      const colRightX = rightEdgeX - c * colW;
      const colCenterX = colRightX - colW / 2;
      const colLeftX = colRightX - colW;
      const colAccent = placeColors[c % placeColors.length];

      ctx.strokeStyle = isLight ? 'rgba(148,163,184,0.32)' : 'rgba(148,163,184,0.18)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(colLeftX, pc.y + 68);
      ctx.lineTo(colLeftX, pc.y + 300);
      ctx.stroke();
      ctx.setLineDash([]);

      // Color-coded Place Header pill (Th / H / T / O)
      ctx.fillStyle = `${colAccent}22`;
      ctx.beginPath();
      ctx.roundRect(colCenterX - 18, pc.y + 70, 36, 22, 8);
      ctx.fill();
      ctx.font = '800 13px monospace';
      ctx.fillStyle = colAccent;
      ctx.textAlign = 'center';
      ctx.fillText(placeNames[c] || '', colCenterX, pc.y + 85);

      // Dedicated Carry / Borrow write box
      ctx.fillStyle = isLight ? 'rgba(254, 249, 195, 0.55)' : 'rgba(250, 204, 21, 0.12)';
      ctx.strokeStyle = isLight ? '#d97706' : '#fbbf24';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.roundRect(colCenterX - 18, pc.y + 98, 36, 30, 8);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = isLight ? '#b45309' : '#fcd34d';
    ctx.textAlign = 'right';
    ctx.fillText('carry / borrow →', rightEdgeX - maxCols * colW - 10, pc.y + 118);

    ctx.font = '800 66px monospace';
    ctx.fillStyle = primaryText;
    ctx.textAlign = 'center';
    for (let idx = 0; idx < strA.length; idx++) {
      const digit = strA[strA.length - 1 - idx];
      const colCenterX = rightEdgeX - idx * colW - colW / 2;
      ctx.fillText(digit, colCenterX, pc.y + 194);
    }

    for (let idx = 0; idx < strB.length; idx++) {
      const digit = strB[strB.length - 1 - idx];
      const colCenterX = rightEdgeX - idx * colW - colW / 2;
      ctx.fillText(digit, colCenterX, pc.y + 268);
    }

    ctx.fillStyle = opAccent;
    ctx.fillText(problem.symbol, rightEdgeX - maxCols * colW - 28, pc.y + 268);

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
  const answerDisplay = problem.expectedText ?? String(problem.correctAnswer);

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

  const promptLabel =
    problem.answerKind === 'compare'
      ? '✍️ DRAW < , > OR = HERE'
      : problem.answerKind === 'fraction'
      ? '✍️ WRITE FRACTION HERE (e.g. 3/4)'
      : problem.answerKind === 'time'
      ? '✍️ WRITE CLOCK TIME HERE (e.g. 3:30)'
      : '✍️ WRITE YOUR ANSWER HERE';

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
      : promptLabel,
    ab.x + 16,
    ab.y + 24
  );

  if (isCorrect) {
    ctx.font = '800 56px monospace';
    ctx.fillStyle = isLight ? '#059669' : '#34d399';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${checkState?.recognizedText ?? checkState?.recognized ?? answerDisplay}  ✓ ⭐`,
      ab.x + ab.width / 2,
      ab.y + 110
    );
    ctx.textAlign = 'left';
  } else if (isRevealed) {
    ctx.font = '800 56px monospace';
    ctx.fillStyle = isLight ? '#4338ca' : '#c7d2fe';
    ctx.textAlign = 'center';
    ctx.fillText(answerDisplay, ab.x + ab.width / 2, ab.y + 110);
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

// ============================================================================
// TOPOLOGICAL LOOP COUNTER + SELF-INTERSECTION DIGIT & SYMBOL CLASSIFIER
// Fixes 8-vs-9 confusion (supports single-stroke figure-8 AND two-circle 8)
// and recognizes integers, compare symbols (< > =), fractions (a/b), & time (H:MM)
// ============================================================================

interface LoopHoleInfo {
  area: number;
  cy: number;
  height: number;
}

function segmentsIntersect2D(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): { x: number; y: number } | null {
  const rX = b.x - a.x;
  const rY = b.y - a.y;
  const sX = d.x - c.x;
  const sY = d.y - c.y;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-6) return null;
  const qpx = c.x - a.x;
  const qpy = c.y - a.y;
  const t = (qpx * sY - qpy * sX) / denom;
  const u = (qpx * rY - qpy * rX) / denom;
  if (t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95) {
    return { x: a.x + t * rX, y: a.y + t * rY };
  }
  return null;
}

function strokePathLengthNorm(pts: Array<{ x: number; y: number }>): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

function countEnclosedLoops(normStrokes: Array<Array<{ x: number; y: number }>>): {
  holeCount: number;
  holes: LoopHoleInfo[];
} {
  const G = 28;
  const grid = new Uint8Array(G * G); // 0 = empty, 1 = ink, 2 = exterior

  const stamp = (gx: number, gy: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = gx + dx;
        const ny = gy + dy;
        if (nx >= 0 && nx < G && ny >= 0 && ny < G) {
          grid[ny * G + nx] = 1;
        }
      }
    }
  };

  const drawSeg = (p0: { x: number; y: number }, p1: { x: number; y: number }) => {
    const x0 = 3 + p0.x * 21;
    const y0 = 3 + p0.y * 21;
    const x1 = 3 + p1.x * 21;
    const y1 = 3 + p1.y * 21;
    const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      stamp(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t));
    }
  };

  for (const pts of normStrokes) {
    for (let i = 1; i < pts.length; i++) {
      drawSeg(pts[i - 1], pts[i]);
    }
    // Gently bridge tiny accidental gaps (<0.22) on long curved loops (e.g. slightly unclosed 8 or 0)
    if (pts.length >= 6) {
      const d = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
      if (d > 0.01 && d < 0.22 && strokePathLengthNorm(pts) > 1.35) {
        drawSeg(pts[pts.length - 1], pts[0]);
      }
    }
  }

  // BFS flood-fill exterior from all border cells
  const queue: number[] = [];
  for (let i = 0; i < G; i++) {
    const borders = [i, (G - 1) * G + i, i * G, i * G + (G - 1)];
    for (const idx of borders) {
      if (grid[idx] === 0) {
        grid[idx] = 2;
        queue.push(idx);
      }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const cx = cur % G;
    const cy = Math.floor(cur / G);
    const neighbors = [
      cx > 0 ? cur - 1 : -1,
      cx < G - 1 ? cur + 1 : -1,
      cy > 0 ? cur - G : -1,
      cy < G - 1 ? cur + G : -1,
    ];
    for (const n of neighbors) {
      if (n >= 0 && grid[n] === 0) {
        grid[n] = 2;
        queue.push(n);
      }
    }
  }

  // Extract interior white holes
  const holes: LoopHoleInfo[] = [];
  for (let idx = 0; idx < G * G; idx++) {
    if (grid[idx] !== 0) continue;
    const compQueue = [idx];
    grid[idx] = 3;
    let cHead = 0;
    let sumY = 0;
    let minY = G;
    let maxY = 0;
    while (cHead < compQueue.length) {
      const c = compQueue[cHead++];
      const cx = c % G;
      const cy = Math.floor(c / G);
      sumY += cy;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      const neighbors = [
        cx > 0 ? c - 1 : -1,
        cx < G - 1 ? c + 1 : -1,
        cy > 0 ? c - G : -1,
        cy < G - 1 ? c + G : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && grid[n] === 0) {
          grid[n] = 3;
          compQueue.push(n);
        }
      }
    }
    if (compQueue.length >= 4) {
      holes.push({
        area: compQueue.length,
        cy: sumY / compQueue.length / (G - 1),
        height: (maxY - minY + 1) / (G - 1),
      });
    }
  }

  holes.sort((a, b) => a.cy - b.cy);
  return { holeCount: holes.length, holes };
}

function hasFigureEightSignature(normPts: Array<{ x: number; y: number }>): boolean {
  if (normPts.length < 8) return false;
  // Subsample slightly for clean segment intersection check
  const step = Math.max(1, Math.floor(normPts.length / 40));
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < normPts.length; i += step) pts.push(normPts[i]);
  if (pts[pts.length - 1] !== normPts[normPts.length - 1]) {
    pts.push(normPts[normPts.length - 1]);
  }

  let hasMidCrossing = false;
  for (let i = 0; i < pts.length - 3; i++) {
    for (let j = i + 3; j < pts.length - 1; j++) {
      // Ignore trivial start-end closure meeting at the very tip
      if (i === 0 && j === pts.length - 2) continue;
      const hit = segmentsIntersect2D(pts[i], pts[i + 1], pts[j], pts[j + 1]);
      if (hit && hit.y >= 0.20 && hit.y <= 0.80) {
        hasMidCrossing = true;
        break;
      }
    }
    if (hasMidCrossing) break;
  }

  if (!hasMidCrossing) return false;

  // Verify the bottom half actually forms a rounded loop (wide horizontal spread in lower half)
  const bottomPts = normPts.filter((p) => p.y >= 0.55);
  const topPts = normPts.filter((p) => p.y <= 0.45);
  if (bottomPts.length < 3 || topPts.length < 3) return false;
  const bMinX = Math.min(...bottomPts.map((p) => p.x));
  const bMaxX = Math.max(...bottomPts.map((p) => p.x));
  const tMinX = Math.min(...topPts.map((p) => p.x));
  const tMaxX = Math.max(...topPts.map((p) => p.x));

  return bMaxX - bMinX >= 0.36 && tMaxX - tMinX >= 0.34;
}

function isStackedDoubleLoopEight(normStrokes: Array<Array<{ x: number; y: number }>>): boolean {
  if (normStrokes.length !== 2) return false;
  const stats = normStrokes.map((pts) => {
    const startEnd = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
    const meanY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const len = strokePathLengthNorm(pts);
    return { startEnd, meanY, len };
  });
  stats.sort((a, b) => a.meanY - b.meanY);
  const [upper, lower] = stats;
  return (
    upper.meanY < 0.52 &&
    lower.meanY > 0.48 &&
    lower.meanY - upper.meanY > 0.25 &&
    upper.startEnd < 0.48 &&
    lower.startEnd < 0.48 &&
    upper.len > 0.8 &&
    lower.len > 0.8
  );
}

interface DigitClusterClassification {
  digit: string;
  strongEight: boolean;
  topologyHint: string;
}

// Geometric + Topological offline single-digit classifier
function classifySingleDigitClusterDetailed(cluster: InkStroke[]): DigitClusterClassification {
  const allPts = cluster.flatMap((s) => s.points);
  if (allPts.length < 2) return { digit: '', strongEight: false, topologyHint: '' };

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

  if (h < 18 && w > 18 && aspect > 2.4) {
    return { digit: '-', strongEight: false, topologyHint: 'flat dash (-)' };
  }
  if (aspect < 0.36 && cluster.length === 1) {
    return { digit: '1', strongEight: false, topologyHint: 'tall vertical stroke (1)' };
  }

  const norm = (p: { x: number; y: number }) => ({
    x: (p.x - minX) / w,
    y: (p.y - minY) / h,
  });

  const normStrokes = cluster.map((s) => s.points.map(norm));
  const mainPts = normStrokes[0];
  const start = mainPts[0];
  const end = mainPts[mainPts.length - 1];
  const startEndDist = Math.hypot(end.x - start.x, end.y - start.y);

  let horizMidCross = 0;
  let vertMidCross = 0;
  let topCount = 0;
  let bottomCount = 0;
  let leftCount = 0;
  let rightCount = 0;

  for (const sNorm of normStrokes) {
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

  // 1. TOPOLOGICAL LOOP & FIGURE-8 ANALYSIS (Highest priority — eliminates 8-vs-9 errors!)
  const { holeCount, holes } = countEnclosedLoops(normStrokes);
  const hasTopAndBottomHoles =
    holeCount >= 2 && holes[0].cy < 0.56 && holes[holes.length - 1].cy > 0.44;
  const stackedEight = isStackedDoubleLoopEight(normStrokes);
  const fig8Single = cluster.length === 1 && hasFigureEightSignature(mainPts);

  if (hasTopAndBottomHoles || stackedEight || fig8Single) {
    return {
      digit: '8',
      strongEight: true,
      topologyHint: hasTopAndBottomHoles
        ? '2 vertically stacked enclosed loops (digit 8)'
        : stackedEight
        ? '2 stacked circular strokes (snowman digit 8)'
        : 'figure-8 self-crossing with upper and lower loops (digit 8)',
    };
  }

  // 2. Two-stroke digits (4, 5, 7)
  if (cluster.length >= 2) {
    if (holeCount === 1 && holes[0].cy >= 0.25 && holes[0].cy <= 0.7) {
      return { digit: '4', strongEight: false, topologyHint: '2-stroke enclosed triangle (4)' };
    }
    if (topCount > bottomCount * 1.35 && end.y > 0.65) {
      return { digit: '7', strongEight: false, topologyHint: '2-stroke crossed 7' };
    }
    if (start.x < 0.5 && rightCount >= leftCount * 0.85) {
      return { digit: '4', strongEight: false, topologyHint: '2-stroke 4' };
    }
    return { digit: '5', strongEight: false, topologyHint: '2-stroke 5' };
  }

  // 3. Single-stroke with exactly ONE enclosed loop -> 9, 6, or 0
  if (holeCount === 1) {
    const hole = holes[0];
    // Bottom stem check for 9 vs 0
    const bottomPts = mainPts.filter((p) => p.y > 0.68);
    const bSpanX =
      bottomPts.length >= 2
        ? Math.max(...bottomPts.map((p) => p.x)) - Math.min(...bottomPts.map((p) => p.x))
        : 0;

    if (hole.cy < 0.47 && (end.y > 0.70 || bSpanX < 0.55)) {
      return {
        digit: '9',
        strongEight: false,
        topologyHint: '1 top loop + open bottom stem (digit 9)',
      };
    }
    if (hole.cy > 0.54 && start.y < 0.32) {
      return {
        digit: '6',
        strongEight: false,
        topologyHint: '1 bottom loop + top stem (digit 6)',
      };
    }
    if (hole.height > 0.30 || startEndDist < 0.36) {
      return {
        digit: '0',
        strongEight: false,
        topologyHint: '1 large central oval loop (digit 0)',
      };
    }
  }

  // 4. Single-stroke closed fallback
  if (startEndDist < 0.34) {
    if (horizMidCross >= 2 && vertMidCross >= 3) {
      return { digit: '8', strongEight: true, topologyHint: 'pinched closed figure-8' };
    }
    if (bottomCount > topCount * 1.45) {
      return { digit: '6', strongEight: false, topologyHint: 'bottom-heavy loop (6)' };
    }
    if (topCount > bottomCount * 1.45) {
      return { digit: '9', strongEight: false, topologyHint: 'top-heavy loop (9)' };
    }
    return { digit: '0', strongEight: false, topologyHint: 'single loop (0)' };
  }

  // 5. Open single-stroke digits (7, 2, 3, 6, 9, 5, 1)
  if (start.y < 0.35 && end.y > 0.72 && end.x < 0.55 && vertMidCross <= 2 && topCount > bottomCount) {
    return { digit: '7', strongEight: false, topologyHint: 'open top-bar diagonal (7)' };
  }
  if (start.y < 0.38 && end.y > 0.75 && end.x > 0.6) {
    return { digit: '2', strongEight: false, topologyHint: 'curved top + bottom right tail (2)' };
  }
  if (rightCount > leftCount * 1.32 && horizMidCross >= 2) {
    return { digit: '3', strongEight: false, topologyHint: 'right-heavy double arc (3)' };
  }
  if (end.y < 0.58 && startEndDist < 0.55 && bottomCount > topCount * 1.15) {
    return { digit: '6', strongEight: false, topologyHint: 'open-top bottom curl (6)' };
  }
  if (topCount > bottomCount * 1.3 && start.y < 0.4 && end.y > 0.72 && vertMidCross <= 2) {
    return { digit: '9', strongEight: false, topologyHint: 'top curl + straight down stem (9)' };
  }
  if (vertMidCross >= 2 && horizMidCross >= 2) {
    return { digit: '5', strongEight: false, topologyHint: 'S-curve (5)' };
  }
  return {
    digit: start.y < 0.4 && end.y > 0.65 ? '1' : '0',
    strongEight: false,
    topologyHint: 'simple stroke',
  };
}

function classifyCompareSymbolOffline(strokes: InkStroke[]): string | null {
  const active = pruneErasedStrokes(strokes).filter((s) => s.points.length >= 2);
  if (active.length === 0) return null;

  // Two roughly horizontal strokes -> '='
  if (active.length >= 2) {
    const horizCount = active.filter((s) => {
      const xs = s.points.map((p) => p.x);
      const ys = s.points.map((p) => p.y);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(1, Math.max(...ys) - Math.min(...ys));
      return w > 24 && w / h > 1.8;
    }).length;
    if (horizCount >= 2) return '=';
  }

  // Single chevron stroke -> '<' or '>'
  const pts = active[0].points;
  const xs = pts.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const w = Math.max(10, maxX - minX);
  const startNormX = (pts[0].x - minX) / w;
  const endNormX = (pts[pts.length - 1].x - minX) / w;
  const midPt = pts[Math.floor(pts.length / 2)];
  const midNormX = (midPt.x - minX) / w;

  if (midNormX < 0.42 && startNormX > 0.55 && endNormX > 0.55) return '<';
  if (midNormX > 0.58 && startNormX < 0.45 && endNormX < 0.45) return '>';
  return null;
}

function normalizeCompareText(raw: string): string | null {
  const s = (raw || '').trim();
  if (s.includes('<') || s.toLowerCase().includes('less')) return '<';
  if (s.includes('>') || s.toLowerCase().includes('greater')) return '>';
  if (s.includes('=') || s.toLowerCase().includes('equal')) return '=';
  return null;
}

function normalizeFractionText(raw: string): string | null {
  const cleaned = (raw || '')
    .trim()
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/\s+/g, '');
  const m = cleaned.match(/^(\d+)\/(\d+)$/);
  if (m) return `${parseInt(m[1], 10)}/${parseInt(m[2], 10)}`;
  const loose = cleaned.match(/(\d+)\/(\d+)/);
  if (loose) return `${parseInt(loose[1], 10)}/${parseInt(loose[2], 10)}`;
  return null;
}

function normalizeTimeText(raw: string): string | null {
  const cleaned = (raw || '')
    .trim()
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[.;]/g, ':')
    .replace(/\s+/g, '');
  const colonMatch = cleaned.match(/(\d{1,2}):(\d{1,2})/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      return `${h}:${String(m).padStart(2, '0')}`;
    }
  }
  // If child wrote 330 or 1045 without colon
  const digits = cleaned.replace(/[^\d]/g, '');
  if (digits.length === 3) {
    const h = parseInt(digits[0], 10);
    const m = parseInt(digits.slice(1), 10);
    if (h >= 1 && h <= 9 && m <= 59) return `${h}:${String(m).padStart(2, '0')}`;
  }
  if (digits.length === 4) {
    const h = parseInt(digits.slice(0, 2), 10);
    const m = parseInt(digits.slice(2), 10);
    if (h >= 1 && h <= 12 && m <= 59) return `${h}:${String(m).padStart(2, '0')}`;
  }
  return null;
}

export function classifyHandwrittenNumberOffline(strokes: InkStroke[]): {
  value: number | null;
  raw: string;
  confidence: number;
  strongEightIndices: number[];
  topologySummary: string;
} {
  const active = pruneErasedStrokes(strokes).filter((s) => s.points.length >= 2);
  if (active.length === 0) {
    return { value: null, raw: '', confidence: 0, strongEightIndices: [], topologySummary: '' };
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
  const details = clusters.map((c) => classifySingleDigitClusterDetailed(c.strokes));
  const chars = details.map((d) => d.digit).join('');
  const strongEightIndices = details
    .map((d, idx) => (d.strongEight ? idx : -1))
    .filter((idx) => idx >= 0);
  const topologySummary = details
    .map((d, idx) => (d.topologyHint ? `Digit ${idx + 1}: ${d.topologyHint}` : ''))
    .filter(Boolean)
    .join('; ');
  const value = extractNumericAnswer(chars);

  return {
    value,
    raw: chars,
    confidence: value !== null ? (strongEightIndices.length > 0 ? 0.88 : 0.72) : 0.25,
    strongEightIndices,
    topologySummary,
  };
}

export async function checkHandwrittenMathAnswer(
  allStrokes: InkStroke[],
  problem: ArithmeticProblem,
  language = 'en-IN'
): Promise<MathAnswerCheckResult> {
  const isTamil = String(language).toLowerCase().startsWith('ta');
  const answerKind = problem.answerKind || 'number';
  const expectedText = problem.expectedText ?? String(problem.correctAnswer);

  const boxStrokes = allStrokes.filter(isStrokeInAnswerBox);
  const strokesForAnalysis = boxStrokes.length > 0 ? boxStrokes : allStrokes;
  let snapshot = buildPracticeAnswerSnapshot(boxStrokes);

  if (!snapshot.hasInk) {
    const allSnapshot = buildPracticeAnswerSnapshot(allStrokes);
    if (allSnapshot.hasInk) {
      snapshot = allSnapshot;
    } else {
      return {
        recognizedNumber: null,
        recognizedText: '',
        rawRecognizedText: '',
        isCorrect: false,
        expectedAnswer: problem.correctAnswer,
        expectedText,
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

  // Run fast local topological pre-analysis BEFORE calling Vision so we can pass exact loop hints
  const offlineNum = answerKind === 'number' ? classifyHandwrittenNumberOffline(strokesForAnalysis) : null;
  const offlineCompare = answerKind === 'compare' ? classifyCompareSymbolOffline(strokesForAnalysis) : null;

  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);
  const customGeminiKey =
    typeof window !== 'undefined' ? localStorage.getItem('aura_custom_gemini_api_key') : null;

  let recognizedNumber: number | null = null;
  let recognizedText = '';
  let rawRecognizedText = '';
  let confidence = 0.85;
  let usedOfflineFallback = false;
  let modelUsed = 'Gemini Vision Reader';

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
        expectedAnswerKind: answerKind,
        localGeometryHint: offlineNum?.topologySummary || offlineCompare || undefined,
        geminiApiKey: customGeminiKey || undefined,
        modelOverride: provider === 'gemini' ? model : undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.result) {
        rawRecognizedText = String(data.result.recognizedText || '').trim();
        confidence = Number(data.result.confidence) || 0.92;
        modelUsed = data.modelUsed || modelUsed;

        if (answerKind === 'compare') {
          recognizedText = normalizeCompareText(rawRecognizedText) || '';
        } else if (answerKind === 'fraction') {
          recognizedText = normalizeFractionText(rawRecognizedText) || '';
        } else if (answerKind === 'time') {
          recognizedText = normalizeTimeText(rawRecognizedText) || '';
        } else {
          recognizedNumber = extractNumericAnswer(rawRecognizedText);
          // 8-vs-9 Topology Guard: If Vision misread a clear 2-loop / figure-8 digit as '9',
          // cross-correct that digit position using our deterministic stroke loop topology!
          if (
            recognizedNumber !== null &&
            offlineNum &&
            offlineNum.strongEightIndices.length > 0
          ) {
            const visionDigits = String(recognizedNumber).split('');
            const offlineDigits = offlineNum.raw.split('');
            if (visionDigits.length === offlineDigits.length) {
              let corrected = false;
              for (const idx of offlineNum.strongEightIndices) {
                if (visionDigits[idx] === '9' || visionDigits[idx] === '0' || visionDigits[idx] === '6') {
                  visionDigits[idx] = '8';
                  corrected = true;
                }
              }
              if (corrected) {
                const fixedVal = extractNumericAnswer(visionDigits.join(''));
                if (fixedVal !== null) {
                  recognizedNumber = fixedVal;
                  rawRecognizedText = String(fixedVal);
                  modelUsed = `${modelUsed} + Topology Guard`;
                }
              }
            }
          }
          if (recognizedNumber !== null) recognizedText = String(recognizedNumber);
        }
      } else {
        usedOfflineFallback = true;
      }
    } else {
      usedOfflineFallback = true;
    }
  } catch {
    usedOfflineFallback = true;
  }

  // Offline fallbacks per answer kind
  if (answerKind === 'compare' && !recognizedText) {
    recognizedText = offlineCompare || '';
    usedOfflineFallback = true;
    modelUsed = 'Offline Symbol Classifier';
  } else if (answerKind === 'number' && (usedOfflineFallback || recognizedNumber === null)) {
    const off = offlineNum || classifyHandwrittenNumberOffline(strokesForAnalysis);
    if (recognizedNumber === null) {
      recognizedNumber = off.value;
      recognizedText = off.value !== null ? String(off.value) : '';
      if (!rawRecognizedText) rawRecognizedText = off.raw;
      confidence = off.confidence;
      usedOfflineFallback = true;
      modelUsed = 'Offline Topological Digit Classifier';
    }
  } else if (answerKind === 'time' && !recognizedText) {
    const off = classifyHandwrittenNumberOffline(strokesForAnalysis);
    const maybeTime = normalizeTimeText(off.raw);
    if (maybeTime) {
      recognizedText = maybeTime;
      usedOfflineFallback = true;
      modelUsed = 'Offline Clock Time Classifier';
    }
  }

  const hasAnswer = answerKind === 'number' ? recognizedNumber !== null : Boolean(recognizedText);
  if (!hasAnswer) {
    return {
      recognizedNumber: null,
      recognizedText: '',
      rawRecognizedText,
      isCorrect: false,
      expectedAnswer: problem.correctAnswer,
      expectedText,
      feedbackMessage: isTamil
        ? 'விடை தெளிவாகப் புரியவில்லை — அழித்து மீண்டும் பெரியதாக எழுதுங்கள்!'
        : answerKind === 'compare'
        ? 'Draw a clear < , > or = inside the box (or tap a quick symbol below)!'
        : answerKind === 'fraction'
        ? 'Write the fraction clearly like 3/4 (or use the quick helper below)!'
        : answerKind === 'time'
        ? 'Write the clock time clearly like 3:30 (or use the quick helper below)!'
        : "I couldn't clearly read that number — try writing each digit nice and clear!",
      spokenFeedback: "I couldn't clearly read that answer. Try writing it neatly!",
      confidence: 0.2,
      usedOfflineFallback,
      modelUsed,
    };
  }

  const isCorrect =
    answerKind === 'number'
      ? recognizedNumber === problem.correctAnswer
      : recognizedText.trim() === expectedText.trim();

  const shownRead = answerKind === 'number' ? String(recognizedNumber) : recognizedText;

  if (isCorrect) {
    return {
      recognizedNumber: answerKind === 'number' ? recognizedNumber : problem.correctAnswer,
      recognizedText: shownRead,
      rawRecognizedText: rawRecognizedText || shownRead,
      isCorrect: true,
      expectedAnswer: problem.correctAnswer,
      expectedText,
      feedbackMessage: isTamil
        ? `சூப்பர்! ${expectedText} என்பது சரியான விடை! ⭐`
        : `Awesome! ${expectedText} is spot on! ⭐`,
      spokenFeedback: `Awesome job! ${expectedText} is completely right. You earned stars!`,
      confidence,
      usedOfflineFallback,
      modelUsed,
    };
  }

  const directionTip =
    answerKind === 'number' && recognizedNumber !== null
      ? recognizedNumber < problem.correctAnswer
        ? 'Hint: the true answer is a bit higher!'
        : 'Hint: the true answer is a bit smaller!'
      : 'Tap "Show Step Hint" and give it one more try!';

  return {
    recognizedNumber,
    recognizedText: shownRead,
    rawRecognizedText: rawRecognizedText || shownRead,
    isCorrect: false,
    expectedAnswer: problem.correctAnswer,
    expectedText,
    feedbackMessage: isTamil
      ? `நல்ல முயற்சி! நீங்கள் எழுதியது ${shownRead}. சரி செய்து மீண்டும் முயற்சிக்கவும் அல்லது 💡 Hint பார்க்கவும்.`
      : `Good try! I read ${shownRead}. ${directionTip}`,
    spokenFeedback: `Good try! I read ${shownRead}. ${directionTip}`,
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


