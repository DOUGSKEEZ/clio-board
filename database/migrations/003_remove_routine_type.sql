-- Migration: Remove unused type field from routines table
-- The type field (project/recurring) was confusing and not actually used
-- Date: 2025-08-14

BEGIN;

-- Step 1: Drop the type column from routines table
ALTER TABLE routines DROP COLUMN IF EXISTS type;

COMMIT;

-- Verification query (run after migration)
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'routines' AND column_name = 'type';
-- Should return 0 rows after successful migration