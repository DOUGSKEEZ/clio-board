-- Migration: Fix archive field consistency across all tables
-- 1. Add is_archived boolean to routines (separate from status)
-- 2. Migrate existing archived routines to use is_archived=true + status=active
-- 3. Remove 'archived' from routines status enum
-- 4. Rename notes.archived to notes.is_archived for consistency
-- Date: 2025-08-14

BEGIN;

-- Step 1: Add is_archived boolean to routines table
ALTER TABLE routines ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Step 2: Migrate existing archived routines
-- Set is_archived=true for routines with status='archived' and reset their status to 'active'
UPDATE routines 
SET is_archived = true, 
    status = 'active' 
WHERE status = 'archived';

-- Step 3: Remove 'archived' from the status enum constraint
-- First drop the old constraint
ALTER TABLE routines DROP CONSTRAINT IF EXISTS routines_status_check;

-- Add new constraint without 'archived'
ALTER TABLE routines ADD CONSTRAINT routines_status_check 
CHECK (status IN ('active', 'paused', 'completed'));

-- Step 4: Fix notes table - rename 'archived' to 'is_archived'
ALTER TABLE notes RENAME COLUMN archived TO is_archived;

COMMIT;

-- Verification queries:
-- SELECT status, is_archived, COUNT(*) FROM routines GROUP BY status, is_archived;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'notes' AND column_name LIKE '%archive%';