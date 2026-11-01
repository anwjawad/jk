# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**MedSched Panel** is a clinical scheduling and patient management web application (v1.0.0). It's a single-page application (SPA) built with vanilla HTML, CSS, and JavaScript that helps medical coordinators manage:

- Port catheterization procedures
- Patient admissions planning
- Patient follow-up calls (WhatsApp & Call tracking)
- Tumor board follow-ups
- Smart import of patient data from Excel and Word documents

The app uses browser localStorage for persistent data storage and requires no backend server or build process. It's designed to be print-friendly and includes dark mode support.

## Architecture

### File Structure
- **index.html** (1054 lines) - UI structure with tabs, modals, tables, and forms
- **app.js** (3200 lines) - All application logic: state management, data operations, rendering, and event handlers
- **style.css** (1223 lines) - Complete styling with design system using CSS variables, dark mode support, and print styles
- **Supporting assets**: Bundled libraries (html2pdf.bundle.min.js, mammoth.browser.min.js) and logo.png

### Code Organization

**app.js** is organized by feature:
1. **State & Initialization** (top) - Global arrays (portCathList, admissionsList, followUpList, tumorBoardList), DOM event listeners
2. **Tab Navigation** - switchTab(), openAddModal(), closeAddModal()
3. **Dark Mode** - toggleDarkMode()
4. **Date Utilities** - getDayName(), formatDateDisplay(), updateDashboardDate()
5. **Port Cath Logic** - addPortCathPatient(), renderPortCathTable(), filterPortCathTable(), edit/delete operations
6. **Admissions Logic** - addAdmissionPatient(), renderAdmissionsTable(), related operations
7. **Follow-up Logic** - Similar pattern for WhatsApp/Call follow-ups
8. **Tumor Board Logic** - Similar pattern for tumor board tracking
9. **Dashboard Rendering** - renderDashboard() with summary counters
10. **Excel/Word Import** - parseExcelFiles(), parseWordFile(), extractTableFromWord()
11. **Persistence** - saveToLocalStorage(), loadFromLocalStorage()
12. **Print/Export** - exportToPDF() functions for each section

**style.css** includes:
- CSS variables for theming (--primary, --secondary, --bg-main, --text-main, etc.)
- Dark mode overrides (body.dark-mode selector)
- Sidebar navigation styling
- Modal and form styling
- Table and badge styles
- Print styles (.no-print classes)
- Responsive layout with 260px sidebar

### Data Models

Each list (portCathList, admissionsList, etc.) contains objects with:
- **id**: Unique timestamp-based identifier (Date.now().toString())
- **date**: ISO date string for scheduling
- **day**: Computed day name from date
- **Type-specific fields**: name, fileNumber, weight, notes, etc.

All data is serialized to JSON and stored in localStorage with keys:
- `medsched_portcath`
- `medsched_admissions`
- `medsched_followup`
- `medsched_tumorboard`
- `medsched_dark_mode` (boolean)

### Third-Party Libraries (CDN-based)
- **SheetJS (XLSX 0.18.5)** - Excel file parsing and reading
- **Mammoth.js** - Word (.docx) document parsing
- **html2pdf.js** - PDF export functionality
- **Google Fonts** - Plus Jakarta Sans font family

## Running & Development

Since this is a static web application, it can be opened directly:

1. **Open locally**: Simply open `index.html` in a web browser
2. **Local testing with live-server**: `! npx http-server .` (from project root)
3. **No build process**: Changes to HTML/CSS/JS are immediately reflected (hard refresh may be needed)

### Workflow
- Edit HTML structure in index.html
- Add/modify logic in app.js
- Update styling in style.css
- Test in browser and verify data persistence with localStorage
- Use browser DevTools Console to debug: `portCathList`, `admissionsList` etc. are global

### Testing Print Output
- Press Ctrl+P or use browser print dialog
- Elements with class `.no-print` are hidden in print view
- Tables are optimized for printing with appropriate spacing

## Key Patterns & Conventions

### Modal Management
```javascript
// Open: adds 'active' class
openAddModal(type) // type: 'portcath', 'admissions', 'followup', 'tumorboard'

// Close: removes 'active' class
closeAddModal(type)
```

### Form Handling
- Forms use `event.preventDefault()` to prevent page reload
- Form IDs follow pattern: `form-{type}`
- Input IDs follow pattern: `{type-abbr}-{field}` (e.g., `pc-name`, `adm-age`)
- After submit: form.reset(), date field re-initialized, modal closed, renderTable() called, renderDashboard() updated, saveToLocalStorage()

### Rendering Pattern
Each feature has a `render{Feature}Table()` function that:
1. Gets filter/search values
2. Filters/sorts the list
3. Generates HTML for each row with edit/delete buttons
4. Handles empty states
5. Updates counter badges

### Edit/Delete Operations
- Edit: `openEditPatient(type, patientId)` - loads data into form, opens modal in edit mode
- Delete: `deletePatient(type, patientId)` - with confirmation, then re-render and save
- Both trigger saveToLocalStorage() and renderDashboard() to keep UI in sync

### Date Handling
- Stored as ISO strings (YYYY-MM-DD)
- Formatted for display as DD/MM/YYYY using formatDateDisplay()
- Day name computed from date using getDayName()
- Filter dropdowns populated by extracting unique dates from lists

### Search/Filter
- Search is case-insensitive client-side filter on visible table rows
- Date filter applies before rendering (filters the list)
- Both maintain table display state without re-opening modals

## Important Details

### localStorage Scope
- Data persists only in the same browser/domain
- No cross-browser or cross-device sync
- Data not encrypted; browser devtools can access it

### Date Input Behavior
- Form date inputs default to today's date on init and after submit
- All dates stored as YYYY-MM-DD strings
- Ensure date fields are properly initialized before modal display

### Excel Import Details
- Accepts .xlsx files (SheetJS supports many formats)
- Expects first row to be headers
- Maps column headers to patient fields (case-sensitive in code)
- Handles multiple sheet files in one drag-drop event

### Word Document Import
- Parses .docx files for tables
- Extracts table data and converts to patient records
- Mammoth.js handles complex Word document structures

### CSS Design System
- Primary color (teal): `#0d9488` used for buttons, badges, highlights
- Secondary (dark slate): `#0f172a` for sidebar background
- Responsive breakpoints hardcoded in CSS (not using media queries extensively)
- Dark mode uses body.dark-mode class with CSS variable overrides

### Print Considerations
- Tables are designed to be multi-page print-friendly
- Use `.no-print` class on FAB, sidebar, action buttons, filters
- PDF export uses html2pdf.js library (check browser console for any JS errors during export)

## Debugging Tips

**View/Edit Data in Console:**
```javascript
// Check all patients
console.log(portCathList, admissionsList, followUpList, tumorBoardList)

// Manually add a test patient
portCathList.push({id: Date.now().toString(), name: 'Test', fileNumber: '001', date: '2026-06-03', day: 'Tuesday', weight: 70, notes: 'test'});
saveToLocalStorage();
renderPortCathTable();

// Clear all data
localStorage.clear();
location.reload();
```

**Network/Performance:**
- All libraries loaded from CDN (check Network tab if imports fail)
- No external API calls; all data local to browser
- Large Excel files may take a few seconds to parse (SheetJS is client-side)

**Common Issues:**
- **Data not persisting**: Check if localStorage is enabled in browser
- **Modal doesn't open**: Verify modal element ID exists (modal-add-{type})
- **Import fails silently**: Check browser console for Mammoth/SheetJS errors
- **Styling issues in dark mode**: Verify dark-mode class is on body and CSS variables are set

## Permanent Rules (Phase 2–6 Integration)

### Google Sheets Sync (Phase 2)
- **localStorage is now a cache only**, not the source of truth. Google Sheets is authoritative.
- **Every mutation** goes through `syncAfterChange(action, type, payload)` in sync.js, not `saveToLocalStorage()` directly.
- All mutations: `add`, `edit`, `delete`, `bulkCreate`, `clearType` must pass through sync layer.
- Failed syncs enqueue to `medsched_pending_queue` in localStorage. On boot, `syncAllLocalPendingChanges()` flushes the queue.
- The sync.js file is the ONLY place that calls the Google Apps Script web app. No other fetch() calls to GAS.

### Modal Patterns (Phases 3 & 6)
- **Three modal types exist**:
  1. `#modal-confirm` — for destructive actions (delete, clear). Use `showConfirmModal({title, body, confirmLabel, onConfirm})`.
  2. `#modal-add-confirm` — for add/edit confirmation with summary. Use `showAddConfirmModal({title, summary, onConfirm})`.
  3. `#modal-prepared-by` — for export/print with coordinator name input. Use `openPreparedByModal({scope, ...})`.
- All `window.confirm()` and `window.prompt()` must be replaced with these functions. Do not introduce new confirm/prompt calls.

### Print CSS is Sacred (Phase 5)
- **Do not redesign print layout or print CSS** unless absolutely necessary for correctness.
- The print DOM output must visually match current print preview. Use the same CSS.
- Print functions generate HTML into `#print-container` and rely on `@media print` rules in style.css.
- `.no-print` class hides UI elements (FAB, sidebar, buttons) in print mode. Do not remove or add elements to this class unless justified.

### Calendar Grid (Phase 4)
- Calendar cells show badge counts only. No patient details in the calendar itself.
- Tumor board patients appear as a single count badge on all days (they have no date field).
- Clicking a calendar day opens `#cal-day-workspace` with filtered tables for that date.
- The calendar state is stored in global vars: `calYear`, `calMonth`, `calSelectedDate`, `calModuleFilter`.
- Workspace renders via `renderWorkspaceSection(type, dateStr)` which reuses existing table columns.

### Sync Status Badges (Phase 3)
- Row sync state tracked in `sync.js`'s `_syncStateMap[recordId]` (pending/synced/error).
- Table rows must have `data-sync-id="${patient.id}"` attribute for badge display.
- Small `<span class="sync-row-badge">` badge shows ⏳ (pending), ✓ (synced), or ⚠ (error) in the actions column.
- Sidebar `#sync-status-indicator` shows global sync status: Offline / Loading / Syncing / Synced / Pending (N).

### Form Flow
- New pattern for add/edit: validate → show summary confirm → on confirm → push/mutate → `syncAfterChange()` → render.
- Do NOT call `saveToLocalStorage()` directly anywhere except inside `syncAfterChange()` itself.
- After any user action that changes data, call the appropriate `render*Table()` and `renderDashboard()` (or `renderCalendar()` if calendar open).

### Word Export
- The `exportToWord()` function reads all stylesheets and wraps them in Office-compatible HTML.
- It creates a `.doc` file (MIME: `application/msword`) with embedded CSS.
- Mammoth.js is for READING .docx (import), not writing. Word export uses the HTML method only.

### Data Operations
- `portCathList`, `admissionsList`, `followUpList`, `tumorBoardList` are module-level `let` arrays, not constants.
- Each record has a unique `id: Date.now().toString()` on create.
- Add/edit/delete must call `syncAfterChange()` for the mutation to persist to GAS.
- No record should ever be created/edited/deleted without a corresponding sync call.
