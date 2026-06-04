# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step. Open `index.html` directly in a browser, or serve it with any static file server:

```powershell
# Python (simplest)
python -m http.server 8080

# Node
npx serve .
```

The app is fully functional offline (localStorage) but Google Sheets sync requires an internet connection and a valid GAS URL.

## Architecture

**Stack:** Vanilla HTML/CSS/JS — no framework, no bundler, no package manager.

### Files

| File | Role |
|---|---|
| `index.html` | Shell: sidebar, all tab `<section>` markup, modal templates, `window.MEDSCHED_CONFIG` inline script |
| `app.js` | All UI logic: rendering, CRUD, calendar, print/PDF export, Excel import, global search |
| `sync.js` | Google Sheets sync layer: HTTP to GAS, offline pending queue, per-row sync badges |
| `style.css` | All styling, CSS custom properties, dark mode, print styles |
| `mammoth.browser.min.js` | Word document (.docx) parsing for Smart Import tab |
| `html2pdf.bundle.min.js` | PDF export for print reports |

`xlsx@0.18.5` is loaded from the CDN (`cdn.jsdelivr.net`) — the only external dependency at runtime.

### Data model

Four in-memory arrays are the source of truth:

```
portCathList    – port catheter placement patients
admissionsList  – daily planned admissions
followUpList    – WhatsApp/call follow-up tasks
tumorBoardList  – tumor board follow-up cases
```

Persistence is two-tier:
1. **localStorage** — written synchronously on every change via `saveToLocalStorage()` (keys: `medsched_portcath`, `medsched_admissions`, `medsched_followup`, `medsched_tumorboard`)
2. **Google Sheets** — async via `sync.js`; failed writes are queued in `medsched_pending_queue` and retried

On boot (`DOMContentLoaded`): local storage is loaded first so the UI is immediately usable, then `initGoogleSheetsSync()` fetches from GAS and overwrites the cache with the authoritative remote data.

### Sync layer (`sync.js`)

- Reads `window.MEDSCHED_CONFIG.gasUrl` and `.apiKey` (set in `index.html`)
- Writes use `fetch` with `mode: 'no-cors'` (opaque response — can't read success/failure from GAS POST)
- Reads use a regular GET (CORS-enabled GAS deployment required)
- JSONP fallback for localhost: set `jsonpReads: true` in `MEDSCHED_CONFIG`
- Every mutation calls `syncAfterChange(action, type, payload)` — this saves locally then fires the async GAS call

### Tabs / navigation

`switchTab(tabId)` toggles `.active` on `#tab-{tabId}` sections and `#menu-{tabId}` sidebar items. Tab IDs: `dashboard`, `portcath`, `admissions`, `followup`, `tumorboard`, `import`.

### Print / PDF export

`generateAndPrintReport(type, dates, mode, preparerName, action)` builds a hidden print DOM then either calls `window.print()` or `html2pdf().save()`. Reports are landscape (admissions) or portrait (port cath, follow-up, tumor board). The "Prepared by" modal (`modal-prepared-by`) gates all exports.

### Google Apps Script backend

The GAS web app (`gasUrl` in `MEDSCHED_CONFIG`) must support:
- `GET ?action=getAll&key=...` → `{ status:'ok', portcath:[], admissions:[], followup:[], tumorboard:[] }`
- `POST` body actions: `createRecord`, `updateRecord`, `deleteRecord`, `syncBatch`, `clearType`

`apiKey` is a shared secret passed in every request body and the GET query string.
