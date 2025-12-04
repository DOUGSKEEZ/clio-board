-- Migration: Add column_dividers table for movable time-of-day separators
-- These dividers allow visual organization of tasks in the Today column
-- They use the same position system as tasks but are NOT exposed via /api/tasks
-- Date: 2025-12-04

BEGIN;

-- Create column_dividers table
CREATE TABLE IF NOT EXISTS column_dividers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    column_name VARCHAR(20) CHECK (column_name IN ('today')) DEFAULT 'today', -- Only Today column for now
    label_above VARCHAR(50) NOT NULL,  -- e.g., "Morning", "Afternoon"
    label_below VARCHAR(50) NOT NULL,  -- e.g., "Afternoon", "Evening"
    position INTEGER NOT NULL DEFAULT 0,  -- Same position system as tasks
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient position queries
CREATE INDEX IF NOT EXISTS idx_column_dividers_position ON column_dividers(column_name, position);

-- Insert the two default dividers for Today column
-- Position them in the middle so tasks can be above/below
INSERT INTO column_dividers (id, column_name, label_above, label_below, position) VALUES
    ('550e8400-e29b-41d4-a716-446655440201', 'today', 'Morning', 'Afternoon', 100),
    ('550e8400-e29b-41d4-a716-446655440202', 'today', 'Afternoon', 'Evening', 200);

COMMIT;

-- Verification:
-- SELECT * FROM column_dividers ORDER BY position;
