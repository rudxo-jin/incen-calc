-- Add 'type' column to employees table
alter table public.employees 
add column type text default 'incentive';

-- Update existing rows if any (optional, but safe)
update public.employees 
set type = 'incentive' 
where type is null;
