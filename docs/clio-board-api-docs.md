# CLIO-Board API
Personal task management system with AI agent integration

## Version: 1.0.0

**Contact information:**  
CLIO Board  
http://192.168.10.21:3000  

### Available authorizations
#### AgentAuth (API Key Authentication)
Agent authentication key for CLIO-Hermes-Agent  
**Name:** X-Agent-Key  
**In:** header  

---

### [GET] /api/dividers
**Get all column dividers**

Returns time-of-day dividers for the Today column. These are UI-only elements, not tasks.

#### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Array of dividers | **application/json**: [ { **"id"**: string (uuid), **"column_name"**: string, **"label_above"**: string, **"label_below"**: string, **"position"**: integer } ]<br> |

### [PUT] /api/dividers/{id}/move
**Move a divider to a new position**

Updates the divider's position within the Today column

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path | Divider ID | Yes | string (uuid) |

#### Request Body

| Required | Schema |
| -------- | ------ |
|  Yes | **application/json**: { **"position"**: integer }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Updated divider |
| 404 | Divider not found |

---

### [GET] /api/notes
**Get all active notes**

Returns all notes that are not archived

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| type | query | Filter by note type | No | string, <br>**Available values:** "user", "agent" |
| column_position | query | Filter by column position (1-2 user, 3-4 agent) | No | integer |

#### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Array of notes | **application/json**: [ { **"id"**: string (uuid), **"title"**: string, **"content"**: string, **"type"**: string, <br>**Available values:** "user", "agent", **"source"**: string, <br>**Available values:** "manual", "voice", "conversation", "claude_api", **"column_position"**: integer, **"task_id"**: string (uuid), **"routine_id"**: string (uuid), **"created_at"**: dateTime } ]<br> |

### [POST] /api/notes
**Create a new note**

Creates a new note in the scratch area

#### Request Body

| Required | Schema |
| -------- | ------ |
|  Yes | **application/json**: { **"title"**: string, **"content"**: string, **"type"**: string, <br>**Available values:** "user", "agent", <br>**Default:** user, **"source"**: string, <br>**Available values:** "manual", "voice", "conversation", "claude_api", <br>**Default:** manual, **"column_position"**: integer, **"task_id"**: string (uuid), **"routine_id"**: string (uuid) }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 201 | Created note |
| 400 | Invalid input |

### [GET] /api/notes/archived
**Get all archived notes**

Returns all notes that have been archived

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Array of archived notes |

### [GET] /api/notes/{id}
**Get a single note by ID**

Returns a note with associated task/routine info

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path | Note ID | Yes | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Note object |
| 404 | Note not found |

### [PUT] /api/notes/{id}
**Update a note**

Updates note content or position

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Request Body

| Required | Schema |
| -------- | ------ |
|  No | **application/json**: { **"title"**: string, **"content"**: string, **"column_position"**: integer }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Updated note |
| 404 | Note not found |

### [PUT] /api/notes/{id}/move
**Move note to different column**

Moves a note to a different column in the scratch area

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Request Body

| Required | Schema |
| -------- | ------ |
|  Yes | **application/json**: { **"column"**: integer }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Moved note |

### [POST] /api/notes/{id}/convert
**Convert note to task**

Converts a note to a task and archives the note

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Request Body

| Required | Schema |
| -------- | ------ |
|  No | **application/json**: { **"title"**: string, **"column_name"**: string, <br>**Available values:** "today", "tomorrow", "this_week", "horizon", <br>**Default:** today, **"routine_id"**: string (uuid), **"due_date"**: date }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 201 | Created task and archived note |
| 404 | Note not found |

### [PUT] /api/notes/{id}/archive
**Archive a note**

Archives a note (soft delete)

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Archived note |
| 404 | Note not found |

### [PUT] /api/notes/{id}/restore
**Restore an archived note**

Restores an archived note back to active

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Restored note |
| 404 | Note not found |

---

### [GET] /api/routines
**Get all active routines**

Returns all routines that are not archived with task counts

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| status | query | Filter by status | No | string, <br>**Available values:** "active", "paused", "completed" |

#### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Array of routines | **application/json**: [ [Routine](#routine) ]<br> |

### [POST] /api/routines
**Create a new routine**

Creates a new routine (project or recurring)

#### Request Body

| Required | Schema |
| -------- | ------ |
|  Yes | **application/json**: { **"title"**: string, **"description"**: string, **"color"**: string, <br>**Default:** #3498db, **"icon"**: string, <br>**Default:** 📌, **"achievable"**: boolean }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 201 | Created routine |
| 400 | Invalid input |

### [GET] /api/routines/archived
**Get all archived routines**

Returns all routines that have been archived, with task counts

#### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Array of archived routines | **application/json**: [ [Routine](#routine) ]<br> |

### [GET] /api/routines/{id}
**Get a single routine by ID**

Returns a routine with task counts

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path | Routine ID | Yes | string (uuid) |

#### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Routine object | **application/json**: [Routine](#routine)<br> |
| 404 | Routine not found |  |

### [PUT] /api/routines/{id}
**Update a routine**

Updates routine properties

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Request Body

| Required | Schema |
| -------- | ------ |
|  No | **application/json**: { **"title"**: string, **"description"**: string, **"color"**: string, **"icon"**: string, **"achievable"**: boolean, **"status"**: string, <br>**Available values:** "active", "paused", "completed" }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Updated routine |
| 404 | Routine not found |

### [GET] /api/routines/{id}/tasks
**Get all tasks for a routine**

Returns all tasks associated with a routine (mini-board view)

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path | Routine ID | Yes | string (uuid) |

#### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Array of tasks | **application/json**: [ [Task](#task) ]<br> |

### [PUT] /api/routines/reorder
**Reorder routines**

Updates the display order of routines

#### Request Body

| Required | Schema |
| -------- | ------ |
|  No | **application/json**: { **"order"**: [ { **"id"**: string (uuid), **"order"**: integer } ] }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Routines reordered successfully |

### [PUT] /api/routines/{id}/pause
**Pause a routine**

Pauses a routine with optional resume date

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Request Body

| Required | Schema |
| -------- | ------ |
|  No | **application/json**: { **"pauseUntil"**: dateTime }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Paused routine |
| 404 | Routine not found |

### [PUT] /api/routines/{id}/complete
**Complete a routine**

Marks an achievable routine as complete

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Completed routine |
| 400 | Routine is not achievable |
| 404 | Routine not found |

### [PUT] /api/routines/{id}/archive
**Archive a routine**

Archives a routine

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Archived routine |
| 404 | Routine not found |

### [PUT] /api/routines/{id}/restore
**Restore an archived routine**

Restores an archived routine back to active status

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Restored routine |
| 404 | Routine not found |

---

### [GET] /api/tasks
**Get all active tasks**

Returns all tasks that are not archived, with their list items if applicable

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| column | query | Filter by column | No | string, <br>**Available values:** "today", "tomorrow", "this_week", "horizon" |
| routine_id | query | Filter by routine | No | string (uuid) |

#### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Array of tasks | **application/json**: [ [Task](#task) ]<br> |

### [POST] /api/tasks
**Create a new task**

Creates a new task (always starts as type='task')

#### Request Body

| Required | Schema |
| -------- | ------ |
|  Yes | **application/json**: { **"title"**: string, **"notes"**: string, **"routine_id"**: string (uuid), **"column_name"**: string, <br>**Available values:** "today", "tomorrow", "this_week", "horizon", <br>**Default:** today, **"due_date"**: date }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 201 | Created task |
| 400 | Invalid input |

### [GET] /api/tasks/archived
**Get all archived tasks**

Returns all tasks that have been archived, with their list items if applicable

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| column | query | Filter by column | No | string, <br>**Available values:** "today", "tomorrow", "this_week", "horizon" |
| routine_id | query | Filter by routine | No | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Array of archived tasks |

### [GET] /api/tasks/{id}
**Get a single task by ID**

Returns a task with its list items if applicable

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path | Task ID | Yes | string (uuid) |

#### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Task object | **application/json**: [Task](#task)<br> |
| 404 | Task not found |  |

### [PUT] /api/tasks/{id}
**Update a task**

Updates task properties (title, notes, column, etc.)

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Request Body

| Required | Schema |
| -------- | ------ |
|  No | **application/json**: { **"title"**: string, **"notes"**: string, **"routine_id"**: string (uuid), **"column_name"**: string, <br>**Available values:** "today", "tomorrow", "this_week", "horizon", **"position"**: integer, **"due_date"**: date }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Updated task |
| 404 | Task not found |

### [PUT] /api/tasks/{id}/move
**Move task to different column**

Moves a task to a different column and/or position

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Request Body

| Required | Schema |
| -------- | ------ |
|  Yes | **application/json**: { **"column"**: string, <br>**Available values:** "today", "tomorrow", "this_week", "horizon", **"position"**: integer }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Moved task |

### [PUT] /api/tasks/{id}/archive
**Archive a task**

Archives a task (preserves list items if type='list')

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Archived task |
| 404 | Task not found |

### [PUT] /api/tasks/{id}/restore
**Restore a task from archive**

Restores an archived task back to active status

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Restored task |
| 404 | Task not found |

### [POST] /api/tasks/{id}/complete
**Mark task as complete**

Marks a task as complete and archives it

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Completed task |
| 404 | Task not found |

---

### [GET] /api/tasks/{id}/items
**Get items for a task**

Returns all list items for a task (if type='list')

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Array of list items |

### [POST] /api/tasks/{id}/items
**Add item to task**

Adds an item to a task (auto-converts task to list if needed)

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |

#### Request Body

| Required | Schema |
| -------- | ------ |
|  Yes | **application/json**: { **"title"**: string }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 201 | Created item |
| 400 | Invalid input |

### [PUT] /api/tasks/{id}/items/{itemId}
**Update list item**

Updates a list item (check/uncheck or edit title)

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |
| itemId | path |  | Yes | string (uuid) |

#### Request Body

| Required | Schema |
| -------- | ------ |
|  No | **application/json**: { **"title"**: string, **"completed"**: boolean }<br> |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Updated item |

### [DELETE] /api/tasks/{id}/items/{itemId}
**Delete list item**

Deletes an item (auto-converts list to task if last item)

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | string (uuid) |
| itemId | path |  | Yes | string (uuid) |

#### Responses

| Code | Description |
| ---- | ----------- |
| 204 | Item deleted |
| 404 | Item not found |

---

### [GET] /health
**Health check endpoint**

Returns server health status and database connectivity

#### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Service is healthy | **application/json**: { **"status"**: string, **"timestamp"**: dateTime, **"version"**: string, **"database"**: { **"connected"**: boolean, **"timestamp"**: dateTime }, **"uptime"**: number }<br> |
| 503 | Service is unhealthy | **application/json**: [Error](#error)<br> |

### [GET] /api
**API information endpoint**

Returns API metadata and authentication status

#### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | API information | **application/json**: { **"message"**: string, **"version"**: string, **"timestamp"**: dateTime, **"actor"**: string, <br>**Available values:** "user", "agent", **"isAgent"**: boolean }<br> |

##### Security

| Security Schema | Scopes |
| --------------- | ------ |
| AgentAuth |  |

---
### Schemas

#### Task

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | string (uuid) | Task ID | No |
| routine_id | string (uuid) | Associated routine ID (null for orphan tasks) | No |
| title | string | Task title | Yes |
| notes | string | Free-form notes | No |
| type | string, <br>**Available values:** "task", "list" | AUTO-MANAGED: Converts based on items<br>*Enum:* `"task"`, `"list"` | No |
| status | string, <br>**Available values:** "pending", "completed", "archived" | Task status<br>*Enum:* `"pending"`, `"completed"`, `"archived"` | No |
| due_date | date | Due date (optional) | No |
| column_name | string, <br>**Available values:** "today", "tomorrow", "this_week", "horizon" | Kanban column<br>*Enum:* `"today"`, `"tomorrow"`, `"this_week"`, `"horizon"` | Yes |
| position | integer | Position within column | No |
| created_at | dateTime |  | No |
| updated_at | dateTime |  | No |

#### Routine

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | string (uuid) |  | No |
| title | string | Routine name | Yes |
| description | string |  | No |
| color | string | Hex color for UI | No |
| icon | string | Emoji icon | No |
| status | string, <br>**Available values:** "active", "paused", "completed" | *Enum:* `"active"`, `"paused"`, `"completed"` | No |
| achievable | boolean | Can be marked complete | No |
| is_archived | boolean | Archive state (separate from operational status) | No |
| pause_until | dateTime | When paused routine should resume | No |
| display_order | integer | Custom display order for drag-and-drop | No |
| created_at | dateTime |  | No |
| updated_at | dateTime |  | No |
| archived_at | dateTime |  | No |

#### Note

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | string (uuid) | Note ID | No |
| title | string | Note title (optional) | No |
| content | string | Note content | Yes |
| type | string, <br>**Available values:** "user", "agent" | Note type (auto-detected from request source)<br>*Enum:* `"user"`, `"agent"` | No |
| source | string, <br>**Available values:** "manual", "voice", "conversation", "claude_api" | How the note was created<br>*Enum:* `"manual"`, `"voice"`, `"conversation"`, `"claude_api"` | No |
| column_position | integer | Column position (1-2 user, 3-4 agent) | No |
| task_id | string (uuid) | Associated task ID | No |
| routine_id | string (uuid) | Associated routine ID | No |
| is_archived | boolean | Archive state | No |
| created_at | dateTime |  | No |
| updated_at | dateTime |  | No |
| archived_at | dateTime |  | No |

#### Error

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| error | string | Error message | No |
| timestamp | dateTime |  | No |

#### Divider

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | string (uuid) | Divider ID | No |
| column_name | string, <br>**Available values:** "today" | Column where divider appears (currently only Today)<br>*Enum:* `"today"` | No |
| label_above | string | Label shown above the line (e.g., Morning) | No |
| label_below | string | Label shown below the line (e.g., Afternoon) | No |
| position | integer | Position for ordering alongside tasks | No |
| created_at | dateTime |  | No |
