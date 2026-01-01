-- Migrate existing base_salary from employees table to employee_salary_settings
-- This ensures that the '기본급' component is populated for all existing employees.

insert into public.employee_salary_settings (employee_id, component_id, amount)
select 
  e.id, 
  sc.id, 
  coalesce(e.base_salary, 0)
from public.employees e
cross join public.salary_components sc
where sc.name = '기본급'
on conflict (employee_id, component_id) 
do update set amount = excluded.amount;

-- Also set default '식대' (Meal Allowance) to 100,000 for everyone as a starting point
insert into public.employee_salary_settings (employee_id, component_id, amount)
select 
  e.id, 
  sc.id, 
  100000
from public.employees e
cross join public.salary_components sc
where sc.name = '식대'
on conflict (employee_id, component_id) 
do nothing;
