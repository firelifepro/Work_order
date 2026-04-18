// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL INSPECTION — DEFICIENCY TRACKING
// Enhanced deficiency rebuild that aggregates from all hospital data sources:
//   1. Sprinkler checklist (Y/N/NA rows marked N with notes)
//   2. Device detail sheets (any row where a PASS/FAIL select = 'FAIL')
//   3. Pre/Post inspection checklist ('NO' answers)
// Auto-detected items are written as data-auto rows in h-defic-tbody (cleared and
// re-added on each call). Manually added rows have no data-auto and are preserved.
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
// Aggregates all deficiencies from every source and writes them as editable
// rows in the main h-defic-tbody table. Called on step navigation to 'defic'
// and on any FAIL/NO change.
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
      // Floor=inputs[0], Location=inputs[1], Note=last input
      const inputs   = Array.from(row.querySelectorAll('input[type="text"]'));
      const floor    = inputs[0]?.value?.trim() || '';
      const loc      = inputs[1]?.value?.trim() || inputs[0]?.value?.trim() || '';
      const note     = inputs[inputs.length - 1]?.value?.trim() || '';
      const floorPfx = floor ? `Fl.${floor} ` : '';
      const desc     = floorPfx + label + (loc ? ' — ' + loc : '') + (note ? ': ' + note : '');
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

  // ── 4. Failed batteries ───────────────────────────────────────────────────
  document.querySelectorAll('#h-battery-tbody tr').forEach(row => {
    const inputs = Array.from(row.querySelectorAll('input[type="text"], input:not([type])'));
    const size   = inputs[0]?.value?.trim() || '';
    const type   = inputs[1]?.value?.trim() || '';
    const locs   = inputs[2]?.value?.trim() || '';
    const note   = inputs[3]?.value?.trim() || '';
    if (!size && !type && !locs && !note) return;
    const desc = `Failed Battery${size ? ' ' + size + 'AH' : ''}${type ? ' ' + type : ''}${locs ? ' — ' + locs : ''}${note ? ': ' + note : ''}`;
    list.push({ text: desc, source: 'Battery' });
  });

  // ── 5. Elevator recall banks ─────────────────────────────────────────────
  document.querySelectorAll('#h-elevator-banks .h-elevator-bank').forEach(bank => {
    const loc = Array.from(bank.querySelectorAll('.data-field input[type="text"]'))[1]?.value?.trim() || '';
    bank.querySelectorAll('select[data-elev-which]').forEach(sel => {
      if (sel.value !== 'FAIL') return;
      const which = sel.getAttribute('data-elev-which');
      const note  = bank.querySelector(`.elev-note-row[data-for="${which}"] input`)?.value?.trim() || '';
      const label = which === 'primary' ? 'Primary Operational' : 'Secondary Operational';
      const desc  = `Elevator Recall — ${label}${loc ? ' ' + loc : ''}${note ? ': ' + note : ''}`;
      list.push({ text: desc, source: 'Elevator Recall' });
    });
  });

  // ── 5. Annunciator cards ──────────────────────────────────────────────────
  document.querySelectorAll('#h-annunciator-grid .h-ann-card').forEach(card => {
    const sel = card.querySelector('select[data-ann-pf]');
    if (sel?.value !== 'FAIL') return;
    const loc  = card.querySelectorAll('.data-field input[type="text"]')[2]?.value?.trim() || '';
    const note = card.querySelector('input[data-ann-note]')?.value?.trim() || '';
    const desc = `Annunciator${loc ? ' — ' + loc : ''}${note ? ': ' + note : ''}`;
    list.push({ text: desc, source: 'Annunciator' });
  });

  // ── Update DOM ────────────────────────────────────────────────────────────
  // Write auto-detected deficiencies as editable rows in the main defic table.
  // Rows marked data-auto are replaced on every call; manual rows are preserved.
  const tbody = document.getElementById('h-defic-tbody');
  if (!tbody) return;

  // Remove previously auto-generated rows
  Array.from(tbody.querySelectorAll('tr[data-auto]')).forEach(r => r.remove());

  // Prepend new auto rows (reversed so first item lands at top)
  list.slice().reverse().forEach(d => {
    const tr = document.createElement('tr');
    tr.dataset.auto = '1';
    tr.style.background = '#fefce8'; // subtle tint to distinguish from manual rows

    const numTd  = document.createElement('td');
    const descTd = document.createElement('td');
    const mmTd   = document.createElement('td');
    const delTd  = document.createElement('td');

    const descInp = document.createElement('input');
    descInp.type  = 'text';
    descInp.style.width = '100%';
    descInp.value = d.text;

    const mmInp = document.createElement('input');
    mmInp.type  = 'text';
    mmInp.style.width = '100%';
    mmInp.placeholder = 'Make/Model…';

    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '✕';
    delBtn.onclick = () => tr.remove();

    descTd.appendChild(descInp);
    mmTd.appendChild(mmInp);
    delTd.appendChild(delBtn);
    tr.append(numTd, descTd, mmTd, delTd);
    tbody.insertBefore(tr, tbody.firstChild);
  });

  // Renumber all rows (auto + manual)
  Array.from(tbody.children).forEach((tr, i) => { tr.cells[0].textContent = i + 1; });
}
