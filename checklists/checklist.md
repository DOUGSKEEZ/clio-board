# Database Setup Checklist

- [x] Create PostgreSQL database `clio_board` (renamed from clio_tasks)
- [x] Create database user `samwise` with password (renamed from clio_user)  
- [x] Grant all privileges on database to user
- [x] Create tables: tasks, list_items, routines, notes, audit_log
- [x] Add indexes for performance (status, column, archived_at)
- [x] Test connection with psql
- [x] Verify tables created correctly
- [x] Insert sample data for development/testing

# API Development Checklist

## Core Task Endpoints
- [x] GET /api/tasks - Get all active tasks
- [x] POST /api/tasks - Create new task  
- [x] PUT /api/tasks/:id - Update task
- [x] PUT /api/tasks/:id/archive - Archive task
- [x] GET /api/tasks/archived - Get all archived tasks
- [x] PUT /api/tasks/:id/restore - Restore archived task
- [x] POST /api/tasks/:id/complete - Mark complete
- [x] PUT /api/tasks/:id/move - Move task between columns
- [x] Due date (due_date field)

## List Items (Implicit Type Management) ✨ CORE INNOVATION
- [x] Implement implicit task/list conversion logic in TaskService
- [x] POST /api/tasks/:id/items - Add item (auto-converts task to list)
- [x] PUT /api/tasks/:id/items/:itemId - Update/check off item (keeps visible)
- [x] DELETE /api/tasks/:id/items/:itemId - Remove item (auto-converts back if last)
- [x] GET /api/tasks/:id/items - Get all items for a task

## Routines
- [x] GET /api/routines - Get all routines (with task counts)
- [x] POST /api/routines - Create routine
- [x] PUT /api/routines/:id - Update routine
- [x] GET /api/routines/:id/tasks - Get tasks for routine (mini-board view)
- [x] PUT /api/routines/:id/pause - Pause routine with optional resume date
- [x] PUT /api/routines/:id/complete - Complete achievable routines
- [x] PUT /api/routines/:id/archive - Archive routine
- [x] PUT /api/routines/:id/restore - Restore archived routine

## Notes
- [x] GET /api/notes - Get all notes (4-column scratch area)
- [x] POST /api/notes - Create note (auto-detects user vs agent)
- [x] PUT /api/notes/:id - Update note content/position
- [x] PUT /api/notes/:id/move - Move note between columns (1-4)
- [x] POST /api/notes/:id/convert - Convert note to task
- [x] PUT /api/notes/:id/archive - Archive note
- [x] PUT /api/notes/:id/restore - Restore archived note

## Infrastructure & Foundation
- [x] Express.js server setup with PostgreSQL connection
- [x] Winston logging (console + file) with request/response logging
- [x] Environment configuration (.env file)
- [x] Health check endpoints (/health, /metrics, /debug/status)
- [x] Swagger API documentation (/api-docs)
- [x] Error handling middleware
- [x] CORS and security middleware (helmet)

## Agent Features
- [x] X-Agent-Key authentication middleware
- [x] Audit logging for all agent actions
- [x] IP validation for agent requests (127.0.0.1, 192.168.10.21, 192.168.20.20)
- [x] Log warnings for agent key used from unexpected IPs (403 Forbidden)
- [x] Rate limiting for agents (500 req/min, 429 status, log when hit)

# Next Priority Tasks (MVP Core)

## Phase 1: Core API Endpoints ✅ COMPLETE!
- [x] Create TaskService with implicit type conversion logic
- [x] Build /api/tasks endpoints (GET, POST, PUT, archive, complete)
- [x] Build /api/tasks/:id/items endpoints (add, update, delete items)
- [x] Build /api/routines endpoints (GET, POST, PUT)
- [x] Build /api/notes endpoints (GET, POST, convert to task)

### 🎯 Phase 1 Test Results - ALL PASSING!
- [x] Task columns working (today/tomorrow/this_week/horizon)
- [x] Archive endpoint preserves data (soft delete)
- [x] Complete endpoint marks complete then archives
- [x] List item checking (mark complete, stays visible)
- [x] Agent authentication via X-Agent-Key header
- [x] Due date/time support fully functional
- [x] Implicit type conversion: task ↔ list (CORE INNOVATION)

## Phase 2: Frontend Kanban Board 🚧 85% COMPLETE

### ✅ Basic Board Infrastructure
- [x] Create 4-column board layout (Today/Tomorrow/Week/Horizon)
- [x] Basic task card component (title, due date, routine tag)
- [x] List card variant (with expand/collapse functionality)
- [x] Drag-and-drop between columns (SortableJS integration)
- [x] Add Task modals with column-specific creation
- [x] Click-to-edit functionality for existing tasks/lists
- [x] Auto-expanding list item fields for rapid creation
- [x] List item deletion with proper error handling
- [x] Space optimization (removed notes from cards, tighter spacing)
- [x] CSP configuration for external CDN resources
- [x] Compact list view - "Grocery List (5 items)" collapsed state
- [x] Three-dot menu system for task actions (prevents accidental archives)
- [x] ESC key and click-outside to close all modals
- [x] Blue hover outline on task cards for better UX

### ✅ COMPLETED CORE FEATURES
- [x] **Task completion checkboxes** on cards (Trello-style hover-to-show)
- [x] **Task states**: Separated completion (pending/completed) from archive state
- [x] **Archive functionality** in UI with three-dot dropdown menu
- [x] **Restore functionality** in Archive tab with instant board refresh
- [x] **Archive view** - dedicated modal for viewing/restoring archived tasks
- [x] **Database refactoring** - separated is_archived from status field
- [x] **Real-time UI updates** - board refreshes after archive/restore operations
### ✅ ROUTINE MANAGEMENT SYSTEM 
- [x] **Routine management** - create/edit routines with color/icon picker
- [x] **Routine completion system** - achievable routines can be marked complete with celebratory styling
- [x] **Routine pause/resume** - pause with optional resume date, visual indicators
- [x] **Archive consistency** - unified is_archived boolean pattern across all entities
- [x] **Task-routine assignment** - basic dropdown selection in Add/Edit Task modals
- [x] **Routine card reordering** - drag-and-drop functionality with backend persistence
- [x] **Mini-board modal** - click routine tag → see all tasks for that routine
- [x] **Routine context preservation** - Ghost cards in routine mini-boards auto-populate routine dropdown when creating tasks

### 📋 REMAINING PHASE 2 FEATURES
- [x] **Enhanced routine picker** - Trello-style dropdown with search, color-coded cards (replacing basic HTML select)
- [x] **List item reordering** - drag to reorder items within lists

## Phase 2 Polish: User-Facing Features 🎨 COMPLETED ✅
- [x] **Edit Routine mini-menu improvements**
  - [x] Add icon editing capability (currently only color/name)
  - [x] Split long name field into separate Icon & Name fields
- [x] **Routine list condensing** - Make routine items same height as "no routine" option
- [x] **Keyboard navigation** - Full keyboard support for routine selection (pure keyboard task creation)
- [x] **Edit Task modal polish**
  - [x] Make Notes text smaller
  - [x] Make modal taller for better visibility
- [x] **Mini-board enhancements**
  - [x] Add edit task capability when clicking tasks in Routine Mini-Board
  - [x] Add 4 mini ghost cards (Today/Tomorrow/This Week/Horizon) for task creation
- [x] **Bug fixes**
  - [x] Fixed task position bug after drag and edit operations
  - [x] Fixed routine card task counts to show active vs archived correctly

## Pre-Phase 3: Critical Stability & Performance 🛡️ COMPLETED ✅
- [x] **Agent rate limiting** - Express middleware for 500 req/min (security critical)
- [x] **Error boundaries** - Comprehensive network failure handling with user feedback
  - [x] Global network error handler with structured error objects
  - [x] Network connectivity detection (online/offline monitoring)  
  - [x] Retry mechanisms with exponential backoff (3 attempts, jitter)
  - [x] User-friendly error notifications with contextual messages
  - [x] Connection status banners (positioned to not block navigation)
- [x] **Event delegation** - Single parent listener instead of per-card listeners (performance)
  - [x] **CRITICAL BUG FIX**: Fixed UUID parseInt() bug that broke all task interactions
  - [x] Task IDs like "550e8400-e29b-41d4-a716-446655440102" were being truncated to "550"
  - [x] Removed all parseInt() calls for UUID task IDs - task cards now work properly
- [x] **Constants extraction** - Centralized magic strings for maintainability
  - [x] Task status constants (PENDING, COMPLETED, ARCHIVED)
  - [x] CSS class constants (HIDDEN, TASK_CARD, etc.)
  - [x] Error code constants (OFFLINE, NETWORK_ERROR, etc.)

## Phase 3: Note Board Module 📋 ✅ COMPLETE!
- [x] **Note Board UI** - 4-column scratch area (User Notes Col 1-2, Agent Notes Col 3-4)
- [x] **Note Columns** - Split-screen design with User Notes (left) and Agent Notes (right)
- [x] **Note creation** - Ghost cards at bottom of each column for quick note creation
      - [x] Note Creation with ghost cards for each column
      - [x] Keyboard navigation (Tab between fields, Ctrl+Enter to save)
- [x] **Note properties** - Title field and content field with proper text area support
- [x] **Note types** - Auto-determined by column position (User: 1-2, Agent: 3-4)
- [x] **Note editing** - Click any note to edit with full modal
- [x] **Note drag-and-drop** - Full drag-drop between all 4 columns with position persistence
- [x] **Note-to-task conversion** - Convert note to task with column selection modal
- [x] **Note archiving** - Archive/restore functionality implemented
- [x] **Agent integration** - API supports agent note creation with X-Agent-Key auth
- [x] **Routine integration** - Notes can be assigned to routines and viewed in routine modal
- [x] **Mini-board Notes** - Routine modal shows all notes for that routine with ghost cards
- [x] **ESC key support** - Close modals with proper stacking order
- [x] **Visual polish** - Compact cards, proper ellipsis, routine color tags

## Phase 4: Polish & Enhancement 🎨 IN PROGRESS (~50-60% COMPLETE)

### ✅ CELEBRATION ANIMATIONS 
- [x] **Confetti celebrations** - Canvas-confetti library with CSP configuration
- [x] **Task completion confetti** - Small green bursts for task checkboxes
- [x] **BIG routine celebration** - Multi-wave confetti explosion for routine completion

### ✅ GHOST CARDS & UX IMPROVEMENTS
- [x] **Ghost cards** - "Add task" cards that stay at bottom during drag-and-drop
- [x] **Smart positioning** - Always anchored at column bottom with hover effects

### ✅ SMART DATE INDICATORS
- [x] **Dynamic headers** - Day names + intelligent This Week/Next Week logic
- [x] **Weekend detection** - Automatically switches on Saturday/Sunday

### ✅ PERFORMANCE OPTIMIZATIONS
- [x] **Optimistic UI** - Instant checkbox feedback with bulletproof error recovery
- [x] **Double-click protection** - Race condition prevention with AbortController
- [x] **Eliminated blinking** - Fixed task title flicker on list item changes

### 📋 REMAINING POLISH FEATURES
- [x] **Font & spacing optimization** - Typography improvements and space utilization
- [x] **Self-host assets** - Local Tailwind CSS, Font Awesome, SortableJS with custom colors
- [x] **Iconography** - Added icons / favicons
- [x] **Mobile responsive design** - Tablet/phone optimized layouts ✅ COMPLETED
- [x] **Agent rate limiting** - Express middleware (~10 lines) ✅ COMPLETED
- [x] **Performance tuning** - Event delegation implemented for better render performance ✅ COMPLETED
- [ ] **Additional UX polish** - Micro-interactions and visual refinements

### ✅ MOBILE-IFICATION
- [x] **Mobile viewport support** - Already had proper viewport meta tag configured
- [x] **Horizontal scrolling** - Task board columns scroll horizontally on mobile
- [x] **Touch drag delay** - 300ms delay on mobile to prevent accidental dragging while scrolling
- [x] **iOS Safari fixes** - Disabled text selection, callout menus, and double-tap zoom on cards
- [x] **Notes board mobile layout** - Fixed tiny column issue with horizontal scrolling sections
- [x] **Header optimization** - Renamed "CLio Board" → "CLio", removed unused settings cog
- [x] **Header centering** - Tasks/Routines/Notes tabs centered in header bar
- [x] **Mobile header spacing** - Reduced padding, gaps, and font sizes for better mobile fit

## Phase 5: Critical Security Hardening 🔴 IMMEDIATE (1-2 hours)
- [x] **Input validation** - Prevent database bloat attacks ✅ COMPLETED!
  - [x] Task titles: max 100 chars (plenty for task names)
  - [x] Task notes: max 20,000 chars (same as note content for seamless conversion)
  - [x] Note content: max 20,000 chars (~4 pages for instruction manuals)
  - [x] List item text: max 100 chars (plenty for single items)
  - [x] Routine titles: max 45 chars (plenty for routine names)
  - [x] Routine descriptions: max 100 chars (brief descriptions)
  - [x] Return 400 Bad Request with clear, actionable error messages
- [x] **Frontend error handling** - Display specific validation errors ✅ COMPLETED!
  - [x] "Title too long" - Clear, immediate understanding
  - [x] "Description too long" - For task notes and routine descriptions  
  - [x] "List item content too long" - Specific to list items
  - [x] "Content exceeds limit" - For note content
  - [x] Fixed network error popup interference (no more "Failed after 4 attempts" for validation)

## Phase 6: Entity Limits & Advanced Features 🟡 NEXT SPRINT
- [ ] **Entity count protection** - Prevent resource exhaustion (2-3 hours)
  - [ ] Max 500 total active tasks (across all columns)
  - [ ] Max 100 routines
  - [ ] Max 100 items per task list
  - [ ] Max 1000 notes
  - [ ] Return 429 "Too Many Entities" when limits exceeded
- [ ] **Database query timeouts** - Prevent slow query DoS (1 hour)
  - [ ] 5-second timeout on SELECT queries
  - [ ] 10-second timeout on complex JOINs
- [ ] **Enhanced rate limiting** (30 min)
  - [ ] Reduce agent rate to 100 req/min (from 500)
  - [ ] Implement per-endpoint specific limits
- [ ] Analytics dashboard
- [ ] Search functionality (archived tasks only)
- [ ] Undo/redo system

## Phase 7: Archive Management & SUPER Advanced Features 🟢 FUTURE
- [ ] **Archive lifecycle management** (major feature - 1 week)
  - [ ] Auto-archive completed tasks older than 90 days
  - [ ] "Cold storage" export after 180 days to JSON files
  - [ ] Filesystem/Key West storage for long-term archive
  - [ ] Search interface for cold storage archives
  - [ ] Preserve critical info (passwords, credentials) indefinitely
  - [ ] Audit log rotation (keep 30 days active, archive rest)
- [ ] WebSocket real-time updates 


## ✅ Potential Quick Wins (from cursory code review Aug 15 for app.js monolith) - COMPLETED!
  1. ✅ Error boundaries - Comprehensive error handling with retry mechanisms and user feedback
  2. [ ] Debouncing - Add delays to search/filter operations to avoid excessive renders  
  3. ✅ Constants - Extracted magic strings to static class constants for maintainability
  4. ✅ Event delegation - Single delegated listener replaced individual task card listeners