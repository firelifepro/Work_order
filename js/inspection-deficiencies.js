// FIRE ALARM — DEVICE LIST, CHECKLISTS, DYNAMIC TABLES
// ─────────────────────────────────────────────────────────────────────────────
const FA_DEVICES = [
  {label:'Smoke Detector',         key:'SD'},
  {label:'Combo Smoke/CO/Other',   key:'CBO'},
  {label:'Heat Detector',          key:'HD'},
  {label:'Manual Pull Station',    key:'PS'},
  {label:'Duct Detector',          key:'DD'},
  {label:'Beam Detector',          key:'BD'},
  {label:'CO Detector',            key:'CO'},
  {label:'Wet Flow Switch',        key:'FS'},
  {label:'Dry Pressure Switch',    key:'PRS'},
  {label:'Tamper Switch',          key:'TS'},
  {label:'Low Air Switch',         key:'LA'},
  {label:'High Air Switch',        key:'HA'},
  {label:'Power Supply',           key:'PWR'},
  {label:'Batteries',              key:'BAT'},
  {label:'Annunciator',            key:'ANN'},
  {label:'Elevator Recall Bank',   key:'ELV'},
  {label:'Phone Jack',             key:'PJ'},
  {label:'Fire Phone',             key:'FP'},
  {label:'Other (specify)',        key:'OTH'},
];
const FA_PRE_CHECKS = [
  'Check in with engineer / building contact?',
  'Were keys provided?',
  'All fire equipment in working order on arrival?',
  'Panel showing "Normal" upon arrival?',
  'Panel taken offline / disabled before testing?',
  'All lamps / LEDs / LCDs functioning?',
  'All fuses in good condition / functional?',
];
const FA_POST_CHECKS = [
  'Signals received at central station?',
  'Panel restored to "Normal" state upon departure?',
  'Panel re-enabled and placed online?',
  'Applicable device tags updated?',
  'Checkout with engineer / keys returned?',
  'Customer notified of any deficiencies?',
  'FCC left clean and organized?',
];
const FA_SEV_OPTS = ['','Critical','High','Moderate','Low','Advisory'];
let faSubpanelCount = 0, faDetectionCount = 0, faFlowCount = 0, faTamperCount = 0, faBatteryCount = 0;
let faYNANoteCounter = 0, faDeficCount = 0, faNoteCount = 0;

// ─── SPRINKLER PASS/FAIL + DEFICIENCY ────────────────────────────────────────
function setSPYNA(btn, rowId, val) {
  // Map Y/N/NA → internal PASS/FAIL/N/A for compatibility with defic tracking + PDF
  const internalVal = val === 'Y' ? 'PASS' : val === 'N' ? 'FAIL' : 'N/A';
  btn.closest('.yna-group').querySelectorAll('.yna-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const row = document.getElementById('row-' + rowId);
  if (!row) return;
  row.dataset.val = internalVal;
  const noteRow = document.getElementById('sp-note-row-' + rowId);
  if (internalVal === 'FAIL') {
    if (noteRow) noteRow.classList.add('show');
    if (!row.dataset.spDeficId) {
      spDeficCount++;
      const deficId = 'sp-defic-pf-' + spDeficCount;
      row.dataset.spDeficId = deficId;
      const label = row.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || rowId;
      document.getElementById('sp-defic-tbody').insertAdjacentHTML('beforeend', `
        <tr id="${deficId}">
          <td style="text-align:center;font-weight:700;color:var(--slate);">${spDeficCount}</td>
          <td><input type="text" id="${deficId}-desc" value="${escHtml(label)}" placeholder="Describe deficiency…"></td>
          <td><button class="del-btn" onclick="removeSPDefic('${deficId}','${rowId}')">✕</button></td>
        </tr>`);
      const noteInp = document.getElementById('sp-defic-note-' + rowId);
      const deficInp = document.getElementById(deficId + '-desc');
      if (noteInp && deficInp) {
        noteInp.addEventListener('input', () => {
          deficInp.value = label + (noteInp.value ? ': ' + noteInp.value : '');
        });
      }
    }
  } else {
    if (noteRow) { noteRow.classList.remove('show'); const ni = noteRow.querySelector('input'); if (ni) ni.value = ''; }
    if (row.dataset.spDeficId) {
      document.getElementById(row.dataset.spDeficId)?.remove();
      delete row.dataset.spDeficId;
    }
  }
  updateSPDeficiencySummary();
}

// Pre-inspection rows: N → general note (not deficiency); Y/NA → clear note
function setSPYNANote(btn, rowId, val) {
  btn.closest('.yna-group').querySelectorAll('.yna-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const row = document.getElementById('row-' + rowId);
  if (!row) return;
  row.dataset.val = val === 'Y' ? 'PASS' : val === 'N' ? 'FAIL' : 'N/A';
  const noteRow = document.getElementById('sp-note-row-' + rowId);
  if (val === 'N') {
    if (noteRow) noteRow.classList.add('show');
    if (!row.dataset.spNoteId) {
      spNoteCount++;
      const noteId = 'sp-note-preinsp-' + spNoteCount;
      row.dataset.spNoteId = noteId;
      const label = row.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || rowId;
      document.getElementById('sp-notes-tbody').insertAdjacentHTML('beforeend', `
        <tr id="${noteId}">
          <td style="text-align:center;font-weight:700;color:var(--slate);">${spNoteCount}</td>
          <td><input type="text" id="${noteId}-text" value="Pre-Inspection: ${escHtml(label)}" placeholder="Note…"></td>
          <td><button class="del-btn" onclick="removeSPPreInspNote('${noteId}','${rowId}')">✕</button></td>
        </tr>`);
      const noteInp = document.getElementById('sp-defic-note-' + rowId);
      const noteTextInp = document.getElementById(noteId + '-text');
      if (noteInp && noteTextInp) {
        noteInp.addEventListener('input', () => {
          noteTextInp.value = 'Pre-Inspection: ' + label + (noteInp.value ? ' - ' + noteInp.value : '');
        });
      }
    }
  } else {
    if (noteRow) { noteRow.classList.remove('show'); const ni = noteRow.querySelector('input'); if (ni) ni.value = ''; }
    if (row.dataset.spNoteId) {
      document.getElementById(row.dataset.spNoteId)?.remove();
      delete row.dataset.spNoteId;
    }
  }
}

function removeSPPreInspNote(noteId, rowId) {
  document.getElementById(noteId)?.remove();
  const row = document.getElementById('row-' + rowId);
  if (row) {
    delete row.dataset.spNoteId;
    row.dataset.val = '';
    row.querySelectorAll('.yna-btn').forEach(b => b.classList.remove('selected'));
  }
  const noteRow = document.getElementById('sp-note-row-' + rowId);
  if (noteRow) { noteRow.classList.remove('show'); const ni = noteRow.querySelector('input'); if (ni) ni.value = ''; }
}

function setSPPF(btn, rowId, val) {
  const group = btn.closest('.pf-group');
  group.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const row = document.getElementById('row-' + rowId);
  if (!row) return;
  row.dataset.val = val;
  const deficRow = document.getElementById('sp-defic-row-' + rowId);
  if (val === 'FAIL') {
    if (deficRow) deficRow.classList.add('show');
    if (!row.dataset.spDeficId) {
      spDeficCount++;
      const deficId = 'sp-defic-pf-' + spDeficCount;
      row.dataset.spDeficId = deficId;
      const label = row.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || rowId;
      document.getElementById('sp-defic-tbody').insertAdjacentHTML('beforeend', `
        <tr id="${deficId}">
          <td style="text-align:center;font-weight:700;color:var(--slate);">${spDeficCount}</td>
          <td><input type="text" id="${deficId}-desc" value="${escHtml(label)}" placeholder="Describe deficiency…"></td>
          <td><button class="del-btn" onclick="removeSPDefic('${deficId}','${rowId}')">✕</button></td>
        </tr>`);
      const noteInp  = document.getElementById('sp-defic-note-' + rowId);
      const deficInp = document.getElementById(deficId + '-desc');
      if (noteInp && deficInp) {
        noteInp.addEventListener('input', () => {
          deficInp.value = label + (noteInp.value ? ': ' + noteInp.value : '');
        });
      }
    }
  } else {
    if (deficRow) { deficRow.classList.remove('show'); const ni = deficRow.querySelector('input'); if (ni) ni.value = ''; }
    if (row.dataset.spDeficId) {
      document.getElementById(row.dataset.spDeficId)?.remove();
      delete row.dataset.spDeficId;
    }
  }
  updateSPDeficiencySummary();
}

function removeSPDefic(deficId, rowId) {
  document.getElementById(deficId)?.remove();
  const row = document.getElementById('row-' + rowId);
  if (row) {
    delete row.dataset.spDeficId;
    row.dataset.val = '';
    row.querySelectorAll('.yna-btn').forEach(b => b.classList.remove('selected'));
    row.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  }
  const noteRow = document.getElementById('sp-note-row-' + rowId) || document.getElementById('sp-defic-row-' + rowId);
  if (noteRow) { noteRow.classList.remove('show'); const ni = noteRow.querySelector('input'); if (ni) ni.value = ''; }
  updateSPDeficiencySummary();
}

function updateSPDeficiencySummary() {
  const count = document.getElementById('sp-defic-tbody')?.querySelectorAll('tr').length || 0;
  const pill = document.getElementById('sp-defic-count-pill');
  if (pill) pill.textContent = count;
}

function addSPDeficRow() {
  spDeficCount++;
  document.getElementById('sp-defic-tbody').insertAdjacentHTML('beforeend', `
    <tr id="sp-defic-manual-${spDeficCount}">
      <td style="text-align:center;font-weight:700;color:var(--slate);">${spDeficCount}</td>
      <td><input type="text" placeholder="Describe deficiency…"></td>
      <td><button class="del-btn" onclick="this.closest('tr').remove();updateSPDeficiencySummary()">✕</button></td>
    </tr>`);
  updateSPDeficiencySummary();
}

function addSPNoteRow() {
  spNoteCount++;
  document.getElementById('sp-notes-tbody').insertAdjacentHTML('beforeend', `
    <tr id="sp-note-${spNoteCount}">
      <td style="text-align:center;font-weight:700;color:var(--slate);">${spNoteCount}</td>
      <td><input type="text" placeholder="Enter note or observation…"></td>
      <td><button class="del-btn" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`);
}

function setFAPF(btn) {
  const group = btn.closest('.pf-group');
  group.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const inspRow = btn.closest('.inspect-row');
  if (!inspRow) return;
  let deficDiv = inspRow.querySelector('.fa-static-defic');
  if (btn.classList.contains('fail')) {
    if (!deficDiv) {
      deficDiv = document.createElement('div');
      deficDiv.className = 'fa-static-defic';
      deficDiv.style.cssText = 'display:flex;gap:8px;align-items:center;padding:6px 0 2px;';
      deficDiv.innerHTML = '<span style="font-size:.72rem;color:var(--amber);font-weight:700;white-space:nowrap;">⚠ Deficiency:</span><input type="text" style="flex:1;" placeholder="Describe deficiency…">';
      inspRow.appendChild(deficDiv);
    } else {
      deficDiv.style.display = 'flex';
    }
    // Add to deficiency list if not already tracked
    if (!inspRow.dataset.pfDeficId) {
      faDeficCount++;
      const deficId = 'fa-defic-pf-' + faDeficCount;
      inspRow.dataset.pfDeficId = deficId;
      const label = inspRow.querySelector('.inspect-label')?.textContent?.trim() || 'Inspection Item';
      document.getElementById('fa-defic-tbody').insertAdjacentHTML('beforeend', `
        <tr id="${deficId}">
          <td style="text-align:center;font-weight:700;color:var(--slate);">${faDeficCount}</td>
          <td><input type="text" id="${deficId}-desc" value="${escHtml(label)}" placeholder="Describe deficiency…"></td>
          <td><button class="del-btn" onclick="removeFAPFDefic('${deficId}')">✕</button></td>
        </tr>`);
      // Sync inline note → deficiency row description
      const inlineInp = deficDiv.querySelector('input');
      const deficInp  = document.getElementById(deficId + '-desc');
      if (inlineInp && deficInp) {
        inlineInp.addEventListener('input', () => {
          deficInp.value = label + (inlineInp.value ? ': ' + inlineInp.value : '');
        });
      }
    }
  } else {
    if (deficDiv) {
      deficDiv.style.display = 'none';
      const inp = deficDiv.querySelector('input');
      if (inp) inp.value = '';
    }
    if (inspRow.dataset.pfDeficId) {
      document.getElementById(inspRow.dataset.pfDeficId)?.remove();
      delete inspRow.dataset.pfDeficId;
    }
  }
}
function removeFAPFDefic(deficId) {
  document.getElementById(deficId)?.remove();
  const row = document.querySelector('[data-pf-defic-id="' + deficId + '"]');
  if (row) delete row.dataset.pfDeficId;
}

// Set all pf-groups in a card to N/A except the Present group (first pf-group in first row)
function setSectionNA(cardId, btn) {
  setFAPF(btn);
  const card = document.getElementById(cardId);
  if (!card) return;
  const presentGroup = card.querySelector('.inspect-row .pf-group');
  card.querySelectorAll('.pf-group').forEach(group => {
    if (group === presentGroup) return;
    group.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
    const naBtn = group.querySelector('.pf-btn.na');
    if (naBtn) naBtn.classList.add('selected');
  });
}

// Clear forced N/A when YES is clicked — deselect all groups except Present
function clearSectionNA(cardId, btn) {
  setFAPF(btn);
  const card = document.getElementById(cardId);
  if (!card) return;
  const presentGroup = card.querySelector('.inspect-row .pf-group');
  card.querySelectorAll('.pf-group').forEach(group => {
    if (group === presentGroup) return;
    group.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  });
}

function setFAYNA(btn, noteId, type) {
  const group = btn.closest('.yna-group');
  group.querySelectorAll('.yna-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const noteRow = document.getElementById(noteId);
  if (!noteRow) return;
  const inspRow = btn.closest('.inspect-row');
  if (type === 'N') {
    faYNANoteCounter++;
    noteRow.querySelector('.note-badge').textContent = 'Note #' + faYNANoteCounter;
    const inp = noteRow.querySelector('input');
    inp.classList.add('fail'); inp.placeholder = 'Describe issue…';
    noteRow.classList.add('show');
    // Add to deficiency list if not already tracked
    if (inspRow && !inspRow.dataset.ynaDeficId) {
      faDeficCount++;
      const deficId = 'fa-defic-yna-' + faDeficCount;
      inspRow.dataset.ynaDeficId = deficId;
      const label = inspRow.querySelector('.inspect-label')?.textContent?.trim() || 'Checklist Item';
      document.getElementById('fa-defic-tbody').insertAdjacentHTML('beforeend', `
        <tr id="${deficId}">
          <td style="text-align:center;font-weight:700;color:var(--slate);">${faDeficCount}</td>
          <td><input type="text" id="${deficId}-desc" value="${escHtml(label)}" placeholder="Describe deficiency…"></td>
          <td><button class="del-btn" onclick="removeFAYNADefic('${deficId}')">✕</button></td>
        </tr>`);
      const deficInp = document.getElementById(deficId + '-desc');
      if (inp && deficInp) {
        inp.addEventListener('input', () => {
          deficInp.value = label + (inp.value ? ': ' + inp.value : '');
        });
      }
    }
  } else {
    noteRow.classList.remove('show');
    if (inspRow && inspRow.dataset.ynaDeficId) {
      document.getElementById(inspRow.dataset.ynaDeficId)?.remove();
      delete inspRow.dataset.ynaDeficId;
    }
  }
}
function removeFAYNADefic(deficId) {
  document.getElementById(deficId)?.remove();
  const row = document.querySelector('[data-yna-defic-id="' + deficId + '"]');
  if (row) delete row.dataset.ynaDeficId;
}

// Detection type dropdown excludes FS and TS (those are flow/tamper tables, not detection devices)
const FA_DEVICE_KEYS_DETECTION = new Set(['FS','TS']);
function buildFATypeOptions(defaultKey) {
  return FA_DEVICES
    .filter(d => !FA_DEVICE_KEYS_DETECTION.has(d.key))
    .map(d => `<option value="${d.key}"${d.key === defaultKey ? ' selected' : ''}>${d.key} — ${d.label}</option>`)
    .join('');
}

function buildFADeviceTable() {
  const tbody = document.getElementById('fa-device-tbody');
  if (!tbody) return;
  FA_DEVICES.forEach((d, i) => {
    const id = `fa-dev-${i}`;
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="label-cell">${d.label}</td>
        <td class="key-cell">${d.key}</td>
        <td><input type="number" id="${id}-total" min="0" placeholder="0" oninput="calcFAPct(${i})"></td>
        <td><input type="number" id="${id}-pass"  min="0" placeholder="0" oninput="calcFAPct(${i})"></td>
        <td><input type="number" id="${id}-fail"  min="0" placeholder="0" oninput="calcFAPct(${i})"></td>
        <td><span class="pct pass" id="${id}-pct-pass">—</span></td>
        <td><span class="pct fail" id="${id}-pct-fail">—</span></td>
        <td><input type="number" id="${id}-nt" min="0" placeholder="0"></td>
        <td><input type="number" id="${id}-nf" min="0" placeholder="0"></td>
        <td><input type="text"   id="${id}-notes" style="min-width:100px;"></td>
      </tr>`);
  });
}

function syncDeviceSummary() {
  // Tally total/pass/fail per key across all detection, flow, tamper rows
  const counts = {};
  FA_DEVICES.forEach(d => { counts[d.key] = { total: 0, pass: 0, fail: 0 }; });

  const tally = (type, passVal) => {
    if (!type) return;
    if (!counts[type]) counts[type] = { total: 0, pass: 0, fail: 0 };
    counts[type].total++;
    if (passVal === 'FAIL') counts[type].fail++;
    else if (passVal === 'PASS') counts[type].pass++;
  };

  // Detection rows: fail if any of alarm/sup/note is FAIL; pass if none are FAIL and at least one is PASS
  for (let n = 1; n <= faDetectionCount; n++) {
    if (!document.getElementById('fa-det-row-' + n)) continue;
    const type  = document.getElementById('fa-det-type-' + n)?.value || '';
    const alarm = document.getElementById('fa-det-alarm-' + n)?.value || '';
    const sup   = document.getElementById('fa-det-sup-' + n)?.value || '';
    const anyFail = alarm === 'FAIL' || sup === 'FAIL';
    const anyPass = alarm === 'PASS' || sup === 'PASS';
    tally(type, anyFail ? 'FAIL' : anyPass ? 'PASS' : '');
  }

  // Flow rows
  for (let n = 1; n <= faFlowCount; n++) {
    if (!document.getElementById('fa-flow-row-' + n)) continue;
    tally(
      document.getElementById('fa-flow-type-' + n)?.value || '',
      document.getElementById('fa-flow-sup-' + n)?.value || ''
    );
  }

  // Tamper rows
  for (let n = 1; n <= faTamperCount; n++) {
    if (!document.getElementById('fa-tamper-row-' + n)) continue;
    tally(
      document.getElementById('fa-tamper-type-' + n)?.value || '',
      document.getElementById('fa-tamper-sup-' + n)?.value || ''
    );
  }

  // Push counts into Device Testing Summary; auto-fill NT = total − pass − fail
  FA_DEVICES.forEach((d, i) => {
    const c = counts[d.key] || { total: 0, pass: 0, fail: 0 };
    const id = `fa-dev-${i}`;
    const totalEl = document.getElementById(id + '-total');
    const passEl  = document.getElementById(id + '-pass');
    const failEl  = document.getElementById(id + '-fail');
    const ntEl    = document.getElementById(id + '-nt');
    if (totalEl) totalEl.value = c.total > 0 ? c.total : '';
    if (passEl)  passEl.value  = c.pass  > 0 ? c.pass  : '';
    if (failEl)  failEl.value  = c.fail  > 0 ? c.fail  : '';
    const nt = Math.max(0, c.total - c.pass - c.fail);
    if (ntEl) ntEl.value = nt > 0 ? nt : '';
    calcFAPct(i);
  });
}

function calcFAPct(i) {
  const id = `fa-dev-${i}`;
  const totalEl = document.getElementById(`${id}-total`);
  const passEl  = document.getElementById(`${id}-pass`);
  const failEl  = document.getElementById(`${id}-fail`);
  // Clamp negatives back to 0 so the down-arrow can't break the row
  if (totalEl && +totalEl.value < 0) totalEl.value = 0;
  if (passEl  && +passEl.value  < 0) passEl.value  = 0;
  if (failEl  && +failEl.value  < 0) failEl.value  = 0;
  const total = +totalEl?.value || 0;
  const pass  = +passEl?.value  || 0;
  const fail  = +failEl?.value  || 0;
  const pPass = document.getElementById(`${id}-pct-pass`);
  const pFail = document.getElementById(`${id}-pct-fail`);
  if (pPass) pPass.textContent = total > 0 ? Math.round(pass / total * 100) + '%' : '—';
  if (pFail) pFail.textContent = total > 0 ? Math.round(fail / total * 100) + '%' : '—';
}

function buildFAChecklists() {
  buildFACL('fa-pre-checklist',  FA_PRE_CHECKS,  'fa-pre');
  buildFACL('fa-post-checklist', FA_POST_CHECKS, 'fa-post');
}

function buildFACL(containerId, items, prefix) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  items.forEach((label, i) => {
    const rowId = `${prefix}-note-${i}`;
    c.insertAdjacentHTML('beforeend', `
      <div class="inspect-row">
        <div class="inspect-row-top">
          <div class="inspect-label">${label}</div>
          <div class="yna-group">
            <button class="yna-btn y"  onclick="setFAYNA(this,'${rowId}','Y')">Y</button>
            <button class="yna-btn n"  onclick="setFAYNA(this,'${rowId}','N')">N</button>
            <button class="yna-btn na" onclick="setFAYNA(this,'${rowId}','N/A')">N/A</button>
          </div>
        </div>
        <div class="note-row" id="${rowId}">
          <span class="note-badge">Note #—</span>
          <input class="note-input" type="text" id="${rowId}-text" placeholder="Note…">
        </div>
      </div>`);
  });
}

function addFASubpanelRow() {
  faSubpanelCount++;
  const n = faSubpanelCount;
  const compBtn = (prefix) => `
    <div style="display:flex;gap:2px;">
      <button class="pf-btn pass" style="padding:3px 7px;" onclick="setSubpanelComp(this,${n},'${prefix}','PASS')" title="Pass">✓</button>
      <button class="pf-btn fail" style="padding:3px 7px;" onclick="setSubpanelComp(this,${n},'${prefix}','FAIL')" title="Fail">✗</button>
      <input type="hidden" id="${prefix}-${n}">
    </div>`;
  const pfBtn = `
    <div style="display:flex;gap:2px;">
      <button class="pf-btn pass" style="padding:3px 7px;" onclick="setSubpanelPF(this,${n},'PASS')" title="Pass">✓</button>
      <button class="pf-btn fail" style="padding:3px 7px;" onclick="setSubpanelPF(this,${n},'FAIL')" title="Fail">✗</button>
      <input type="hidden" id="fa-sp-pf-${n}">
    </div>`;
  document.getElementById('fa-subpanel-tbody').insertAdjacentHTML('beforeend', `
    <tr id="fa-sp-row-${n}">
      <td><input type="text" id="fa-sp-loc-${n}"></td>
      <td><input type="text" id="fa-sp-make-${n}"></td>
      <td><input type="text" id="fa-sp-circuit-${n}"></td>
      <td><input type="text" id="fa-sp-amps-${n}"></td>
      <td>${compBtn('fa-sp-lbatt')}</td>
      <td>${compBtn('fa-sp-rbatt')}</td>
      <td>${compBtn('fa-sp-spvsd')}</td>
      <td>${pfBtn}</td>
      <td><button class="del-btn" onclick="removeSubpanelRow(${n})">✕</button></td>
    </tr>
    <tr id="fa-sp-defic-tr-${n}" style="display:none;">
      <td colspan="9" style="padding:4px 8px 8px;background:#fff7ed;border-top:none;">
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:.72rem;color:var(--amber);font-weight:700;white-space:nowrap;">⚠ Deficiency:</span>
          <input type="text" id="fa-sp-defic-txt-${n}" style="flex:1;" placeholder="Describe the sub panel issue…" oninput="syncSubpanelDefic(${n})">
        </div>
      </td>
    </tr>`);
}

function addFADetectionRow() {
  faDetectionCount++;
  const n = faDetectionCount;
  const iconBtns2 = (prefix) => `
    <div style="display:flex;gap:2px;">
      <button class="pf-btn pass" style="padding:3px 7px;" onclick="setPFTable(this,'${prefix}-${n}','PASS')" title="Pass">✓</button>
      <button class="pf-btn fail" style="padding:3px 7px;" onclick="setPFTable(this,'${prefix}-${n}','FAIL')" title="Fail">✗</button>
      <input type="hidden" id="${prefix}-${n}">
    </div>`;
  document.getElementById('fa-detection-tbody').insertAdjacentHTML('beforeend', `
    <tr id="fa-det-row-${n}">
      <td><select id="fa-det-type-${n}" onchange="syncDeviceSummary()">${buildFATypeOptions('SD')}</select></td>
      <td><input type="text" id="fa-det-loc-${n}"></td>
      <td><input type="text" id="fa-det-scan-${n}"></td>
      <td><input type="text" id="fa-det-addr-${n}"></td>
      <td>${iconBtns2('fa-det-alarm')}</td>
      <td>${iconBtns2('fa-det-sup')}</td>
      <td><button class="del-btn" onclick="removeDetectionRow(${n})">✕</button></td>
    </tr>
    <tr id="fa-det-defic-tr-${n}" style="display:none;">
      <td colspan="7" style="padding:4px 8px 8px;background:#fff7ed;border-top:none;">
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:.72rem;color:var(--amber);font-weight:700;white-space:nowrap;">⚠ Deficiency:</span>
          <input type="text" id="fa-det-defic-txt-${n}" style="flex:1;" placeholder="Describe the device issue…" oninput="syncDetectionDefic(${n})">
        </div>
      </td>
    </tr>`);
  syncDeviceSummary();
}

function addFAFlowRow() {
  faFlowCount++;
  const n = faFlowCount;
  const iconBtnsFlow = `
    <div style="display:flex;gap:2px;">
      <button class="pf-btn pass" style="padding:3px 7px;" onclick="setPFTable(this,'fa-flow-sup-${n}','PASS')" title="Pass">✓</button>
      <button class="pf-btn fail" style="padding:3px 7px;" onclick="setPFTable(this,'fa-flow-sup-${n}','FAIL')" title="Fail">✗</button>
      <input type="hidden" id="fa-flow-sup-${n}">
    </div>`;
  document.getElementById('fa-flow-tbody').insertAdjacentHTML('beforeend', `
    <tr id="fa-flow-row-${n}">
      <td><input type="text" id="fa-flow-type-${n}" value="FS"></td>
      <td><input type="text" id="fa-flow-loc-${n}"></td>
      <td><input type="text" id="fa-flow-scan-${n}"></td>
      <td><input type="text" id="fa-flow-addr-${n}"></td>
      <td>${iconBtnsFlow}</td>
      <td><input type="number" id="fa-flow-secs-${n}" placeholder="sec"></td>
      <td><button class="del-btn" onclick="removeFlowRow(${n})">✕</button></td>
    </tr>
    <tr id="fa-flow-defic-tr-${n}" style="display:none;">
      <td colspan="7" style="padding:4px 8px 8px;background:#fff7ed;border-top:none;">
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:.72rem;color:var(--amber);font-weight:700;white-space:nowrap;">⚠ Deficiency:</span>
          <input type="text" id="fa-flow-defic-txt-${n}" style="flex:1;" placeholder="Describe the flow switch issue…" oninput="syncFlowDefic(${n})">
        </div>
      </td>
    </tr>`);
  syncDeviceSummary();
}

function addFATamperRow() {
  faTamperCount++;
  const n = faTamperCount;
  const iconBtnsTs = `
    <div style="display:flex;gap:2px;">
      <button class="pf-btn pass" style="padding:3px 7px;" onclick="setPFTable(this,'fa-tamper-sup-${n}','PASS')" title="Pass">✓</button>
      <button class="pf-btn fail" style="padding:3px 7px;" onclick="setPFTable(this,'fa-tamper-sup-${n}','FAIL')" title="Fail">✗</button>
      <input type="hidden" id="fa-tamper-sup-${n}">
    </div>`;
  document.getElementById('fa-tamper-tbody').insertAdjacentHTML('beforeend', `
    <tr id="fa-tamper-row-${n}">
      <td><input type="text" id="fa-tamper-type-${n}" value="TS"></td>
      <td><input type="text" id="fa-tamper-loc-${n}"></td>
      <td><input type="text" id="fa-tamper-scan-${n}"></td>
      <td><input type="text" id="fa-tamper-addr-${n}"></td>
      <td>${iconBtnsTs}</td>
      <td><input type="text" id="fa-tamper-notes-${n}"></td>
      <td><button class="del-btn" onclick="removeTamperRow(${n})">✕</button></td>
    </tr>
    <tr id="fa-tamper-defic-tr-${n}" style="display:none;">
      <td colspan="7" style="padding:4px 8px 8px;background:#fff7ed;border-top:none;">
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:.72rem;color:var(--amber);font-weight:700;white-space:nowrap;">⚠ Deficiency:</span>
          <input type="text" id="fa-tamper-defic-txt-${n}" style="flex:1;" placeholder="Describe the tamper switch issue…" oninput="syncTamperDefic(${n})">
        </div>
      </td>
    </tr>`);
  syncDeviceSummary();
}

function addFABatteryRow() {
  faBatteryCount++;
  const n = faBatteryCount;
  document.getElementById('fa-battery-tbody').insertAdjacentHTML('beforeend', `
    <tr id="fa-bat-row-${n}">
      <td><input type="text" id="fa-bat-size-${n}" placeholder="e.g. 7AH"></td>
      <td><input type="text" id="fa-bat-type-${n}" placeholder="e.g. SLA, Li"></td>
      <td><input type="number" id="fa-bat-count-${n}" min="1" placeholder="1"></td>
      <td><select id="fa-bat-loc-${n}"><option>FACP</option><option>Power Supply</option><option>Fire Alarm Communicator</option></select></td>
      <td><button class="del-btn" onclick="document.getElementById('fa-bat-row-${n}').remove()">✕</button></td>
    </tr>`);
}

function addFADeficRow() {
  faDeficCount++;
  const n = faDeficCount;
  document.getElementById('fa-defic-tbody').insertAdjacentHTML('beforeend', `
    <tr id="fa-defic-row-${n}">
      <td style="text-align:center;font-weight:700;color:var(--slate);">${n}</td>
      <td><input type="text" id="fa-defic-desc-${n}" placeholder="Describe deficiency and proposed solution…"></td>
      <td><button class="del-btn" onclick="document.getElementById('fa-defic-row-${n}').remove()">✕</button></td>
    </tr>`);
}

function addFANoteRow() {
  faNoteCount++;
  const n = faNoteCount;
  document.getElementById('fa-notes-tbody').insertAdjacentHTML('beforeend', `
    <tr id="fa-note-row-${n}">
      <td style="text-align:center;font-weight:700;color:var(--slate);">${n}</td>
      <td><input type="text" id="fa-note-desc-${n}" placeholder="Note or observation…"></td>
      <td><button class="del-btn" onclick="document.getElementById('fa-note-row-${n}').remove()">✕</button></td>
    </tr>`);
}

// ─── ONSITE CONDITION BUTTONS ─────────────────────────────────────────────────
// Tracks which onsite rows are currently marked Unsatisfactory
const _onsiteUnsat = {};  // rowNum → defic-tbody row id

function setOnsiteCond(btn, n, state) {
  // Toggle button styles in the pair
  const row = document.getElementById('fa-onsite-row-' + n);
  if (!row) return;
  row.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');

  if (state === 'unsat') {
    _onsiteUnsat[n] = true;
    addOnsiteDeficRow(n);
  } else {
    _onsiteUnsat[n] = false;
    removeOnsiteDeficRow(n);
  }
  // N/A just clears selection visual — deficiency already removed above
}

function addOnsiteDeficRow(n) {
  // Only add once per row
  if (document.getElementById('fa-defic-onsite-' + n)) return;
  faDeficCount++;
  const count = faDeficCount;
  const eq    = document.getElementById('fa-onsite-eq-' + n)?.value || 'Equipment ' + n;
  const notes = document.getElementById('fa-onsite-notes-' + n)?.value || '';
  document.getElementById('fa-defic-tbody').insertAdjacentHTML('beforeend', `
    <tr id="fa-defic-onsite-${n}">
      <td style="text-align:center;font-weight:700;color:var(--slate);">${count}</td>
      <td><input type="text" id="fa-defic-onsite-desc-${n}" value="${escHtml(eq)}${notes ? ' — ' + escHtml(notes) : ''}" placeholder="Describe deficiency and proposed solution…"></td>
      <td><button class="del-btn" onclick="removeOnsiteDeficRow(${n})">✕</button></td>
    </tr>`);
}

function removeOnsiteDeficRow(n) {
  const row = document.getElementById('fa-defic-onsite-' + n);
  if (row) row.remove();
  _onsiteUnsat[n] = false;
}

function syncOnsiteDefic(n) {
  // When notes change on an unsatisfactory row, keep the defic description in sync
  if (!_onsiteUnsat[n]) return;
  const descEl = document.getElementById('fa-defic-onsite-desc-' + n);
  if (!descEl) return;
  const eq    = document.getElementById('fa-onsite-eq-' + n)?.value || 'Equipment ' + n;
  const notes = document.getElementById('fa-onsite-notes-' + n)?.value || '';
  descEl.value = eq + (notes ? ' — ' + notes : '');
}

// ─── REPORT TYPE BUTTONS ──────────────────────────────────────────────────────
function setFAReportType(val, btn) {
  document.getElementById('report-type').value = val;
  document.querySelectorAll('#fa-rt-annual, #fa-rt-semi').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}
function syncFAReportTypeButtons() {
  const val = document.getElementById('report-type')?.value || 'Annual';
  document.getElementById('fa-rt-annual')?.classList.toggle('selected', val !== 'Semi-Annual');
  document.getElementById('fa-rt-semi')?.classList.toggle('selected', val === 'Semi-Annual');
}

// ─── SUB PANEL PASS/FAIL + DEFICIENCY ─────────────────────────────────────────
function setSubpanelComp(btn, n, prefix, val) {
  // Standard icon toggle
  const group = btn.closest('.pf-group') || btn.parentElement;
  group.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const input = document.getElementById(prefix + '-' + n);
  if (input) input.value = val;
  // If any component fails, auto-set Pass/Fail to FAIL
  if (val === 'FAIL') {
    const pfInput = document.getElementById('fa-sp-pf-' + n);
    if (pfInput && pfInput.value !== 'FAIL') {
      const pfRow = document.getElementById('fa-sp-row-' + n);
      const pfDiv = pfRow?.querySelectorAll('td')[7]?.querySelector('div');
      if (pfDiv) {
        pfDiv.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
        pfDiv.querySelector('.pf-btn.fail')?.classList.add('selected');
        pfInput.value = 'FAIL';
      }
      showSubpanelDeficRow(n);
    }
  }
}

function setSubpanelPF(btn, n, val) {
  const pfInput = document.getElementById('fa-sp-pf-' + n);
  if (!pfInput) return;
  (btn.closest('.pf-group') || btn.parentElement).querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  pfInput.value = val;
  if (val === 'FAIL') showSubpanelDeficRow(n);
  else hideSubpanelDeficRow(n);
}

function showSubpanelDeficRow(n) {
  const tr = document.getElementById('fa-sp-defic-tr-' + n);
  if (tr) tr.style.display = '';
  if (!document.getElementById('fa-defic-sp-' + n)) {
    faDeficCount++;
    const count = faDeficCount;
    const loc = document.getElementById('fa-sp-loc-' + n)?.value || 'Sub Panel ' + n;
    document.getElementById('fa-defic-tbody').insertAdjacentHTML('beforeend', `
      <tr id="fa-defic-sp-${n}">
        <td style="text-align:center;font-weight:700;color:var(--slate);">${count}</td>
        <td><input type="text" id="fa-defic-sp-desc-${n}" value="Sub Panel — ${escHtml(loc)}" placeholder="Describe deficiency…"></td>
        <td><button class="del-btn" onclick="removeSubpanelDeficRow(${n})">✕</button></td>
      </tr>`);
  }
}

function hideSubpanelDeficRow(n) {
  const tr = document.getElementById('fa-sp-defic-tr-' + n);
  if (tr) { tr.style.display = 'none'; const txt = document.getElementById('fa-sp-defic-txt-' + n); if (txt) txt.value = ''; }
  removeSubpanelDeficRow(n);
}

function removeSubpanelDeficRow(n) {
  document.getElementById('fa-defic-sp-' + n)?.remove();
}

function removeSubpanelRow(n) {
  removeSubpanelDeficRow(n);
  document.getElementById('fa-sp-row-' + n)?.remove();
  document.getElementById('fa-sp-defic-tr-' + n)?.remove();
}

// ─── DETECTION ROW DEFICIENCY ─────────────────────────────────────────────────
function checkDetectionDefic(n) {
  const alarm = document.getElementById('fa-det-alarm-' + n)?.value;
  const sup   = document.getElementById('fa-det-sup-' + n)?.value;
  if (alarm === 'FAIL' || sup === 'FAIL') showDetectionDeficRow(n);
  else hideDetectionDeficRow(n);
}
function showDetectionDeficRow(n) {
  const tr = document.getElementById('fa-det-defic-tr-' + n);
  if (tr) tr.style.display = '';
  if (!document.getElementById('fa-defic-det-' + n)) {
    faDeficCount++;
    const count = faDeficCount;
    const loc = document.getElementById('fa-det-loc-' + n)?.value || 'Device ' + n;
    const type = document.getElementById('fa-det-type-' + n)?.value || '';
    document.getElementById('fa-defic-tbody').insertAdjacentHTML('beforeend', `
      <tr id="fa-defic-det-${n}">
        <td style="text-align:center;font-weight:700;color:var(--slate);">${count}</td>
        <td><input type="text" id="fa-defic-det-desc-${n}" value="${escHtml((type ? type + ' — ' : '') + loc)}" placeholder="Describe deficiency…"></td>
        <td><button class="del-btn" onclick="removeDetectionDeficRow(${n})">✕</button></td>
      </tr>`);
  }
}
function hideDetectionDeficRow(n) {
  const tr = document.getElementById('fa-det-defic-tr-' + n);
  if (tr) { tr.style.display = 'none'; const txt = document.getElementById('fa-det-defic-txt-' + n); if (txt) txt.value = ''; }
  removeDetectionDeficRow(n);
}
function removeDetectionDeficRow(n) { document.getElementById('fa-defic-det-' + n)?.remove(); }
function removeDetectionRow(n) {
  removeDetectionDeficRow(n);
  document.getElementById('fa-det-row-' + n)?.remove();
  document.getElementById('fa-det-defic-tr-' + n)?.remove();
  syncDeviceSummary();
}
function syncDetectionDefic(n) {
  const descEl = document.getElementById('fa-defic-det-desc-' + n);
  if (!descEl) return;
  const loc   = document.getElementById('fa-det-loc-' + n)?.value || 'Device ' + n;
  const type  = document.getElementById('fa-det-type-' + n)?.value || '';
  const notes = document.getElementById('fa-det-defic-txt-' + n)?.value || '';
  descEl.value = (type ? type + ' — ' : '') + loc + (notes ? ' — ' + notes : '');
}

// ─── FLOW SWITCH ROW DEFICIENCY ───────────────────────────────────────────────
function showFlowDeficRow(n) {
  const tr = document.getElementById('fa-flow-defic-tr-' + n);
  if (tr) tr.style.display = '';
  if (!document.getElementById('fa-defic-flow-' + n)) {
    faDeficCount++;
    const count = faDeficCount;
    const type = document.getElementById('fa-flow-type-' + n)?.value || 'FS';
    const loc  = document.getElementById('fa-flow-loc-' + n)?.value || '';
    const prefix = 'Flow Switch ' + n + ' (' + type + ')';
    const initVal = loc ? prefix + ' — ' + loc : prefix;
    document.getElementById('fa-defic-tbody').insertAdjacentHTML('beforeend', `
      <tr id="fa-defic-flow-${n}">
        <td style="text-align:center;font-weight:700;color:var(--slate);">${count}</td>
        <td><input type="text" id="fa-defic-flow-desc-${n}" value="${escHtml(initVal)}" placeholder="Describe deficiency…"></td>
        <td><button class="del-btn" onclick="removeFlowDeficRow(${n})">✕</button></td>
      </tr>`);
  }
}
function hideFlowDeficRow(n) {
  const tr = document.getElementById('fa-flow-defic-tr-' + n);
  if (tr) { tr.style.display = 'none'; const txt = document.getElementById('fa-flow-defic-txt-' + n); if (txt) txt.value = ''; }
  removeFlowDeficRow(n);
}
function removeFlowDeficRow(n) { document.getElementById('fa-defic-flow-' + n)?.remove(); }
function removeFlowRow(n) {
  removeFlowDeficRow(n);
  document.getElementById('fa-flow-row-' + n)?.remove();
  document.getElementById('fa-flow-defic-tr-' + n)?.remove();
  syncDeviceSummary();
}
function syncFlowDefic(n) {
  const descEl = document.getElementById('fa-defic-flow-desc-' + n);
  if (!descEl) return;
  const type  = document.getElementById('fa-flow-type-' + n)?.value || 'FS';
  const loc   = document.getElementById('fa-flow-loc-' + n)?.value || '';
  const notes = document.getElementById('fa-flow-defic-txt-' + n)?.value || '';
  const prefix = 'Flow Switch ' + n + ' (' + type + ')';
  descEl.value = (loc ? prefix + ' — ' + loc : prefix) + (notes ? ': ' + notes : '');
}

// ─── TAMPER SWITCH ROW DEFICIENCY ─────────────────────────────────────────────
function showTamperDeficRow(n) {
  const tr = document.getElementById('fa-tamper-defic-tr-' + n);
  if (tr) tr.style.display = '';
  if (!document.getElementById('fa-defic-tamper-' + n)) {
    faDeficCount++;
    const count = faDeficCount;
    const type = document.getElementById('fa-tamper-type-' + n)?.value || 'TS';
    const loc  = document.getElementById('fa-tamper-loc-' + n)?.value || '';
    const prefix = 'Tamper Switch ' + n + ' (' + type + ')';
    const initVal = loc ? prefix + ' — ' + loc : prefix;
    document.getElementById('fa-defic-tbody').insertAdjacentHTML('beforeend', `
      <tr id="fa-defic-tamper-${n}">
        <td style="text-align:center;font-weight:700;color:var(--slate);">${count}</td>
        <td><input type="text" id="fa-defic-tamper-desc-${n}" value="${escHtml(initVal)}" placeholder="Describe deficiency…"></td>
        <td><button class="del-btn" onclick="removeTamperDeficRow(${n})">✕</button></td>
      </tr>`);
  }
}
function hideTamperDeficRow(n) {
  const tr = document.getElementById('fa-tamper-defic-tr-' + n);
  if (tr) { tr.style.display = 'none'; const txt = document.getElementById('fa-tamper-defic-txt-' + n); if (txt) txt.value = ''; }
  removeTamperDeficRow(n);
}
function removeTamperDeficRow(n) { document.getElementById('fa-defic-tamper-' + n)?.remove(); }
function removeTamperRow(n) {
  removeTamperDeficRow(n);
  document.getElementById('fa-tamper-row-' + n)?.remove();
  document.getElementById('fa-tamper-defic-tr-' + n)?.remove();
  syncDeviceSummary();
}
function syncTamperDefic(n) {
  const descEl = document.getElementById('fa-defic-tamper-desc-' + n);
  if (!descEl) return;
  const type  = document.getElementById('fa-tamper-type-' + n)?.value || 'TS';
  const loc   = document.getElementById('fa-tamper-loc-' + n)?.value || '';
  const notes = document.getElementById('fa-tamper-defic-txt-' + n)?.value || '';
  const prefix = 'Tamper Switch ' + n + ' (' + type + ')';
  descEl.value = (loc ? prefix + ' — ' + loc : prefix) + (notes ? ': ' + notes : '');
}


// ITEM → PANEL MAP  (used by deficiency summary to show section name)
// Built once when forms are created, maps every inspect-row id to its panel.
// ─────────────────────────────────────────────────────────────────────────────
const ITEM_PANEL_MAP = {};   // itemId  → { panelId, panelTitle }

function buildItemPanelMap() {
  Object.keys(ITEM_PANEL_MAP).forEach(k => delete ITEM_PANEL_MAP[k]);
  // Dynamic panels (non-FA systems)
  document.querySelectorAll('.sys-panel').forEach(panel => {
    const panelId    = panel.id.replace('panel-', '');
    const panelTitle = panel.querySelector('.sys-panel-header span:nth-child(2)')?.textContent?.trim() || panelId;
    panel.querySelectorAll('.inspect-row').forEach(row => {
      const itemId = row.id.replace('row-', '');
      ITEM_PANEL_MAP[itemId] = { panelId, panelTitle };
    });
  });
  // Static FA steps — map each card's inspect-rows to the FA step key
  ['fa-devices', 'fa-aux', 'fa-defic'].forEach(stepKey => {
    const stepEl = document.getElementById('step-' + stepKey);
    if (!stepEl) return;
    stepEl.querySelectorAll('.card').forEach(card => {
      const panelTitle = card.querySelector('.card-header')?.textContent?.trim() || stepKey;
      card.querySelectorAll('.inspect-row').forEach(row => {
        const itemId = row.id.replace('row-', '');
        ITEM_PANEL_MAP[itemId] = { panelId: 'step-' + stepKey, panelTitle };
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PASS/FAIL LOGIC
// ─────────────────────────────────────────────────────────────────────────────
function setPF(btn, itemId, val) {
  const row = document.getElementById('row-' + itemId);
  if (!row) return;
  row.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  row.dataset.val = val;

  const deficRow = document.getElementById('defic-' + itemId);
  if (deficRow) {
    if (val === 'FAIL') {
      deficRow.classList.add('show');
    } else {
      // PASS or N/A — clear deficiency note and hide row
      deficRow.classList.remove('show');
      const inp = document.getElementById('defic-txt-' + itemId);
      if (inp) inp.value = '';
    }
  }
  updateDeficiencySummary();
}

function updateDeficiencySummary() {
  const sumDiv   = document.getElementById('defic-summary');
  const listDiv  = document.getElementById('defic-list');
  const countPill= document.getElementById('defic-count-pill');
  if (!sumDiv || !listDiv) return;

  // Collect all FAIL rows with full context
  const defics = [];
  document.querySelectorAll('.inspect-row').forEach(row => {
    if (row.dataset.val !== 'FAIL') return;
    const itemId   = row.id.replace('row-', '');
    const labelEl  = row.querySelector('.inspect-label');
    // Get just the main label text (first text node, excluding the <small> sublabel)
    const label    = labelEl?.childNodes[0]?.textContent?.trim() || itemId;
    const note     = document.getElementById('defic-txt-' + itemId)?.value?.trim() || '';
    const panelInfo= ITEM_PANEL_MAP[itemId] || { panelId: '', panelTitle: '' };
    defics.push({ itemId, label, note, panelId: panelInfo.panelId, panelTitle: panelInfo.panelTitle });
  });

  // Update count pill
  if (countPill) countPill.textContent = defics.length + (defics.length === 1 ? ' deficiency' : ' deficiencies');

  // Generic systems (not FA/SP) have a dedicated Deficiencies step — hide the inline box
  const _isGenericSys = activeInspectionSystem && !['fire-alarm','sprinkler'].includes(activeInspectionSystem);
  if (_isGenericSys) {
    sumDiv.classList.remove('show');
    listDiv.innerHTML = '';
  } else if (defics.length > 0) {
    sumDiv.classList.add('show');
    listDiv.innerHTML = defics.map(d => `
      <div class="defic-item" id="defic-card-${d.itemId}">
        <div class="defic-item-body">
          <div class="defic-item-section">${escHtml(d.panelTitle)}</div>
          <div class="defic-item-label">⚠ ${escHtml(d.label)}</div>
          ${d.note
            ? `<div class="defic-item-note">${escHtml(d.note)}</div>`
            : `<div class="defic-item-note missing">No description entered — tap the item to add details</div>`
          }
        </div>
        ${d.panelId ? `<button class="defic-jump-btn" onclick="jumpToItem('${d.itemId}','${d.panelId}')">Go to item ↓</button>` : ''}
      </div>`).join('');

    // Auto-suggest DEFICIENT overall status if not yet set
    if (overallStatus === '') setOverallStatus('DEFICIENT');
  } else {
    sumDiv.classList.remove('show');
    listDiv.innerHTML = '';
  }

  // Update panel header highlights and badges
  // First reset all panels
  document.querySelectorAll('.sys-panel-header').forEach(hdr => {
    hdr.classList.remove('has-defic');
  });
  document.querySelectorAll('.defic-badge').forEach(badge => {
    badge.textContent = ''; badge.style.display = 'none';
  });

  // Count deficiencies per panel and highlight
  const panelCounts = {};
  defics.forEach(d => {
    if (d.panelId) panelCounts[d.panelId] = (panelCounts[d.panelId] || 0) + 1;
  });
  Object.entries(panelCounts).forEach(([panelId, count]) => {
    const hdr   = document.getElementById('panel-hdr-' + panelId);
    const badge = document.getElementById('panel-badge-' + panelId);
    if (hdr)   hdr.classList.add('has-defic');
    if (badge) { badge.textContent = count + (count === 1 ? ' defic.' : ' defic.'); badge.style.display = 'inline-block'; }
  });

  // Also update the FA deficiency summary (step-fa-defic)
  const faSumDiv   = document.getElementById('fa-defic-summary');
  const faListDiv  = document.getElementById('fa-defic-list');
  const faCountPill= document.getElementById('fa-defic-count-pill');
  if (faSumDiv && faListDiv) {
    if (faCountPill) faCountPill.textContent = defics.length + (defics.length === 1 ? ' deficiency' : ' deficiencies');
    if (defics.length > 0) {
      faSumDiv.classList.add('show');
      faListDiv.innerHTML = defics.map(d => `
        <div class="defic-item" id="fa-defic-card-${d.itemId}">
          <div class="defic-item-body">
            <div class="defic-item-section">${escHtml(d.panelTitle)}</div>
            <div class="defic-item-label">&#9888; ${escHtml(d.label)}</div>
            ${d.note
              ? `<div class="defic-item-note">${escHtml(d.note)}</div>`
              : `<div class="defic-item-note missing">No description entered — tap the item to add details</div>`
            }
          </div>
          ${d.panelId ? `<button class="defic-jump-btn" onclick="goFAStep('${d.panelId.replace('step-fa-','')}')" >Go to item ↓</button>` : ''}
        </div>`).join('');
    } else {
      faSumDiv.classList.remove('show');
      faListDiv.innerHTML = '';
    }
  }
}

// Scroll to an inspection item and open its panel if collapsed
function jumpToItem(itemId, panelId) {
  // Handle FA step navigation
  if (panelId && panelId.startsWith('step-fa-')) {
    const faKey = panelId.replace('step-fa-', '');
    goFAStep(faKey);
    setTimeout(() => {
      const row = document.getElementById('row-' + itemId);
      if (!row) return;
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.outline = '3px solid var(--red)';
      row.style.borderRadius = '4px';
      setTimeout(() => { row.style.outline = ''; row.style.borderRadius = ''; }, 2000);
    }, 300);
    return;
  }
  // Open panel if collapsed (dynamic panels)
  const panelBody = document.getElementById('panel-body-' + panelId);
  const panelHdr  = document.getElementById('panel-hdr-' + panelId);
  if (panelBody && panelBody.classList.contains('hidden')) {
    panelBody.classList.remove('hidden');
    if (panelHdr) panelHdr.classList.remove('collapsed');
  }
  // Scroll to item with a brief highlight flash
  const row = document.getElementById('row-' + itemId);
  if (!row) return;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.style.outline = '3px solid var(--red)';
  row.style.borderRadius = '4px';
  setTimeout(() => { row.style.outline = ''; row.style.borderRadius = ''; }, 2000);
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERALL STATUS
// ─────────────────────────────────────────────────────────────────────────────
function setOverallStatus(val, btn) {
  overallStatus = val;
  if (btn) overallStatusUserSet = true;
  document.querySelectorAll('.ost-btn').forEach(b => b.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  else {
    document.querySelectorAll('.ost-btn').forEach(b => { if (b.textContent.includes(val)) b.classList.add('selected'); });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNATURE PAD
// ─────────────────────────────────────────────────────────────────────────────
let custSigCtx = null, custSigDrawing = false, custSigHasData = false;
function initCustSig() {
  const canvas = document.getElementById('cust-sig-canvas');
  if (!canvas || custSigCtx) return;
  custSigCtx = canvas.getContext('2d');
  custSigCtx.strokeStyle = '#0d1b2a';
  custSigCtx.lineWidth = 2;
  custSigCtx.lineCap = 'round';
  const getPos = (e) => {
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
  };
  canvas.addEventListener('pointerdown', e => {
    custSigDrawing = true; const p = getPos(e);
    custSigCtx.beginPath(); custSigCtx.moveTo(p.x, p.y); e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!custSigDrawing) return; const p = getPos(e);
    custSigCtx.lineTo(p.x, p.y); custSigCtx.stroke(); custSigHasData = true; e.preventDefault();
  });
  canvas.addEventListener('pointerup', () => custSigDrawing = false);
  canvas.addEventListener('pointerleave', () => custSigDrawing = false);
}
function clearCustSig() { if (custSigCtx) custSigCtx.clearRect(0,0,500,100); custSigHasData = false; }

function initSig() {
  const canvas = document.getElementById('sig-canvas');
  if (!canvas || sigCtx) return;
  sigCtx = canvas.getContext('2d');
  sigCtx.strokeStyle = '#0d1b2a';
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = 'round';
  const getPos = (e) => {
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
  };
  canvas.addEventListener('pointerdown', e => {
    sigDrawing = true; const p = getPos(e);
    sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!sigDrawing) return; const p = getPos(e);
    sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); sigHasData = true; e.preventDefault();
  });
  canvas.addEventListener('pointerup', () => sigDrawing = false);
  canvas.addEventListener('pointerleave', () => sigDrawing = false);
}
function clearSig() { if (sigCtx) sigCtx.clearRect(0,0,500,100); sigHasData = false; }

function autoSign() {
  initSig();
  const canvas = document.getElementById('sig-canvas');
  if (!canvas || !sigCtx) return;
  sigCtx.clearRect(0, 0, canvas.width, canvas.height);

  const drawSig = () => {
    sigCtx.save();
    sigCtx.translate(18, 72);
    sigCtx.rotate(-0.05);
    sigCtx.font = '700 52px "Dancing Script"';
    sigCtx.fillStyle = '#0d1b2a';
    sigCtx.fillText('Alan Antonio', 0, 0);
    sigCtx.restore();
    sigHasData = true;
  };

  // Use document.fonts.load() for the specific variant — more reliable than .ready for canvas
  (document.fonts ? document.fonts.load('700 52px "Dancing Script"') : Promise.resolve()).then(drawSig);
}

// ─────────────────────────────────────────────────────────────────────────────
