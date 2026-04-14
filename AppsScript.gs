// ═══════════════════════════════════════════════════════════════════════════
// FLIPS — Inspection History + System Log
// Google Apps Script
//
// SETUP ORDER (run each function once from the Apps Script editor):
//   1. upgradeHistoryTab      — adds FLPS Acct # column to existing tab
//                               (or run setupHistoryTab if starting fresh)
//   2. setSecret              — stores the shared secret
//   3. migrateFromScheduleTab — ONE-TIME: copies old "Inspection Schedule"
//                               rows with dates → Inspection History as
//                               source = "Work Order"
//   4. Deploy → Manage Deployments → update your existing deployment
//      (or New Deployment if first time: Web App, Execute as Me, Anyone)
//
// The old "Inspection Schedule" tab and onEdit trigger are no longer used.
// You can hide/delete that tab once migration is confirmed.
// ═══════════════════════════════════════════════════════════════════════════

// ── Tab / sheet names ───────────────────────────────────────────────────────
const HISTORY_TAB    = 'Inspection History';
const CLIENT_TAB     = 'Client List';
const LOG_SHEET_NAME = 'FLPS software system log';
const LOG_FOLDER_NAME = 'FLPS Software Files';

// ── Inspection History column positions (1-based) ───────────────────────────
const H_PROP   = 1;  // A - Property Name
const H_ACCT   = 2;  // B - FLPS Acct #
const H_ADDR   = 3;  // C - Service Address
const H_TYPE   = 4;  // D - Inspection Type
const H_DATE   = 5;  // E - Date Completed
const H_FREQ   = 6;  // F - Frequency
const H_SOURCE = 7;  // G - Source
const H_NOTES  = 8;  // H - Notes

// ── Log verbosity ────────────────────────────────────────────────────────────
const LOG_LEVEL_DEFAULT = 'NORMAL';

function getLogLevel() {
  try {
    return PropertiesService.getScriptProperties().getProperty('LOG_LEVEL') || LOG_LEVEL_DEFAULT;
  } catch(_) { return LOG_LEVEL_DEFAULT; }
}

function maybeLog(source, action, detail, status, error) {
  const level = getLogLevel();
  const s = String(status || 'INFO').toUpperCase();
  if (level !== 'VERBOSE' && s === 'INFO') return;
  writeLog(source, action, detail, status, error);
}

// ── Date helper ──────────────────────────────────────────────────────────────
// Parses "YYYY-MM-DD" (from work order/inspection pages) as local noon to
// avoid UTC-midnight timezone shift on display.
function parseDateMT(isoStr) {
  if (!isoStr) return null;
  const parts = String(isoStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return new Date(isoStr);
  return new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]), 12, 0, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM LOG
// ═══════════════════════════════════════════════════════════════════════════
function getOrCreateLogSheet() {
  const folders = DriveApp.getFoldersByName(LOG_FOLDER_NAME);
  if (folders.hasNext()) {
    const folder = folders.next();
    const files = folder.getFilesByName(LOG_SHEET_NAME);
    if (files.hasNext()) {
      return SpreadsheetApp.openById(files.next().getId()).getSheets()[0];
    }
  }
  const allFiles = DriveApp.getFilesByName(LOG_SHEET_NAME);
  if (allFiles.hasNext()) {
    return SpreadsheetApp.openById(allFiles.next().getId()).getSheets()[0];
  }
  const ss    = SpreadsheetApp.create(LOG_SHEET_NAME);
  const sheet = ss.getSheets()[0];
  sheet.setName('Log');
  const headers = ['Timestamp', 'Source', 'Action', 'Detail', 'Status', 'Error'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const hr = sheet.getRange(1, 1, 1, headers.length);
  hr.setBackground('#1c4587'); hr.setFontColor('#ffffff'); hr.setFontWeight('bold');
  sheet.setColumnWidth(1, 165); sheet.setColumnWidth(2, 140); sheet.setColumnWidth(3, 190);
  sheet.setColumnWidth(4, 400); sheet.setColumnWidth(5, 90);  sheet.setColumnWidth(6, 300);
  sheet.setFrozenRows(1);
  const newFile = DriveApp.getFileById(ss.getId());
  const destFolders = DriveApp.getFoldersByName(LOG_FOLDER_NAME);
  if (destFolders.hasNext()) {
    const dest = destFolders.next();
    dest.addFile(newFile);
    DriveApp.getRootFolder().removeFile(newFile);
  }
  return sheet;
}

function writeLog(source, action, detail, status, error) {
  try {
    const sheet = getOrCreateLogSheet();
    const tz    = Session.getScriptTimeZone();
    const ts    = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([ts, source || '', action || '', detail || '', status || '', error || '']);
    const row = sheet.getLastRow();
    const statusCell = sheet.getRange(row, 5);
    const s = String(status || '').toUpperCase();
    if      (s === 'OK')      { statusCell.setBackground('#d9ead3'); statusCell.setFontColor('#274e13'); }
    else if (s === 'ERROR')   { statusCell.setBackground('#f4cccc'); statusCell.setFontColor('#cc0000'); }
    else if (s === 'WARN')    { statusCell.setBackground('#fce8b2'); statusCell.setFontColor('#7f4f00'); }
    else if (s === 'SKIPPED') { statusCell.setBackground('#efefef'); statusCell.setFontColor('#666666'); }
  } catch(e) {
    Logger.log('writeLog ERROR: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// doGet — health check
// ═══════════════════════════════════════════════════════════════════════════
function doGet(e) {
  writeLog('doGet', 'HEALTH_CHECK', 'GET request received — connectivity OK', 'OK', '');
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'FLIPS Apps Script is running', time: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════════════════
// doPost — main endpoint
// ═══════════════════════════════════════════════════════════════════════════
function doPost(e) {
  const rawBody = e?.postData?.contents || '(empty)';
  maybeLog('doPost', 'REQUEST_RECEIVED',
    'Body length: ' + rawBody.length + ' | First 120: ' + rawBody.substring(0, 120), 'INFO', '');

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch(parseErr) {
    writeLog('doPost', 'PARSE_ERROR', rawBody.substring(0, 200), 'ERROR', parseErr.message);
    return jsonOut({ success: false, error: 'JSON parse failed: ' + parseErr.message });
  }

  const storedSecret = PropertiesService.getScriptProperties().getProperty('FLIPS_SECRET');
  if (!storedSecret) {
    writeLog('doPost', 'AUTH_ERROR', 'FLIPS_SECRET not set — run setSecret()', 'ERROR', '');
    return jsonOut({ success: false, error: 'Server misconfiguration: secret not set. Run setSecret().' });
  }
  if (payload.secret !== storedSecret) {
    writeLog('doPost', 'AUTH_FAILED', 'Secret mismatch', 'ERROR', 'Unauthorized');
    return jsonOut({ success: false, error: 'Unauthorized — secret mismatch' });
  }

  const action = payload.action || 'update_inspection';
  maybeLog('doPost', 'AUTH_OK', 'Action: ' + action, 'INFO', '');

  // ── Log-only ping ─────────────────────────────────────────────────────────
  if (action === 'log') {
    const lg = payload.log || {};
    writeLog(lg.source || 'html', lg.action || 'LOG', lg.detail || '', lg.status || 'INFO', lg.error || '');
    return jsonOut({ success: true, logged: true });
  }

  // ── Append inspection completions to History tab ──────────────────────────
  if (action === 'update_inspection' || action === 'update') {
    const updates = payload.updates || [];
    if (updates.length === 0) {
      writeLog('doPost', 'NO_UPDATES', 'Payload had 0 updates', 'WARN', '');
    }
    const results = [];
    for (const u of updates) {
      try {
        const r = appendInspectionHistory(
          u.propertyName, u.acctNum, u.inspectionType, u.dateCompleted,
          u.frequency, u.source, u.notes
        );
        writeLog('doPost', r.success ? 'HISTORY_APPENDED' : 'HISTORY_FAIL',
          `"${u.propertyName}" | acct: ${u.acctNum || '(none)'} | "${u.inspectionType}" | ${u.dateCompleted} | source: ${u.source || ''}`,
          r.success ? 'OK' : 'ERROR', r.error || '');
        if (!u.acctNum) {
          writeLog('doPost', 'MISSING_ACCT',
            `No FLPS Acct # for "${u.propertyName}" — property may be missing acct # in Client List`,
            'WARN', '');
        }
        results.push(r);
      } catch(err) {
        writeLog('doPost', 'UPDATE_EXCEPTION',
          `"${u.propertyName}" | "${u.inspectionType}"`, 'ERROR', err.message);
        results.push({ success: false, error: err.message });
      }
    }
    writeLog('doPost', 'REQUEST_DONE', 'Processed ' + results.length + ' update(s)', 'OK', '');
    return jsonOut({ success: true, results });
  }

  // ── One-time migration ────────────────────────────────────────────────────
  if (action === 'migrate_schedule') {
    try {
      const result = migrateFromScheduleTab();
      writeLog('doPost', 'MIGRATION_DONE',
        `Migrated: ${result.migrated} | Skipped: ${result.skipped}`, 'OK', '');
      return jsonOut({ success: true, migrated: result.migrated, skipped: result.skipped });
    } catch(err) {
      writeLog('doPost', 'MIGRATION_ERROR', '', 'ERROR', err.message);
      return jsonOut({ success: false, error: err.message });
    }
  }

  writeLog('doPost', 'UNKNOWN_ACTION', 'action = "' + action + '"', 'WARN', '');
  return jsonOut({ success: false, error: 'Unknown action: ' + action });
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════════════════════
// APPEND TO INSPECTION HISTORY
// Core write function — all sources (Work Order, Inspection, Manual) use this.
// acctNum is the FLPS Acct # — used as the stable match key in schedule.html.
// ═══════════════════════════════════════════════════════════════════════════
function appendInspectionHistory(propertyName, acctNum, inspectionType, dateCompleted, frequency, source, notes) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HISTORY_TAB);
  if (!sheet) {
    return { success: false, error: 'Inspection History tab not found — run setupHistoryTab() first' };
  }
  const address = getAddressForProperty(propertyName);
  const dateVal = parseDateMT(dateCompleted);
  sheet.appendRow([
    propertyName,
    acctNum      || '',
    address,
    inspectionType,
    dateVal,
    frequency    || 'Annual',
    source       || '',
    notes        || '',
  ]);
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════
function setupHistoryTab() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(HISTORY_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(HISTORY_TAB);
    Logger.log('Created tab: ' + HISTORY_TAB);
  }
  if (!sheet.getRange('A1').getValue()) {
    const headers = ['Property Name', 'FLPS Acct #', 'Service Address', 'Inspection Type',
                     'Date Completed', 'Frequency', 'Source', 'Notes'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    const hr = sheet.getRange(1, 1, 1, headers.length);
    hr.setBackground('#2e6da4'); hr.setFontColor('#ffffff'); hr.setFontWeight('bold');
    sheet.setColumnWidth(1, 200); sheet.setColumnWidth(2, 90);  sheet.setColumnWidth(3, 190);
    sheet.setColumnWidth(4, 220); sheet.setColumnWidth(5, 120); sheet.setColumnWidth(6, 100);
    sheet.setColumnWidth(7, 110); sheet.setColumnWidth(8, 200);
    sheet.setFrozenRows(1);
    Logger.log('Headers written.');
  } else {
    Logger.log('Tab already has data — headers not overwritten. Run upgradeHistoryTab() to add Acct # column.');
  }
  Logger.log('setupHistoryTab complete.');
}

// ── One-time upgrade: inserts FLPS Acct # column into an existing tab ───────
// Safe to run when the tab has only the header row (no data rows).
// If data rows exist, it inserts the column and back-fills acct # from Client List.
function upgradeHistoryTab() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HISTORY_TAB);
  if (!sheet) { Logger.log('Inspection History tab not found — run setupHistoryTab() first.'); return; }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());

  // Already upgraded?
  if (headers.some(h => h.toLowerCase().includes('acct'))) {
    Logger.log('FLPS Acct # column already present — nothing to do.');
    return;
  }

  // Insert a column after column A (Property Name) → becomes column B
  sheet.insertColumnAfter(1);
  sheet.getRange(1, H_ACCT).setValue('FLPS Acct #');
  const hr = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  hr.setBackground('#2e6da4'); hr.setFontColor('#ffffff'); hr.setFontWeight('bold');
  sheet.setColumnWidth(H_ACCT, 90);

  // Back-fill acct # from Client List for any existing data rows
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const propCol  = sheet.getRange(2, H_PROP, lastRow - 1, 1).getValues();
    const acctVals = propCol.map(([prop]) => [getAcctForProperty(String(prop || '').trim())]);
    sheet.getRange(2, H_ACCT, lastRow - 1, 1).setValues(acctVals);
    Logger.log('Back-filled acct # for ' + (lastRow - 1) + ' data row(s).');
  }

  Logger.log('upgradeHistoryTab complete.');
}

// ═══════════════════════════════════════════════════════════════════════════
// ONE-TIME MIGRATION
// Reads the old "Inspection Schedule" tab and copies every row that has a
// Last Done date into Inspection History with source = "Work Order".
// Safe to run multiple times — you can clear the History tab and re-run if needed.
// ═══════════════════════════════════════════════════════════════════════════
function migrateFromScheduleTab() {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const oldSheet = ss.getSheetByName('Inspection Schedule');
  const histSheet = ss.getSheetByName(HISTORY_TAB);

  if (!oldSheet)  { Logger.log('No "Inspection Schedule" tab found — nothing to migrate.'); return { migrated: 0, skipped: 0 }; }
  if (!histSheet) { Logger.log('Run setupHistoryTab() first.'); throw new Error('Inspection History tab not found'); }

  const data    = oldSheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const iProp   = headers.findIndex(h => h.includes('property'));
  const iAddr   = headers.findIndex(h => h.includes('address'));
  const iType   = headers.findIndex(h => h.includes('inspection'));
  const iFreq   = headers.findIndex(h => h.includes('freq'));
  const iLast   = headers.findIndex(h => h.includes('last'));

  if (iProp === -1 || iType === -1 || iLast === -1) {
    throw new Error('Could not find expected columns in Inspection Schedule tab');
  }

  let migrated = 0, skipped = 0;
  const newRows = [];
  for (let i = 1; i < data.length; i++) {
    const lastVal = data[i][iLast];
    // Skip rows with no Last Done date
    if (!lastVal || (lastVal instanceof Date && isNaN(lastVal.getTime()))) { skipped++; continue; }
    const prop = String(data[i][iProp] || '').trim();
    const type = String(data[i][iType] || '').trim();
    if (!prop || !type) { skipped++; continue; }
    const addr   = iAddr >= 0 ? String(data[i][iAddr] || '').trim() : '';
    const freq   = iFreq >= 0 ? String(data[i][iFreq] || 'Annual').trim() : 'Annual';
    const acct   = getAcctForProperty(prop);
    const dateVal = (lastVal instanceof Date) ? lastVal : parseDateMT(String(lastVal));
    newRows.push([prop, acct, addr, type, dateVal, freq, 'Work Order', '']);
    migrated++;
  }

  if (newRows.length > 0) {
    histSheet.getRange(histSheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }

  Logger.log('Migration complete. Migrated: ' + migrated + ' | Skipped: ' + skipped);
  return { migrated, skipped };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
// Returns [address, acctNum] for a property — single sheet read, used by both helpers below.
function _getClientRow(propName) {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const clientSheet = ss.getSheetByName(CLIENT_TAB);
  if (!clientSheet) return {};
  const data    = clientSheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const propCol = headers.indexOf('Property Name');
  if (propCol === -1) return {};
  const addrCol = headers.findIndex(h => h === 'Service Address');
  const acctCol = headers.findIndex(h => h.toLowerCase().includes('acct') || h.toLowerCase().includes('account number'));
  const name = propName.trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][propCol] || '').trim().toLowerCase() === name) {
      return {
        address: addrCol >= 0 ? String(data[i][addrCol] || '').replace(/\n/g, ', ').trim() : '',
        acct:    acctCol >= 0 ? String(data[i][acctCol] || '').trim() : '',
      };
    }
  }
  return {};
}

function getAddressForProperty(propName) {
  return _getClientRow(propName).address || '';
}

function getAcctForProperty(propName) {
  return _getClientRow(propName).acct || '';
}

// ── Back-fill acct # into existing History rows that have none ───────────────
// Run this once manually from the Apps Script editor after migration.
// Matches History rows to Client List by property name (case-insensitive,
// trimmed). Logs any property names it couldn't match so you can fix them.
function backfillAcctNumbers() {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const histSheet   = ss.getSheetByName(HISTORY_TAB);
  const clientSheet = ss.getSheetByName(CLIENT_TAB);
  if (!histSheet)   { Logger.log('Inspection History tab not found.'); return; }
  if (!clientSheet) { Logger.log('Client List tab not found.'); return; }

  // Build acct lookup from Client List: lowercase property name → acct #
  const clientData    = clientSheet.getDataRange().getValues();
  const clientHeaders = clientData[0].map(h => String(h).trim());
  const cPropCol = clientHeaders.indexOf('Property Name');
  const cAcctCol = clientHeaders.findIndex(h => h.toLowerCase().includes('acct') || h.toLowerCase().includes('account number'));

  if (cPropCol === -1) { Logger.log('ERROR: "Property Name" column not found in Client List.'); return; }
  if (cAcctCol === -1) { Logger.log('ERROR: No acct column found in Client List (looking for header containing "acct" or "account number").'); return; }

  const acctByName = {};
  for (let i = 1; i < clientData.length; i++) {
    const name = String(clientData[i][cPropCol] || '').trim().toLowerCase();
    const acct = String(clientData[i][cAcctCol] || '').trim();
    if (name && acct) acctByName[name] = acct;
  }
  Logger.log('Client List loaded: ' + Object.keys(acctByName).length + ' properties with acct #.');

  // Read History tab
  const histData    = histSheet.getDataRange().getValues();
  const histHeaders = histData[0].map(h => String(h).trim().toLowerCase());
  const hPropIdx = histHeaders.findIndex(h => h.includes('property'));
  const hAcctIdx = histHeaders.findIndex(h => h.includes('acct'));

  if (hPropIdx === -1) { Logger.log('ERROR: No property column found in Inspection History.'); return; }
  if (hAcctIdx === -1) { Logger.log('ERROR: No acct column found in Inspection History. Run upgradeHistoryTab() first.'); return; }

  let filled = 0, alreadySet = 0, noMatch = [];
  for (let i = 1; i < histData.length; i++) {
    const currentAcct = String(histData[i][hAcctIdx] || '').trim();
    if (currentAcct) { alreadySet++; continue; }

    const propName = String(histData[i][hPropIdx] || '').trim();
    if (!propName) continue;

    const acct = acctByName[propName.toLowerCase()];
    if (acct) {
      histSheet.getRange(i + 1, hAcctIdx + 1).setValue(acct);
      filled++;
    } else {
      if (!noMatch.includes(propName)) noMatch.push(propName);
    }
  }

  Logger.log('Done. Filled: ' + filled + ' | Already had acct#: ' + alreadySet + ' | No match: ' + noMatch.length);
  if (noMatch.length > 0) {
    Logger.log('Properties with no Client List match (check spelling/case):');
    noMatch.forEach(n => Logger.log('  · ' + n));
  }
}

function setSecret() {
  PropertiesService.getScriptProperties().setProperty('FLIPS_SECRET', 'flips-2026-secret');
  Logger.log('Secret set to: flips-2026-secret');
}

function testLog() {
  writeLog('testLog', 'MANUAL_TEST', 'If you see this row the log sheet is working correctly', 'OK', '');
  Logger.log('Done — check "' + LOG_FOLDER_NAME + '" folder for "' + LOG_SHEET_NAME + '"');
}
