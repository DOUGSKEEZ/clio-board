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
- [ ] Rate limiting for agents (500 req/min, 429 status, log when hit)

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

### 📋 REMAINING PHASE 2 FEATURES
- [x] **Enhanced routine picker** - Trello-style dropdown with search, color-coded cards (replacing basic HTML select)
- [x] **List item reordering** - drag to reorder items within lists

## Phase 2 Polish: User-Facing Features 🎨 TODO
- [ ] **Edit Routine mini-menu improvements**
  - [ ] Add icon editing capability (currently only color/name)
  - [ ] Split long name field into separate Icon & Name fields
- [ ] **Routine list condensing** - Make routine items same height as "no routine" option
- [ ] **Keyboard navigation** - Full keyboard support for routine selection (pure keyboard task creation)
- [ ] **Edit Task modal polish**
  - [ ] Make Notes text smaller
  - [ ] Make modal taller for better visibility
- [ ] **Mini-board enhancements**
  - [ ] Add edit task capability when clicking tasks in Routine Mini-Board
  - [ ] Add 4 mini ghost cards (Today/Tomorrow/This Week/Horizon) for task creation

## Pre-Phase 3: Critical Stability & Performance 🛡️ TODO
- [ ] **Agent rate limiting** - Express middleware for 500 req/min (security critical)
- [ ] **Error boundaries** - Wrap network operations in try/catch, prevent UI crashes  
- [ ] **Event delegation** - Single parent listener instead of per-card listeners (performance)
- [ ] **Constants extraction** - Centralize magic strings for maintainability

## Phase 3: Note Board Module 📋 PLANNED
- [ ] **Note Board UI** - 4-column scratch area (User Notes Col 1-2, Agent Notes Col 3-4)
- [ ] **Note creation** - Click to add note blobs in any column
- [ ] **Note types** - User thoughts/voice transcripts vs Agent observations/mentoring
- [ ] **Note editing** - Click to edit existing note content
- [ ] **Note drag-and-drop** - Move notes between the 4 columns
- [ ] **Note-to-task conversion** - Convert any note into a task on main board
- [ ] **Note archiving** - "Save note" action moves to Key West "Aquarium" directory
- [ ] **Note deletion** - "Delete note" removes from context entirely
- [ ] **Agent integration** - API endpoints for agent to create observations/patterns

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
- [ ] **Font & spacing optimization** - Typography improvements and space utilization
- [ ] **Self-host assets** - Local Tailwind CSS, Font Awesome, SortableJS with custom colors
- [ ] **Mobile responsive design** - Tablet/phone optimized layouts
- [ ] **Agent rate limiting** - Express middleware (~10 lines)
- [ ] **Performance tuning** - Bundle size reduction, render optimizations
- [ ] **Additional UX polish** - Micro-interactions and visual refinements

## Phase 4: Advanced Features 🔮 FUTURE
- [ ] WebSocket real-time updates 
- [ ] Analytics dashboard
- [ ] Search functionality (archived tasks only)
- [ ] Undo/redo system
- [ ] Backup/export functionality
- [ ] Keyboard shortcuts

##   Potential Quick Wins (from cursory code review Aug 15 for app.js monolith):
  1. Error boundaries - Wrap more operations in try/catch blocks. Network calls fail randomly
  2. Debouncing - Add delays to search/filter operations to avoid excessive renders
  3. Constants - Pull out magic strings like 'routineTagsMinimized' to top-level constants
  4. Event delegation - Instead of attaching listeners to every task card, use one listener on the parent