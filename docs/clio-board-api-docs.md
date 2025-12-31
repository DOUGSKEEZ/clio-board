<!-- Generator: Widdershins v4.0.1 -->

<h1 id="clio-board-api">CLIO-Board API v1.0.0</h1>

> Scroll down for code samples, example requests and responses. Select a language for code samples from the tabs above or the mobile navigation menu.

Personal task management system with AI agent integration

Base URLs:

* <a href="http://192.168.10.21:3000">http://192.168.10.21:3000</a>

* <a href="http://localhost:3000">http://localhost:3000</a>

Web: <a href="http://192.168.10.21:3000">CLIO Board</a> 

# Authentication

* API Key (AgentAuth)
    - Parameter Name: **X-Agent-Key**, in: header. Agent authentication key for CLIO-Hermes-Agent

<h1 id="clio-board-api-dividers">Dividers</h1>

## get__api_dividers

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/dividers \
  -H 'Accept: application/json'

```

`GET /api/dividers`

*Get all column dividers*

Returns time-of-day dividers for the Today column. These are UI-only elements, not tasks.

## Determining Task Time Sections

To categorize Today's tasks into Morning/Afternoon/Evening sections, compare task positions to divider positions:

1. Fetch tasks: `GET /api/tasks?column=today`
2. Fetch dividers: `GET /api/dividers`
3. Find the "Morning/Afternoon" divider (label_above="Morning") and "Afternoon/Evening" divider (label_above="Afternoon")
4. Categorize tasks:
   - **Morning**: task.position < morning_afternoon_divider.position
   - **Afternoon**: task.position < afternoon_evening_divider.position (and >= morning divider)
   - **Evening**: task.position >= afternoon_evening_divider.position

### Example
```
// If dividers are at positions 5 and 12:
// - Tasks at positions 0-4 → Morning
// - Tasks at positions 6-11 → Afternoon
// - Tasks at positions 13+ → Evening
```

Note: Dividers share the same position space as tasks, so positions are interleaved.

> Example responses

> 200 Response

```json
[
  {
    "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
    "column_name": "today",
    "label_above": "Morning",
    "label_below": "Afternoon",
    "position": 0
  }
]
```

<h3 id="get__api_dividers-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Array of dividers ordered by position|Inline|

<h3 id="get__api_dividers-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» id|string(uuid)|false|none|none|
|» column_name|string|false|none|none|
|» label_above|string|false|none|The section label above the divider line|
|» label_below|string|false|none|The section label below the divider line|
|» position|integer|false|none|Position in the Today column (shared position space with tasks)|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_dividers_{id}_move

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/dividers/{id}/move \
  -H 'Content-Type: application/json'

```

`PUT /api/dividers/{id}/move`

*Move a divider to a new position*

Updates the divider's position within the Today column

> Body parameter

```json
{
  "position": 0
}
```

<h3 id="put__api_dividers_{id}_move-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|Divider ID|
|body|body|object|true|none|
|» position|body|integer|true|New position for the divider|

<h3 id="put__api_dividers_{id}_move-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Updated divider|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Divider not found|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="clio-board-api-notes">Notes</h1>

## get__api_notes_summary

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/notes/summary \
  -H 'Accept: application/json'

```

`GET /api/notes/summary`

*Get LLM-optimized notes summary*

Returns note titles with short previews.
Optimized for LLM context (~700 chars for 10 notes).

Use this endpoint for a quick overview of notes.

<h3 id="get__api_notes_summary-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|limit|query|integer|false|Max notes returned|
|previewLength|query|integer|false|Characters in preview|
|routine|query|string|false|Filter by routine name or ID|

> Example responses

> 200 Response

```json
{
  "total": 0,
  "items": [
    {
      "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
      "title": "string",
      "preview": "string",
      "routine": "string"
    }
  ]
}
```

<h3 id="get__api_notes_summary-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Notes summary|Inline|

<h3 id="get__api_notes_summary-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» total|integer|false|none|none|
|» items|[object]|false|none|none|
|»» id|string(uuid)|false|none|none|
|»» title|string|false|none|none|
|»» preview|string|false|none|none|
|»» routine|string¦null|false|none|none|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_notes

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/notes \
  -H 'Accept: application/json'

```

`GET /api/notes`

*Get all active notes*

Returns all notes that are not archived

<h3 id="get__api_notes-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|type|query|string|false|Filter by note type|
|column_position|query|integer|false|Filter by column position (1-2 user, 3-4 agent)|

#### Enumerated Values

|Parameter|Value|
|---|---|
|type|user|
|type|agent|

> Example responses

> 200 Response

```json
[
  {
    "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
    "title": "string",
    "content": "string",
    "type": "user",
    "source": "manual",
    "column_position": 0,
    "task_id": "736fde4d-9029-4915-8189-01353d6982cb",
    "routine_id": "f53c5ff7-cfb7-4f43-8b79-3421a01d8e2a",
    "created_at": "2019-08-24T14:15:22Z"
  }
]
```

<h3 id="get__api_notes-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Array of notes|Inline|

<h3 id="get__api_notes-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» id|string(uuid)|false|none|none|
|» title|string|false|none|none|
|» content|string|false|none|none|
|» type|string|false|none|none|
|» source|string|false|none|none|
|» column_position|integer|false|none|none|
|» task_id|string(uuid)|false|none|none|
|» routine_id|string(uuid)|false|none|none|
|» created_at|string(date-time)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|type|user|
|type|agent|
|source|manual|
|source|voice|
|source|conversation|
|source|claude_api|

<aside class="success">
This operation does not require authentication
</aside>

## post__api_notes

> Code samples

```shell
# You can also use wget
curl -X POST http://192.168.10.21:3000/api/notes \
  -H 'Content-Type: application/json'

```

`POST /api/notes`

*Create a new note*

Creates a new note in the scratch area

> Body parameter

```json
{
  "title": "string",
  "content": "string",
  "type": "user",
  "source": "manual",
  "column_position": 1,
  "task_id": "736fde4d-9029-4915-8189-01353d6982cb",
  "routine_id": "f53c5ff7-cfb7-4f43-8b79-3421a01d8e2a"
}
```

<h3 id="post__api_notes-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|object|true|none|
|» title|body|string|false|Note title (optional)|
|» content|body|string|true|Note content|
|» type|body|string|false|none|
|» source|body|string|false|none|
|» column_position|body|integer|false|Column position (1-2 user, 3-4 agent)|
|» task_id|body|string(uuid)|false|Associated task ID|
|» routine_id|body|string(uuid)|false|Associated routine ID|

#### Enumerated Values

|Parameter|Value|
|---|---|
|» type|user|
|» type|agent|
|» source|manual|
|» source|voice|
|» source|conversation|
|» source|claude_api|

<h3 id="post__api_notes-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|Created note|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid input|None|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_notes_archived

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/notes/archived

```

`GET /api/notes/archived`

*Get all archived notes*

Returns all notes that have been archived

<h3 id="get__api_notes_archived-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Array of archived notes|None|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_notes_{id}

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/notes/{id}

```

`GET /api/notes/{id}`

*Get a single note by ID*

Returns a note with associated task/routine info.
Use excerpt=true for LLM-optimized response (~450 chars).

<h3 id="get__api_notes_{id}-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|Note ID|
|excerpt|query|boolean|false|Return LLM-optimized excerpt instead of full note|
|excerptLength|query|integer|false|Max characters in excerpt (only used when excerpt=true)|

<h3 id="get__api_notes_{id}-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Note object (or excerpt if excerpt=true)|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Note not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_notes_{id}

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/notes/{id} \
  -H 'Content-Type: application/json'

```

`PUT /api/notes/{id}`

*Update a note*

Updates note content or position

> Body parameter

```json
{
  "title": "string",
  "content": "string",
  "column_position": 1
}
```

<h3 id="put__api_notes_{id}-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|
|body|body|object|false|none|
|» title|body|string|false|none|
|» content|body|string|false|none|
|» column_position|body|integer|false|none|

<h3 id="put__api_notes_{id}-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Updated note|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Note not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_notes_{id}_move

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/notes/{id}/move \
  -H 'Content-Type: application/json'

```

`PUT /api/notes/{id}/move`

*Move note to different column*

Moves a note to a different column in the scratch area

> Body parameter

```json
{
  "column": 1
}
```

<h3 id="put__api_notes_{id}_move-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|
|body|body|object|true|none|
|» column|body|integer|true|New column position|

<h3 id="put__api_notes_{id}_move-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Moved note|None|

<aside class="success">
This operation does not require authentication
</aside>

## post__api_notes_{id}_convert

> Code samples

```shell
# You can also use wget
curl -X POST http://192.168.10.21:3000/api/notes/{id}/convert \
  -H 'Content-Type: application/json'

```

`POST /api/notes/{id}/convert`

*Convert note to task*

Converts a note to a task and archives the note

> Body parameter

```json
{
  "title": "string",
  "column_name": "today",
  "routine_id": "f53c5ff7-cfb7-4f43-8b79-3421a01d8e2a",
  "due_date": "2019-08-24"
}
```

<h3 id="post__api_notes_{id}_convert-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|
|body|body|object|false|none|
|» title|body|string|false|Task title (defaults to note title)|
|» column_name|body|string|false|none|
|» routine_id|body|string(uuid)|false|none|
|» due_date|body|string(date)|false|none|

#### Enumerated Values

|Parameter|Value|
|---|---|
|» column_name|today|
|» column_name|tomorrow|
|» column_name|this_week|
|» column_name|horizon|

<h3 id="post__api_notes_{id}_convert-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|Created task and archived note|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Note not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_notes_{id}_archive

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/notes/{id}/archive

```

`PUT /api/notes/{id}/archive`

*Archive a note*

Archives a note (soft delete)

<h3 id="put__api_notes_{id}_archive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|

<h3 id="put__api_notes_{id}_archive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Archived note|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Note not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_notes_{id}_restore

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/notes/{id}/restore

```

`PUT /api/notes/{id}/restore`

*Restore an archived note*

Restores an archived note back to active

<h3 id="put__api_notes_{id}_restore-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|

<h3 id="put__api_notes_{id}_restore-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Restored note|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Note not found|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="clio-board-api-routines">Routines</h1>

## get__api_routines_summary

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/routines/summary \
  -H 'Accept: application/json'

```

`GET /api/routines/summary`

*Get LLM-optimized routines summary*

Returns routines with their associated tasks and notes.
Optimized for LLM context (~800 chars for 5 routines).

Use this endpoint to understand task/note organization.

<h3 id="get__api_routines_summary-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|includeItems|query|boolean|false|Include tasks/notes per routine|
|itemLimit|query|integer|false|Max tasks/notes per routine|

> Example responses

> 200 Response

```json
{
  "total": 0,
  "active": 0,
  "items": [
    {
      "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
      "name": "string",
      "status": "active",
      "icon": "string",
      "tasks": [],
      "notes": []
    }
  ]
}
```

<h3 id="get__api_routines_summary-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Routines summary with contents|Inline|

<h3 id="get__api_routines_summary-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» total|integer|false|none|none|
|» active|integer|false|none|none|
|» items|[object]|false|none|none|
|»» id|string(uuid)|false|none|none|
|»» name|string|false|none|none|
|»» status|string|false|none|none|
|»» icon|string|false|none|none|
|»» tasks|array|false|none|none|
|»» notes|array|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|status|active|
|status|paused|
|status|completed|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_routines

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/routines \
  -H 'Accept: application/json'

```

`GET /api/routines`

*Get all active routines*

Returns all routines that are not archived with task counts

<h3 id="get__api_routines-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|status|query|string|false|Filter by status|

#### Enumerated Values

|Parameter|Value|
|---|---|
|status|active|
|status|paused|
|status|completed|

> Example responses

> 200 Response

```json
[
  {
    "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
    "title": "string",
    "description": "string",
    "color": "string",
    "icon": "string",
    "status": "active",
    "achievable": true,
    "is_archived": true,
    "pause_until": "2019-08-24T14:15:22Z",
    "display_order": 0,
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "archived_at": "2019-08-24T14:15:22Z"
  }
]
```

<h3 id="get__api_routines-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Array of routines|Inline|

<h3 id="get__api_routines-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|[[Routine](#schemaroutine)]|false|none|none|
|» id|string(uuid)|false|none|none|
|» title|string|true|none|Routine name|
|» description|string¦null|false|none|none|
|» color|string|false|none|Hex color for UI|
|» icon|string|false|none|Emoji icon|
|» status|string|false|none|none|
|» achievable|boolean|false|none|Can be marked complete|
|» is_archived|boolean|false|none|Archive state (separate from operational status)|
|» pause_until|string(date-time)¦null|false|none|When paused routine should resume|
|» display_order|integer|false|none|Custom display order for drag-and-drop|
|» created_at|string(date-time)|false|none|none|
|» updated_at|string(date-time)|false|none|none|
|» archived_at|string(date-time)¦null|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|status|active|
|status|paused|
|status|completed|

<aside class="success">
This operation does not require authentication
</aside>

## post__api_routines

> Code samples

```shell
# You can also use wget
curl -X POST http://192.168.10.21:3000/api/routines \
  -H 'Content-Type: application/json'

```

`POST /api/routines`

*Create a new routine*

Creates a new routine (project or recurring)

> Body parameter

```json
{
  "title": "string",
  "description": "string",
  "color": "#3498db",
  "icon": "📌",
  "achievable": false
}
```

<h3 id="post__api_routines-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|object|true|none|
|» title|body|string|true|Routine title|
|» description|body|string|false|Routine description|
|» color|body|string|false|Hex color for UI|
|» icon|body|string|false|Emoji icon|
|» achievable|body|boolean|false|Can be marked complete|

<h3 id="post__api_routines-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|Created routine|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid input|None|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_routines_archived

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/routines/archived \
  -H 'Accept: application/json'

```

`GET /api/routines/archived`

*Get all archived routines*

Returns all routines that have been archived, with task counts

> Example responses

> 200 Response

```json
[
  {
    "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
    "title": "string",
    "description": "string",
    "color": "string",
    "icon": "string",
    "status": "active",
    "achievable": true,
    "is_archived": true,
    "pause_until": "2019-08-24T14:15:22Z",
    "display_order": 0,
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "archived_at": "2019-08-24T14:15:22Z"
  }
]
```

<h3 id="get__api_routines_archived-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Array of archived routines|Inline|

<h3 id="get__api_routines_archived-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|[[Routine](#schemaroutine)]|false|none|none|
|» id|string(uuid)|false|none|none|
|» title|string|true|none|Routine name|
|» description|string¦null|false|none|none|
|» color|string|false|none|Hex color for UI|
|» icon|string|false|none|Emoji icon|
|» status|string|false|none|none|
|» achievable|boolean|false|none|Can be marked complete|
|» is_archived|boolean|false|none|Archive state (separate from operational status)|
|» pause_until|string(date-time)¦null|false|none|When paused routine should resume|
|» display_order|integer|false|none|Custom display order for drag-and-drop|
|» created_at|string(date-time)|false|none|none|
|» updated_at|string(date-time)|false|none|none|
|» archived_at|string(date-time)¦null|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|status|active|
|status|paused|
|status|completed|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_routines_{id}

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/routines/{id} \
  -H 'Accept: application/json'

```

`GET /api/routines/{id}`

*Get a single routine by ID*

Returns a routine with task counts

<h3 id="get__api_routines_{id}-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|Routine ID|

> Example responses

> 200 Response

```json
{
  "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
  "title": "string",
  "description": "string",
  "color": "string",
  "icon": "string",
  "status": "active",
  "achievable": true,
  "is_archived": true,
  "pause_until": "2019-08-24T14:15:22Z",
  "display_order": 0,
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "archived_at": "2019-08-24T14:15:22Z"
}
```

<h3 id="get__api_routines_{id}-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Routine object|[Routine](#schemaroutine)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Routine not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_routines_{id}

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/routines/{id} \
  -H 'Content-Type: application/json'

```

`PUT /api/routines/{id}`

*Update a routine*

Updates routine properties

> Body parameter

```json
{
  "title": "string",
  "description": "string",
  "color": "string",
  "icon": "string",
  "achievable": true,
  "status": "active"
}
```

<h3 id="put__api_routines_{id}-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|
|body|body|object|false|none|
|» title|body|string|false|none|
|» description|body|string|false|none|
|» color|body|string|false|none|
|» icon|body|string|false|none|
|» achievable|body|boolean|false|none|
|» status|body|string|false|none|

#### Enumerated Values

|Parameter|Value|
|---|---|
|» status|active|
|» status|paused|
|» status|completed|

<h3 id="put__api_routines_{id}-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Updated routine|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Routine not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_routines_{id}_summary

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/routines/{id}/summary \
  -H 'Accept: application/json'

```

`GET /api/routines/{id}/summary`

*Get LLM-optimized single routine detail*

Returns full detail for one routine with all its items.
Optimized for LLM context (~600 chars).

Use this endpoint for deep-dive into a specific routine.

<h3 id="get__api_routines_{id}_summary-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|Routine ID|

> Example responses

> 200 Response

```json
{
  "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
  "name": "string",
  "status": "string",
  "icon": "string",
  "taskCount": 0,
  "noteCount": 0,
  "tasks": [],
  "notes": []
}
```

<h3 id="get__api_routines_{id}_summary-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Routine detail with all tasks and notes|Inline|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Routine not found|None|

<h3 id="get__api_routines_{id}_summary-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» id|string(uuid)|false|none|none|
|» name|string|false|none|none|
|» status|string|false|none|none|
|» icon|string|false|none|none|
|» taskCount|integer|false|none|none|
|» noteCount|integer|false|none|none|
|» tasks|array|false|none|none|
|» notes|array|false|none|none|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_routines_{id}_tasks

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/routines/{id}/tasks \
  -H 'Accept: application/json'

```

`GET /api/routines/{id}/tasks`

*Get all tasks for a routine*

Returns all tasks associated with a routine (mini-board view)

<h3 id="get__api_routines_{id}_tasks-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|Routine ID|

> Example responses

> 200 Response

```json
[
  {
    "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
    "routine_id": "f53c5ff7-cfb7-4f43-8b79-3421a01d8e2a",
    "title": "string",
    "notes": "string",
    "type": "task",
    "status": "pending",
    "due_date": "2019-08-24",
    "column_name": "today",
    "position": 0,
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z"
  }
]
```

<h3 id="get__api_routines_{id}_tasks-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Array of tasks|Inline|

<h3 id="get__api_routines_{id}_tasks-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|[[Task](#schematask)]|false|none|none|
|» id|string(uuid)|false|none|Task ID|
|» routine_id|string(uuid)¦null|false|none|Associated routine ID (null for orphan tasks)|
|» title|string|true|none|Task title|
|» notes|string¦null|false|none|Free-form notes|
|» type|string|false|none|AUTO-MANAGED: Converts based on items|
|» status|string|false|none|Task status|
|» due_date|string(date)¦null|false|none|Due date (optional)|
|» column_name|string|true|none|Kanban column|
|» position|integer|false|none|Position within column|
|» created_at|string(date-time)|false|none|none|
|» updated_at|string(date-time)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|type|task|
|type|list|
|status|pending|
|status|completed|
|status|archived|
|column_name|today|
|column_name|tomorrow|
|column_name|this_week|
|column_name|horizon|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_routines_reorder

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/routines/reorder \
  -H 'Content-Type: application/json'

```

`PUT /api/routines/reorder`

*Reorder routines*

Updates the display order of routines

> Body parameter

```json
{
  "order": [
    {
      "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
      "order": 0
    }
  ]
}
```

<h3 id="put__api_routines_reorder-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|object|false|none|
|» order|body|[object]|false|none|
|»» id|body|string(uuid)|false|none|
|»» order|body|integer|false|none|

<h3 id="put__api_routines_reorder-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Routines reordered successfully|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_routines_{id}_pause

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/routines/{id}/pause \
  -H 'Content-Type: application/json'

```

`PUT /api/routines/{id}/pause`

*Pause a routine*

Pauses a routine with optional resume date

> Body parameter

```json
{
  "pauseUntil": "2019-08-24T14:15:22Z"
}
```

<h3 id="put__api_routines_{id}_pause-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|
|body|body|object|false|none|
|» pauseUntil|body|string(date-time)|false|When to resume the routine|

<h3 id="put__api_routines_{id}_pause-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Paused routine|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Routine not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_routines_{id}_complete

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/routines/{id}/complete

```

`PUT /api/routines/{id}/complete`

*Complete a routine*

Marks an achievable routine as complete

<h3 id="put__api_routines_{id}_complete-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|

<h3 id="put__api_routines_{id}_complete-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Completed routine|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Routine is not achievable|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Routine not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_routines_{id}_archive

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/routines/{id}/archive

```

`PUT /api/routines/{id}/archive`

*Archive a routine*

Archives a routine

<h3 id="put__api_routines_{id}_archive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|

<h3 id="put__api_routines_{id}_archive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Archived routine|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Routine not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_routines_{id}_restore

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/routines/{id}/restore

```

`PUT /api/routines/{id}/restore`

*Restore an archived routine*

Restores an archived routine back to active status

<h3 id="put__api_routines_{id}_restore-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|

<h3 id="put__api_routines_{id}_restore-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Restored routine|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Routine not found|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="clio-board-api-search">Search</h1>

## get__api_search

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/search?q=string \
  -H 'Accept: application/json'

```

`GET /api/search`

*Cross-entity search*

Search across tasks, notes, and routines.

**Two modes available:**
- **User mode (default)**: Full results with all fields, higher limit (15)
- **LLM mode (summary=true)**: Concise results optimized for context (~750 chars)

Use `summary=true` for LLM integrations to minimize token usage.

<h3 id="get__api_search-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|q|query|string|true|Search query|
|type|query|string|false|Filter by entity type (omit for all types)|
|limit|query|integer|false|Max results per type (default 15 for user mode, 5 for LLM mode)|
|summary|query|boolean|false|Enable LLM-optimized mode with concise responses.|

#### Detailed descriptions

**summary**: Enable LLM-optimized mode with concise responses.
Truncates titles/content, limits results, excludes verbose fields.

#### Enumerated Values

|Parameter|Value|
|---|---|
|type|tasks|
|type|notes|
|type|routines|

> Example responses

> 200 Response

```json
{
  "query": "string",
  "results": {
    "tasks": [],
    "notes": [],
    "routines": []
  },
  "totalHits": 0
}
```

<h3 id="get__api_search-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Search results grouped by type|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Search query is required|None|

<h3 id="get__api_search-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» query|string|false|none|The search query|
|» results|object|false|none|none|
|»» tasks|array|false|none|Matching tasks. In summary mode: id, title (truncated), column, routine.<br>In full mode: adds due, notes, updatedAt.|
|»» notes|array|false|none|Matching notes. In summary mode: id, title (truncated), preview, routine.<br>In full mode: adds content, type, source, updatedAt.|
|»» routines|array|false|none|Matching routines. In summary mode: id, name, status.<br>In full mode: adds description, icon, updatedAt.|
|» totalHits|integer|false|none|Total number of matches across all types|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="clio-board-api-tasks">Tasks</h1>

## get__api_tasks_summary

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/tasks/summary \
  -H 'Accept: application/json'

```

`GET /api/tasks/summary`

*Get LLM-optimized tasks summary*

Returns tasks grouped by column with minimal fields.
Optimized for LLM context (~900 chars for 15-20 tasks).

Use this endpoint when you need a quick overview of all tasks
without consuming excessive context tokens.

<h3 id="get__api_tasks_summary-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|limit|query|integer|false|Max tasks per column|
|columns|query|string|false|Comma-separated column filter (e.g., "Today,Tomorrow")|
|routine|query|string|false|Filter by routine name or ID|

> Example responses

> 200 Response

```json
{
  "total": 0,
  "byColumn": {},
  "overdue": 0,
  "dueThisWeek": 0
}
```

<h3 id="get__api_tasks_summary-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Tasks summary grouped by column|Inline|

<h3 id="get__api_tasks_summary-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» total|integer|false|none|Total number of active tasks|
|» byColumn|object|false|none|Tasks grouped by column name|
|» overdue|integer|false|none|Count of overdue tasks|
|» dueThisWeek|integer|false|none|Count of tasks due this week|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_tasks

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/tasks \
  -H 'Accept: application/json'

```

`GET /api/tasks`

*Get all active tasks*

Returns all tasks that are not archived, with their list items if applicable

<h3 id="get__api_tasks-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|column|query|string|false|Filter by column|
|routine_id|query|string(uuid)|false|Filter by routine|

#### Enumerated Values

|Parameter|Value|
|---|---|
|column|today|
|column|tomorrow|
|column|this_week|
|column|horizon|

> Example responses

> 200 Response

```json
[
  {
    "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
    "routine_id": "f53c5ff7-cfb7-4f43-8b79-3421a01d8e2a",
    "title": "string",
    "notes": "string",
    "type": "task",
    "status": "pending",
    "due_date": "2019-08-24",
    "column_name": "today",
    "position": 0,
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z"
  }
]
```

<h3 id="get__api_tasks-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Array of tasks|Inline|

<h3 id="get__api_tasks-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|[[Task](#schematask)]|false|none|none|
|» id|string(uuid)|false|none|Task ID|
|» routine_id|string(uuid)¦null|false|none|Associated routine ID (null for orphan tasks)|
|» title|string|true|none|Task title|
|» notes|string¦null|false|none|Free-form notes|
|» type|string|false|none|AUTO-MANAGED: Converts based on items|
|» status|string|false|none|Task status|
|» due_date|string(date)¦null|false|none|Due date (optional)|
|» column_name|string|true|none|Kanban column|
|» position|integer|false|none|Position within column|
|» created_at|string(date-time)|false|none|none|
|» updated_at|string(date-time)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|type|task|
|type|list|
|status|pending|
|status|completed|
|status|archived|
|column_name|today|
|column_name|tomorrow|
|column_name|this_week|
|column_name|horizon|

<aside class="success">
This operation does not require authentication
</aside>

## post__api_tasks

> Code samples

```shell
# You can also use wget
curl -X POST http://192.168.10.21:3000/api/tasks \
  -H 'Content-Type: application/json'

```

`POST /api/tasks`

*Create a new task*

Creates a new task (always starts as type='task')

> Body parameter

```json
{
  "title": "string",
  "notes": "string",
  "routine_id": "f53c5ff7-cfb7-4f43-8b79-3421a01d8e2a",
  "column_name": "today",
  "due_date": "2019-08-24"
}
```

<h3 id="post__api_tasks-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|object|true|none|
|» title|body|string|true|Task title|
|» notes|body|string|false|Task notes|
|» routine_id|body|string(uuid)|false|Associated routine ID|
|» column_name|body|string|false|none|
|» due_date|body|string(date)|false|none|

#### Enumerated Values

|Parameter|Value|
|---|---|
|» column_name|today|
|» column_name|tomorrow|
|» column_name|this_week|
|» column_name|horizon|

<h3 id="post__api_tasks-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|Created task|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid input|None|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_tasks_archived

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/tasks/archived

```

`GET /api/tasks/archived`

*Get all archived tasks*

Returns all tasks that have been archived, with their list items if applicable

<h3 id="get__api_tasks_archived-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|column|query|string|false|Filter by column|
|routine_id|query|string(uuid)|false|Filter by routine|

#### Enumerated Values

|Parameter|Value|
|---|---|
|column|today|
|column|tomorrow|
|column|this_week|
|column|horizon|

<h3 id="get__api_tasks_archived-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Array of archived tasks|None|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_tasks_{id}

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/tasks/{id} \
  -H 'Accept: application/json'

```

`GET /api/tasks/{id}`

*Get a single task by ID*

Returns a task with its list items if applicable

<h3 id="get__api_tasks_{id}-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|Task ID|

> Example responses

> 200 Response

```json
{
  "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
  "routine_id": "f53c5ff7-cfb7-4f43-8b79-3421a01d8e2a",
  "title": "string",
  "notes": "string",
  "type": "task",
  "status": "pending",
  "due_date": "2019-08-24",
  "column_name": "today",
  "position": 0,
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z"
}
```

<h3 id="get__api_tasks_{id}-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Task object|[Task](#schematask)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Task not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_tasks_{id}

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/tasks/{id} \
  -H 'Content-Type: application/json'

```

`PUT /api/tasks/{id}`

*Update a task*

Updates task properties (title, notes, column, etc.)

> Body parameter

```json
{
  "title": "string",
  "notes": "string",
  "routine_id": "f53c5ff7-cfb7-4f43-8b79-3421a01d8e2a",
  "column_name": "today",
  "position": 0,
  "due_date": "2019-08-24"
}
```

<h3 id="put__api_tasks_{id}-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|
|body|body|object|false|none|
|» title|body|string|false|none|
|» notes|body|string|false|none|
|» routine_id|body|string(uuid)|false|none|
|» column_name|body|string|false|none|
|» position|body|integer|false|none|
|» due_date|body|string(date)|false|none|

#### Enumerated Values

|Parameter|Value|
|---|---|
|» column_name|today|
|» column_name|tomorrow|
|» column_name|this_week|
|» column_name|horizon|

<h3 id="put__api_tasks_{id}-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Updated task|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Task not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## get__api_tasks_{id}_context

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/tasks/{id}/context \
  -H 'Accept: application/json'

```

`GET /api/tasks/{id}/context`

*Get LLM-optimized task context*

Returns full context for a single task in a concise format.
Includes description, checklist items, and routine membership.
Optimized for LLM context (~550 chars).

Use this endpoint when you need complete details about a specific task.

<h3 id="get__api_tasks_{id}_context-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|Task ID|

> Example responses

> 200 Response

```json
{
  "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
  "title": "string",
  "description": "string",
  "column": "string",
  "routine": "string",
  "due": "2019-08-24",
  "created": "2019-08-24",
  "checklist": [
    {
      "text": "string",
      "done": true
    }
  ]
}
```

<h3 id="get__api_tasks_{id}_context-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Task context|Inline|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Task not found|None|

<h3 id="get__api_tasks_{id}_context-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» id|string(uuid)|false|none|none|
|» title|string|false|none|none|
|» description|string¦null|false|none|none|
|» column|string|false|none|none|
|» routine|string¦null|false|none|none|
|» due|string(date)¦null|false|none|none|
|» created|string(date)|false|none|none|
|» checklist|[object]|false|none|none|
|»» text|string|false|none|none|
|»» done|boolean|false|none|none|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_tasks_{id}_move

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/tasks/{id}/move \
  -H 'Content-Type: application/json'

```

`PUT /api/tasks/{id}/move`

*Move task to different column*

Moves a task to a different column and/or position

> Body parameter

```json
{
  "column": "today",
  "position": 0
}
```

<h3 id="put__api_tasks_{id}_move-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|
|body|body|object|true|none|
|» column|body|string|true|none|
|» position|body|integer|false|none|

#### Enumerated Values

|Parameter|Value|
|---|---|
|» column|today|
|» column|tomorrow|
|» column|this_week|
|» column|horizon|

<h3 id="put__api_tasks_{id}_move-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Moved task|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_tasks_{id}_archive

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/tasks/{id}/archive

```

`PUT /api/tasks/{id}/archive`

*Archive a task*

Archives a task (preserves list items if type='list')

<h3 id="put__api_tasks_{id}_archive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|

<h3 id="put__api_tasks_{id}_archive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Archived task|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Task not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_tasks_{id}_restore

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/tasks/{id}/restore

```

`PUT /api/tasks/{id}/restore`

*Restore a task from archive*

Restores an archived task back to active status

<h3 id="put__api_tasks_{id}_restore-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|

<h3 id="put__api_tasks_{id}_restore-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Restored task|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Task not found|None|

<aside class="success">
This operation does not require authentication
</aside>

## post__api_tasks_{id}_complete

> Code samples

```shell
# You can also use wget
curl -X POST http://192.168.10.21:3000/api/tasks/{id}/complete

```

`POST /api/tasks/{id}/complete`

*Mark task as complete*

Marks a task as complete and archives it

<h3 id="post__api_tasks_{id}_complete-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|

<h3 id="post__api_tasks_{id}_complete-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Completed task|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Task not found|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="clio-board-api-list-items">List Items</h1>

## get__api_tasks_{id}_items

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api/tasks/{id}/items

```

`GET /api/tasks/{id}/items`

*Get items for a task*

Returns all list items for a task (if type='list')

<h3 id="get__api_tasks_{id}_items-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|

<h3 id="get__api_tasks_{id}_items-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Array of list items|None|

<aside class="success">
This operation does not require authentication
</aside>

## post__api_tasks_{id}_items

> Code samples

```shell
# You can also use wget
curl -X POST http://192.168.10.21:3000/api/tasks/{id}/items \
  -H 'Content-Type: application/json'

```

`POST /api/tasks/{id}/items`

*Add item to task*

Adds an item to a task (auto-converts task to list if needed)

> Body parameter

```json
{
  "title": "string"
}
```

<h3 id="post__api_tasks_{id}_items-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|
|body|body|object|true|none|
|» title|body|string|true|Item text|

<h3 id="post__api_tasks_{id}_items-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|Created item|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Invalid input|None|

<aside class="success">
This operation does not require authentication
</aside>

## put__api_tasks_{id}_items_{itemId}

> Code samples

```shell
# You can also use wget
curl -X PUT http://192.168.10.21:3000/api/tasks/{id}/items/{itemId} \
  -H 'Content-Type: application/json'

```

`PUT /api/tasks/{id}/items/{itemId}`

*Update list item*

Updates a list item (check/uncheck or edit title)

> Body parameter

```json
{
  "title": "string",
  "completed": true
}
```

<h3 id="put__api_tasks_{id}_items_{itemid}-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|
|itemId|path|string(uuid)|true|none|
|body|body|object|false|none|
|» title|body|string|false|none|
|» completed|body|boolean|false|none|

<h3 id="put__api_tasks_{id}_items_{itemid}-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Updated item|None|

<aside class="success">
This operation does not require authentication
</aside>

## delete__api_tasks_{id}_items_{itemId}

> Code samples

```shell
# You can also use wget
curl -X DELETE http://192.168.10.21:3000/api/tasks/{id}/items/{itemId}

```

`DELETE /api/tasks/{id}/items/{itemId}`

*Delete list item*

Deletes an item (auto-converts list to task if last item)

<h3 id="delete__api_tasks_{id}_items_{itemid}-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string(uuid)|true|none|
|itemId|path|string(uuid)|true|none|

<h3 id="delete__api_tasks_{id}_items_{itemid}-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|204|[No Content](https://tools.ietf.org/html/rfc7231#section-6.3.5)|Item deleted|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|Item not found|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="clio-board-api-system">System</h1>

## get__health

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/health \
  -H 'Accept: application/json'

```

`GET /health`

*Health check endpoint*

Returns server health status and database connectivity

> Example responses

> 200 Response

```json
{
  "status": "healthy",
  "timestamp": "2019-08-24T14:15:22Z",
  "version": "1.0.0",
  "database": {
    "connected": true,
    "timestamp": "2019-08-24T14:15:22Z"
  },
  "uptime": 0
}
```

<h3 id="get__health-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Service is healthy|Inline|
|503|[Service Unavailable](https://tools.ietf.org/html/rfc7231#section-6.6.4)|Service is unhealthy|[Error](#schemaerror)|

<h3 id="get__health-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» status|string|false|none|none|
|» timestamp|string(date-time)|false|none|none|
|» version|string|false|none|none|
|» database|object|false|none|none|
|»» connected|boolean|false|none|none|
|»» timestamp|string(date-time)|false|none|none|
|» uptime|number|false|none|Server uptime in seconds|

<aside class="success">
This operation does not require authentication
</aside>

## get__api

> Code samples

```shell
# You can also use wget
curl -X GET http://192.168.10.21:3000/api \
  -H 'Accept: application/json' \
  -H 'X-Agent-Key: API_KEY'

```

`GET /api`

*API information endpoint*

Returns API metadata and authentication status

> Example responses

> 200 Response

```json
{
  "message": "CLIO-Board API",
  "version": "1.0.0",
  "timestamp": "2019-08-24T14:15:22Z",
  "actor": "user",
  "isAgent": false
}
```

<h3 id="get__api-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|API information|Inline|

<h3 id="get__api-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» message|string|false|none|none|
|» version|string|false|none|none|
|» timestamp|string(date-time)|false|none|none|
|» actor|string|false|none|none|
|» isAgent|boolean|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|actor|user|
|actor|agent|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
AgentAuth
</aside>

# Schemas

<h2 id="tocS_Task">Task</h2>
<!-- backwards compatibility -->
<a id="schematask"></a>
<a id="schema_Task"></a>
<a id="tocStask"></a>
<a id="tocstask"></a>

```json
{
  "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
  "routine_id": "f53c5ff7-cfb7-4f43-8b79-3421a01d8e2a",
  "title": "string",
  "notes": "string",
  "type": "task",
  "status": "pending",
  "due_date": "2019-08-24",
  "column_name": "today",
  "position": 0,
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|id|string(uuid)|false|none|Task ID|
|routine_id|string(uuid)¦null|false|none|Associated routine ID (null for orphan tasks)|
|title|string|true|none|Task title|
|notes|string¦null|false|none|Free-form notes|
|type|string|false|none|AUTO-MANAGED: Converts based on items|
|status|string|false|none|Task status|
|due_date|string(date)¦null|false|none|Due date (optional)|
|column_name|string|true|none|Kanban column|
|position|integer|false|none|Position within column|
|created_at|string(date-time)|false|none|none|
|updated_at|string(date-time)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|type|task|
|type|list|
|status|pending|
|status|completed|
|status|archived|
|column_name|today|
|column_name|tomorrow|
|column_name|this_week|
|column_name|horizon|

<h2 id="tocS_Routine">Routine</h2>
<!-- backwards compatibility -->
<a id="schemaroutine"></a>
<a id="schema_Routine"></a>
<a id="tocSroutine"></a>
<a id="tocsroutine"></a>

```json
{
  "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
  "title": "string",
  "description": "string",
  "color": "string",
  "icon": "string",
  "status": "active",
  "achievable": true,
  "is_archived": true,
  "pause_until": "2019-08-24T14:15:22Z",
  "display_order": 0,
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "archived_at": "2019-08-24T14:15:22Z"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|id|string(uuid)|false|none|none|
|title|string|true|none|Routine name|
|description|string¦null|false|none|none|
|color|string|false|none|Hex color for UI|
|icon|string|false|none|Emoji icon|
|status|string|false|none|none|
|achievable|boolean|false|none|Can be marked complete|
|is_archived|boolean|false|none|Archive state (separate from operational status)|
|pause_until|string(date-time)¦null|false|none|When paused routine should resume|
|display_order|integer|false|none|Custom display order for drag-and-drop|
|created_at|string(date-time)|false|none|none|
|updated_at|string(date-time)|false|none|none|
|archived_at|string(date-time)¦null|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|status|active|
|status|paused|
|status|completed|

<h2 id="tocS_Note">Note</h2>
<!-- backwards compatibility -->
<a id="schemanote"></a>
<a id="schema_Note"></a>
<a id="tocSnote"></a>
<a id="tocsnote"></a>

```json
{
  "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
  "title": "string",
  "content": "string",
  "type": "user",
  "source": "manual",
  "column_position": 1,
  "task_id": "736fde4d-9029-4915-8189-01353d6982cb",
  "routine_id": "f53c5ff7-cfb7-4f43-8b79-3421a01d8e2a",
  "is_archived": true,
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "archived_at": "2019-08-24T14:15:22Z"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|id|string(uuid)|false|none|Note ID|
|title|string¦null|false|none|Note title (optional)|
|content|string|true|none|Note content|
|type|string|false|none|Note type (auto-detected from request source)|
|source|string|false|none|How the note was created|
|column_position|integer¦null|false|none|Column position (1-2 user, 3-4 agent)|
|task_id|string(uuid)¦null|false|none|Associated task ID|
|routine_id|string(uuid)¦null|false|none|Associated routine ID|
|is_archived|boolean|false|none|Archive state|
|created_at|string(date-time)|false|none|none|
|updated_at|string(date-time)|false|none|none|
|archived_at|string(date-time)¦null|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|type|user|
|type|agent|
|source|manual|
|source|voice|
|source|conversation|
|source|claude_api|

<h2 id="tocS_Error">Error</h2>
<!-- backwards compatibility -->
<a id="schemaerror"></a>
<a id="schema_Error"></a>
<a id="tocSerror"></a>
<a id="tocserror"></a>

```json
{
  "error": "string",
  "timestamp": "2019-08-24T14:15:22Z"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|error|string|false|none|Error message|
|timestamp|string(date-time)|false|none|none|

<h2 id="tocS_Divider">Divider</h2>
<!-- backwards compatibility -->
<a id="schemadivider"></a>
<a id="schema_Divider"></a>
<a id="tocSdivider"></a>
<a id="tocsdivider"></a>

```json
{
  "id": "497f6eca-6276-4993-bfeb-53cbbbba6f08",
  "column_name": "today",
  "label_above": "string",
  "label_below": "string",
  "position": 0,
  "created_at": "2019-08-24T14:15:22Z"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|id|string(uuid)|false|none|Divider ID|
|column_name|string|false|none|Column where divider appears (currently only Today)|
|label_above|string|false|none|Label shown above the line (e.g., Morning)|
|label_below|string|false|none|Label shown below the line (e.g., Afternoon)|
|position|integer|false|none|Position for ordering alongside tasks|
|created_at|string(date-time)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|column_name|today|

