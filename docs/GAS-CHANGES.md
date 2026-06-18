# GAS Backend Changes Required for Port Cath Studio

## 1. Overview

The Port Cath Scheduling Studio introduces two new entity types that must be persisted in Google Sheets via the existing GAS web app backend (`google-apps-script/Code.gs`).

**New types:**

| Type string | Purpose |
|---|---|
| `portcath-session-config` | Records whether a specific calendar date is an allowed Port Cath session day |
| `portcath-history` | Append-only audit trail of patient actions (move, cancel, noshow, apologize, restore) |

The frontend calls `syncAfterChange(action, type, payload)` already wired to these new type strings. The GAS backend must be updated to:

1. Register two new sheet names in `SHEET_NAMES`
2. Register two new column maps in `COLUMN_MAP`
3. Add `case` branches in `recordToRow()` and `rowToRecord()` for both types
4. Create the two new sheets in the spreadsheet with the correct headers

No changes are needed to `doPost`, `createRecordHandler`, or `updateRecordHandler` — they are type-agnostic and delegate to `recordToRow` / `rowToRecord`.

---

## 2. New Sheet Required: `portcath_session_config`

### Purpose

Stores one row per session date. Each row represents a calendar date that has been configured as an allowed (or disallowed) Port Cath session day.

### How to create the sheet

1. Open the linked Google Spreadsheet.
2. Click the **+** button at the bottom to add a new sheet.
3. Rename it exactly: `PortCathSessionConfig`
4. In row 1, enter the following headers in order (one per column, A through G):

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| id | date | year | month | dayOfWeek | isActive | syncStatus |

### Column definitions

| Column | Type | Notes |
|---|---|---|
| `id` | String | The date string used as the unique key, e.g. `"2026-06-15"` |
| `date` | String | ISO date `"YYYY-MM-DD"` |
| `year` | Number | Full year, e.g. `2026` |
| `month` | Number | 0-based month (0 = January, 11 = December) |
| `dayOfWeek` | String | Arabic day name, e.g. `"الأحد"` |
| `isActive` | Boolean | `true` = session allowed on this date |
| `syncStatus` | String | `'pending'` or `'synced'` — managed by the frontend |

### Actions used

- `'create'` — when a new session day is first configured
- `'update'` — when `isActive` is toggled for an existing date

---

## 3. New Sheet Required: `portcath_history`

### Purpose

Append-only audit trail. Each row records one patient action (move, cancel, noshow, apologize, or restore). Rows are never updated or deleted.

### How to create the sheet

1. Open the linked Google Spreadsheet.
2. Click **+** to add a new sheet.
3. Rename it exactly: `PortCathHistory`
4. In row 1, enter the following headers in order (A through K):

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| id | patientId | patientName | fileNumber | action | fromDate | toDate | reason | note | timestamp | syncStatus |

### Column definitions

| Column | Type | Notes |
|---|---|---|
| `id` | String | Unique ID, e.g. `"1718700000000_move"` |
| `patientId` | String | Internal patient identifier |
| `patientName` | String | Display name |
| `fileNumber` | String | Hospital file number |
| `action` | String | One of: `move`, `cancel`, `noshow`, `apologize`, `restore` |
| `fromDate` | String | ISO date — source date for moves; session date for status actions |
| `toDate` | String or empty | ISO date for moves; empty/null for status actions |
| `reason` | String | Reason text entered by the user |
| `note` | String | Optional free-text note |
| `timestamp` | Number | Unix milliseconds (from `Date.now()`) |
| `syncStatus` | String | `'pending'` or `'synced'` — managed by the frontend |

### Actions used

- `'create'` only — history is append-only. Update and delete are not used for this type.

---

## 4. GAS Code Changes Required

All changes are made in `google-apps-script/Code.gs`.

### 4a. Add to `SHEET_NAMES` constant

```js
const SHEET_NAMES = {
  portcath: 'PortCath',
  admissions: 'Admissions',
  followup: 'FollowUp',
  tumorboard: 'TumorBoard',
  clinic: 'ClinicAppointments',
  audit_log: 'AuditLog',
  settings: 'Settings',
  // NEW — Port Cath Studio
  'portcath-session-config': 'PortCathSessionConfig',
  'portcath-history': 'PortCathHistory'
};
```

### 4b. Add to `COLUMN_MAP` constant

```js
const COLUMN_MAP = {
  // ... existing entries unchanged ...

  // NEW — Port Cath Studio
  'portcath-session-config': {
    id: 0, date: 1, year: 2, month: 3, dayOfWeek: 4, isActive: 5, syncStatus: 6
  },
  'portcath-history': {
    id: 0, patientId: 1, patientName: 2, fileNumber: 3, action: 4,
    fromDate: 5, toDate: 6, reason: 7, note: 8, timestamp: 9, syncStatus: 10
  }
};
```

### 4c. Add cases in `recordToRow(type, record)`

The existing function builds a row array from `COLUMN_MAP[type]`. Because the new types are keyed directly in `COLUMN_MAP`, `recordToRow` should work without any structural change **if** it uses the generic column-map loop. Verify:

```js
function recordToRow(type, record) {
  const colMap = COLUMN_MAP[type];
  const row = new Array(Object.keys(colMap).length);
  for (const [field, idx] of Object.entries(colMap)) {
    row[idx] = record[field] !== undefined ? record[field] : '';
  }
  return row;
}
```

If the function has a `switch (type)` with hard-coded cases instead, add:

```js
case 'portcath-session-config':
  return [
    record.id, record.date, record.year, record.month,
    record.dayOfWeek, record.isActive, record.syncStatus
  ];

case 'portcath-history':
  return [
    record.id, record.patientId, record.patientName, record.fileNumber,
    record.action, record.fromDate, record.toDate || '',
    record.reason, record.note, record.timestamp, record.syncStatus
  ];
```

### 4d. Add cases in `rowToRecord(type, row)`

Same pattern — if the function is generic it will work automatically. If it uses a `switch (type)`, add:

```js
case 'portcath-session-config':
  return {
    id:         row[0],
    date:       row[1],
    year:       row[2],
    month:      row[3],
    dayOfWeek:  row[4],
    isActive:   row[5],
    syncStatus: row[6]
  };

case 'portcath-history':
  return {
    id:          row[0],
    patientId:   row[1],
    patientName: row[2],
    fileNumber:  row[3],
    action:      row[4],
    fromDate:    row[5],
    toDate:      row[6] || null,
    reason:      row[7],
    note:        row[8],
    timestamp:   row[9],
    syncStatus:  row[10]
  };
```

### 4e. Update `ensureSheetsExist()` / `initializeSpreadsheet()`

If either function creates sheets and writes headers programmatically, add entries for the two new sheets:

```js
// Inside initializeSpreadsheet() or ensureSheetsExist():

ensureSheet('PortCathSessionConfig',
  ['id', 'date', 'year', 'month', 'dayOfWeek', 'isActive', 'syncStatus']);

ensureSheet('PortCathHistory',
  ['id', 'patientId', 'patientName', 'fileNumber', 'action',
   'fromDate', 'toDate', 'reason', 'note', 'timestamp', 'syncStatus']);
```

### 4f. History type is append-only — guard against update/delete

The `updateRecordHandler` and `deleteRecordHandler` should reject attempts to modify history records. Add an early guard:

```js
function updateRecordHandler(payload) {
  if (payload.type === 'portcath-history') {
    return errorResponse('NOT_ALLOWED', 'portcath-history records are append-only', 403);
  }
  // ... rest of existing logic
}

function deleteRecordHandler(payload) {
  if (payload.type === 'portcath-history') {
    return errorResponse('NOT_ALLOWED', 'portcath-history records cannot be deleted', 403);
  }
  // ... rest of existing logic
}
```

---

## 5. Privacy Note

Some `portcath` records stored in the main `PortCath` sheet now include a `phone` field for certain patients. The following rules apply to GAS error handling and logging:

- **Do not log the `phone` field** in `AuditLog` `beforeJson`/`afterJson` entries.
- **Do not include `phone`** in GAS error messages returned in HTTP responses.
- **Do not include `phone`** in any server-side `Logger.log()` or `console.log()` calls.
- If the `portcath` record must be serialized for audit purposes, strip the phone field first:

```js
function sanitizeForAudit(record) {
  const safe = Object.assign({}, record);
  delete safe.phone;
  return safe;
}
```

Apply `sanitizeForAudit` before calling `JSON.stringify(record)` in `writeAuditLog` calls within `createRecordHandler` and `updateRecordHandler` when `type === 'portcath'`.

---

## 6. Testing Checklist

1. **Sheet creation** — Run the `setup` action via GET or trigger `initializeSpreadsheet()` directly. Verify that `PortCathSessionConfig` and `PortCathHistory` sheets are created with the correct headers in row 1.

2. **Create session-config record** — POST a `create` / `portcath-session-config` payload with a valid record. Verify a new row appears in `PortCathSessionConfig` with all 7 columns populated and no extra blank columns.

3. **Update session-config record** — POST an `update` / `portcath-session-config` payload changing `isActive`. Verify the existing row is updated (same `id`, changed `isActive` value) and no duplicate row is created.

4. **Create history record** — POST a `create` / `portcath-history` payload for a `move` action (with `toDate` set) and a `cancel` action (with `toDate` null/empty). Verify both rows appear in `PortCathHistory` with correct values, and `toDate` is blank (not the string `"null"`) for the cancel row.

5. **Reject update on history** — POST an `update` / `portcath-history` payload. Verify the GAS returns a `403 NOT_ALLOWED` error and no row is modified.

6. **Reject delete on history** — POST a `delete` / `portcath-history` payload. Verify the GAS returns a `403 NOT_ALLOWED` error.

7. **Phone field not exposed** — Create or update a `portcath` record that includes a `phone` field. Open the `AuditLog` sheet and verify that neither `beforeJson` nor `afterJson` columns contain the phone number string.

8. **getAll still works** — Call the `getAll` action. Verify the response includes `portcath`, `admissions`, `followup` data as before, and does not break due to the new sheet names. (The new sheets are not required to appear in `getAll` unless the frontend requests them.)
