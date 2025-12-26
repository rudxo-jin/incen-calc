-- Add 'hire_date' column to employees table
alter table public.employees 
add column hire_date date default current_date;
