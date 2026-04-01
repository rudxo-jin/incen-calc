-- Delete '식대' (Meal Allowance) from employee_salary_settings
DELETE FROM public.employee_salary_settings
WHERE component_id IN (
    SELECT id FROM public.salary_components WHERE name = '식대'
);
