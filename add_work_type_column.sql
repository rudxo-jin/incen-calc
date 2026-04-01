alter table public.employees 
add column work_type_id bigint references public.work_types(id);

-- Optional: Update existing rows if needed, or leave null
