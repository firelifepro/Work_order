# FLIPS — Fire Life Protection Systems Field App

## What this is
Plain HTML/JS field service management app for a commercial fire inspection company. No build step, no framework. Hosted on Cloudflare Workers at `https://workorder.firelifepro.workers.dev/`.

## Deploy
```bash
npx wrangler deploy
```
Deploys the entire directory as static assets plus the `_worker.js` API routes. Files listed in `.assetsignore` are excluded from the public deploy (e.g. `_worker.js`, `AppsScript.gs`, `CLAUDE.md`, `README.md`, abandoned test files). Cloudflare caches aggressively — users may need to hard-refresh (Cmd+Shift+R) after a deploy if they have the page open.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Work order creation — the main form |
| `schedule.html` | Inspection schedule tracker (next-due dates, overdue alerts) |
| `estimate.html` | Estimate builder — PDF + Drive + Gmail draft |
| `estimate-tracker.html` | List/manage estimates, convert to work order |
| `clients.html` | Client list + QuickBooks reconciliation |
| `create-invoices.html` | Create QB invoices from Drive work order PDFs |
| `inspection.html` | iPad fire inspection report (4-step wizard, PDF) |
| `hospital-inspection.html` | Variant inspection form for hospital properties |
| `worklog.html` | Work log / time tracking |
| `js/flips-google-fetch.js` | **Canonical fetch helpers** — `apiFetch`, `googleFetch`, `refreshAccessToken`. Loaded by every page. Single source of truth for the 401-retry / token-refresh path. |
| `js/flips-shared.js` | Shared auth (`initGoogle`), property loading (`loadSheet`), expense calcs, dynamic row helpers, Drive utilities. Used by `index.html`, `estimate.html`, `estimate-tracker.html`. |
| `js/flips-history.js` | Inspection History writes — `appendInspectionHistory`, `deleteInspectionHistoryEntries`. Direct Sheets API calls (no Apps Script). Used by `index.html`, `schedule.html`, `inspection.html`, `hospital-inspection.html`. |
| `js/inspection-google.js` | Auth + sheet loader specific to `inspection.html` and `hospital-inspection.html` (has its own proactive token refresh). |
| `js/inspection-*.js` | Other inspection page modules (main, pdf, panels, nav, etc.) |
| `_worker.js` | Cloudflare Worker — API proxy routes for QuickBooks OAuth only. Same-origin lock on `/api/*` (cross-origin returns 403). |
| `.assetsignore` | Files in this list are NOT served publicly by Cloudflare. Add anything sensitive here. |

---

## Architecture

### Shared JS — two-tier model

There are two shared JS files. They serve different scopes:

- **`js/flips-google-fetch.js`** — fetch helpers ONLY (`apiFetch`, `googleFetch`, `refreshAccessToken`). Every page loads it. Depends on `accessToken` and `tokenClient` already being declared in script scope (either by `flips-shared.js` or by the page's inline script).
- **`js/flips-shared.js`** — full auth/connect flow (`initGoogle`), property dropdown, expense calcs, dynamic row helpers. Loaded by `index.html`, `estimate.html`, `estimate-tracker.html`. Other pages have their own `initGoogle` and just load `flips-google-fetch.js`.

#### Pages using `flips-shared.js` (full auth integration)
```html
<script src="https://accounts.google.com/gsi/client"></script>
<script src="js/flips-shared.js"></script>
<script src="js/flips-google-fetch.js"></script>
<script> /* page-specific code */ </script>
```
Each page must define `const SCOPES = '...'` in its own `<script>` **before** flips-shared.js loads.

**Extension hooks** — define these in your page script and shared will call them automatically:
- `onAfterAuth()` — called after OAuth token is obtained and `loadSheet()` completes
- `onPropertySelectExtras(d)` — called at the end of `onPropertySelect()` with the row data object

**Globals declared by `flips-shared.js`** (accessible everywhere on those pages):
- `accessToken` — current OAuth Bearer token
- `tokenClient` — GIS TokenClient instance
- `clientData` — `{ [propertyName]: { [lowercasedHeader]: value } }` — loaded from the property list sheet
- `API_KEY_VAL` — Google API key

#### Pages with their own `initGoogle` (auth done inline)
`clients.html`, `schedule.html`, `worklog.html`, `create-invoices.html` — each declares its own `let accessToken; let tokenClient;` in an inline `<script>` and just loads:
```html
<script src="https://accounts.google.com/gsi/client"></script>
<script src="js/flips-google-fetch.js"></script>
<script> /* inline initGoogle, page-specific code */ </script>
```
The fetch helpers in `flips-google-fetch.js` resolve `accessToken`/`tokenClient` at call time via shared script scope, so the helper file works in both setups.

#### Inspection pages (separate subsystem)
`inspection.html` and `hospital-inspection.html` use `js/inspection-google.js` which has its own `googleFetch` plus a unique `_scheduleTokenRefresh()` that proactively refreshes 5 min before expiry. They do NOT load `flips-google-fetch.js`.

### Auth flow
1. User enters API Key + Client ID → `initGoogle()` → GIS OAuth popup → token stored in `localStorage` (55 min TTL)
2. On page load, if stored token is still valid, `loadSheet()` runs automatically — no popup
3. `loadSheet()` checks `sessionStorage` (key: `flips_client_cache`, 30-min TTL) before hitting the Sheets API
4. **If properties stop populating after a deploy: click ↺ Refresh Properties** to force-bypass the session cache. This is the fix for stale cache after code changes.

### Session / local storage keys
| Key | Storage | Purpose |
|---|---|---|
| `flips_api_key` | localStorage | Google API key |
| `flips_client_id` | localStorage | Google OAuth Client ID |
| `flips_access_token` | localStorage | OAuth access token |
| `flips_token_expiry` | localStorage | Token expiry timestamp |
| `flips_client_cache` | sessionStorage | Property list cache (30 min) |
| `flips_pending_estimate` | localStorage | Estimate→WO pre-fill bridge |

---

## Key Constants

### Google Sheets
- **Property list sheet**: `SHEET_ID = '1_Koq_v0RjsFbQ_c2qZh-eQpGQT2-0IkOal-I4CjSJrI'`, `SHEET_GID = '1899870347'` — defined in `flips-shared.js`
- **Work Requests / WO log sheet**: `WR_SHEET_ID = '1-DBErY57b1Avl6UHvuaZeYKkWlyEOLhrNBz6Cozvaik'` — in `estimate.html` and `index.html` (collectForm → createDoc)
- **Inspection History tab**: Same `SHEET_ID` as the property list, tab name `'Inspection History'`. Columns A–H: Property Name, FLPS Acct #, Service Address, Inspection Type, Date Completed, Frequency, Source, Notes. Append-only — schedule.html groups rows and keeps the most recent per (property+type). Read by `schedule.html`, written by `js/flips-history.js`.

### Google Drive
- **Estimate folder**: `EST_FOLDER_ID = '1Ma-hUFL3t4l6NsWdmPRB45JJMaaK1Oc1'` — estimates saved as `FLPS_EST_*.json` and `FLPS_EST_*.pdf`
- **WO folders**: Named folders ("2 - Ready to Invoice", "3 - Invoice Sent") — `create-invoices.html` finds them by name via Drive API
- **Work order template Google Doc**: `TEMPLATE_DOC_ID = '1x96eu74Jlo-8mz8Ztah2noGc7SY-HvX1CQNQ6Vl07Sc'` — in `index.html`

---

## Cloudflare Environment Variables
Set in Cloudflare dashboard → Worker → Settings → Variables:
- `QB_CLIENT_ID` / `QB_CLIENT_SECRET` — QuickBooks sandbox OAuth
- `QB_CLIENT_ID_PROD` / `QB_CLIENT_SECRET_PROD` — QuickBooks production OAuth

---

## Patterns & Conventions

### Adding a new page
1. Define `const SCOPES = '...'` at the top of the page's inline `<script>`
2. Load `js/flips-shared.js` (for full auth integration) AND `js/flips-google-fetch.js` after the GIS script tag
3. Call `initGoogle()` from your connect button
4. Optionally define `onAfterAuth()` and `onPropertySelectExtras(d)` hooks
5. Add nav links to all other pages

### Google API calls
Use `googleFetch(url, method, body)` or its alias `apiFetch(url, method, body)` from `js/flips-google-fetch.js`. Both share the same implementation — it handles `Authorization: Bearer` headers and a single-flight 401 retry that refreshes the token via `tokenClient.requestAccessToken({ prompt: '' })`. Concurrent 401s share one refresh promise, so parallel calls won't fight over the token client's callback.

Defaults: `method='GET'`, `body=null`. `Content-Type: application/json` is only set when `body !== null`. For binary downloads (Drive `?alt=media`), pass no body — the helper returns the raw `Response` for you to call `.text()`/`.blob()` on.

### `_worker.js` API routes
- `/api/qb-token` — QB OAuth2 token exchange (uses `QB_CLIENT_ID*` env vars)
- `/api/qb-api` — QB API proxy (forwards `access_token` + `realm_id` from request)

**Origin lock**: every `/api/*` route checks the `Origin` header. Same-origin (browser at the deployed Worker URL) and no-Origin (server-to-server) requests pass; cross-origin requests get 403. Don't try to call these endpoints from a different domain — the lock is intentional.

### Inspection history writes
`appendInspectionHistory(updates)` in `js/flips-history.js` appends rows to the Inspection History tab via the Sheets `:append` endpoint. `deleteInspectionHistoryEntries(acctNum, propertyName, type)` reads the tab, finds matching rows, and issues a `:batchUpdate` with `deleteDimension` requests in reverse order. Both require write scope on Sheets — pages that call them must include `https://www.googleapis.com/auth/spreadsheets` (not `.readonly`) in their `SCOPES`.

### Drive file upload
`driveUploadFile(name, mimeType, content, folderId, existingFileId, isBase64)`:
- Pass `existingFileId` to update (PATCH), `null` to create (POST)
- Pass `isBase64=true` for binary (PDF) content
- Pass `name=null` on PATCH to preserve the existing filename

### Schedule update behavior
- The latest date always wins regardless of source — work order, inspection report, or manual pencil edit all compete equally on date.

### Estimate → Work Order flow
`estimate-tracker.html` writes `est` JSON to `localStorage.flips_pending_estimate` then navigates to `index.html`. On load, `index.html` calls `checkPendingEstimate()` which shows a banner. Clicking "Load Estimate" calls `loadFromEstimate()` to pre-fill the form.

### PDF generation
- Work orders: Google Docs template copy via Drive API (server-side rendering)
- Estimates: jsPDF (cdnjs 2.5.1 UMD) — client-side generation
- Inspection reports: jsPDF — client-side generation

### QuickBooks
API calls proxied through `_worker.js` at `/api/qb-api` to keep client secrets off the client. See `clients.html` and `create-invoices.html` for QB customer matching and invoice creation logic.
