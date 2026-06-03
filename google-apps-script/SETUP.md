# MedSched Panel — Google Apps Script Setup Guide

## Overview

This guide walks you through setting up the Google Apps Script backend that will serve as the data API for the MedSched Panel webapp. The script syncs patient data with a Google Sheet and provides REST-like endpoints for create, read, update, delete, and bulk operations.

---

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Click **"+ Create"** → **"Blank spreadsheet"**
3. Name it: `MedSched Data` (or your preferred name)
4. Copy the **Spreadsheet ID** from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - Store this ID in a safe place — you'll need it later

---

## Step 2: Create Sheet Tabs and Headers (Auto or Manual)

### Option A: Automatic (Recommended)
The Google Apps Script will automatically create all 6 tabs and headers on first use. You can trigger this by:

1. Pasting Code.gs into Google Apps Script (see Step 4 below)
2. Deploying as Web App (see Step 6 below)
3. Opening this URL in your browser:
   ```
   https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=setup&key=medsched-2026-key-abc123
   ```
   Replace `YOUR_DEPLOYMENT_ID` with your actual deployment ID

You should get a JSON response: `{"status":"ok","message":"Spreadsheet initialized"}`

The script will now have created all 6 sheets with correct headers automatically.

---

### Option B: Manual (If you prefer to create sheets yourself)

You need **6 tabs** in your Google Sheet. Create them in this exact order:

### Tab 1: `PortCath`
| Column | Header |
|--------|--------|
| A | id |
| B | name |
| C | fileNumber |
| D | date |
| E | day |
| F | weight |
| G | notes |
| H | createdAt |
| I | updatedAt |
| J | deletedAt |
| K | version |
| L | preparedBy |

**Instructions:**
1. Right-click the default "Sheet1" tab at the bottom
2. Select **"Rename"** and name it `PortCath`
3. In row 1, add the headers from the table above (copy-paste is fine)
4. Leave row 2 onwards empty — the script will append data here

### Tab 2: `Admissions`
| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | name | fileNumber | age | triageScore | primaryPhysician | placeOfReferral | modeOfTransportation | performanceStatus | admissionDepartment | date | summary | causeOfAdmission | notes | createdAt | updatedAt | deletedAt | version | preparedBy |

**Instructions:**
1. Click **"+ Sheet"** at the bottom left
2. Name it `Admissions`
3. Add the headers in row 1

### Tab 3: `FollowUp`
| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| id | name | phone | fileNumber | date | task | taskResult | createdAt | updatedAt | deletedAt | version | preparedBy |

**Instructions:**
1. Create new sheet named `FollowUp`
2. Add headers in row 1

### Tab 4: `TumorBoard`
| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | name | fileNumber | age | physician | diagnosis | notes | tasks | createdAt | updatedAt | deletedAt | version | preparedBy |

**Note on column H (tasks):** This column stores the entire tasks array as a **JSON string**, for example:
```
[{"id":"1748_abc","type":"referral_followup","title":"متابعة تحويلة","status":"pending","notes":""}]
```

**Instructions:**
1. Create new sheet named `TumorBoard`
2. Add headers in row 1

### Tab 5: `AuditLog`
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| timestamp | action | module | recordId | displayName | beforeJson | afterJson |

**Instructions:**
1. Create new sheet named `AuditLog`
2. Add headers in row 1
3. Leave data rows empty — the script populates this automatically

### Tab 6: `Settings`
| A | B | C |
|---|---|---|
| key | value | updatedAt |

**Instructions:**
1. Create new sheet named `Settings`
2. Add headers in row 1
3. You can optionally pre-populate some settings:
   - Row 2: `schemaVersion | 1.0.0 | [timestamp]`
   - Row 3: `lastSyncTime | [timestamp] | [timestamp]`

---

## Step 3: Link Google Apps Script to the Sheet

1. From your Google Sheet, go to **Extensions** → **Apps Script**
   - This will open Google Apps Script in a new tab, linked to your sheet
2. A default `Code.gs` file will appear with boilerplate code
3. **Delete all of it** — select all text and delete

---

## Step 4: Paste the Code.gs File

1. Open `google-apps-script/Code.gs` from this repository
2. Copy **all the code**
3. Paste it into the Google Apps Script editor (replacing the empty boilerplate)
4. Click **"Save"** (or Ctrl+S)

---

## Step 5: Configure the API Key

In the Google Apps Script editor, find this line near the top:

```javascript
const VALID_API_KEYS = ['medsched-2026-key-abc123']; // Add your API key(s) here
```

**Choose your API key:**
- You can use the default: `medsched-2026-key-abc123`
- Or generate a custom one: any alphanumeric string (32+ characters is safer)
- This key must match what you put in `index.html` config later

**Save the script** after making any changes.

---

## Step 6: Deploy as Web App

1. In Google Apps Script, click **"Deploy"** (top-right button, looks like an arrow)
2. Click **"New Deployment"**
3. From the **"Select type"** dropdown, choose **"Web app"**
4. Configure these settings:
   - **Execute as**: Select your Google account (the one owning this script/sheet)
   - **Who has access**: Select **"Anyone"**
   - Click **"Deploy"**
5. You will see a pop-up with a **"Web app URL"** that looks like:
   ```
   https://script.google.com/macros/s/AKfycbx...abc123.../exec
   ```
6. **Copy this entire URL** and save it — you'll need this for the next step

---

## Step 7: Initialize the Spreadsheet

Before testing data operations, initialize the spreadsheet to create all required sheets:

1. Open a new browser tab and go to:
   ```
   https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=setup&key=medsched-2026-key-abc123
   ```
   Replace `YOUR_DEPLOYMENT_ID` with the deployment ID from your Web app URL (the long alphanumeric string between `/s/` and `/exec`)

2. You should see a JSON response:
   ```json
   {
     "status": "ok",
     "message": "Spreadsheet initialized"
   }
   ```

3. Go back to your Google Sheet and refresh it. You should now see **6 new sheet tabs** at the bottom:
   - `PortCath`
   - `Admissions`
   - `FollowUp`
   - `TumorBoard`
   - `AuditLog`
   - `Settings`

4. Each sheet will have its headers already in row 1

---

## Step 8: Test the Deployment

Now verify that the API is working:

1. Open a new browser tab and go to:
   ```
   https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=getAll&key=medsched-2026-key-abc123
   ```

2. You should see a JSON response like:
   ```json
   {
     "status": "ok",
     "portcath": [],
     "admissions": [],
     "followup": [],
     "tumorboard": []
   }
   ```

3. If you get an error, check:
   - The API key matches what's in `Code.gs` (line 8)
   - The Web app URL is complete and correct
   - You deployed as "Anyone" (not restricted to your account)
   - The `setup` endpoint completed successfully

---

## Step 9: Configure the Frontend

Now you need to tell the MedSched Panel webapp where to find the Google Apps Script API.

1. Open `index.html` in the MedSched Panel project (the main webapp)
2. Find the `<head>` section and add this **before the `<script src="app.js">` line**:

```html
<!-- MedSched Configuration -->
<script>
  window.MEDSCHED_CONFIG = {
    gasUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
    apiKey: 'medsched-2026-key-abc123'
  };
</script>

<!-- Include API layer -->
<script src="api.js"></script>
```

Replace:
- `YOUR_DEPLOYMENT_ID` with the deployment ID from your Web app URL
  - The deployment ID is the long alphanumeric string between `/s/` and `/exec`
  - Example: `https://script.google.com/macros/s/AKfycbx1234567890abcdef/exec` → ID is `AKfycbx1234567890abcdef`
- `medsched-2026-key-abc123` with your API key (if you changed it)

3. Save `index.html`

---

## Step 10: Verify Everything Works

1. Open the MedSched Panel app in your browser (e.g., `file:///path/to/index.html`)
2. Check the browser console (F12 → Console tab)
3. The app should load data from Google Sheets instead of localStorage
4. Add a new patient (any module) and verify:
   - The patient appears in the app
   - The patient appears in your Google Sheet within 5 seconds
   - A new row is added to the `AuditLog` sheet

---

## Troubleshooting

### "Authentication failed" error
- Check that the API key in `index.html` matches the one in `Code.gs` (line 8)
- Make sure the key is passed in the request URL/body

### "SHEET_NOT_FOUND" error
- Verify that all 6 sheet tabs exist with **exact names**:
  - `PortCath` (capital P, camelCase)
  - `Admissions`
  - `FollowUp` (capital U)
  - `TumorBoard` (capital T)
  - `AuditLog` (capital A and L)
  - `Settings` (capital S)

### Empty response or no data appears in Sheets
- Check that you deployed the script as a **Web app** (not just saved it)
- Verify the Web app URL is correct
- Make sure you selected **"Anyone"** in the deployment access settings
- Check the GAS execution logs: in Apps Script editor, click **"Execution"** to see errors

### Print/PDF still works?
- **Yes!** The Google Sheets sync is completely separate from the print pipeline
- Print functionality uses data already in memory (the four arrays), not localStorage
- No changes to print were made

---

## API Endpoint Reference

Once deployed, your Web app provides these endpoints:

### GET requests

**Get all data (app startup):**
```
GET https://your-gas-url/exec?action=getAll&key=YOUR_KEY
→ { status: "ok", portcath: [...], admissions: [...], followup: [...], tumorboard: [...] }
```

**Get records by date:**
```
GET https://your-gas-url/exec?action=getByDate&type=portcath&date=2026-06-10&key=YOUR_KEY
→ { status: "ok", portcath: [...matching records...] }
```

**Get settings:**
```
GET https://your-gas-url/exec?action=getSettings&key=YOUR_KEY
→ { status: "ok", apiVersion: "1.0.0", ... }
```

### POST requests (used by api.js in Phase 2)

All POST requests must:
1. Use `Content-Type: text/plain` (to avoid CORS preflight)
2. Include the API key in the JSON body as `"key": "YOUR_KEY"`

**Create record:**
```json
{
  "action": "createRecord",
  "type": "portcath",
  "key": "YOUR_KEY",
  "record": { id, name, fileNumber, date, day, weight, notes },
  "displayName": "Ahmed"
}
```

**Update record:**
```json
{
  "action": "updateRecord",
  "type": "portcath",
  "key": "YOUR_KEY",
  "record": { id, name, ..., updatedAt, version, preparedBy },
  "displayName": "Ahmed"
}
```

**Delete record (soft delete):**
```json
{
  "action": "deleteRecord",
  "type": "portcath",
  "key": "YOUR_KEY",
  "id": "1748901234567",
  "displayName": "Ahmed"
}
```

**Batch sync:**
```json
{
  "action": "syncBatch",
  "type": "portcath",
  "key": "YOUR_KEY",
  "operations": [
    { "op": "create", "record": {...} },
    { "op": "update", "record": {...} }
  ],
  "displayName": "Ahmed"
}
```

---

## Security Notes

### API Key is not truly secret
The API key is stored in `window.MEDSCHED_CONFIG` in the frontend HTML, which means it's visible in the browser's network tab and source code. This is acceptable because:
1. The key is only useful if someone knows your Web app URL
2. The data is clinical (your own patient records)
3. This is a static frontend app for a small team, not a public service

If you need stronger security later, you can:
- Deploy behind a reverse proxy that strips the key
- Use Google OAuth instead of an API key
- Use a backend server that validates requests

### Audit logging
Every create/update/delete operation logs to the `AuditLog` sheet with:
- Timestamp
- Action (CREATE, UPDATE, DELETE, BATCH_*)
- Module (portcath, admissions, etc.)
- Record ID
- Display name (who performed the action)
- Before/after JSON of the record

This allows you to track all changes and debug issues.

---

## Next Steps

Once you've completed this setup and verified everything works:

1. **Phase 2** — I will create `api.js`, the frontend API client that:
   - Wraps all GAS API calls
   - Implements offline queue (for operations when internet is down)
   - Handles sync status and error states

2. **Phase 3** — I will wire up the frontend to use the new API instead of localStorage

3. Then: Calendar view, Word export, UI modernization, and full testing

---

## Quick Reference: Deployment ID Extraction

Your Web app URL looks like:
```
https://script.google.com/macros/s/AKfycbx1234567890abcdefghijklmnop/exec
```

The **deployment ID** is: `AKfycbx1234567890abcdefghijklmnop`

(Everything between `/s/` and `/exec`)

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Open the Google Apps Script editor and click **"Execution"** to see logs
3. Verify that the sheet tabs have **exact names** (case-sensitive)
4. Confirm the API key is the same in `Code.gs` and `index.html`
