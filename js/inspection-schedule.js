// ─────────────────────────────────────────────────────────────────────────────
// INSPECTION SCHEDULE UPDATE
// Called after the inspection PDF is saved and downloaded. Posts the completed
// inspection to the Apps Script web app so the schedule sheet is kept current.
// ─────────────────────────────────────────────────────────────────────────────

// Maps activeInspectionSystem keys → inspection type names used in the schedule sheet
const INSP_SYS_TYPE_MAP = {
  'fire-alarm':         'Fire Alarm Inspection',
  'sprinkler':          'Sprinkler Inspection',
  'extinguisher':       'Extinguisher Inspection',
  'exit-sign-lighting': 'Emergency Exit Light Inspection',
  'hood':               'Hood Inspection',
  'fire-pump':          'Fire Pump Inspection',
  'backflow':           'Annual Backflow Prevention Test',
};

// Maps report-type field values → canonical frequency strings for the schedule sheet
const INSP_FREQ_MAP = {
  'annual':      'Annual',
  'semi-annual': 'Semi Annual',
  'semi annual': 'Semi Annual',
  'quarterly':   'Quarterly',
  'monthly':     'Monthly',
};

// ─────────────────────────────────────────────────────────────────────────────
// updateInspectionSchedule — non-blocking, fire-and-forget.
// data: result of collectAllData()
// ─────────────────────────────────────────────────────────────────────────────
async function updateInspectionSchedule(data) {
  const propertyName  = data.property?.name || '';
  const dateCompleted = data.inspection?.date || '';
  const sysKey        = data.inspectionSystem || activeInspectionSystem || '';

  if (!propertyName) {
    console.warn('[Schedule] No property name — skipping schedule update');
    return;
  }
  if (!dateCompleted) {
    console.warn('[Schedule] No inspection date — skipping schedule update');
    return;
  }
  if (!sysKey) {
    console.warn('[Schedule] No inspection system — skipping schedule update');
    return;
  }

  const inspectionType = INSP_SYS_TYPE_MAP[sysKey];
  if (!inspectionType) {
    console.log(`[Schedule] System "${sysKey}" is not tracked in the schedule — skipping`);
    return;
  }

  // Sprinkler has its own report-type field; all others use the main one
  const rawFreq = sysKey === 'sprinkler'
    ? (data.fieldData?.['sp-report-type'] || 'Annual').toLowerCase()
    : (data.inspection?.reportType || 'Annual').toLowerCase();
  const frequency = INSP_FREQ_MAP[rawFreq] || 'Annual';

  const updates = [{ propertyName, inspectionType, dateCompleted, frequency, source: 'Inspection' }];

  console.log(`[Schedule] Posting update → ${propertyName} | ${inspectionType} | ${frequency} | ${dateCompleted}`);

  try {
    const resp = await fetch('/api/apps-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _appsScriptUrl: APPS_SCRIPT_URL, secret: APPS_SCRIPT_SECRET, updates })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.warn('[Schedule] HTTP error', resp.status, txt.substring(0, 200));
      return;
    }

    const result = await resp.json();
    if (result.success) {
      console.log(`[Schedule] ✓ Schedule updated: ${inspectionType} for ${propertyName}`);
    } else {
      console.warn('[Schedule] Apps Script error:', result.error);
    }
  } catch(e) {
    console.warn('[Schedule] Could not reach Apps Script:', e.message);
  }
}
