# Auto-Setup Quick Reference

Since you've only created the "MedSched Data" sheet, use the auto-setup feature to create all other sheets automatically.

## Quick Start (3 steps)

### 1. Copy Code.gs into Google Apps Script

1. Go to your "MedSched Data" Google Sheet
2. Click **Extensions** → **Apps Script**
3. Delete any boilerplate code
4. Copy all code from `Code.gs` and paste it into the editor
5. Click **Save**

### 2. Deploy as Web App

1. Click **Deploy** (top-right)
2. Click **New Deployment**
3. Select type: **Web app**
4. Execute as: **(your Google account)**
5. Who has access: **Anyone**
6. Click **Deploy**
7. Copy the **Web app URL** that appears

### 3. Run Auto-Setup

1. Open this URL in your browser (replace `YOUR_DEPLOYMENT_ID` with the long alphanumeric string from your Web app URL):
   ```
   https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=setup&key=medsched-2026-key-abc123
   ```

2. You should see:
   ```json
   {"status":"ok","message":"Spreadsheet initialized"}
   ```

3. Go back to your Google Sheet and refresh. All 6 sheets are now created:
   - PortCath (with headers)
   - Admissions (with headers)
   - FollowUp (with headers)
   - TumorBoard (with headers)
   - AuditLog (with headers)
   - Settings (with headers + 2 default settings)

---

## Extract Your Deployment ID

Your Web app URL looks like:
```
https://script.google.com/macros/s/AKfycbx1234567890abcdefghijklmnop/exec
```

The deployment ID is: `AKfycbx1234567890abcdefghijklmnop`
(Everything between `/s/` and `/exec`)

---

## Test It Works

Open this URL (with your deployment ID):
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=getAll&key=medsched-2026-key-abc123
```

Expected response:
```json
{
  "status": "ok",
  "portcath": [],
  "admissions": [],
  "followup": [],
  "tumorboard": []
}
```

---

## Next: Configure Frontend

Once auto-setup completes, update `index.html` with your GAS URL:

```html
<script>
  window.MEDSCHED_CONFIG = {
    gasUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
    apiKey: 'medsched-2026-key-abc123'
  };
</script>
<script src="api.js"></script>
```

Then proceed to Phase 2.
