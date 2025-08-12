-- Migration: Separate completion status from archive state
-- Before: status IN ('pending', 'completed', 'archived')
-- After: status IN ('pending', 'completed') + is_archived BOOLEAN

BEGIN;

-- Step 1: Add new is_archived column
ALTER TABLE tasks ADD COLUMN is_archived BOOLEAN DEFAULT false;

-- Step 2: Migrate existing data
-- Convert 'archived' status to completed + archived based on completed_at
UPDATE tasks 
SET 
    is_archived = true,
    status = CASE 
        WHEN completed_at IS NOT NULL THEN 'completed'
        ELSE 'pending'
    END
WHERE status = 'archived';

-- Step 3: Update status column constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
    CHECK (status IN ('pending', 'completed'));

-- Step 4: Update index that filters on archived status
DROP INDEX IF EXISTS idx_tasks_active;
CREATE INDEX idx_tasks_active ON tasks(status, created_at) WHERE is_archived = false;

DROP INDEX IF EXISTS idx_tasks_archived;
CREATE INDEX idx_tasks_archived ON tasks(archived_at) WHERE is_archived = true;

-- Step 5: Update the getTasks query filter
-- Note: Will need to update TaskService.getTasks() to use is_archived = false instead of status != 'archived'

COMMIT;

-- Verification queries
-- SELECT status, is_archived, COUNT(*) FROM tasks GROUP BY status, is_archived;
-- SELECT * FROM tasks WHERE is_archived = true LIMIT 5;