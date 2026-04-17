// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL INSPECTION — DEFICIENCY TRACKING
// Enhanced deficiency rebuild that aggregates from all hospital data sources:
//   1. Sprinkler checklist (Y/N/NA rows marked N with notes)
//   2. Device detail sheets (any row where a PASS/FAIL select = 'FAIL')
//   3. Pre/Post inspection checklist ('NO' answers)
//   4. Explicit h-defic-tbody manual entries
// SP_CHECKLIST, SP_DRY_ITEMS, SP_5YR_ITEMS are runtime refs — defined in
// hospital inline script which loads after this file, so they're available
// by the time any function here is actually called.
// ─────────────────────────────────────────────────────────────────────────────

// TJC/CMS severity labels used in the deficiency table severity select
const HOSP_SEV_OPTS = ['', 'Life Safety', 'Critical', 'Non Critical'];

// Device sheet keys → display labels for deficiency descriptions
const HOSP_DEVICE_SHEETS = [
  { key: 'supervisory',   label: 'Supervisory Signal' },
  { key: 'flow',         label: 'Flow/Pressure Switch' },
  { key: 'tamper',       label: 'Tamper Switch' },
  { key: 'smoke',        label: 'Smoke Detector' },
  { key: 'heat',         label: 'Heat Detector' },
  { key: 'pull',         label: 'Pull Station' },
  { key: 'duct',         label: 'Duct Detector' },
  { key: 'av',           label: 'Audio/Visual' },
  { key: 'door-release', label: 'Door Release Device' },
  { key: 'offprem',      label: 'Off-Premise Monitoring' },
  { key: 'subpanel',     label: 'Sub Panel' },
  { key: 'annunciator',  label: 'Annunciator' },
  { key: 'ahu',          label: 'AHU Shutdown' },
  { key: 'fdc',          label: 'FDC' },
  { key: 'hose-valve',   label: 'Hose Valve' },
  { key: 'standpipe',    label: 'Standpipe' },
  { key: 'valves',       label: 'Sprinkler Valve' },
  { key: 'gauges',       label: 'Sprinkler Gauge' },
  { key: 'hydraulic',    label: 'Hydraulic Plate' },
];

// ─────────────────────────────────────────────────────────────────────────────
// rebuildHospDeficList
// Aggregates all deficiencies from every source and updates the banner/count.
// Called on step navigation to 'defic' and on any FAIL select change.
// ─────────────────────────────────────────────────────────────────────────────
function rebuildHospDeficList() {
  const list = []; // [{text, source}]

  // ── 1. Sprinkler checklist N answers ──────────────────────────────────────
  const allSpItems = [
    ...(typeof SP_CHECKLIST  !== 'undefined' ? Object.values(SP_CHECKLIST).flat() : []),
    ...(typeof SP_DRY_ITEMS  !== 'undefined' ? SP_DRY_ITEMS  : []),
    ...(typeof SP_5YR_ITEMS  !== 'undefined' ? SP_5YR_ITEMS  : []),
  ];
  allSpItems.forEach(item => {
    const rowEl  = document.querySelector(`[data-id="${item.id}"]`);
    if (!rowEl || rowEl.dataset.val !== 'N') return;
    const noteEl = document.getElementById('sp-defic-note-' + item.id);
    const text   = noteEl?.value?.trim() || item.label;
    list.push({ text, source: 'Sprinkler' });
  });

  // ── 2. Device detail sheets — scan for FAIL selects ──────────────────────
  HOSP_DEVICE_SHEETS.forEach(({ key, label }) => {
    const tbody = document.getElementById('h-' + key + '-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(row => {
      const hasFail = Array.from(row.querySelectorAll('select'))
        .some(s => s.value === 'FAIL');
      if (!hasFail) return;
      // Use first text input as location, last text input as note
      const inputs   = Array.from(row.querySelectorAll('input[type="text"]'));
      const loc      = inputs[0]?.value?.trim() || '';
      const note     = inputs[inputs.length - 1]?.value?.trim() || '';
      const desc     = label + (loc ? ' — ' + loc : '') + (note ? ': ' + note : '');
      list.push({ text: desc, source: label });
    });
  });

  // ── 3. Pre/Post checklist NO answers ─────────────────────────────────────
  const chkItems = [
    ...(typeof PRE_CHECKLIST_ITEMS  !== 'undefined' ? PRE_CHECKLIST_ITEMS  : []),
    ...(typeof POST_CHECKLIST_ITEMS !== 'undefined' ? POST_CHECKLIST_ITEMS : []),
  ];
  chkItems.forEach(item => {
    const hidden = document.getElementById(item.id);
    if (hidden && hidden.value === 'NO') {
      list.push({ text: item.label, source: 'Pre/Post Checklist' });
    }
  });

  // ── 4. Explicit manual deficiency table entries ───────────────────────────
  document.querySelectorAll('#h-defic-tbody tr td:nth-child(2) input').forEach(inp => {
    if (inp.value.trim()) list.push({ text: inp.value.trim(), source: 'Manual' });
  });

  // ── Update DOM ────────────────────────────────────────────────────────────
  const pill   = document.getElementById('h-defic-count-pill');
  const listEl = document.getElementById('h-defic-list');
  const banner = document.getElementById('h-defic-summary');

  if (pill)   pill.textContent = list.length;
  if (listEl) listEl.innerHTML = list.map(d =>
    `<div class="defic-item">⚠ <strong>${typeof escHtml === 'function' ? escHtml(d.source) : d.source}:</strong> ${typeof escHtml === 'function' ? escHtml(d.text) : d.text}</div>`
  ).join('');
  if (banner) banner.classList.toggle('has-defics', list.length > 0);
}
