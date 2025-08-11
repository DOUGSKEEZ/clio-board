// CLIO Task Manager - Refined Technical Architecture v2
// Incorporating all feedback and clarifications

// ============================================
// CRITICAL CONCEPT: Tasks and Lists are the SAME entity!
// ============================================
/*
  A "List" is just a Task with type='list' that has child items.
  This is exactly how Trello works - everything is a Card!
  
  Regular Task: Just has title, description, notes
  List Task: Has title, description, notes + list_items
*/

// 1. Database Schema (PostgreSQL) - REFINED
const dbSchema = {
  
  routines: {
    id: 'UUID PRIMARY KEY',
    title: 'VARCHAR(255) NOT NULL',
    description: 'TEXT',
    color: 'VARCHAR(7)', // Hex color
    icon: 'VARCHAR(50)', // Emoji
    type: 'ENUM(project, recurring)',
    status: 'ENUM(active, paused, completed, archived)',
    achievable: 'BOOLEAN DEFAULT false',
    pause_until: 'TIMESTAMP',
    created_at: 'TIMESTAMP',
    updated_at: 'TIMESTAMP'
  },

  tasks: {
    id: 'UUID PRIMARY KEY',
    routine_id: 'UUID REFERENCES routines(id)', // NULL for orphans
    title: 'VARCHAR(255) NOT NULL',
    
    // *** NOTES FIELD - Added per your feedback! ***
    notes: 'TEXT', // Free-form notes from user or agent
    
    // AUTO-MANAGED TYPE FIELD - User never sets this!
    type: 'ENUM(task, list) DEFAULT task', // Automatically managed
    
    status: 'ENUM(pending, completed, archived)',
    due_date: 'DATE', // Just date, no time
    position: 'INTEGER', // Order within column
    column: 'ENUM(today, tomorrow, this_week, horizon)',
    
    // For archiving lists - snapshot items when archived
    archived_items: 'JSONB', // Preserves list state at archive time
    
    created_at: 'TIMESTAMP',
    updated_at: 'TIMESTAMP',
    completed_at: 'TIMESTAMP',
    archived_at: 'TIMESTAMP'
  },

  // Only exists for tasks where type='list'
  list_items: {
    id: 'UUID PRIMARY KEY',
    task_id: 'UUID REFERENCES tasks(id)', // Parent List Task
    title: 'VARCHAR(255) NOT NULL',
    completed: 'BOOLEAN DEFAULT false',
    position: 'INTEGER', // For drag-to-reorder!
    created_at: 'TIMESTAMP'
  },

  notes: {
    id: 'UUID PRIMARY KEY',
    title: 'VARCHAR(255)',
    content: 'TEXT NOT NULL',
    type: 'ENUM(user, agent)',
    source: 'ENUM(manual, voice, conversation, claude_api)',
    task_id: 'UUID REFERENCES tasks(id)',
    routine_id: 'UUID REFERENCES routines(id)',
    archived: 'BOOLEAN DEFAULT false',
    created_at: 'TIMESTAMP'
  },

  audit_log: {
    id: 'UUID PRIMARY KEY',
    actor: 'ENUM(user, agent)',
    action: 'VARCHAR(100)',
    entity_type: 'VARCHAR(50)',
    entity_id: 'UUID',
    previous_state: 'JSONB', // For undo functionality
    new_state: 'JSONB',
    created_at: 'TIMESTAMP'
  }
};

// 2. API Behavior - FULLY IMPLICIT TYPE MANAGEMENT
const implicitTaskListBehavior = {
  
  // Creating any task (no type needed ever!)
  createTask: {
    endpoint: 'POST /api/tasks',
    payload: {
      title: "Grocery Shopping",
      column: "today",
      notes: "Check for sales"
      // NO TYPE FIELD - always starts as 'task'
    },
    serverLogic: {
      type: 'task' // Always created as task initially
    }
  },
  
  // Adding first item AUTO-CONVERTS to list
  addFirstItem: {
    endpoint: 'POST /api/tasks/:id/items',
    payload: { title: "Milk" },
    serverLogic: async (taskId, itemData) => {
      const task = await getTask(taskId);
      
      // Auto-convert task → list
      if (task.type === 'task') {
        await updateTask(taskId, { type: 'list' });
      }
      
      return await createListItem(taskId, itemData);
    },
    result: {
      task_type: 'list', // Now it's a list!
      item_added: 'Milk'
    }
  },
  
  // Checking off items (they stay in the list)
  checkOffItem: {
    endpoint: 'PUT /api/tasks/:id/items/:itemId',
    payload: { completed: true },
    behavior: 'Item stays visible with checkmark'
  },
  
  // Deleting last item AUTO-CONVERTS back to task
  deleteLastItem: {
    endpoint: 'DELETE /api/tasks/:id/items/:itemId',
    serverLogic: async (taskId, itemId) => {
      await deleteListItem(itemId);
      
      const remainingItems = await countItems(taskId);
      
      // Auto-convert list → task when empty
      if (remainingItems === 0) {
        await updateTask(taskId, { type: 'task' });
      }
    },
    result: {
      task_type: 'task', // Back to simple task!
    }
  },
  
  // Archiving preserves current state
  archiveList: {
    endpoint: 'PUT /api/tasks/:id/archive',
    scenarios: {
      
      // Scenario 1: Archive list with items
      withItems: {
        before: {
          type: 'list',
          items: ['Milk ✓', 'Eggs ✓', 'Bread']
        },
        after: {
          status: 'archived',
          type: 'list',
          archived_items: ['Milk ✓', 'Eggs ✓', 'Bread'] // Snapshot preserved!
        }
      },
      
      // Scenario 2: Archive after deleting all items
      withoutItems: {
        before: {
          type: 'task', // Already converted back
          items: []
        },
        after: {
          status: 'archived',
          type: 'task',
          archived_items: null // No items to preserve
        }
      }
    }
  },
  
  // Completing a list archives with items intact
  completeList: {
    endpoint: 'POST /api/tasks/:id/complete',
    behavior: 'Marks complete → Archives with item snapshot'
  }
};

// 3. Backend Service Implementation
class TaskService {
  
  // Create task - ALWAYS starts as simple task
  async createTask(data) {
    return await db.tasks.create({
      ...data,
      type: 'task', // Always start simple!
      status: 'pending'
    });
  }
  
  // Add item - auto-converts to list if needed
  async addItemToTask(taskId, itemData) {
    const task = await db.tasks.findById(taskId);
    
    // Auto-upgrade: task → list
    if (task.type === 'task') {
      await db.tasks.update(taskId, { type: 'list' });
    }
    
    // Add the item
    const item = await db.list_items.create({
      task_id: taskId,
      title: itemData.title,
      completed: false,
      position: await this.getNextPosition(taskId)
    });
    
    return item;
  }
  
  // Delete item - auto-converts back if last item
  async deleteItem(taskId, itemId) {
    await db.list_items.delete(itemId);
    
    const remainingCount = await db.list_items.count({ 
      where: { task_id: taskId } 
    });
    
    // Auto-downgrade: list → task when empty
    if (remainingCount === 0) {
      await db.tasks.update(taskId, { type: 'task' });
    }
  }
  
  // Check off item (mark complete but keep in list)
  async toggleItemComplete(itemId) {
    const item = await db.list_items.findById(itemId);
    return await db.list_items.update(itemId, {
      completed: !item.completed
    });
  }
  
  // Archive task/list - preserves current state
  async archiveTask(taskId) {
    const task = await db.tasks.findById(taskId);
    const updateData = {
      status: 'archived',
      archived_at: new Date()
    };
    
    // If it's a list, snapshot the items
    if (task.type === 'list') {
      const items = await db.list_items.findAll({ 
        where: { task_id: taskId },
        order: [['position', 'ASC']]
      });
      
      // Store snapshot in archived_items
      updateData.archived_items = items.map(item => ({
        title: item.title,
        completed: item.completed
      }));
    }
    
    return await db.tasks.update(taskId, updateData);
  }
  
  // Complete task - marks done then archives
  async completeTask(taskId) {
    await db.tasks.update(taskId, {
      status: 'completed',
      completed_at: new Date()
    });
    
    // CLIO-Hermes-Agent will archive later
    // Or archive immediately based on preference
    return await this.archiveTask(taskId);
  }
}

// ============================================
// IMPLICIT TYPE RULES SUMMARY
// ============================================
/*
  1. ALL tasks start as type='task' (simple)
  2. Adding first item → auto-converts to type='list'
  3. Deleting last item → auto-converts back to type='task'
  4. Checking off items → items stay visible with checkmark
  5. Archiving preserves current state:
     - If list with items → snapshot saved in archived_items
     - If simple task → archived_items = null
  6. User NEVER specifies type - it's always automatic!
*/

// 4. Frontend State Management (with Optimistic Updates)
const frontendState = {
  
  optimisticUpdates: {
    // Card drag & drop
    onDragEnd: async (result) => {
      // 1. Immediately update UI
      updateLocalState(result);
      
      // 2. Send to server
      try {
        await api.updateTaskPosition(taskId, newColumn, newPosition);
      } catch (error) {
        // 3. Rollback on failure
        rollbackLocalState();
        showError("Failed to move task");
      }
    }
  },
  
  localCache: {
    // Keep board state in memory for instant updates
    tasks: new Map(), // taskId -> task object
    routines: new Map(),
    notes: new Map(),
    
    // Optimistic update functions
    moveTask: (taskId, newColumn) => {
      const task = tasks.get(taskId);
      task.column = newColumn;
      rerenderBoard();
    }
  }
};
const keyboardShortcuts = {
  'q': 'Quick add task to Today',
  'n': 'New note',
  '/': 'Focus search',
  '1': 'Jump to Today column',
  '2': 'Jump to Tomorrow column', 
  '3': 'Jump to This Week column',
  '4': 'Jump to Horizon column',
  'Space': 'Mark focused task complete',
  'Cmd+Z': 'Undo last action',
  'Tab': 'Navigate between cards in column',
  'Enter': 'Edit focused card'
};

// 5. Mobile Gestures (Your Adjustments)
const mobileGestures = {
  swipeRight: 'Move to next column (Tomorrow/Week/Horizon)',
  swipeLeft: 'Mark complete',
  longPress: {
    menu: ['Open Card', 'Mark Complete', 'Edit', 'Archive']
  },
  pullToRefresh: 'Sync with server',
  
  // Smooth touch scrolling for boards
  horizontalScroll: 'Scroll between columns',
  verticalScroll: 'Scroll within column'
};

// 6. Analytics Engine (Important for v1!)
const analyticsEngine = {
  
  // Core metrics stored in PostgreSQL
  dailyMetrics: {
    tasks_created: 'COUNT by day',
    tasks_completed: 'COUNT by day',
    tasks_moved: 'Track column transitions',
    active_routines: 'COUNT of non-archived'
  },
  
  // Weekly rollup for CLIO-Hermes-Agent
  weeklyDigest: async () => {
    return {
      completed_tasks: 47,
      created_tasks: 52,
      routines_finished: 2,
      routines_started: 3,
      most_productive_day: 'Tuesday',
      longest_task: 'Update resume (14 days)',
      
      // Fun stats
      total_list_items_checked: 89,
      notes_converted_to_tasks: 5,
      agent_vs_user_created: {
        agent: 31,
        user: 21
      }
    };
  },
  
  // API endpoints
  endpoints: {
    'GET /api/analytics/daily': 'Today\'s stats',
    'GET /api/analytics/weekly': 'This week\'s digest',
    'GET /api/analytics/monthly': 'Monthly summary',
    'GET /api/analytics/completed/:dateRange': 'Historical completions'
  },
  
  // Charts/visualizations (simple)
  visualizations: {
    completionTrend: 'Line chart of daily completions',
    routineProgress: 'Progress bars for active routines',
    columnDistribution: 'Where tasks spend most time'
  }
};

// 7. Backup Format (Standardized)
const backupFormat = {
  version: '1.0',
  exported_at: 'ISO8601 timestamp',
  checksum: 'SHA256 hash for validation',
  
  data: {
    routines: [], // All routine records
    tasks: [],    // All task records
    list_items: [], // All list items
    notes: [],    // Active notes only
    
    // Preserve positions and relationships
    board_state: {
      column_positions: {}, // Task order in each column
      routine_assignments: {} // Task-routine mappings
    }
  },
  
  metadata: {
    total_tasks: 1234,
    active_tasks: 45,
    completed_last_30: 389,
    database_size_mb: 12.4
  }
};

// 8. CLIO-Hermes-Agent - No Type Management Needed!
const agentSimplicity = {
  
  // Agent doesn't need to know about types!
  agentCommands: {
    
    "Add milk to grocery list": async () => {
      // Find the task
      const task = await findTaskByTitle("Grocery List");
      
      if (!task) {
        // Create it (no type needed!)
        const newTask = await api.createTask({
          title: "Grocery List",
          column: "today"
        });
        taskId = newTask.id;
      } else {
        taskId = task.id;
      }
      
      // Just add the item - type conversion is automatic!
      await api.addItem(taskId, { title: "Milk" });
      // Server handles task → list conversion
    },
    
    "Create shopping list with milk, eggs, bread": async () => {
      // Create task (starts as simple task)
      const task = await api.createTask({
        title: "Shopping",
        column: "today"
      });
      
      // Add items (first one auto-converts to list)
      await api.addItem(task.id, { title: "Milk" });
      await api.addItem(task.id, { title: "Eggs" });  
      await api.addItem(task.id, { title: "Bread" });
      // Now it's a list with 3 items!
    },
    
    "Remove eggs from shopping list": async () => {
      const task = await findTaskByTitle("Shopping");
      const item = await findItemByTitle(task.id, "Eggs");
      
      await api.deleteItem(task.id, item.id);
      // If this was the last item, server converts back to task
    },
    
    "Archive grocery list": async () => {
      const task = await findTaskByTitle("Grocery List");
      await api.archiveTask(task.id);
      // Server preserves items if it's a list
    }
  },
  
  dailyOperations: {
    morning: {
      // Move yesterday's Tomorrow to Today
      advanceTasks: 'Move Tomorrow → Today',
      
      // Check for overdue items
      flagOverdue: 'Note incomplete Today tasks from yesterday',
      
      // Clean up completed
      archiveCompleted: 'Archive tasks marked complete yesterday',
      
      // Recurring routine check
      checkRecurring: 'Create new workout routine if needed'
    },
    
    evening: {
      // Review incomplete
      reviewIncomplete: 'Ask about moving incomplete tasks',
      
      // Suggest tomorrow
      planTomorrow: 'Suggest tasks for tomorrow based on routines',
      
      // Quick summary
      dailySummary: 'You completed 8 tasks today!'
    }
  }
};

// 9. Undo/Redo Implementation
const undoRedoSystem = {
  
  // Store last N actions
  actionHistory: {
    maxSize: 50,
    storage: 'In-memory array',
    
    action: {
      id: 'UUID',
      type: 'move_task',
      before: { column: 'today', position: 3 },
      after: { column: 'tomorrow', position: 1 },
      timestamp: 'ISO8601'
    }
  },
  
  // Undo function
  undo: async () => {
    const lastAction = actionHistory.pop();
    await api.revertAction(lastAction);
    redoStack.push(lastAction);
  },
  
  // Redo function  
  redo: async () => {
    const action = redoStack.pop();
    await api.applyAction(action);
    actionHistory.push(action);
  }
};

// 10. Simple Performance Guidelines
const performance = {
  // You're right - columns will be small!
  expectedLoad: {
    today: '5-10 tasks',
    tomorrow: '5-10 tasks',
    this_week: '10-20 tasks',
    horizon: '10-30 tasks',
    archived: '1000s of tasks (indexed, not displayed)'
  },
  
  // Simple optimizations
  optimizations: {
    lazyLoadArchived: 'Only load when searching',
    cacheActiveBoard: 'Keep in memory for instant updates',
    batchUpdates: 'Group WebSocket messages'
  }
};

// Example: Complete Task/List Lifecycle
const taskListLifecycle = {
  
  // Step 1: Create a simple task
  step1_createTask: {
    action: 'User/Agent creates task',
    api: 'POST /api/tasks',
    data: { title: 'Costco Run', column: 'today' },
    result: {
      id: 'task-123',
      type: 'task', // Simple task
      title: 'Costco Run',
      items: [] // No items yet
    }
  },
  
  // Step 2: Add first item (auto-converts to list!)
  step2_addItem: {
    action: 'User/Agent adds "Milk"',
    api: 'POST /api/tasks/task-123/items',
    data: { title: 'Milk' },
    result: {
      type: 'list', // NOW IT'S A LIST!
      items: [{ id: 'item-1', title: 'Milk', completed: false }]
    }
  },
  
  // Step 3: Add more items
  step3_addMore: {
    action: 'Add more items',
    result: {
      type: 'list',
      items: [
        { title: 'Milk', completed: false },
        { title: 'Eggs', completed: false },
        { title: 'Bread', completed: false }
      ]
    }
  },
  
  // Step 4: Check off items (they stay in list)
  step4_checkOff: {
    action: 'Check off Milk and Eggs',
    api: 'PUT /api/tasks/task-123/items/item-1',
    result: {
      type: 'list',
      items: [
        { title: 'Milk', completed: true }, // ✓
        { title: 'Eggs', completed: true }, // ✓
        { title: 'Bread', completed: false }
      ]
    }
  },
  
  // Path A: Delete all items (converts back to task)
  pathA_deleteAll: {
    action: 'Delete all items',
    api: 'DELETE /api/tasks/task-123/items/[each]',
    result: {
      type: 'task', // BACK TO SIMPLE TASK!
      items: [] // Empty
    },
    then: {
      action: 'Archive the now-simple task',
      result: {
        status: 'archived',
        type: 'task',
        archived_items: null // No items to preserve
      }
    }
  },
  
  // Path B: Archive with items (preserves snapshot)
  pathB_archiveList: {
    action: 'Archive list with items',
    api: 'PUT /api/tasks/task-123/archive',
    result: {
      status: 'archived',
      type: 'list',
      archived_items: [
        { title: 'Milk', completed: true },
        { title: 'Eggs', completed: true },
        { title: 'Bread', completed: false }
      ] // Snapshot preserved forever!
    }
  },
  
  // Path C: Mark complete (archives with items)
  pathC_complete: {
    action: 'Mark entire list complete',
    api: 'POST /api/tasks/task-123/complete',
    result: {
      status: 'completed',
      completed_at: '2025-08-09T10:00:00Z',
      // Later archived by CLIO-Hermes-Agent
      archived_items: [...] // Items preserved
    }
  }
};