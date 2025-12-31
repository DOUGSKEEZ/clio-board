# CLio-Board: LLM-Optimized API Endpoints

**Purpose**: Recommendations for summary endpoints optimized for LLM consumption.
**Target**: 500-1000 characters per response (fits in 8K context window).
**Background**: CLio uses a small local LLM (Mistral 3B) with limited context. Current full-data endpoints return too much data for efficient LLM processing.

---

## Data Model Note

**Routines are classifiers**: Tasks and notes can belong to a routine. A routine is the primary organizational tag for grouping related items together (e.g., "Morning Routine" might have tasks like "Make coffee" and notes like "Morning checklist").

---

## Design Principles

1. **Minimal by default** - Return only essential fields
2. **Structured for scanning** - Group logically (by column, by routine)
3. **Truncate intelligently** - Cut titles/content at word boundaries when possible
4. **Count, don't enumerate** - Include totals so LLM knows scope without seeing everything
5. **No deep nesting** - Flat or 1-level deep structures only
6. **Show relationships** - Always include routine membership where applicable

---

## Recommended Endpoints

### 1. Tasks Summary

```
GET /api/tasks/summary
```

Returns tasks grouped by column with minimal fields, including routine membership.

**Response** (~900 chars for 15-20 tasks):
```json
{
  "total": 23,
  "byColumn": {
    "To Do": [
      {"id": 1, "title": "Fix login bug", "due": "2024-01-15", "routine": null},
      {"id": 2, "title": "Make coffee", "routine": "Morning Routine"}
    ],
    "In Progress": [
      {"id": 3, "title": "Implement dark mode", "due": "2024-01-20", "routine": null}
    ],
    "Done": [
      {"id": 4, "title": "Take vitamins", "routine": "Morning Routine"}
    ]
  },
  "overdue": 2,
  "dueThisWeek": 3
}
```

**Query Parameters**:
- `limit` - Max tasks per column (default: 5)
- `columns` - Comma-separated column filter (e.g., `To Do,In Progress`)
- `routine` - Filter by routine name/id

---

### 2. Notes Summary

```
GET /api/notes/summary
```

Returns note titles with short previews, including routine membership.

**Response** (~700 chars for 10 notes):
```json
{
  "total": 15,
  "items": [
    {"id": 1, "title": "Meeting Notes", "preview": "Discussed Q1 roadmap and...", "routine": null},
    {"id": 2, "title": "Morning checklist", "preview": "1. Coffee 2. Vitamins 3...", "routine": "Morning Routine"},
    {"id": 3, "title": "Bedtime reading list", "preview": "Books to read before sleep...", "routine": "Bedtime"}
  ]
}
```

**Query Parameters**:
- `limit` - Max notes returned (default: 10)
- `previewLength` - Characters in preview (default: 50)
- `routine` - Filter by routine name/id

---

### 3. Routines Summary (with contents)

```
GET /api/routines/summary
```

Returns routines with their associated tasks and notes.

**Response** (~800 chars for 5 routines):
```json
{
  "total": 5,
  "active": 3,
  "items": [
    {
      "id": 1,
      "name": "Morning Routine",
      "status": "active",
      "icon": "sun",
      "tasks": [
        {"id": 2, "title": "Make coffee", "column": "To Do"},
        {"id": 4, "title": "Take vitamins", "column": "Done"}
      ],
      "notes": [
        {"id": 2, "title": "Morning checklist"}
      ]
    },
    {
      "id": 2,
      "name": "Bedtime",
      "status": "active",
      "icon": "moon",
      "tasks": [
        {"id": 7, "title": "Set alarm", "column": "To Do"}
      ],
      "notes": [
        {"id": 3, "title": "Bedtime reading list"}
      ]
    },
    {
      "id": 3,
      "name": "Focus Mode",
      "status": "paused",
      "icon": "brain",
      "tasks": [],
      "notes": []
    }
  ]
}
```

**Query Parameters**:
- `includeItems` - Boolean, include tasks/notes (default: true)
- `itemLimit` - Max tasks/notes per routine (default: 3)

---

### 4. Single Routine Detail

```
GET /api/routines/:id/summary
```

Returns full detail for one routine with all its items.

**Response** (~600 chars):
```json
{
  "id": 1,
  "name": "Morning Routine",
  "status": "active",
  "icon": "sun",
  "taskCount": 5,
  "noteCount": 2,
  "tasks": [
    {"id": 2, "title": "Make coffee", "column": "To Do", "due": null},
    {"id": 4, "title": "Take vitamins", "column": "Done", "due": null},
    {"id": 8, "title": "Check calendar", "column": "To Do", "due": null}
  ],
  "notes": [
    {"id": 2, "title": "Morning checklist", "preview": "1. Coffee 2. Vitamins..."}
  ]
}
```

---

### 5. Note Excerpt Mode

```
GET /api/notes/:id?excerpt=true
```

Extends existing endpoint with excerpt mode, includes routine.

**Response** (~450 chars):
```json
{
  "id": 2,
  "title": "Morning checklist",
  "routine": "Morning Routine",
  "excerpt": "1. Make coffee 2. Take vitamins 3. Check calendar 4. Review daily goals 5. Quick stretch...",
  "wordCount": 150,
  "lastModified": "2024-01-10T14:30:00Z"
}
```

**Query Parameters**:
- `excerpt` - Boolean, enables excerpt mode
- `excerptLength` - Characters in excerpt (default: 300)

---

### 6. Task Context (Deep Dive)

```
GET /api/tasks/:id/context
```

Returns full context for a single task, includes routine.

**Response** (~550 chars):
```json
{
  "id": 2,
  "title": "Make coffee",
  "description": "French press, 4 scoops, let steep 4 minutes",
  "column": "To Do",
  "routine": "Morning Routine",
  "due": null,
  "created": "2024-01-05",
  "checklist": [
    {"text": "Boil water", "done": false},
    {"text": "Grind beans", "done": false},
    {"text": "Steep 4 min", "done": false}
  ]
}
```

---

### 7. Cross-Entity Search

```
GET /api/search?q=keyword
```

Search across tasks and notes, includes routine in results.

**Response** (~750 chars):
```json
{
  "query": "coffee",
  "results": {
    "tasks": [
      {"id": 2, "title": "Make coffee", "column": "To Do", "routine": "Morning Routine"}
    ],
    "notes": [
      {"id": 2, "title": "Morning checklist", "preview": "1. Coffee 2. Vitamins...", "routine": "Morning Routine"}
    ],
    "routines": [
      {"id": 1, "name": "Morning Routine", "status": "active"}
    ]
  },
  "totalHits": 3
}
```

**Query Parameters**:
- `q` - Search query (required)
- `type` - Filter by entity type (`tasks`, `notes`, `routines`, or all)
- `limit` - Max results per type (default: 5)

---

## Implementation Notes

### Field Truncation

Use consistent truncation:
```javascript
function truncate(str, maxLen = 50) {
  if (!str || str.length <= maxLen) return str;
  const truncated = str.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }
  return truncated + '...';
}
```

### Response Size Targets

| Endpoint | Target Size | Max Items |
|----------|-------------|-----------|
| `/tasks/summary` | 900 chars | 5 per column |
| `/notes/summary` | 700 chars | 10 notes |
| `/routines/summary` | 800 chars | 5 routines, 3 items each |
| `/routines/:id/summary` | 600 chars | all items |
| `/notes/:id?excerpt` | 450 chars | 1 note |
| `/tasks/:id/context` | 550 chars | 1 task |
| `/search` | 750 chars | 5 per type |

### Validation

Test each endpoint response with:
```bash
curl -s "http://localhost:3001/api/tasks/summary" | wc -c
# Should be under 1000
```

---

## Integration with Vivaldi

Vivaldi's `request-handler.js` will call these endpoints. Once implemented, update the handlers:

```javascript
// In vivaldi/src/actions/request-handler.js
tasks: async (config, params = {}) => {
  const baseUrl = config.services.clioBoard.baseUrl;
  // Use summary endpoint
  const result = await fetchEndpoint(baseUrl, '/api/tasks/summary');
  return [{ name: 'Tasks', data: result.data }];
},

routines: async (config, params = {}) => {
  const baseUrl = config.services.clioBoard.baseUrl;
  // Use summary endpoint (includes tasks/notes per routine)
  const result = await fetchEndpoint(baseUrl, '/api/routines/summary');
  return [{ name: 'Routines', data: result.data }];
}
```

---

## Priority Order

1. **`/api/tasks/summary`** - Most frequently requested, highest impact
2. **`/api/routines/summary`** - Critical for understanding task/note organization
3. **`/api/notes/summary`** - Common request
4. **`/api/search`** - Enables CLio to find specific items
5. **`/api/routines/:id/summary`** - Deep dive into single routine
6. **`/api/notes/:id?excerpt`** - Enhancement to existing endpoint
7. **`/api/tasks/:id/context`** - Deep dive into single task

---

*Document created for CLio-Board development team - January 2025*
