
export interface IncentiveData {
  name: string;
  position: string;
  category: string;
  netSales: number;
  additionalSales?: number; // Optional manually added sales
  profitMargin: number; // Percentage as a number (e.g., 37.6 for 37.6%)
  forcedCol?: number; // Optional forced application rate (1-9)
}

export interface BreakdownItem {
  level: number;
  min: number;
  max: number | null;
  rate: number;
  salesAmount: number;
  incentiveAmount: number;
}

export interface IncentiveResult {
  incentive: number;
  level: number;
  rate: number;
  multiplier: number;
  col: number;
  baseDeductible: number;
  salesLevelStart: number;
  message?: string;
  baseSalary: number;
  totalSalary: number;
  breakdown: BreakdownItem[];
}

// Thresholds for segments [Base, Level 1 End, Level 2 End]
// Level 1: Base ~ Level 1 End
// Level 2: Level 1 End ~ Level 2 End
// Level 3: Level 2 End ~ ...
export const DEFAULT_THRESHOLDS: Record<string, [number, number, number]> = {
  '기사': [21500000, 25500000, 40000000],
  '선임기사': [23000000, 27000000, 42000000],
  '팀장': [24500000, 28500000, 45500000],
};

const RATES = [0.03, 0.07, 0.10]; // 3%, 7%, 10%

// Multiplier Grid
const MARGIN_RANGES_TAXI = [
  { max: 36.5, col: 1 },
  { max: 38.0, col: 2 },
  { max: 39.5, col: 3 },
  { max: 41.0, col: 4 },
  { min: 41.1, col: 5 },
];

const MARGIN_RANGES_PANGPANG = [
  { max: 36.5, col: 1 },
  { max: 38.0, col: 2 },
  { max: 39.5, col: 3 },
  { max: 41.0, col: 4 },
  { max: 42.5, col: 5 },
  { max: 44.0, col: 6 },
  { max: 45.5, col: 7 },
  { max: 47.0, col: 8 },
  { min: 47.1, col: 9 },
];

const MULTIPLIER_BY_COL = [0.9, 0.95, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6];

function getColumn(margin: number, category: string): number {
  const isTaxi = category.includes('택시');
  const ranges = isTaxi ? MARGIN_RANGES_TAXI : MARGIN_RANGES_PANGPANG;

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (range.max !== undefined && margin <= range.max) {
      return range.col;
    }
    if (range.min !== undefined && margin >= range.min) {
      return range.col;
    }
  }
  return 1;
}

// Helper to truncate rate to 1 decimal place (e.g., 2.85% -> 2.8%)
function getEffectiveRate(rate: number, multiplier: number): number {
  // rate * multiplier * 100 gives percentage (e.g., 0.03 * 0.95 * 100 = 2.85)
  // floor(2.85 * 10) = 28
  // 28 / 10 = 2.8
  // 2.8 / 100 = 0.028
  return Math.floor(rate * multiplier * 1000) / 1000;
}

export function calculateIncentive(
  data: IncentiveData,
  employee?: { type: 'incentive' | 'basic', baseSalary: number },
  customThresholds?: Record<string, [number, number, number]>
): IncentiveResult {
  const { position, netSales, profitMargin, category, forcedCol } = data;

  // If employee is set to 'basic' type, return 0 incentive (or handle differently if needed)
  if (employee?.type === 'basic') {
    return {
      incentive: 0,
      level: 0,
      rate: 0,
      multiplier: 0,
      col: 0,
      baseDeductible: 0,
      salesLevelStart: 0,
      message: '기본급 전용 (인센티브 없음)',
      baseSalary: employee.baseSalary,
      totalSalary: employee.baseSalary,
      breakdown: []
    };
  }


  // Normalize position
  let pos = (position || '').trim();

  const thresholdsMap = customThresholds || DEFAULT_THRESHOLDS;
  const thresholds = thresholdsMap[pos];


  // Factory Manager has no incentive
  if (pos === '공장장') {
    return {
      incentive: 0,
      level: 0,
      rate: 0,
      multiplier: 0,
      col: 0,
      baseDeductible: 0,
      salesLevelStart: 0,
      message: '공장장 (인센티브 없음)',
      baseSalary: employee?.baseSalary || 0,
      totalSalary: employee?.baseSalary || 0,
      breakdown: []
    };
  }

  if (!thresholds) {
    return {
      incentive: 0,
      level: 0,
      rate: 0,
      multiplier: 0,
      col: 0,
      baseDeductible: 0,
      salesLevelStart: 0,
      message: '직급 정보 없음 (인센티브 계산 불가)',
      baseSalary: employee?.baseSalary || 0,
      totalSalary: employee?.baseSalary || 0,
      breakdown: []
    };
  }

  const [base, l1End, l2End] = thresholds;

  // Determine Multiplier Column
  const col = (forcedCol !== undefined && forcedCol !== null) ? forcedCol : getColumn(profitMargin, category);
  const multiplier = MULTIPLIER_BY_COL[col - 1] || 1.0;

  let totalIncentive = 0;
  let maxLevel = 0;
  const breakdown: BreakdownItem[] = [];

  // Calculate Effective Sales (Net Sales + Additional Sales)
  const effectiveSales = netSales + (data.additionalSales || 0);

  // Level 1 Calculation
  if (effectiveSales > base) {
    const limit = Math.min(effectiveSales, l1End);
    const amount = limit - base;
    if (amount > 0) {
      const effectiveRate = getEffectiveRate(RATES[0], multiplier);
      const incentive = Math.round(amount * effectiveRate);
      totalIncentive += incentive;
      maxLevel = 1;
      breakdown.push({
        level: 1,
        min: base,
        max: l1End,
        rate: effectiveRate, // Store effective rate for display
        salesAmount: amount,
        incentiveAmount: incentive
      });
    }
  }

  // Level 2 Calculation
  if (effectiveSales > l1End) {
    const limit = Math.min(effectiveSales, l2End);
    const amount = limit - l1End;
    if (amount > 0) {
      const effectiveRate = getEffectiveRate(RATES[1], multiplier);
      const incentive = Math.round(amount * effectiveRate);
      totalIncentive += incentive;
      maxLevel = 2;
      breakdown.push({
        level: 2,
        min: l1End,
        max: l2End,
        rate: effectiveRate,
        salesAmount: amount,
        incentiveAmount: incentive
      });
    }
  }

  // Level 3 Calculation
  if (effectiveSales > l2End) {
    const amount = effectiveSales - l2End;
    if (amount > 0) {
      // For '기사', use Level 2 rate (7%) for the excess amount as well (effectively no Level 3)
      const rate = pos === '기사' ? RATES[1] : RATES[2];
      const effectiveRate = getEffectiveRate(rate, multiplier);
      const incentive = Math.round(amount * effectiveRate);
      totalIncentive += incentive;
      maxLevel = 3;
      breakdown.push({
        level: 3,
        min: l2End,
        max: null,
        rate: effectiveRate,
        salesAmount: amount,
        incentiveAmount: incentive
      });
    }
  }

  const baseSalary = employee?.baseSalary || 0;
  const incentive = totalIncentive;

  return {
    incentive,
    level: maxLevel,
    rate: 0, // Not applicable in progressive
    multiplier,
    col,
    baseDeductible: base,
    salesLevelStart: 0, // Not applicable
    baseSalary,
    totalSalary: incentive + baseSalary,
    breakdown
  };
}
