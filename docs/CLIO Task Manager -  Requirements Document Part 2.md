## 🎯 **Project Overview**

- **Name**: CLIO (Comprehensive Life Integration & Orchestration)
- **Type**: Personal Trello-like task management webapp
- **Users**: Single user (Doug) - no authentication needed
- **Network**: Private network with WireGuard VPN access
- **Agent Integration**: CLIO-Hermes-Agent (local LLM) shares same API

## 🏗️ **Core Architecture**

### **Technology Stack**

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL (already on Samwise)
- **Frontend**: HTML/CSS/JavaScript (vanilla or lightweight framework)
- **Real-time**: WebSockets (Socket.io)
- **Deployment**: Docker containers on Samwise

### **Authentication & Authorization**

- **Single User System**: No user registration/login needed
- **Agent Authentication**: API key in `X-Agent-Key` header
- **Network Security**: Protected by WireGuard VPN + private network
- **Audit Trail**: Distinguish "user" vs "agent" actions via API key presence

```sql
-- PostgreSQL with JSONB for Trello-like flexibility
-- No user table needed - single user system
tasks: {
  id: UUID,
  title: VARCHAR(255),
  notes: TEXT,              -- Free-form notes area
  type: ENUM('task', 'list') DEFAULT 'task', -- AUTO-MANAGED, never set by user!
  -- Type automatically changes:
  -- 'task' → 'list' when first item added
  -- 'list' → 'task' when last item deleted
  position: INTEGER,
  column: VARCHAR(50),
  created_at: TIMESTAMP
}

audit_log: {
  id: UUID,
  actor: ENUM(user, agent),  -- Who performed action
  action: VARCHAR(100),      -- create_task, update_task, etc.
  entity_type: VARCHAR(50),  -- task, routine, note
  entity_id: UUID,
  data: JSONB,              -- Full request payload
  created_at: TIMESTAMP
}
```

## 📌 **Core Modules**

### **1. Individual Task Cards**

- **Behavior**: Like TODO post-it notes with checkbox
- **Columns**: Today → Tomorrow → Later This Week → On the Horizon
- **States**: Pending → Completed → Archived
	- Completed tasks can be archived (like in trello) after they are marked complete
	- But also, Completed tasks are automatically archived at the end of every day/before the start of the next day
- **Completion**: Click checkbox → Green checkmark + status "Complete"
- **Properties**:
    - Title (required): "Go to bank to get money"
    - Free-form text area: Notes from user or CLIO-Hermes-Agent
    - Due date (soft required): Agent will prompt if missing
    - Due time (optional): "9:30 AM"
    - Routine assignment (optional): Via single tag [errand-run]

### **2. Project Demarcation System (Labels/Tags)**

- **Purpose**: Parent containers for related tasks (but in the application behaves like a label or tag in Trello - It is called a "container" because only 1 tag/label is allowed per task.  Therefore to me it is practical to say tasks belong to a label rather than a label belonging to a task...)
- **Types**:
    - **Projects**: "Bathroom Renovation", "Server Rack Build"
    - **Recurring**: "Weekly Writing", "Workout Routine"
- **Properties**:
    - Achievable flag: Can be marked "complete" when all tasks done
    - New Routines can be created with the same name (e.g. I completed my [errand-run] by finishing all the tasks on it - it get's marked as "Complete" and then is archived. I can then create a new [errand-run] routine to start preparing my next errand run to-do tasks.)
    - Status: Active/Paused/Completed/Archived
		- Completed Routines can be archived (like Lists in trello) after they are marked complete
		- But also, Completed Routines are automatically archived at the end of every day/before the start of the next day
    - Pause duration: "3 days", "1 week"
- **Behavior**: Mini-Trello board within the main board
- **Mini-Board Feature**: Click routine label → Modal showing all tasks with that tag

### **3. List Card Modules (Implicit Task Enhancement)**

- **Purpose**: Any task can become a list by adding items
- **No Special Creation**: Lists are NOT a separate type - they're tasks with items
- **Implicit Conversion**:
    - Task + first item = Automatically becomes a list
    - List - last item = Automatically reverts to simple task
    - User/Agent never specifies "create a list" - just add items!
- **Examples**: "Grocery List", "Home Depot List", "Denver Run"
- **Items**: Simple text entries with checkboxes
- **Item Operations**:
    - Add item to any task (auto-converts to list)
    - Remove item (simple delete - no archiving)
    - Check off item (mark completed, stays visible)
    - Reorder items (drag to reorder within list)
- **List Archiving**: When archived, current items are snapshot and preserved
- **Behavior**:
    - Lists move between columns as a unit
    - Items can be checked off individually
    - Can archive with unchecked items (they're preserved)
- **Collapse Feature**: Lists can collapse to save space ("Costco List (5 items)")


### **4. Note Board (Scratch Area)**

- **Layout**: 4 columns (2 User + 2 Agent areas)
- **Content Types**:
	- Note Blob
		- Examples:
		    - User thoughts/voice transcripts
		    - Agent observations from conversations
		    - Claude API mentoring notes
		- These notes help add context for the User or CLIO-Hermes-Agent to use
	
- **Actions**:
    - Convert note → task
    - Save note (→ a directory in Key West "Aquarium")
    - Delete note (remove from context)

### **5. Routine Management Board**

- **Purpose**: Administrative view of all routines
- **Features**:
    - Toggle Active/Inactive/Pause
    - Collapsible task lists per routine
    - Add/remove tasks from routines
    - Archive completed projects

## 🎛️ **Board Layout**

### **Main Task Board**

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   TODAY     │  TOMORROW   │ LATER THIS  │    ON THE   │
│             │             │    WEEK     │   HORIZON   │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ Grout white │ Costco List │ Write blog  │ Plan summer │
│ tile        │ - Milk      │ post        │ vacation    │
│ 🔧 Bathroom │ - Eggs      │ 📝 Writing  │ ☐ Orphan    │
│             │ - Meat      │             │             │
│             │ - Syrup     │ Measure     │ Research    │
│ Call        │ - Wine      │ shower      │ new car     │
│ contractor  │ 🛒 Costco   │ 🔧 Bathroom │ ☐ Orphan    │
│ 🔧 Bathroom │             │             │             │
│             │ Pick up     │ Update      │             │
│             │ dry clean   │ resume      │             │
│             │ ☐ Orphan    │ ☐ Orphan    │             │
└─────────────┴─────────────┴─────────────┴─────────────┘

Notes: 
- 🔧🛒📝 = Colored routine labels/tags
- ☐ = Orphan tasks (no routine)
- List cards show items (collapsible)
- Click routine label → Mini-board modal
```

#### Task Cards:

##### Task with a tab/label:
```
┌─────────────┐
│ Grout white │  ← Actual task title
│ tile        │
│ 🔧 Bathroom │  ← Colored routine label/tag
└─────────────┘
```

##### Task withOUT a tab/label (an orphan):
```
┌─────────────┐
│ Pick up     │  ← Task title
│ dry clean   │
│             │  ← No routine label
└─────────────┘
```


#### Task Card (with list items)
```
┌─────────────┐
│ Costco List │  ← Task name
│ - Milk      │  ← List items (can collapse)
│ - Eggs      │
│ - Meat      │
│ - Syrup     │
│ - Wine      │
│ 🛒 Costco   │  ← Optional routine tag
└─────────────┘
```

##### 💡 **List Card Collapse Feature**
Perfect UX consideration! List cards should have:
- **Expanded view**: Shows all items (like the Costco example)
- **Collapsed view**: "Costco List (5 items)" to save board space
- **Toggle**: Click to expand/collapse individual list cards

Task Display Rules:
- If task has items → Show as list with checkboxes
- If task has no items → Show as simple task card
- Type conversion is invisible to user - UI adapts automatically
- Both types have title, notes, routine label, due date

### **Note Board (Scratch Area)**

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  USER NOTES │  USER NOTES │ AGENT NOTES │ AGENT NOTES │
│    (Area 1) │   (Area 1)  │   (Area 2)  │   (Area 2)  │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ [Note Card] │ [Note Card] │ [Observation]│ [Claude API]│
│ [Voice Note]│             │ [Pattern]   │ [Mentoring] │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

## 🔄 **Column Logic**

### **Time-Based Columns**

- **Today**: Current date
- **Tomorrow**: Next day
- **Later This Week**: If Mon-Fri, else "Later Next Week"
- **On the Horizon**: Future/someday items

### **Week Boundaries**

- Weeks start Monday
- Weekend handling: Sat/Sun shows "Later Next Week"

## 🛠️ **API Endpoints**

### **Task Management**

```
GET    /api/tasks              - Get active tasks (filter by column/routine)
POST   /api/tasks              - Create new task
PUT    /api/tasks/:id          - Update task (move columns, edit)
PUT    /api/tasks/:id/archive  - Archive task (soft delete)
PUT    /api/tasks/:id/restore  - Restore archived task
POST   /api/tasks/:id/complete - Mark task complete 
```

### **List Items (List-specific actions within Task)**

```
GET    /api/tasks/:id/items         - Get items in list (only if task type='list')
POST /api/tasks/:id/items - Add item (auto-converts task→list if needed)
PUT    /api/tasks/:id/items/:itemId - Update list item text or check off
DELETE /api/tasks/:id/items/:itemId - Remove item (auto-converts list→task if last)

`Note: Users/agents NEVER specify task type - it's implicit based on items!`
```

### **Routines (Tags/Labels)**

```
GET    /api/routines                - Get active routine definitions
POST   /api/routines                - Create new routine label
PUT    /api/routines/:id            - Update routine (name, color, status)
PUT    /api/routines/:id/pause      - Pause routine (with duration)
PUT    /api/routines/:id/archive    - Archive routine label
PUT    /api/routines/:id/restore    - Restore archived routine
GET    /api/routines/:id/tasks      - Get all tasks with this routine tag (mini-board)
```

### **Notes**

```
GET    /api/notes                   - Get all notes (filter by user/agent)
POST   /api/notes                   - Create note
PUT    /api/notes/:id               - Update note
PUT    /api/notes/:id/archive       - Archive note
PUT    /api/notes/:id/restore       - Restore archived note
POST   /api/notes/:id/convert       - Convert note to task
```

### **Board Data Access**

```
GET    /api/tasks?status=active     - Get all active tasks (UI organizes by column)
GET    /api/notes?status=active     - Get all active notes  
GET    /api/routines?status=active  - Get all active routines
PUT    /api/tasks/:id               - Update task position/column (drag & drop)
```
**Note**: No special "board state" endpoints needed - client fetches data and organizes into board layout
## 🤖 **Agent Integration**

### **Agent Authentication**

- **Method**: `X-Agent-Key` header with secret value
- **Detection**: API key present = "agent", absent = "user"
- **Agent Permissions**:
    - ✅ **Create**: New tasks, notes, list items, routines
    - ✅ **Read**: All data access for context
    - ✅ **Update**: Modify existing items, move columns, mark complete
    - ✅ **Archive**: Move items to archived status (reversible)
    - ❌ **Delete**: BLOCKED - No permanent deletion capabilities
- **Rate Limiting**: 100 requests/minute
- **Audit**: All agent actions logged with full request payload
- **Safety**: Archive only - agent cannot permanently destroy data

### **📝 Implicit Type Management**

The system automatically manages whether something is a "task" or "list" based on a simple rule: **Does it have items?**

**Automatic Conversions:**

1. **Create any task** → Starts as `type='task'`
2. **Add first item** → Automatically becomes `type='list'`
3. **Delete last item** → Automatically reverts to `type='task'`
4. **Archive with items** → Preserves as list with item snapshot
5. **Archive without items** → Archives as simple task

**What This Means:**

- Users never choose "create a list" - they just add items to tasks
- CLIO-Hermes-Agent doesn't need to know about types
- The UI shows items if they exist, otherwise shows simple task
- Database type field is managed automatically by the backend

**Example Flow:**
```
"Create Grocery Shopping" → Creates task (type='task')
"Add milk to Grocery Shopping" → Becomes list (type='list')
"Add eggs to Grocery Shopping" → Still list with 2 items
"Remove milk and eggs" → Reverts to task (type='task')
```

### **Natural Language Examples**

```
"Add milk to grocery list"              → Creates task if needed, then adds item
"Create shopping list"                   → Just creates a task named "Shopping List"
"Add items: milk, eggs, bread"          → Task auto-converts to list with 3 items
"Remove milk from grocery list"         → Deletes item (may revert to task if last)

Note: Agent never specifies task vs list - just performs actions!

"Create bathroom renovation routine"    → POST /api/routines
"Add task to bathroom project"          → POST /api/tasks (routine_id: bathroom)
"Show me all bathroom tasks"            → GET /api/routines/:bathroomId/tasks
"Archive that old note"                 → PUT /api/notes/:noteId/archive
"Remove milk from grocery list"         → PUT /api/tasks/:groceryId/items/:milkId/archive
"Note: Found cheaper tiles at Home Depot" → POST /api/notes
```

### **Agent Capabilities**

- ✅ Create tasks/notes/routines (including list-type tasks)
- ✅ Update task status/columns/content
- ✅ Add/remove items to/from lists (simple operations)
- ✅ Archive tasks (preserves list items as snapshot)
- ✅ Mark tasks complete
- ✅ **Can delete list items** (simple text entries)
- ❌ **Cannot delete tasks/routines permanently**
- ❌ **Cannot restore archived items** (user-only action)
- All actions logged for audit trail

## 📊 **Features Deep Dive**

### **Undo/Redo System**

- **Audit Log**: Track all changes with timestamps
- **Action Types**: create, update, move, complete, delete
- **Rollback**: Restore previous state from audit log
- **UI**: Undo button shows last action
- **Retention**: Keep 30 days of change history

### **Real-Time Updates**

- **Technology**: WebSockets (Socket.io)
- **Events**: task_created, task_moved, task_completed, note_added
- **Source Tracking**: Show if change from user or agent
- **Cross-Device**: Updates sync across phone/laptop

### **Backup & Export**

- **Format**: JSON export of complete board state
- **Frequency**: Weekly automated backup
- **Storage**: Local file + copy to Key West storage
- **Restore**: Import JSON to restore board state

### **Archive System**

- **Completed Tasks**: Move to archive with completion date
- **Note Copies**: Archived notes → Key West "Aquarium"
- **Reporting Data**: Use archives for analytics
- **Retention**: Keep indefinitely for historical analysis
#### **Archive Behavior**

- **Simple Task**: Archives with title, notes, completion status
- **List (task with items)**: Archives with complete item snapshot in `archived_items` field
- **Empty List (all items deleted)**: Archives as simple task (type='task')
- **Preservation**: Item states (checked/unchecked) preserved exactly as they were

Example:
- Archive "Grocery List" with [Milk ✓, Eggs ✓, Bread ☐]
- Stored as: `{type: 'list', archived_items: [{title: 'Milk', completed: true}, ...]}`
### **Basic Search (Phase 2)**

- **Scope**: Archived tasks and notes only
- **Use Cases**: "When did I change oil?", "Find contractor notes"
- **Implementation**: Simple text search across titles/descriptions
- **UI**: Search bar above board

### **Archive Strategy & Performance**

#### **Soft Delete Approach**

- **Archive = Status Change**: `status = 'archived'` + `archived_at = NOW()`
- **UI Filtering**: Active queries exclude archived items by default
- **Restore Capability**: Change status back to 'pending' if needed
- **Hard Delete**: Only for true permanent removal (rare)

#### **Database Performance Optimization**
```sql
-- Critical indexes for performance with thousands of records
CREATE INDEX idx_tasks_active ON tasks(status, created_at) WHERE status != 'archived';
CREATE INDEX idx_tasks_column ON tasks(column, position) WHERE status != 'archived';
CREATE INDEX idx_tasks_routine ON tasks(routine_id, status);
CREATE INDEX idx_tasks_archived ON tasks(archived_at) WHERE status = 'archived';

-- Partitioning strategy (future enhancement)
-- Partition by status (active vs archived) for better performance
```

### **Query Patterns**
```javascript
// Active tasks only (fast query)
SELECT * FROM tasks WHERE status != 'archived' ORDER BY position;

// Analytics queries (include archived)
SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND archived_at > NOW() - INTERVAL '30 days';

// Archive cleanup (optional, future)
-- Move items older than 1 year to separate archive table
```

#### **Archive Lifecycle**

1. **Complete Task**: `status = 'completed'` (stays on board briefly)
2. **Agent Auto-Archive**: CLIO-Hermes-Agent periodically offers to clean up completed tasks
3. **Manual Archive**: User/agent can archive immediately via API
4. **Restore**: User can change status back to 'pending' (if needed)
5. **Permanent Storage**: All data preserved indefinitely for analytics
6. **Emergency Cleanup**: Manual database operations only (rare, admin-level)

**Note**: No background services needed - CLIO-Hermes-Agent handles cleanup through natural conversation

### **Basic Search (Phase 2)**

- **Scope**: Archived tasks and notes only
- **Use Cases**: "When did I change oil?", "Find contractor notes"
- **Implementation**: Simple text search across titles/descriptions
- **UI**: Search bar above board

### **Analytics & Reporting**

- **Weekly**: "You completed 47 tasks this week!"
- **Monthly**: "421 tasks completed, 5 new projects, 2 finished!"
- **Yearly**: Annual summary with trends
- **Output**: JSON data → CLIO-Hermes-Agent for narrative summary
- **Delivery**: Email/webhook → Agent creates engaging report

## 🚫 **Explicitly NOT Needed**

- **User Authentication**: Single user system
- **File Attachments**: Not necessary for task management
- **Comments**: Agent communicates via conversation, not card comments
- **Bulk Operations**: Trello doesn't have them, manual is fine
- **Complex Tagging**: Routine assignment sufficient
- **Traditional Notifications**: Agent handles all prompting
- **Collaboration Features**: Single user only
- **DELETE Operations for Tasks/Routines**: Everything archived, never destroyed
- **Archive/Restore for List Items**: List items are simple text entries (add/remove only)
- **Agent DELETE Permissions for Tasks**: Agent can only archive tasks, but can delete list items

## 🔒 **Error Handling & Validation**

### **Input Validation**

- **Task Titles**: Max 255 chars, required
- **Due Dates**: Valid date format, can be future
- **Routine Names**: Unique, max 100 chars
- **Text Blobs**: Max 10k chars (reasonable limit)

### **Error Responses**

```json
{
  "error": "validation_failed",
  "message": "Task title is required",
  "code": 400
}
```

### **Resilience Features**

- **Service Registry**: Track service health
- **Retry Logic**: Auto-retry failed operations
- **Circuit Breaker**: Fail fast on persistent errors
- **Logging**: Structured logs for debugging
- **Watchdog**: Monitor and restart failed services

## 📱 **Cross-Device Requirements**

### **Responsive Design**

- **Mobile**: Touch-friendly drag/drop
- **Tablet**: Optimized layout for larger screens
- **Desktop**: Full feature set
- **Performance**: < 2 second load times

### **Sync Behavior**

- **Real-time**: Changes appear instantly on all devices
- **Conflict Resolution**: Last-write-wins (single user)
- **Offline**: Display cached state, sync when reconnected

## 🎯 **Success Metrics**

### **Performance Targets**

- **Active Task Queries**: < 100ms (even with 1000s of archived items)
- **Page Load**: < 2 seconds
- **API Response**: < 500ms average
- **Real-time Updates**: < 100ms propagation
- **Database Queries**: < 50ms for board state

### **User Experience**

- **Drag/Drop**: Smooth animations
- **Voice Input**: Quick task creation
- **Agent Integration**: Seamless updates
- **Cross-Device**: Consistent experience

## 🚀 **Development Phases**

### **Phase 1: Core MVP (2 weeks)**

- PostgreSQL schema + basic CRUD APIs
- Simple Kanban board UI
- Drag/drop functionality
- Agent API authentication

### **Phase 2: Real-time & Polish (1 week)**

- WebSocket implementation
- Undo/redo system
- Basic responsive design
- Error handling

### **Phase 3: Advanced Features (2 weeks)**

- Note board implementation
- Routine management
- Archive system
- Backup/export

### **Phase 4: Analytics & Integration (1 week)**

- Basic reporting
- CLIO-Hermes-Agent integration testing
- Performance optimization
- Final polish

## 📋 **Technical Specifications**

### **Database Schema**

```sql
-- Core tables with JSONB for flexibility
-- Simplified single-user design (no user management)
tasks, routines, notes, list_items, 
audit_log, board_state
```

### **API Design**

- **RESTful**: Standard HTTP methods
- **JSON**: All requests/responses
- **Versioned**: /api/v1/ prefix
- **CORS**: Configured for local network

### **Frontend Architecture**

- **Vanilla JS**: No framework dependency
- **Modern CSS**: Grid/Flexbox for layout
- **Progressive**: Works without JavaScript (basic)
- **Accessible**: WCAG 2.1 AA compliance