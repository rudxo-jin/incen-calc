alter table public.employees 
add column resignation_date date;

-- Optional: Update is_active based on resignation_date
-- update public.employees set is_active = false where resignation_date is not null and resignation_date <= current_date;
