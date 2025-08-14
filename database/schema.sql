-- CLIO Task Manager Database Schema
-- Single-user task management system with implicit task/list conversion
-- Based on requirements in docs/CLIO Task Manager - Requirements Document Part 2.md

-- Create database (run separately)
-- CREATE DATABASE clio_board;
-- \c clio_board;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Routines Table (Containers for related tasks)
CREATE TABLE routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3498db', -- Hex color for UI
    icon VARCHAR(50) DEFAULT '📌', -- Emoji icon
    status VARCHAR(20) CHECK (status IN ('active', 'paused', 'completed')) DEFAULT 'active',
    achievable BOOLEAN DEFAULT false, -- Can be marked complete when all tasks done
    pause_until TIMESTAMP NULL, -- When paused routines resume
    is_archived BOOLEAN DEFAULT false, -- Archive state (separate from operational status)
    display_order INTEGER DEFAULT 0, -- Custom display order for drag-and-drop
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    archived_at TIMESTAMP NULL
);

-- 2. Tasks Table (Core entity - both simple tasks and lists)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routine_id UUID REFERENCES routines(id) ON DELETE SET NULL, -- NULL for orphan tasks
    title VARCHAR(255) NOT NULL,
    notes TEXT, -- Free-form notes from user or agent
    
    -- AUTO-MANAGED TYPE FIELD - User never sets this directly!
    type VARCHAR(10) CHECK (type IN ('task', 'list')) DEFAULT 'task',
    
    status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'archived')) DEFAULT 'pending',
    due_date DATE, -- Soft deadline (optional)
    due_time TIME, -- Optional time component
    position INTEGER NOT NULL DEFAULT 0, -- Order within column
    column_name VARCHAR(20) CHECK (column_name IN ('today', 'tomorrow', 'this_week', 'horizon')) DEFAULT 'today',
    
    -- Archive preservation for lists
    archived_items JSONB, -- Snapshot of list items when archived
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP NULL,
    archived_at TIMESTAMP NULL
);

-- 3. List Items Table (Only exists for tasks where type='list')
CREATE TABLE list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    completed BOOLEAN DEFAULT false,
    position INTEGER NOT NULL DEFAULT 0, -- For drag-to-reorder within list
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Notes Table (Scratch area - 4 columns)
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255),
    content TEXT NOT NULL,
    type VARCHAR(10) CHECK (type IN ('user', 'agent')) DEFAULT 'user',
    source VARCHAR(20) CHECK (source IN ('manual', 'voice', 'conversation', 'claude_api')) DEFAULT 'manual',
    column_position INTEGER CHECK (column_position IN (1, 2, 3, 4)) DEFAULT 1, -- 1,2=user, 3,4=agent
    
    -- Optional associations
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    routine_id UUID REFERENCES routines(id) ON DELETE SET NULL,
    
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    archived_at TIMESTAMP NULL
);

-- 5. Audit Log Table (Track all changes for undo/agent monitoring)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor VARCHAR(10) CHECK (actor IN ('user', 'agent')) NOT NULL,
    action VARCHAR(100) NOT NULL, -- create_task, update_task, move_task, etc.
    entity_type VARCHAR(50) NOT NULL, -- task, routine, note, list_item
    entity_id UUID NOT NULL,
    
    -- For undo functionality
    previous_state JSONB,
    new_state JSONB,
    
    -- Agent identification
    agent_key_hash VARCHAR(64), -- Hashed agent key for security
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Performance Indexes
-- Critical for board queries with many archived items
CREATE INDEX idx_tasks_active ON tasks(status, created_at) WHERE status != 'archived';
CREATE INDEX idx_tasks_column ON tasks(column_name, position) WHERE status != 'archived';
CREATE INDEX idx_tasks_routine ON tasks(routine_id, status);
CREATE INDEX idx_tasks_archived ON tasks(archived_at) WHERE status = 'archived';

CREATE INDEX idx_list_items_task ON list_items(task_id, position);

CREATE INDEX idx_routines_active ON routines(status) WHERE status != 'archived';

CREATE INDEX idx_notes_active ON notes(column_position, created_at) WHERE archived = false;
CREATE INDEX idx_notes_type ON notes(type, created_at);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_log_actor ON audit_log(actor, created_at);

-- Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_routines_updated_at BEFORE UPDATE ON routines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample Data for Development/Testing
INSERT INTO routines (id, title, description, color, icon, type, status) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Bathroom Renovation', 'Master bathroom remodel project', '#e74c3c', '🔧', 'project', 'active'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Weekly Errands', 'Recurring weekly tasks', '#2ecc71', '🛒', 'recurring', 'active'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Writing', 'Blog posts and articles', '#9b59b6', '📝', 'recurring', 'active');

INSERT INTO tasks (id, routine_id, title, notes, column_name, position, type) VALUES
    ('550e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440001', 'Grout white tile', 'Need to finish the shower area first', 'today', 1, 'task'),
    ('550e8400-e29b-41d4-a716-446655440102', '550e8400-e29b-41d4-a716-446655440001', 'Call contractor', 'Get quote for plumbing work', 'today', 2, 'task'),
    ('550e8400-e29b-41d4-a716-446655440103', '550e8400-e29b-41d4-a716-446655440002', 'Costco List', 'Weekly grocery run', 'tomorrow', 1, 'list'),
    ('550e8400-e29b-41d4-a716-446655440104', NULL, 'Pick up dry cleaning', 'The blue shirts are ready', 'tomorrow', 2, 'task'),
    ('550e8400-e29b-41d4-a716-446655440105', '550e8400-e29b-41d4-a716-446655440003', 'Write blog post', 'Topic: Task management systems', 'this_week', 1, 'task'),
    ('550e8400-e29b-41d4-a716-446655440106', NULL, 'Plan summer vacation', 'Research destinations', 'horizon', 1, 'task');

-- Sample list items for the Costco List
INSERT INTO list_items (task_id, title, completed, position) VALUES
    ('550e8400-e29b-41d4-a716-446655440103', 'Milk', false, 1),
    ('550e8400-e29b-41d4-a716-446655440103', 'Eggs', false, 2),
    ('550e8400-e29b-41d4-a716-446655440103', 'Meat', false, 3),
    ('550e8400-e29b-41d4-a716-446655440103', 'Syrup', false, 4),
    ('550e8400-e29b-41d4-a716-446655440103', 'Wine', false, 5);

-- Sample notes
INSERT INTO notes (title, content, type, column_position) VALUES
    ('Voice Note', 'Remember to check for sales at Costco this week', 'user', 1),
    ('Ideas', 'Blog post idea: How AI agents can help with task management', 'user', 2),
    ('System Observation', 'User tends to create more tasks on Monday mornings', 'agent', 3),
    ('Pattern Analysis', 'Bathroom project tasks are taking longer than estimated', 'agent', 4);

-- Comments explaining key design decisions
COMMENT ON TABLE tasks IS 'Core entity: tasks automatically convert between simple tasks and lists based on presence of list_items';
COMMENT ON COLUMN tasks.type IS 'AUTO-MANAGED: task->list when first item added, list->task when last item deleted';
COMMENT ON COLUMN tasks.archived_items IS 'Preserves snapshot of list items when task is archived';
COMMENT ON TABLE list_items IS 'Only exists for tasks where type=list. Simple text entries with checkboxes';
COMMENT ON TABLE audit_log IS 'Complete change history for undo functionality and agent monitoring';