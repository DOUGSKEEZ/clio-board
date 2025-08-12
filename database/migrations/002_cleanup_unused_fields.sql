-- Migration: Remove unused fields from tasks table
-- Remove: archived_items (list items are preserved automatically)
-- Remove: due_time (we only use due_date)

BEGIN;

-- Step 1: Remove archived_items column (not needed, list_items table handles this)
ALTER TABLE tasks DROP COLUMN IF EXISTS archived_items;

-- Step 2: Remove due_time column (we only use due_date)
ALTER TABLE tasks DROP COLUMN IF EXISTS due_time;

COMMIT;

-- Verification
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks' AND column_name IN ('archived_items', 'due_time');