# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Running the app

No build step. Serve the folder with any static server and open it:

```powershell
python -m http.server 8124
```

To try changes without touching the team's Google Sheet, turn on **Settings → Demo mode**
(data lives in this browser only; demo patients come from `js/demo.js`).

## Architecture

Vanilla ES modules, no framework or bundler. GitHub Pages serves the repo root.

| Path | Role |
|---|---|
| `index.html`, `css/app.css` | App shell and the whole design system (tokens, light/dark) |
| `js/main.js` | Routing (`#/route?params`), rendering, event delegation, global search, sync status |
| `js/store.js` | Local-first store: changes apply locally, queue in an outbox, are sent in batches with retry; loading re-applies unsent changes |
| `js/api.js` | Transport: Apps Script v2 (`applyBatch`) or v1 (`createRecord`/`updateRecord`/`deleteRecord`), or the demo database |
| `js/model.js` | Domain rules: port cath statuses, session days, “awaiting outcome”, triage, task types, search |
| `js/ui.js`, `js/print.js` | Dialogs, toasts, menus, icons; printable reports and Word export |
| `js/views/*.js` | One module per screen, each exports `title`, `render`, optional `onRoute`, `mount`, `focusRecord` |
| `google-apps-script/Code.gs` | Backend (v2). Same sheets/columns as v1; see `SETUP.md` |
| `backup/v1/` | The previous version of the app, untouched |

Rules of thumb:
- Views render HTML with the `html` tagged template (auto-escapes); handlers are registered with `registerActions` / `registerChanges` and referenced by `data-action` / `data-change` / `data-input`.
- Mutations go through `upsert` / `create` / `remove` in `store.js` only. Port cath status changes go through `pc.*` in `model.js`, which also writes the history row.
- Dates are local `yyyy-mm-dd` strings (`todayISO()`, never `toISOString()` for a calendar day).
- Port cath: a booked patient whose date has passed is “awaiting outcome” until marked **Port done** (`status: done`, `doneAt`) or **Not done** (carried over, back to waiting list, or cancelled).
