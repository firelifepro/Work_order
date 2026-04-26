// ─────────────────────────────────────────────────────────────────────────────
// FLIPS HISTORY — direct Sheets API writes to the Inspection History tab.
// Replaces the Apps Script proxy. Requires `accessToken` and `googleFetch`
// to already be in scope (loaded by flips-google-fetch.js).
//
// Inspection History columns (1-based):
//   A Property Name | B FLPS Acct # | C Service Address | D Inspection Type
//   E Date Completed | F Frequency | G Source | H Notes
// ─────────────────────────────────────────────────────────────────────────────

const HISTORY_SHEET_ID = '1_Koq_v0RjsFbQ_c2qZh-eQpGQT2-0IkOal-I4CjSJrI';
const HISTORY_TAB      = 'Inspection History';

// Format YYYY-MM-DD → M/D/YYYY so Sheets renders without a time component.
function _fmtHistoryDate(isoStr) {
  if (!isoStr) return '';
  const m = String(isoStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(isoStr);
  return `${parseInt(m[2])}/${parseInt(m[3])}/${m[1]}`;
}

// Resolve the Service Address from clientData (flips-shared.js) when available.
function _addressFor(propertyName) {
  if (typeof clientData !== 'object' || !clientData) return '';
  const row = clientData[propertyName];
  if (!row) return '';
  const v = row['service address'] || row['address'] || '';
  return String(v).replace(/\n/g, ', ').trim();
}

// Append one or more rows to Inspection History.
// updates: [{ propertyName, acctNum, inspectionType, dateCompleted (YYYY-MM-DD),
//             frequency, source, notes?, address? }, ...]
async function appendInspectionHistory(updates) {
  if (!updates || !updates.length) return { appended: 0 };

  const values = updates.map(u => [
    u.propertyName || '',
    u.acctNum      || '',
    u.address || _addressFor(u.propertyName),
    u.inspectionType || '',
    _fmtHistoryDate(u.dateCompleted),
    u.frequency || 'Annual',
    u.source    || '',
    u.notes     || '',
  ]);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${HISTORY_SHEET_ID}` +
              `/values/${encodeURIComponent(HISTORY_TAB)}:append` +
              `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await googleFetch(url, 'POST', { values });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`History append failed (${res.status}): ${txt.substring(0, 200)}`);
  }
  return { appended: values.length };
}

// Delete every Inspection History row matching property+type.
// Match key: acct # when both row and request have one; otherwise property name.
async function deleteInspectionHistoryEntries(acctNum, propertyName, inspectionType) {
  const targetAcct = String(acctNum || '').trim();
  const targetProp = String(propertyName || '').trim().toLowerCase();
  const targetType = String(inspectionType || '').trim().toLowerCase();
  if (!targetType || (!targetAcct && !targetProp)) {
    throw new Error('deleteInspectionHistoryEntries: need (acctNum or propertyName) and inspectionType');
  }

  // 1. Resolve the tab's numeric sheetId (needed for batchUpdate deleteDimension).
  const metaRes = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${HISTORY_SHEET_ID}?fields=sheets.properties`
  );
  if (!metaRes.ok) throw new Error('Sheet meta error ' + metaRes.status);
  const meta = await metaRes.json();
  const tab = (meta.sheets || []).find(s => s.properties?.title === HISTORY_TAB);
  if (!tab) throw new Error(`Tab "${HISTORY_TAB}" not found`);
  const tabId = tab.properties.sheetId;

  // 2. Read all values to find matching row indices.
  const valRes = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${HISTORY_SHEET_ID}` +
    `/values/${encodeURIComponent(HISTORY_TAB)}`
  );
  if (!valRes.ok) throw new Error('Sheet read error ' + valRes.status);
  const { values: rows = [] } = await valRes.json();
  if (rows.length < 2) return { deleted: 0 };

  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  const iProp = headers.findIndex(h => h.includes('property'));
  const iAcct = headers.findIndex(h => h.includes('acct'));
  const iType = headers.findIndex(h => h.includes('inspection') || h.includes('type'));
  if (iProp === -1 || iType === -1) throw new Error('Could not locate required columns in Inspection History');

  const matches = [];
  for (let i = 1; i < rows.length; i++) {
    const rowAcct = iAcct >= 0 ? String(rows[i][iAcct] || '').trim() : '';
    const rowProp = String(rows[i][iProp] || '').trim().toLowerCase();
    const rowType = String(rows[i][iType] || '').trim().toLowerCase();
    if (rowType !== targetType) continue;
    const propMatch = (targetAcct && rowAcct) ? rowAcct === targetAcct : rowProp === targetProp;
    if (propMatch) matches.push(i); // 0-based row index in the values array
  }
  if (matches.length === 0) return { deleted: 0 };

  // 3. Build deleteDimension requests in reverse order (so earlier indices stay valid).
  const requests = matches
    .sort((a, b) => b - a)
    .map(idx => ({
      deleteDimension: {
        range: {
          sheetId: tabId,
          dimension: 'ROWS',
          startIndex: idx,         // 0-based, inclusive — matches the values array index
          endIndex: idx + 1,       // exclusive
        },
      },
    }));

  const batchRes = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${HISTORY_SHEET_ID}:batchUpdate`,
    'POST',
    { requests }
  );
  if (!batchRes.ok) {
    const txt = await batchRes.text().catch(() => '');
    throw new Error(`History delete failed (${batchRes.status}): ${txt.substring(0, 200)}`);
  }
  return { deleted: matches.length };
}
