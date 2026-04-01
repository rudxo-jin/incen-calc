/**
 * Payroll Calculation Utilities
 * Based on 2024 Korean Standard Rates
 */

// 1. National Pension (국민연금)
// Rate: 4.5% of taxable income
// Cap: Monthly income min 370,000 ~ max 5,900,000 (as of July 2023, check 2024 updates if needed)
// For simplicity, we'll use the rate without strict caps for now, or apply simple caps.
export const calculateNationalPension = (taxableIncome: number): number => {
    const rate = 0.045;
    // Simple cap implementation (approximate 2024 standards)
    // Max monthly income base: 5,900,000 KRW -> Max pension: 265,500 KRW
    const maxIncome = 5900000;
    const minIncome = 370000;

    let baseIncome = taxableIncome;
    if (baseIncome > maxIncome) baseIncome = maxIncome;
    if (baseIncome < minIncome) baseIncome = minIncome;

    return Math.floor((baseIncome * rate) / 10) * 10; // Round down to nearest 10
};

// 2. Health Insurance (건강보험)
// Rate: 3.545% of taxable income (2024)
export const calculateHealthInsurance = (taxableIncome: number): number => {
    const rate = 0.03545;
    return Math.floor((taxableIncome * rate) / 10) * 10;
};

// 3. Long-term Care Insurance (장기요양보험)
// Rate: 12.95% of Health Insurance amount (2024)
export const calculateLongTermCare = (healthInsuranceAmount: number): number => {
    const rate = 0.1295;
    return Math.floor((healthInsuranceAmount * rate) / 10) * 10;
};

// 4. Employment Insurance (고용보험)
// Rate: 0.9% of taxable income (Worker's share)
export const calculateEmploymentInsurance = (taxableIncome: number): number => {
    const rate = 0.009;
    return Math.floor((taxableIncome * rate) / 10) * 10;
};

// 5. Income Tax (소득세)
// Simplified calculation (Simplified Tax Table is complex, using flat rate or simple bracket for estimation)
// For this MVP, we will use a simplified logic or a flat rate if the user prefers, 
// but usually it follows the National Tax Service's Simplified Tax Table.
// Here we'll implement a very simplified progressive tax bracket for estimation.
import taxTable from '../data/tax_table.json';

// 5. Income Tax (소득세)
// Uses Simplified Tax Table (2024)
export const calculateIncomeTax = (taxableIncome: number, dependents: number = 1): number => {
    if (taxableIncome <= 0) return 0;

    // The table uses monthly income in thousands (e.g., 1,000,000 -> 1000)
    // But our json stores min/max in full won.
    // We just need to find the range.

    // Find the row where min <= income < max
    const row = taxTable.find((r: any) => taxableIncome >= r.min && taxableIncome < r.max);

    if (!row) {
        // If income is higher than the max in table (10,000,000)
        // Use the last row for base tax (10,000,000)
        const lastRow = taxTable[taxTable.length - 1];
        const baseTax = (lastRow.taxes as any)[Math.min(dependents, 11).toString()] || 0;

        const income = taxableIncome;

        // 1. 10,000,000 < Income <= 14,000,000
        if (income <= 14000000) {
            // (10,000,000원인 경우의 해당 세액) + (10,000,000원을 초과하는 금액 중 98%를 곱한 금액의 35% 상당액) + (25,000원)
            return Math.floor(baseTax + ((income - 10000000) * 0.98 * 0.35) + 25000);
        }

        // 2. 14,000,000 < Income <= 28,000,000
        if (income <= 28000000) {
            // (1천만원인 경우의 해당세액) + (1,397,000원) + (14,000천원을 초과하는 금액 중 98퍼센트를 곱한 금액의 38퍼센트 상당액)
            return Math.floor(baseTax + 1397000 + ((income - 14000000) * 0.98 * 0.38));
        }

        // 3. 28,000,000 < Income <= 30,000,000
        if (income <= 30000000) {
            // (10,000천원인 경우의 해당세액) + (6,610,600원) + (28,000천원을 초과하는 금액에 98퍼센트를 곱한 금액의 40퍼센트 상당액)
            return Math.floor(baseTax + 6610600 + ((income - 28000000) * 0.98 * 0.40));
        }

        // 4. 30,000,000 < Income <= 45,000,000 (and above for now)
        // (10,000천원인 경우의 해당세액) + (7,394,600원) + (30,000천원을 초과하는 금액의 40퍼센트 상당액)
        // Note: No 98% for this bracket as per instruction
        return Math.floor(baseTax + 7394600 + ((income - 30000000) * 0.40));
    }

    // Get tax for dependent count (cap at 11)
    const dependentKey = Math.min(dependents, 11).toString();
    const tax = (row.taxes as any)[dependentKey] || 0;

    return tax;
};

// 6. Local Income Tax (지방소득세)
// 10% of Income Tax
export const calculateLocalIncomeTax = (incomeTax: number): number => {
    return Math.floor((incomeTax * 0.1) / 10) * 10;
};
