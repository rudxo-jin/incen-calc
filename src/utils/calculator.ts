
export interface IncentiveData {
  name: string;
  position: string;
  category: string;
  netSales: number;
  profitMargin: number; // Percentage as a number (e.g., 37.6 for 37.6%)
}

export interface IncentiveResult {
  incentive: number;
  level: number;
  rate: number;
  multiplier: number;
  baseDeductible: number;
  salesLevelStart: number;
  message?: string;
  baseSalary: number; // Base salary from employee record
  totalSalary: number; // Incentive + Base Salary
}


// Thresholds for segments [Base, Level 1 End, Level 2 End]
// Level 1: Base ~ Level 1 End
// Level 2: Level 1 End ~ Level 2 End
// Level 3: Level 2 End ~ ...
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

export function calculateIncentive(
  data: IncentiveData,
  employee?: { type: 'incentive' | 'basic', baseSalary: number },
  customThresholds?: Record<string, [number, number, number]>
): IncentiveResult {
  const { position, netSales, profitMargin, category } = data;

  // If employee is set to 'basic' type, return 0 incentive (or handle differently if needed)
  if (employee?.type === 'basic') {
    return {
      incentive: 0,
      level: 0,
      rate: 0,
      multiplier: 0,
      baseDeductible: 0,
      salesLevelStart: 0,
      message: '기본급 전용 (인센티브 없음)',
      baseSalary: employee.baseSalary,
      totalSalary: employee.baseSalary
    };
  }

  // Normalize position
  let pos = (position || '').trim();

  // Factory Manager has no incentive
  if (pos === '공장장') {
    return {
      incentive: 0,
      level: 0,
      rate: 0,
      multiplier: 0,
      baseDeductible: 0,
      salesLevelStart: 0,
      message: '공장장 (인센티브 없음)',
      baseSalary: employee?.baseSalary || 0,
      totalSalary: employee?.baseSalary || 0
    };
  }

  const thresholds = (customThresholds && customThresholds[pos])
    ? customThresholds[pos]
    : DEFAULT_THRESHOLDS[pos];

  if (!thresholds) {
    return {
      incentive: 0,
      level: 0,
      rate: 0,
      multiplier: 0,
      baseDeductible: 0,
      salesLevelStart: 0,
      message: '직급 정보 없음',
      baseSalary: employee?.baseSalary || 0,
      totalSalary: employee?.baseSalary || 0
    };
  }

  const [base, l1End, l2End] = thresholds;

  // Determine Multiplier
  const col = getColumn(profitMargin, category);
  const multiplier = MULTIPLIER_BY_COL[col - 1];

  let totalIncentive = 0;
  let maxLevel = 0;

  // Level 1 Calculation
  if (netSales > base) {
    const limit = Math.min(netSales, l1End);
    const amount = limit - base;
    if (amount > 0) {
      totalIncentive += amount * RATES[0] * multiplier;
      maxLevel = 1;
    }
  }

  // Level 2 Calculation
  if (netSales > l1End) {
    const limit = Math.min(netSales, l2End);
    const amount = limit - l1End;
    if (amount > 0) {
      totalIncentive += amount * RATES[1] * multiplier;
      maxLevel = 2;
    }
  }

  // Level 3 Calculation
  if (netSales > l2End) {
    const amount = netSales - l2End;
    if (amount > 0) {
      // For '기사', use Level 2 rate (7%) for the excess amount as well (effectively no Level 3)
      const rate = pos === '기사' ? RATES[1] : RATES[2];
      totalIncentive += amount * rate * multiplier;
      maxLevel = 3;
    }
  }

  const baseSalary = employee?.baseSalary || 0;
  const incentive = Math.floor(totalIncentive);

  return {
    incentive,
    level: maxLevel,
    rate: 0, // Not applicable in progressive
    multiplier,
    baseDeductible: base,
    salesLevelStart: 0, // Not applicable
    baseSalary,
    totalSalary: incentive + baseSalary
  };
}
