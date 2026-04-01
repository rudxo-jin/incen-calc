-- Add formula column to salary_components table
ALTER TABLE salary_components
ADD COLUMN formula TEXT;

-- Update default formulas for standard deductions
-- Note: Using simplified variable names 'taxable_income' for calculation reference
-- These strings will be evaluated or parsed by the frontend/backend logic

-- 1. National Pension (4.5%)
UPDATE salary_components
SET formula = 'taxable_income * 0.045'
WHERE name = '국민연금';

-- 2. Health Insurance (3.545%)
UPDATE salary_components
SET formula = 'taxable_income * 0.03545'
WHERE name = '건강보험';

-- 3. Long-term Care Insurance (12.95% of Health Insurance)
-- This might need a way to reference other components, but for now let's use the base rate approximation or specific logic
-- If we support referencing other components, we might need variable names like 'health_insurance'
-- For simplicity in MVP, let's use the direct rate on taxable income: 3.545% * 12.95% ~= 0.459%
-- OR better, define it as dependent. Let's try to stick to the plan's suggestion:
-- "health_insurance * 0.1295" -> This implies we need to resolve 'health_insurance' value first.
UPDATE salary_components
SET formula = 'health_insurance * 0.1295'
WHERE name = '장기요양보험';

-- 4. Employment Insurance (0.9%)
UPDATE salary_components
SET formula = 'taxable_income * 0.009'
WHERE name = '고용보험';

-- 5. Income Tax (Simplified 3.3% for now as placeholder, or user can edit)
UPDATE salary_components
SET formula = 'taxable_income * 0.033'
WHERE name = '소득세';

-- 6. Local Income Tax (10% of Income Tax)
UPDATE salary_components
SET formula = 'income_tax * 0.1'
WHERE name = '지방소득세';
