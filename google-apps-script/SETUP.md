# MedSched — Apps Script setup (v2)

The app talks to one Google Sheet through an Apps Script web app (`Code.gs` in this folder).
The new script uses the **same sheets and columns** as before, so no data moves.

The app also works with the old script, but the new one is faster and safer:
one request per save, a lock so two people can't overwrite each other, dates
that don't shift by a day, and file/phone numbers that keep their leading zeros.

## Update the existing script (keeps the same link)

1. Open the Google Sheet → **Extensions → Apps Script**.
2. Select everything in `Code.gs`, delete it, and paste the contents of `google-apps-script/Code.gs` from this repository.
   Keep the access key at the top (`VALID_API_KEYS`) the same as before.
3. Click **Save**.
4. **Deploy → Manage deployments** → pick the active deployment → ✏️ **Edit** →
   **Version: New version** → **Deploy**.
   Editing the existing deployment keeps the same `/exec` link, so the app needs no change.
5. Open the app → **Settings → Google Sheet**. The chip should say **Connected · new script**.

The first save after deploying adds two columns at the end of the `PortCath` sheet
(`doneAt`, `outcomeNote`) for the “Port done” confirmation. Nothing else changes.

## Fresh start (new sheet)

1. Create a blank Google Sheet, then **Extensions → Apps Script**, paste `Code.gs`, save.
2. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access* **Anyone**.
3. Open `YOUR_EXEC_LINK?action=setup&key=YOUR_KEY` once to create the tabs.
4. Paste the link in the app under **Settings → Google Sheet**.

## Sheets

| Tab | What it holds |
|---|---|
| `PortCath` | Port cath patients: booking date, status (`waiting`, `confirmed`, `done`, `cancelled`), `doneAt` |
| `PortCathSessionConfig` | Which days are port cath session days |
| `PortCathHistory` | Every move, cancellation and outcome (append-only) |
| `Admissions` | Planned admissions |
| `FollowUp` | WhatsApp & call follow-ups |
| `TumorBoard` | Tumor board patients; `tasks` is a JSON list |
| `ClinicAppointments` | Clinic appointments by doctor |
| `AuditLog` | Who changed what and when (phone numbers are left out) |
| `Settings` | Shared settings such as clinic doctor colours |

Rows are never removed: deleting sets `deletedAt`, and the app hides those rows.

## API (for reference)

- `GET ?action=getAll&key=…` → every list plus `settings`, `version: 2`.
- `POST {action:'applyBatch', key, displayName, ops:[{op:'upsert'|'delete', type, record|id}]}` →
  `{status:'ok', applied}`. Upserts only write the fields that were sent.
- v1 actions (`createRecord`, `updateRecord`, `deleteRecord`, `syncBatch`, `clearType`, `writeSetting`) still work.
