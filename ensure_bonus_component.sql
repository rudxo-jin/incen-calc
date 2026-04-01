
-- Check if '상여금' exists, if not insert it
INSERT INTO salary_components (name, type, is_taxable, is_fixed)
SELECT '상여금', 'allowance', true, false
WHERE NOT EXISTS (
    SELECT 1 FROM salary_components WHERE name = '상여금'
);

-- Verify
SELECT * FROM salary_components;
