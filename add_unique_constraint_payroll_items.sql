-- Add unique constraint to payroll_items table
-- This is required for upsert operations using onConflict: 'payroll_id, component_id'

ALTER TABLE payroll_items
ADD CONSTRAINT payroll_items_payroll_id_component_id_key UNIQUE (payroll_id, component_id);
