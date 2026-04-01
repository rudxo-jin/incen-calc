
-- Add sort_order column to salary_components
ALTER TABLE public.salary_components 
ADD COLUMN sort_order integer DEFAULT 0;

-- Initialize sort_order based on current id order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY type, id) as rn
  FROM public.salary_components
)
UPDATE public.salary_components
SET sort_order = ranked.rn
FROM ranked
WHERE public.salary_components.id = ranked.id;
