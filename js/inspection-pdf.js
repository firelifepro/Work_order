// ─────────────────────────────────────────────────────────────────────────────
// COLLECT ALL FORM DATA  (complete snapshot for save/restore)
// ─────────────────────────────────────────────────────────────────────────────
function collectAllData() {
  const v = id => (document.getElementById(id)?.value || '').trim();

  // Collect ALL input/select/textarea values from the inspection panels
  const fieldData = {};
  document.querySelectorAll(
    '#sys-forms input, #sys-forms select, #sys-forms textarea,' +
    '#step-fa-panel input, #step-fa-panel select, #step-fa-panel textarea,' +
    '#step-sp-overview input, #step-sp-overview select, #step-sp-overview textarea,' +
    '#step-sp-inspection input, #step-sp-inspection select, #step-sp-inspection textarea,' +
    '#step-sp-drain input, #step-sp-drain select,' +
    '#step-sp-defic input, #step-sp-defic select, #step-sp-defic textarea'
  ).forEach(el => {
    if (el.id && el.type !== 'button') fieldData[el.id] = el.value;
  });
  // Also step-1 fields
  ['property-name','client-company','service-address','city-state-zip','property-contact-name','property-contact-email',
   'insp-date','report-type','inspector-name','inspector-cert','company-name',
   'company-license','nfpa-ref','weather'].forEach(id => {
    fieldData[id] = v(id);
  });

  // Collect pass/fail row states — save everything needed for restore
  const pfStates = {};
  document.querySelectorAll('.inspect-row[data-val]').forEach(row => {
    const itemId    = row.id.replace('row-', '');
    const labelEl   = row.querySelector('.inspect-label');
    const label     = labelEl?.childNodes[0]?.textContent?.trim() || itemId;
    const panelInfo = ITEM_PANEL_MAP[itemId] || { panelId: '', panelTitle: '' };
    pfStates[row.id] = {
      val:        row.dataset.val,
      defic:      document.getElementById('defic-txt-' + itemId)?.value || '',
      label,
      panelId:    panelInfo.panelId,
      panelTitle: panelInfo.panelTitle
    };
  });

  // Collect deficiency list (for summary)
  const deficiencies = [];
  const isGeneric = !['fire-alarm','sprinkler'].includes(activeInspectionSystem);
  const genericDeficRows = isGeneric ? document.querySelectorAll('#generic-defic-tbody tr') : [];

  if (isGeneric && genericDeficRows.length > 0) {
    // Use the reviewed+edited deficiency list from the dedicated defic step
    genericDeficRows.forEach(row => {
      const desc = row.querySelector('td:nth-child(2) input')?.value?.trim();
      if (desc) deficiencies.push({ item: desc, description: '' });
    });
  } else if (!isGeneric) {
    // FA/SP: scan inspect-rows for FAIL states
    document.querySelectorAll('.inspect-row').forEach(row => {
      if (row.dataset.val === 'FAIL') {
        const id = row.id.replace('row-','');
        const label = row.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id;
        const desc  = document.getElementById('defic-txt-' + id)?.value?.trim() || '';
        deficiencies.push({ item: label, description: desc });
      }
    });
  } else {
    // Generic: inspector hasn't visited defic step yet — fall back to inspect-row scan
    document.querySelectorAll('#sys-forms .inspect-row').forEach(row => {
      if (row.dataset.val === 'FAIL') {
        const id = row.id.replace('row-','');
        const label = row.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id;
        const desc  = document.getElementById('defic-txt-' + id)?.value?.trim() || '';
        deficiencies.push({ item: label, description: desc });
      }
    });
  }

  // For FA inspections, also collect from fa-defic-tbody (manually added rows)
  if (activeInspectionSystem === 'fire-alarm') {
    document.querySelectorAll('#fa-defic-tbody tr').forEach(row => {
      const desc = row.querySelector('td:nth-child(2) input')?.value?.trim();
      if (desc) deficiencies.push({ item: desc, description: '' });
    });
  }
  // For SP inspections, collect from sp-defic-tbody
  if (activeInspectionSystem === 'sprinkler') {
    document.querySelectorAll('#sp-defic-tbody tr').forEach(row => {
      const desc = row.querySelector('td:nth-child(2) input')?.value?.trim();
      if (desc) deficiencies.push({ item: desc, description: '' });
    });
  }

  // Extinguishers
  const extinguishers = [];
  for (let i = 1; i <= extUnitCount; i++) {
    if (!document.getElementById('ext-unit-row-' + i)) continue;
    const noteTxt = document.getElementById('u-note-txt-' + i)?.value?.trim() || '';
    extinguishers.push({
      rowNum:   i,
      flr:      document.getElementById('u-flr-' + i)?.value?.trim() || '',
      location: document.getElementById('u-loc-' + i)?.value?.trim() || '',
      mount:    document.getElementById('u-mount-' + i)?.value || '',
      cabM:     document.getElementById('u-cab-m-' + i)?.value || '',
      cabG:     document.getElementById('u-cab-g-' + i)?.value || '',
      cabS:     document.getElementById('u-cab-s-' + i)?.value || '',
      mfgYear:  document.getElementById('u-mfg-' + i)?.value?.trim() || '',
      size:     document.getElementById('u-size-' + i)?.value?.trim() || '',
      type:     document.getElementById('u-type-' + i)?.value || '',
      pf:       document.getElementById('u-pf-' + i)?.value || '',
      deficTxt: document.getElementById('u-defic-txt-' + i)?.value?.trim() || '',
      hydroDue: document.getElementById('u-hydro-' + i)?.value?.trim() || '',
      recharge: document.getElementById('u-recharge-' + i)?.value || '',
      newUnit:  document.getElementById('u-newunit-' + i)?.value || '',
      noteTxt,
    });
  }
  // Extinguisher summary sheet data
  const extSvcTable = typeof EXT_SVC_TYPES !== 'undefined' ? EXT_SVC_TYPES.map((type, i) => ({
    type,
    yr6:      document.getElementById('ext-svc-6yr-' + i)?.value || '',
    hydro:    document.getElementById('ext-svc-hydro-' + i)?.value || '',
    recharge: document.getElementById('ext-svc-recharge-' + i)?.value || '',
    newunit:  document.getElementById('ext-svc-newunit-' + i)?.value || '',
    notes:    document.getElementById('ext-svc-notes-' + i)?.value?.trim() || '',
  })) : [];
  const extQA = typeof EXT_QA_QUESTIONS !== 'undefined' ? EXT_QA_QUESTIONS.map((q, i) => ({
    q,
    ans:  document.getElementById('ext-qa-ans-' + i)?.value || '',
    note: document.getElementById('ext-qa-note-' + i)?.value?.trim() || '',
  })) : [];
  const extNfMallets  = document.getElementById('ext-nf-mallets')?.value || '';
  const extNfSignage  = document.getElementById('ext-nf-signage')?.value || '';
  const extNfGlass    = document.getElementById('ext-nf-glass')?.value?.trim() || '';
  const extTotalSvcDue = document.getElementById('ext-total-svc-due')?.value || '';

  // Exit Sign & Emergency Lighting units
  const elUnits = [];
  for (let i = 1; i <= elCount; i++) {
    if (!document.getElementById('el-row-' + i)) continue;
    elUnits.push({
      rowNum:   i,
      loc:      document.getElementById('el-loc-' + i)?.value?.trim() || '',
      type:     document.getElementById('el-type-' + i)?.value || '',
      pf30s:    document.getElementById('el-30s-' + i)?.value || '',
      pf90m:    document.getElementById('el-90m-' + i)?.value || '',
      pfBatt:   document.getElementById('el-batt-' + i)?.value || '',
      pf:       document.getElementById('el-pf-' + i)?.value || '',
      comments: document.getElementById('el-comments-' + i)?.value?.trim() || '',
    });
  }
  const esUnits = [];
  for (let i = 1; i <= esCount; i++) {
    if (!document.getElementById('es-row-' + i)) continue;
    esUnits.push({
      rowNum:    i,
      loc:       document.getElementById('es-loc-' + i)?.value?.trim() || '',
      type:      document.getElementById('es-type-' + i)?.value || '',
      pfIllum:   document.getElementById('es-illum-' + i)?.value || '',
      pfArrows:  document.getElementById('es-arrows-' + i)?.value || '',
      pfBatt:    document.getElementById('es-batt-' + i)?.value || '',
      pf:        document.getElementById('es-pf-' + i)?.value || '',
      comments:  document.getElementById('es-comments-' + i)?.value?.trim() || '',
    });
  }

  return {
    meta: { generatedAt: new Date().toISOString(), version: '3.0' },
    property: {
      name:         v('property-name') || document.getElementById('property-select')?.value || v('service-address') || '',
      acct:         _currentPropertyAcct,
      company:      v('client-company'),
      address:      v('service-address'),
      cityStateZip: v('city-state-zip'),
      contact:      v('property-contact-name'),
      contactEmail: v('property-contact-email')
    },
    inspection: {
      date:         v('insp-date'),
      reportType:   v('report-type'),
      inspectorName:v('inspector-name'),
      inspectorCert:v('inspector-cert'),
      companyName:  v('company-name'),
      companyLicense:v('company-license'),
      nfpaRef:      v('nfpa-ref'),
      weather:      v('weather')
    },
    inspectionSystem: activeInspectionSystem,
    systems:      activeInspectionSystem ? [activeInspectionSystem] : [...activeSystems],
    overallStatus,
    generalNotes: v('general-notes'),
    fieldData,
    pfStates,
    deficiencies,
    extinguishers,
    extSvcTable,
    extQA,
    extNfMallets,
    extNfSignage,
    extNfGlass,
    extTotalSvcDue,
    elUnits,
    esUnits,
    signature: { name: v('sig-name'), date: v('sig-date'), hasDrawnSig: sigHasData }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTORE FORM DATA from a saved inspection
// Restores all typed fields + extinguisher rows.
// Does NOT restore pass/fail states (new inspection = fresh assessment).
// ─────────────────────────────────────────────────────────────────────────────
function restoreInspectionData(data) {
  if (!data) return;

  // Restore step-1 fields (but NOT insp-date — that should be today)
  const skip = new Set(['insp-date']);
  if (data.fieldData) {
    Object.entries(data.fieldData).forEach(([id, val]) => {
      if (skip.has(id)) return;
      const el = document.getElementById(id);
      if (el && el.type !== 'button') el.value = val;
    });
  }

  // Restore notes fields directly too
  if (data.inspection) {
    const map = {
      'inspector-name':    data.inspection.inspectorName,
      'inspector-cert':    data.inspection.inspectorCert,
      'company-name':      data.inspection.companyName,
      'company-license':   data.inspection.companyLicense,
      'nfpa-ref':          data.inspection.nfpaRef,
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    });
  }

  // Restore general notes
  if (data.generalNotes) {
    const el = document.getElementById('general-notes');
    if (el) el.value = data.generalNotes;
  }

  // Restore overall status (user can change it)
  if (data.overallStatus) setOverallStatus(data.overallStatus);
}

// Called after forms are built to restore panel field values
function restorePanelFields(data) {
  if (!data?.fieldData) return;
  const skip = new Set(['insp-date', 'report-type']);
  Object.entries(data.fieldData).forEach(([id, val]) => {
    if (skip.has(id)) return;
    const el = document.getElementById(id);
    if (el && el.type !== 'button' && !el.closest('#step-1')) {
      // For selects restore by value
      if (el.tagName === 'SELECT') {
        const opt = [...el.options].find(o => o.value === val);
        if (opt) el.value = val;
      } else {
        el.value = val;
      }
    }
  });
}

// Restore extinguisher rows from saved data
function restoreExtinguishers(extData) {
  if (!extData || extData.length === 0) return;
  // Clear the default empty rows first
  const tbody = document.getElementById('ext-tbody');
  if (tbody) tbody.innerHTML = '';
  extUnitCount = 0;
  extData.forEach(ext => {
    addExtUnitRow(ext);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD PDF DOC  — returns a jsPDF instance (caller handles save/upload)
// ─────────────────────────────────────────────────────────────────────────────
async function buildPDFDoc() {
  const data = collectAllData();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W = 215.9, ML = 14, MR = 14;
  const usableW = W - ML - MR;
  let y = 0;

  // ── Font sizes ──
  const FS = { title: 13, heading: 10.5, body: 9, small: 8, label: 7, tiny: 6.5 };

  // ── Color helpers ──
  const C = {
    navy:    [13, 27, 42],
    navy2:   [30, 48, 74],
    blue:    [37, 99, 235],
    white:   [255,255,255],
    slate:   [100,116,139],
    light:   [248,250,252],
    border:  [226,232,240],
    green:   [22,163,74],
    red:     [220,38,38],
    amber:   [180,100,0],
    passGrn: [240,253,244],
    failRed: [254,242,242],
    passTxt: [20,120,50],
    failTxt: [180,20,20],
  };
  const setFill  = (c) => doc.setFillColor(...c);
  const setDraw  = (c) => doc.setDrawColor(...c);
  const setTxt   = (c) => doc.setTextColor(...c);
  const setFont  = (s, w) => { doc.setFontSize(s); doc.setFont('helvetica', w||'normal'); };

  // ── Status color ──
  const statusC = data.overallStatus === 'COMPLIANT' ? C.green :
                  data.overallStatus === 'IMPAIRED'  ? C.red   : C.amber;

  // ── Page footer helper ──
  function drawPageFooter() {
    const pg = doc.internal.getCurrentPageInfo().pageNumber;
    setFont(FS.tiny); setTxt([160,160,160]);
    doc.text('Upload to The Compliance Engine (Brycer) at thecomplianceengine.com', ML, 274);
    doc.text(`Generated by FLIPS  |  ${new Date().toLocaleString()}`, W - MR, 274, { align:'right' });
    setTxt([180,180,180]);
    // page number added after all pages are done
  }

  // ── Page header (for continuation pages) ──
  function drawContinuationHeader() {
    setFill(C.navy); doc.rect(0, 0, W, 12, 'F');
    setTxt(C.white); setFont(FS.small, 'bold');
    doc.text('FIRE LIFE PROTECTION SYSTEMS  |  INSPECTION REPORT (continued)', ML, 8);
    setTxt(statusC); setFont(FS.small, 'bold');
    doc.text(data.property.name || '', W - MR, 8, { align:'right' });
    y = 18;
  }

  function checkPage(needed) {
    if (y + (needed || 14) > 266) {
      drawPageFooter();
      doc.addPage();
      drawContinuationHeader();
    }
  }

  // ══════════════════════════════════════════════════════════
  // PAGE 1 HEADER BLOCK
  // ══════════════════════════════════════════════════════════
  setFill(C.navy); doc.rect(0, 0, W, 26, 'F');
  setTxt(C.white); setFont(FS.title, 'bold');
  doc.text('FIRE LIFE PROTECTION SYSTEMS', ML, 12);
  setFont(FS.small); doc.setFont('helvetica','normal');
  doc.text('Fire Inspection & Protection Services', ML, 19);

  setTxt(statusC); setFont(FS.heading, 'bold');
  doc.text(data.overallStatus || 'STATUS PENDING', W - MR, 11, { align:'right' });
  setTxt(C.white); setFont(FS.tiny);
  doc.text('INSPECTION, TESTING & MAINTENANCE REPORT', W - MR, 17, { align:'right' });
  y = 32;

  // ══════════════════════════════════════════════════════════
  // PROPERTY INFO BLOCK — dynamic height, no overlap
  // ══════════════════════════════════════════════════════════
  const propName   = data.property.name || 'Property Not Selected';
  const addrLine   = [data.property.address, data.property.cityStateZip].filter(Boolean).join(', ');
  const emailPart   = data.property.contactEmail ? '   Email: ' + data.property.contactEmail + '   |  ' : '';
  const contactLine = 'Contact: ' + (data.property.contact || '—') + '   |   ' + emailPart + 'Company: ' + (data.property.company || '—');

  // Left column
  setFont(FS.heading,'bold'); setTxt(C.navy);
  const propNameLines = doc.splitTextToSize(propName, 120);
  doc.text(propNameLines, ML + 3, y + 7);
  let leftH = propNameLines.length * 5.5 + 7;
  setFont(FS.body); setTxt([70,70,70]);
  doc.text(addrLine, ML + 3, y + leftH + 1);
  leftH += 5;
  setFont(FS.small); setTxt([90,90,90]);
  const clines = doc.splitTextToSize(contactLine, 120);
  doc.text(clines, ML + 3, y + leftH + 1);
  leftH += clines.length * 4.2 + 2;

  // Right column (always 4 rows × ~6mm each = 28mm)
  const rCol = ML + 130;
  const rColW = usableW - 130;
  const kvRight = (lbl, val, ry) => {
    setFont(FS.label,'bold'); setTxt(C.slate);
    doc.text(lbl, rCol, y + ry);
    setFont(FS.body,'normal'); setTxt(C.navy);
    doc.text(String(val||'—'), rCol, y + ry + 4.5);
  };
  kvRight('INSPECTION DATE',   data.inspection.date || '—',            5);
  kvRight('REPORT TYPE',       data.inspection.reportType || '—',      16);
  kvRight('NFPA STANDARDS',    data.inspection.nfpaRef || 'NFPA 72, 25', 27);

  const blockH = Math.max(leftH + 4, 38);
  setFill(C.light); setDraw(C.border);
  doc.rect(ML, y, usableW, blockH, 'FD');
  // Redraw text on top of box (jsPDF draws box over text, so re-apply)
  setFont(FS.heading,'bold'); setTxt(C.navy);
  doc.text(propNameLines, ML + 3, y + 7);
  let lh2 = propNameLines.length * 5.5 + 7;
  setFont(FS.body); setTxt([70,70,70]);
  doc.text(addrLine, ML + 3, y + lh2 + 1);
  lh2 += 5;
  setFont(FS.small); setTxt([90,90,90]);
  doc.text(clines, ML + 3, y + lh2 + 1);
  // Divider line
  setDraw([200,210,220]); doc.line(ML + 128, y + 2, ML + 128, y + blockH - 2);
  kvRight('INSPECTION DATE',   data.inspection.date || '—',            5);
  kvRight('REPORT TYPE',       data.inspection.reportType || '—',      16);
  kvRight('NFPA STANDARDS',    data.inspection.nfpaRef || 'NFPA 72, 25', 27);
  y += blockH + 4;

  // ── Inspector row ──
  const inspItems = [
    ['Inspector', data.inspection.inspectorName],
    ['License/Cert', data.inspection.inspectorCert],
    ['Company', data.inspection.companyName],
    ['Co. License', data.inspection.companyLicense],
    ['Weather', data.inspection.weather],
  ];
  const colW5 = usableW / inspItems.length;
  inspItems.forEach((item, i) => {
    const ix = ML + i * colW5;
    setFont(FS.tiny,'bold'); setTxt(C.slate);
    doc.text(item[0].toUpperCase(), ix, y + 3.5);
    setFont(FS.small,'normal'); setTxt(C.navy);
    const vlines = doc.splitTextToSize(item[1]||'—', colW5 - 2);
    doc.text(vlines, ix, y + 8);
  });
  // Systems inspected row
  setFont(FS.tiny,'bold'); setTxt(C.slate);
  doc.text('SYSTEMS INSPECTED', ML, y + 15);
  setFont(FS.small,'normal'); setTxt(C.navy);
  const sysNames = { 'fire-alarm':'Fire Alarm','sprinkler':'Sprinkler','fire-pump':'Fire Pump',
    'standpipe':'Standpipe','hood':'Kitchen Hood','extinguisher':'Extinguishers',
    'hydrant':'Hydrants','bda':'BDA/Radio','smoke-control':'Smoke Control',
    'gas-detection':'Gas Detection','special-suppression':'Special Suppression','backflow':'Backflow' };
  const sysList = data.systems.map(s => sysNames[s]||s).join('  |  ');
  const syslines = doc.splitTextToSize(sysList, usableW);
  doc.text(syslines, ML, y + 20);
  y += 25 + (syslines.length > 1 ? (syslines.length-1)*4 : 0);
  setDraw(C.border); doc.line(ML, y, ML + usableW, y); y += 5;

  // ══════════════════════════════════════════════════════════
  // DEFICIENCY SUMMARY (if any)
  // ══════════════════════════════════════════════════════════
  if (data.deficiencies.length > 0) {
    checkPage(data.deficiencies.length * 8 + 16);
    setFill([254,226,226]); setDraw([220,38,38]);
    const defBlockH = data.deficiencies.length * 7 + 12;
    doc.roundedRect(ML, y, usableW, defBlockH, 1.5, 1.5, 'FD');
    setFont(FS.body,'bold'); setTxt([185,28,28]);
    doc.text('DEFICIENCIES FOUND: ' + data.deficiencies.length + ' ITEM(S) REQUIRING ATTENTION', ML + 4, y + 7);
    let dy = y + 13;
    data.deficiencies.forEach(d => {
      setFont(FS.small,'bold'); setTxt([180,20,20]);
      const dtxt = doc.splitTextToSize('- ' + d.item + (d.description ? ': ' + d.description : ''), usableW - 8);
      doc.text(dtxt, ML + 5, dy);
      dy += dtxt.length * 4;
    });
    y += defBlockH + 6;
  }

  // ══════════════════════════════════════════════════════════
  // SECTION HEADER
  // ══════════════════════════════════════════════════════════
  function sectionHdr(title) {
    checkPage(12);
    setFill(C.navy2); doc.rect(ML, y, usableW, 7, 'F');
    setTxt(C.white); setFont(FS.small,'bold');
    doc.text(title, ML + 3, y + 4.8);
    y += 9; setTxt([20,20,20]);
  }

  // ══════════════════════════════════════════════════════════
  // DATA FIELD ROW — renders key/value pairs in columns
  // ══════════════════════════════════════════════════════════
  function dataFieldRow(fields) {
    // fields: array of {label, id} — reads value from DOM
    if (!fields || fields.length === 0) return;
    const colN = Math.min(fields.length, 3);
    const cw   = usableW / colN;
    let maxLines = 1;
    fields.forEach((f, i) => {
      const x = ML + (i % colN) * cw;
      if (i > 0 && i % colN === 0) { y += maxLines * 4.5 + 2; maxLines = 1; }
      setFont(FS.tiny,'bold'); setTxt(C.slate);
      doc.text((f.label||'').toUpperCase(), x, y);
      const val = document.getElementById(f.id)?.value?.trim() || '—';
      setFont(FS.small,'normal'); setTxt([30,30,30]);
      const vl = doc.splitTextToSize(val, cw - 3);
      doc.text(vl, x, y + 4);
      if (vl.length > maxLines) maxLines = vl.length;
    });
    y += maxLines * 4.5 + 4;
  }

  // ══════════════════════════════════════════════════════════
  // INSPECTION RESULT ROW
  // ══════════════════════════════════════════════════════════
  function inspRow(label, result, deficDesc) {
    checkPage(result === 'FAIL' && deficDesc ? 14 : 8);
    const bgColor = result === 'PASS' ? C.passGrn : result === 'FAIL' ? C.failRed :
                    result === 'N/A'  ? [248,250,252] : [255,255,255];
    setFill(bgColor); doc.rect(ML, y, usableW, 7, 'F');
    setDraw(C.border); doc.line(ML, y + 7, ML + usableW, y + 7);

    // Label
    setFont(FS.small,'normal'); setTxt([25,25,25]);
    const labelLines = doc.splitTextToSize(label, usableW - 26);
    doc.text(labelLines, ML + 2, y + 4.8);

    // Result badge
    if (result) {
      const badgeC = result === 'PASS' ? C.green : result === 'FAIL' ? C.red : C.slate;
      setFill(badgeC);
      doc.roundedRect(W - MR - 20, y + 1, 20, 5, 1, 1, 'F');
      setTxt(C.white); setFont(FS.tiny,'bold');
      doc.text(result, W - MR - 10, y + 4.8, { align:'center' });
    }
    y += labelLines.length > 1 ? labelLines.length * 4 + 2 : 8;

    if (result === 'FAIL' && deficDesc) {
      checkPage(8);
      setFill([255,236,236]); doc.rect(ML + 3, y, usableW - 3, 6.5, 'F');
      setTxt([160,10,10]); setFont(FS.tiny,'italic');
      const dl = doc.splitTextToSize('Deficiency: ' + deficDesc, usableW - 10);
      doc.text(dl, ML + 5, y + 4);
      y += dl.length * 3.8 + 2.5;
    }
    setTxt([20,20,20]);
  }

  // ══════════════════════════════════════════════════════════
  // SYSTEM-SPECIFIC DATA FIELDS MAP
  // ══════════════════════════════════════════════════════════
  const systemDataFields = {
    'fire-alarm': [
      [{label:'Panel Make',id:'fa-cp-make'},{label:'Panel Model',id:'fa-cp-model'},{label:'Serial #',id:'fa-cp-serial'}],
      [{label:'Panel Location',id:'fa-cp-location'},{label:'Panel Type',id:'fa-cp-type'},{label:'# Zones/Loops',id:'fa-cp-zones'}],
      [{label:'Year Installed',id:'fa-cp-year'},{label:'Battery Install Date',id:'fa-cp-batt-date'}],
      [{label:'Dialer Make',id:'fa-dr-make'},{label:'Dialer Model',id:'fa-dr-model'},{label:'Dialer Type',id:'fa-dr-type'}],
      [{label:'Monitored?',id:'fa-monitored'},{label:'Monitoring Company',id:'fa-monitor-company'},{label:'Account #',id:'fa-monitor-account'}],
      [{label:'Monitor Phone',id:'fa-monitor-phone'},{label:'Time Offline',id:'fa-monitor-offline'},{label:'Time Online',id:'fa-monitor-online'}],
      [{label:'Monitoring Notes',id:'fa-monitor-notes'}],
    ],
    'sprinkler': [
      [{label:'System Type',id:'sp-type'},{label:'Manufacturer',id:'sp-mfr'},{label:'Year Installed',id:'sp-year'}],
      [{label:'Total Heads',id:'sp-heads'},{label:'Coverage (sq ft)',id:'sp-coverage'},{label:'Hazard Class',id:'sp-hazard'}],
      [{label:'Water Supply',id:'sp-water-src'},{label:'Static PSI',id:'sp-static-psi'},{label:'Residual PSI',id:'sp-residual-psi'}],
      [{label:'Waterflow Time (sec)',id:'sp-wf-time'},{label:'Spare Head Types',id:'sp-spare-types'},{label:'5-Year Items Next Due',id:'sp-5yr-due'}],
      [{label:'Last Trip Test Date',id:'sp-trip-date'},{label:'Trip Pressure (PSI)',id:'sp-trip-psi'}],
    ],
    'fire-pump': [
      [{label:'Manufacturer',id:'fp-mfr'},{label:'Model',id:'fp-model'},{label:'Serial #',id:'fp-serial'}],
      [{label:'Driver Type',id:'fp-type'},{label:'Rated GPM',id:'fp-rated-gpm'},{label:'Rated PSI',id:'fp-rated-psi'}],
      [{label:'RPM',id:'fp-rpm'},{label:'Horsepower',id:'fp-hp'},{label:'Year Installed',id:'fp-year'}],
      [{label:'Jockey Start PSI',id:'fp-jockey-start'},{label:'Jockey Stop PSI',id:'fp-jockey-stop'}],
      [{label:'Churn Suction PSI',id:'fp-churn-suction'},{label:'Churn Discharge PSI',id:'fp-churn-discharge'},{label:'Churn RPM',id:'fp-churn-rpm'}],
      [{label:'Churn Voltage',id:'fp-churn-volts'},{label:'Churn Amps',id:'fp-churn-amps'}],
      [{label:'Flow GPM',id:'fp-flow-gpm'},{label:'Flow Suction PSI',id:'fp-flow-suction'},{label:'Flow Discharge PSI',id:'fp-flow-discharge'}],
      [{label:'Flow RPM',id:'fp-flow-rpm'},{label:'Flow Voltage',id:'fp-flow-volts'},{label:'Flow Amps',id:'fp-flow-amps'}],
      [{label:'Oil Pressure PSI',id:'fp-diesel-oil'},{label:'Coolant Temp F',id:'fp-diesel-temp'},{label:'Engine Hours',id:'fp-diesel-hours'}],
    ],
    'standpipe': [
      [{label:'Class',id:'std-class'},{label:'System Type',id:'std-type'},{label:'# Standpipes',id:'std-count'}],
      [{label:'# Floors',id:'std-floors'},{label:'# Hose Stations',id:'std-hose-stations'}],
      [{label:'PRV Static PSI',id:'std-prv-static'},{label:'PRV Residual PSI',id:'std-prv-residual'}],
      [{label:'Flow Test PSI',id:'std-flow-psi'},{label:'Flow GPM',id:'std-flow-gpm'},{label:'Last Flow Test',id:'std-flow-date'}],
    ],
    'hood': [
      [{label:'Manufacturer',id:'hood-mfr'},{label:'Model/Cylinder',id:'hood-model'},{label:'Year Installed',id:'hood-install'}],
      [{label:'Agent Type',id:'hood-agent'},{label:'# Nozzles',id:'hood-nozzle-count'},{label:'Last Service',id:'hood-last-service'}],
      [{label:'Cylinder Weight (actual)',id:'hood-cyl-wt-actual'},{label:'Min. Acceptable Weight',id:'hood-cyl-wt-min'}],
      [{label:'Next Service Due',id:'hood-next-service'},{label:'Tag Color/ID',id:'hood-tag-color'}],
    ],
    'hydrant': [
      [{label:'# Hydrants',id:'hy-count'},{label:'Hydrant Type',id:'hy-type'},{label:'Last Flow Test',id:'hy-last-flow'}],
      [{label:'Flow Static PSI',id:'hy-flow-static'},{label:'Flow Residual PSI',id:'hy-flow-residual'},{label:'Flow GPM',id:'hy-flow-gpm'}],
    ],
    'bda': [
      [{label:'Manufacturer',id:'bda-mfr'},{label:'Model',id:'bda-model'},{label:'Year Installed',id:'bda-install'}],
      [{label:'Frequencies',id:'bda-freqs'},{label:'Floors/Areas Covered',id:'bda-coverage-floors'},{label:'AHJ Cert/FCC License',id:'bda-ahj-cert'}],
      [{label:'Min Signal (dBm)',id:'bda-min-signal'},{label:'Worst Coverage Location',id:'bda-worst-loc'},{label:'Next Test Date',id:'bda-next-test'}],
    ],
    'smoke-control': [
      [{label:'System Type',id:'sc-type'},{label:'# Zones',id:'sc-zones'},{label:'Year Installed',id:'sc-year'}],
      [{label:'# Fans',id:'sc-fans'},{label:'# Dampers',id:'sc-dampers'},{label:'Pressure Differential',id:'sc-pressure-val'}],
    ],
    'gas-detection': [
      [{label:'Manufacturer',id:'gd-mfr'},{label:'Model',id:'gd-model'},{label:'Gas Type',id:'gd-gas-type'}],
      [{label:'# Sensors',id:'gd-sensor-count'},{label:'# Zones',id:'gd-zones'},{label:'Year Installed',id:'gd-install-date'}],
      [{label:'Low Alarm Setpoint',id:'gd-alarm-setpoint-lo'},{label:'High Alarm Setpoint',id:'gd-alarm-setpoint-hi'}],
      [{label:'Sensor Age/Last Replaced',id:'gd-sensor-age'},{label:'Next Replacement Due',id:'gd-sensor-due'}],
    ],
    'special-suppression': [
      [{label:'System Type',id:'ss-type'},{label:'Manufacturer',id:'ss-mfr'},{label:'Protected Area',id:'ss-area'}],
      [{label:'Agent Name',id:'ss-agent'},{label:'# Cylinders',id:'ss-cylinders'},{label:'Year Installed',id:'ss-install'}],
      [{label:'Actual Weight (lbs)',id:'ss-actual-wt'},{label:'Min. Required (lbs)',id:'ss-min-wt'},{label:'Cylinder PSI',id:'ss-pressure'}],
      [{label:'Last Full Service',id:'ss-last-service'},{label:'Next Service Due',id:'ss-next-service'}],
    ],
    'backflow': [
      [{label:'Manufacturer',id:'bf-mfr'},{label:'Model',id:'bf-model'},{label:'Serial #',id:'bf-serial'}],
      [{label:'Device Type',id:'bf-type'},{label:'Size',id:'bf-size'},{label:'Location',id:'bf-location'}],
      [{label:'Check 1 Open PSI',id:'bf-check1-open'},{label:'Check 1 Close PSI',id:'bf-check1-close'}],
      [{label:'Check 2 Open PSI',id:'bf-check2-open'},{label:'Check 2 Close PSI',id:'bf-check2-close'}],
      [{label:'RV Diff PSI',id:'bf-rv-open'},{label:'Test Date',id:'bf-test-date'}],
      [{label:"Tester's Cert #",id:'bf-cert-number'},{label:'Cert. Expiration',id:'bf-cert-exp'}],
    ],
    'exit-sign-lighting': [
      [{label:'# Emergency Lighting Units',id:'esl-el-count'},{label:'# Exit Signs',id:'esl-es-count'}],
    ],
  };

  // ══════════════════════════════════════════════════════════
  // INSPECTION ITEM IDS PER SYSTEM
  // ══════════════════════════════════════════════════════════
  const systemInspItems = {
    'fire-alarm':['fa-panel-cond','fa-battery','fa-batt-date','fa-ac-power','fa-tamper','fa-trouble','fa-smoke-test','fa-heat-test','fa-pull-test','fa-duct-smoke','fa-co','fa-horns','fa-horn-sync','fa-mass-notif','fa-valve-super','fa-waterflow','fa-monitoring-test','fa-annunciator','fa-elevator','fa-door-release','fa-suppression-rel','fa-tags','fa-logbook'],
    'sprinkler': ['sp-main-drain','sp-control-valve','sp-os-y','sp-piv','sp-check-valve','sp-gauges','sp-waterflow','sp-waterflow-cs','sp-heads-visual','sp-heads-clearance','sp-spare-heads','sp-head-type-match','sp-pipe-visual','sp-hanger-spacing','sp-pipe-support','sp-air-pressure','sp-dp-valve','sp-low-air','sp-quick-open','sp-5yr-pipe','sp-5yr-fdc','sp-gauges-5yr'],
    'fire-pump': ['fp-controller-cond','fp-controller-auto','fp-jockey-type','fp-jockey-cycles','fp-churn-test','fp-flow-test','fp-diesel-start','fp-diesel-fuel','fp-diesel-battery','fp-diesel-coolant','fp-diesel-run','fp-power-fail-alarm','fp-phase-alarm','fp-room-temp','fp-suction-valve'],
    'standpipe': ['std-fdc','std-fdc-sign','std-hose-valves','std-prv','std-check-valve','std-flow-test','std-hose-cond','std-nozzle','std-cabinet'],
    'hood':      ['hood-cylinder-wt','hood-pull-station','hood-auto-detect','hood-micro-switch','hood-nozzle-cond','hood-nozzle-coverage','hood-duct-protected','hood-gas-shutoff','hood-power-shutoff','hood-fa-integration','hood-ansul-reset','hood-grease-buildup','hood-filter-cond','hood-service-tag'],
    'extinguisher':['ext-mounted','ext-signage','ext-6yr','ext-hydro'],
    'hydrant':   ['hy-caps','hy-drainage','hy-painted','hy-clearance','hy-operation','hy-gate-valve','hy-outlet-threads','hy-flow-test'],
    'bda':       ['bda-uplink','bda-downlink','bda-coverage','bda-power','bda-backup-power','bda-donor-antenna','bda-internal-antenna','bda-alarms','bda-fa-interface','bda-permit','bda-coverage-map'],
    'smoke-control':['sc-fans-op','sc-cfm','sc-pressure','sc-dampers-op','sc-fire-dampers','sc-damper-access','sc-control-panel','sc-fa-integration','sc-override','sc-detector-input'],
    'gas-detection':['gd-sensor-test','gd-alarm-test','gd-gas-shutoff','gd-ventilation','gd-power','gd-backup','gd-control-panel','gd-fa-integration','gd-calibration-cert'],
    'special-suppression':['ss-agent-wt','ss-detection','ss-pull','ss-abort','ss-discharge-time','ss-nozzles','ss-coverage','ss-room-integrity','ss-hvac-shutoff','ss-power-shutoff','ss-fa-integration','ss-recharge-cert'],
    'backflow':  ['bf-test','bf-passed','bf-casing','bf-shutoffs','bf-clearance','bf-freeze'],
    'exit-sign-lighting': [],
  };

  const systemTitles = {
    'fire-alarm':          'FIRE ALARM SYSTEM  (NFPA 72)',
    'sprinkler':           'SPRINKLER SYSTEM  (NFPA 25)',
    'fire-pump':           'FIRE PUMP  (NFPA 25 Ch. 8)',
    'standpipe':           'STANDPIPE SYSTEM  (NFPA 25 Ch. 6)',
    'hood':                'KITCHEN HOOD SUPPRESSION  (NFPA 17A)',
    'extinguisher':        'PORTABLE FIRE EXTINGUISHERS  (NFPA 10)',
    'hydrant':             'PRIVATE HYDRANTS  (NFPA 25 Ch. 7)',
    'bda':                 'BDA / EMERGENCY RADIO COMMUNICATION  (NFPA 72 Ch. 24)',
    'smoke-control':       'SMOKE CONTROL SYSTEM  (NFPA 92)',
    'gas-detection':       'GAS DETECTION SYSTEM',
    'special-suppression': 'SPECIAL SUPPRESSION SYSTEM  (NFPA 2001 / 11 / 17)',
    'backflow':            'BACKFLOW PREVENTION DEVICE',
    'exit-sign-lighting':  'EXIT SIGN & EMERGENCY LIGHTING  (NFPA 101)',
  };

  const notesIds = {
    'fire-alarm':'fa-notes','sprinkler':'sp-notes','fire-pump':'fp-notes',
    'standpipe':'std-notes','hood':'hood-notes','hydrant':'hy-notes',
    'bda':'bda-notes','smoke-control':'sc-notes','gas-detection':'gd-notes',
    'special-suppression':'ss-notes','backflow':'bf-notes','extinguisher':'ext-notes',
    'exit-sign-lighting':'esl-notes',
  };

  // ── Render active system ──
  [activeInspectionSystem].filter(Boolean).forEach(sys => {
    const title = systemTitles[sys] || sys.toUpperCase();
    sectionHdr(title);

    // Data fields
    const dFields = systemDataFields[sys];
    if (dFields) {
      dFields.forEach(row => dataFieldRow(row));
    }

    if (sys === 'fire-alarm') {
      // ── FA-wizard-specific rendering ──
      const grpVal = (grp) => grp?.querySelector('.pf-btn.selected')?.textContent?.trim() || '';
      const ynaVal = (row) => {
        if (row.querySelector('.yna-btn.y.selected'))  return 'Y';
        if (row.querySelector('.yna-btn.n.selected'))  return 'N';
        if (row.querySelector('.yna-btn.na.selected')) return 'N/A';
        return 'N/A';
      };
      const subHdr = (title) => {
        checkPage(10);
        setFill([240,244,252]); doc.rect(ML, y, usableW, 5.5, 'F');
        setFont(FS.tiny,'bold'); setTxt([50,80,130]);
        doc.text(title, ML + 2, y + 4); y += 7;
      };
      const tblHdr = (cols, widths) => {
        setFill(C.navy2); doc.rect(ML, y, usableW, 5.5, 'F');
        let tx = ML;
        cols.forEach((h, i) => {
          setFont(FS.tiny,'bold'); setTxt(C.white);
          doc.text(h, tx + 1.5, y + 4); tx += widths[i];
        });
        y += 6;
      };

      // NFPA References & Procedure
      {
        subHdr('NFPA REFERENCES AND PROCEDURE');
        const nfpaParas = [
          'YOUR ENTIRE FIRE ALARM SYSTEM IS REQUIRED TO BE THROUGHLY INSPECTED, TESTED AND MAINTAINED EACH YEAR BY AN APPROVED SERVICING COMPANY IN ACCORDANCE WITH THE FOLLOWING NFPA CHAPTER REFERENCES:',
          'CHAPTER 14 OF NFPA 72 (SEE NFPA 72(10), TABLES 14.3.1 AND 14.4.5; SEE ALSO: NFPA 90A(12), SEC.6.4.1).',
          'TESTING MUST INCLUDE CONTROL EQUIPMENT, REMOTE ANNUNCIATORS, INITIATING DEVICES, HVAC SHUTDOWN DEVICES AND ALARM NOTIFICATION APPLIANCES. SEE THE BELOW LIST OF VARIOUS TESTING DEVICES:',
        ];
        const nfpaBullets = [
          'VISUAL AND FUNCTIONAL TESTING OF THE FIRE ALARM CONTROL PANEL (FACP) AND COMPONENTS',
          'VISUAL AND FUNCTIONAL TESTING OF THE REMOTE POWER SUPPLIES (IF APPLICABLE)',
          'VISUAL AND FUNCTIONAL LOAD TESTING OF THE FACP AND REMOTE POWER SUPPLY BATTERIES. (ANNUAL & SEMI ANNUAL)',
          'VISUAL AND FUNCTIONAL TESTING OF THE AUTOMATIC AND MANUAL ALARM INITIATING DEVICES. (ANNUAL ONLY/FUNCTIONAL)',
          'VISUAL AND FUNCTIONAL TESTING OF THE TAMPER AND WATER FLOW DEVICES',
          'VISUAL AND FUNCTIONAL TESTING OF THE AUDIBLE AND VISUAL NOTIFICATION APPLIANCES (ANNUAL ONLY/FUNCTIONAL)',
          'ALARM SIGNAL TRANSMISSION TO CENTRAL STATION VERIFICATION (IF APPLICABLE)',
          'VISUAL AND FUNCTIONAL TESTING OF THE GRAPHIC MAP DEVICE LOCATION VERIFICATION & ACCURACY (IF APPLICABLE)',
          'HVAC AND DAMPER CONTROL RELAYS FUNCTIONAL TESTING (ANNUAL ONLY/FUNCTIONAL).',
          'DOOR RELEASING RELAYS FUNCTIONAL TESTING (IF APPLICABLE) (ANNUAL ONLY/FUNCTIONAL).',
          'DOCUMENTATION OF SYSTEM TESTING AND WHEN APPLICABLE GENERATION OF SYSTEM DEFICIENCIES REPORT',
        ];
        nfpaParas.forEach(para => {
          checkPage(12);
          const lines = doc.splitTextToSize(para, usableW - 6);
          setFont(FS.tiny, 'normal'); setTxt([30, 30, 30]);
          doc.text(lines, ML + 3, y + 3.5);
          y += lines.length * 4.2 + 3;
        });
        nfpaBullets.forEach(bullet => {
          checkPage(8);
          const lines = doc.splitTextToSize(bullet, usableW - 10);
          setFont(FS.tiny, 'normal'); setTxt([30, 30, 30]);
          doc.text('\u2022', ML + 3, y + 3.5);
          doc.text(lines, ML + 7, y + 3.5);
          y += lines.length * 4.2 + 1;
        });
        y += 5;
      }

      // Panel Testing Instructions
      const instrVal = document.getElementById('fa-panel-instructions')?.value?.trim();
      if (instrVal) {
        checkPage(12);
        setFill([255,253,235]); setDraw([254,215,0]);
        const il = doc.splitTextToSize('Panel Instructions: ' + instrVal, usableW - 6);
        const ih = il.length * 4 + 5;
        doc.rect(ML, y, usableW, ih, 'FD');
        setFont(FS.small,'italic'); setTxt([92,70,0]);
        doc.text(il, ML + 3, y + 4.5);
        y += ih + 3;
      }

      // Pre/Post Checklist
      const preEl  = document.getElementById('fa-pre-checklist');
      const postEl = document.getElementById('fa-post-checklist');
      if (preEl || postEl) {
        subHdr('PRE & POST INSPECTION CHECKLIST');
        const renderCL = (el, label) => {
          if (!el || !el.children.length) return;
          checkPage(8);
          setFont(FS.tiny,'bold'); setTxt(C.slate);
          doc.text(label, ML, y); y += 4;
          el.querySelectorAll('.inspect-row').forEach(row => {
            checkPage(6);
            const lbl = row.querySelector('.inspect-label')?.textContent?.trim() || '';
            const val = ynaVal(row);
            const bgC = val === 'Y' ? C.passGrn : val === 'N' ? C.failRed : [248,250,252];
            setFill(bgC); doc.rect(ML, y, usableW, 6, 'F');
            setDraw(C.border); doc.line(ML, y + 6, ML + usableW, y + 6);
            setFont(FS.small,'normal'); setTxt([25,25,25]);
            const ll = doc.splitTextToSize(lbl, usableW - 22);
            doc.text(ll, ML + 2, y + 4.2);
            if (val) {
              const bc = val === 'Y' ? C.green : val === 'N' ? C.red : C.slate;
              setFill(bc); doc.roundedRect(W - MR - 18, y + 1, 18, 4.5, 1, 1, 'F');
              setTxt(C.white); setFont(FS.tiny,'bold');
              doc.text(val, W - MR - 9, y + 4.5, { align:'center' });
            }
            y += ll.length > 1 ? ll.length * 4 + 2 : 7;
          });
          y += 2;
        };
        renderCL(preEl, 'PRE-INSPECTION');
        renderCL(postEl, 'POST-INSPECTION');
      }

      // On-Site System Notes
      const onsiteEl = document.getElementById('fa-onsite-tbody');
      if (onsiteEl) {
        subHdr('ON-SITE SYSTEM NOTES');
        const ow = [80, 52, usableW - 132];
        tblHdr(['Equipment','Condition','Notes & Observations'], ow);
        for (let n = 1; n <= 5; n++) {
          const orow = document.getElementById('fa-onsite-row-' + n);
          if (!orow) continue;
          checkPage(7);
          const eq    = document.getElementById('fa-onsite-eq-' + n)?.value || '';
          const cond  = orow.querySelector('.pf-btn.pass.selected') ? 'Satisfactory' :
                        orow.querySelector('.pf-btn.fail.selected') ? 'Unsatisfactory' :
                        orow.querySelector('.pf-btn.na.selected')   ? 'N/A' : '';
          const onotes = document.getElementById('fa-onsite-notes-' + n)?.value || '';
          const bgC   = cond === 'Satisfactory' ? C.passGrn : cond === 'Unsatisfactory' ? C.failRed : C.light;
          setFill(bgC); doc.rect(ML, y, usableW, 6, 'F');
          setDraw(C.border); doc.line(ML, y + 6, ML + usableW, y + 6);
          setFont(FS.tiny,'normal'); setTxt([25,25,25]);
          doc.text((eq||'').slice(0,28), ML + 1.5, y + 4.2);
          if (cond) doc.text(cond.slice(0,18), ML + ow[0] + 1.5, y + 4.2);
          if (onotes) doc.text(doc.splitTextToSize(onotes, ow[2] - 3)[0], ML + ow[0] + ow[1] + 1.5, y + 4.2);
          y += 6.5;
        }
        y += 2;
      }

      // Detection Devices
      if (faDetectionCount > 0) {
        subHdr('DEVICES — FIRE DETECTION');
        const dw = [26, 54, 28, 28, 26, 26];
        tblHdr(['Type','Location','Scan ID','Address','Alarm','Supervisory'], dw);
        for (let n = 1; n <= faDetectionCount; n++) {
          if (!document.getElementById('fa-det-row-' + n)) continue;
          checkPage(7);
          const dtype  = document.getElementById('fa-det-type-' + n)?.value || '';
          const dloc   = document.getElementById('fa-det-loc-' + n)?.value || '';
          const dscan  = document.getElementById('fa-det-scan-' + n)?.value || '';
          const daddr  = document.getElementById('fa-det-addr-' + n)?.value || '';
          const dalarm = document.getElementById('fa-det-alarm-' + n)?.value || '';
          const dsup   = document.getElementById('fa-det-sup-' + n)?.value || '';
          const bgC = (dalarm === 'FAIL' || dsup === 'FAIL') ? C.failRed :
                      (dalarm === 'PASS' || dsup === 'PASS') ? C.passGrn : C.light;
          setFill(bgC); doc.rect(ML, y, usableW, 6, 'F');
          setDraw(C.border); doc.line(ML, y + 6, ML + usableW, y + 6);
          setFont(FS.tiny,'normal'); setTxt([25,25,25]);
          [dtype, dloc, dscan, daddr, dalarm, dsup].forEach((v, i) => {
            let cx = ML; for (let j = 0; j < i; j++) cx += dw[j];
            doc.text(String(v||'').slice(0, dw[i] > 28 ? 16 : 8), cx + 1.5, y + 4.2);
          });
          y += 6.5;
        }
        y += 2;
      }

      // Flow Switches
      if (faFlowCount > 0) {
        subHdr('FLOW SWITCHES — SPRINKLER SYSTEMS');
        const fw = [26, 56, 28, 28, 26, 24];
        tblHdr(['Type','Location','Scan ID','Address','Supervisory','Seconds'], fw);
        for (let n = 1; n <= faFlowCount; n++) {
          if (!document.getElementById('fa-flow-row-' + n)) continue;
          checkPage(7);
          const ftype = document.getElementById('fa-flow-type-' + n)?.value || '';
          const floc  = document.getElementById('fa-flow-loc-' + n)?.value || '';
          const fscan = document.getElementById('fa-flow-scan-' + n)?.value || '';
          const faddr = document.getElementById('fa-flow-addr-' + n)?.value || '';
          const fsup  = document.getElementById('fa-flow-sup-' + n)?.value || '';
          const fsecs = document.getElementById('fa-flow-secs-' + n)?.value || '';
          const bgC = fsup === 'FAIL' ? C.failRed : fsup === 'PASS' ? C.passGrn : C.light;
          setFill(bgC); doc.rect(ML, y, usableW, 6, 'F');
          setDraw(C.border); doc.line(ML, y + 6, ML + usableW, y + 6);
          setFont(FS.tiny,'normal'); setTxt([25,25,25]);
          [ftype, floc, fscan, faddr, fsup, fsecs].forEach((v, i) => {
            let cx = ML; for (let j = 0; j < i; j++) cx += fw[j];
            doc.text(String(v||'').slice(0, fw[i] > 28 ? 16 : 8), cx + 1.5, y + 4.2);
          });
          y += 6.5;
        }
        y += 2;
      }

      // Tamper Switches
      if (faTamperCount > 0) {
        subHdr('TAMPER SWITCHES — SPRINKLER SYSTEMS');
        const tw = [26, 56, 28, 28, 26, 24];
        tblHdr(['Type','Location','Scan ID','Address','Supervisory','Notes'], tw);
        for (let n = 1; n <= faTamperCount; n++) {
          if (!document.getElementById('fa-tamper-row-' + n)) continue;
          checkPage(7);
          const ttype  = document.getElementById('fa-tamper-type-' + n)?.value || '';
          const tloc   = document.getElementById('fa-tamper-loc-' + n)?.value || '';
          const tscan  = document.getElementById('fa-tamper-scan-' + n)?.value || '';
          const taddr  = document.getElementById('fa-tamper-addr-' + n)?.value || '';
          const tsup   = document.getElementById('fa-tamper-sup-' + n)?.value || '';
          const tnotes = document.getElementById('fa-tamper-notes-' + n)?.value || '';
          const bgC = tsup === 'FAIL' ? C.failRed : tsup === 'PASS' ? C.passGrn : C.light;
          setFill(bgC); doc.rect(ML, y, usableW, 6, 'F');
          setDraw(C.border); doc.line(ML, y + 6, ML + usableW, y + 6);
          setFont(FS.tiny,'normal'); setTxt([25,25,25]);
          [ttype, tloc, tscan, taddr, tsup, tnotes].forEach((v, i) => {
            let cx = ML; for (let j = 0; j < i; j++) cx += tw[j];
            doc.text(String(v||'').slice(0, tw[i] > 28 ? 16 : 8), cx + 1.5, y + 4.2);
          });
          y += 6.5;
        }
        y += 2;
      }

      // Device Testing Summary
      const devTbody = document.getElementById('fa-device-tbody');
      if (devTbody && devTbody.children.length) {
        subHdr('DEVICE TESTING SUMMARY');
        const svw = [usableW - 118, 14, 18, 18, 18, 14, 14, 14, 14];
        tblHdr(['Device / System','Key','Total','Pass','Fail','%P','%F','NT','NF'], svw);
        devTbody.querySelectorAll('tr').forEach(drow => {
          checkPage(6);
          const cells = drow.querySelectorAll('td');
          if (!cells.length) return;
          const dlabel = cells[0]?.textContent?.trim() || '';
          const dkey   = cells[1]?.textContent?.trim() || '';
          const dtotal = cells[2]?.querySelector('input')?.value || '';
          const dpass  = cells[3]?.querySelector('input')?.value || '';
          const dfail  = cells[4]?.querySelector('input')?.value || '';
          const dpctP  = cells[5]?.textContent?.trim() || '';
          const dpctF  = cells[6]?.textContent?.trim() || '';
          const dnt    = cells[7]?.querySelector('input')?.value || '';
          const dnf    = cells[8]?.querySelector('input')?.value || '';
          const bgC = +dfail > 0 ? C.failRed : +dpass > 0 ? C.passGrn : C.light;
          setFill(bgC); doc.rect(ML, y, usableW, 6, 'F');
          setDraw(C.border); doc.line(ML, y + 6, ML + usableW, y + 6);
          setFont(FS.tiny,'normal'); setTxt([25,25,25]);
          [dlabel, dkey, dtotal, dpass, dfail, dpctP, dpctF, dnt, dnf].forEach((v, i) => {
            let cx = ML; for (let j = 0; j < i; j++) cx += svw[j];
            doc.text(String(v||'').slice(0, i === 0 ? 26 : 5), cx + 1.5, y + 4.2);
          });
          y += 6.5;
        });
        y += 2;
      }

      // Audio/Visual, Door Holder, HVAC
      subHdr('AUXILIARY & LOCATIONS');
      ['fa-av-card','fa-door-card','fa-hvac-card'].forEach(cardId => {
        const card = document.getElementById(cardId);
        if (!card) return;
        const cardTitle = card.querySelector('.card-header span:nth-child(2)')?.childNodes[0]?.textContent?.trim() || '';
        checkPage(6);
        setFont(FS.tiny,'bold'); setTxt(C.slate);
        doc.text(cardTitle.toUpperCase(), ML, y); y += 4;
        card.querySelectorAll('.inspect-row').forEach(arow => {
          checkPage(6);
          const albl   = arow.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || '';
          const groups = arow.querySelectorAll('.pf-group');
          if (groups.length >= 2) {
            const presentVal = grpVal(groups[0]);
            const operVal    = grpVal(groups[1]);
            const deficInp   = arow.querySelector('.fa-static-defic input');
            const deficTxt   = (deficInp && deficInp.closest('.fa-static-defic')?.style.display !== 'none') ? deficInp.value.trim() : '';
            inspRow(albl + '  [Present: ' + (presentVal||'—') + ']', operVal, deficTxt);
          } else if (groups.length === 1) {
            const result  = grpVal(groups[0]);
            const deficInp = arow.querySelector('.fa-static-defic input');
            const deficTxt = (deficInp && deficInp.closest('.fa-static-defic')?.style.display !== 'none') ? deficInp.value.trim() : '';
            inspRow(albl, result, deficTxt);
          }
        });
        const cardNotesInp = card.querySelector('input[type=text][id$="-notes"]');
        if (cardNotesInp?.value?.trim()) {
          checkPage(8);
          setFill([255,253,235]); setDraw([254,215,0]);
          const cnl = doc.splitTextToSize('Notes: ' + cardNotesInp.value.trim(), usableW - 6);
          const cnh = cnl.length * 4 + 5;
          doc.rect(ML, y, usableW, cnh, 'FD');
          setFont(FS.small,'italic'); setTxt([92,70,0]);
          doc.text(cnl, ML + 3, y + 4.5);
          y += cnh + 3;
        }
        y += 2;
      });

      // Sub Panel / Power Supply
      if (faSubpanelCount > 0) {
        subHdr('SUB PANEL / POWER SUPPLY INFORMATION');
        const spw = [usableW - 120, 36, 28, 16, 14, 14, 12];
        tblHdr(['Location','Make','Panel/Circuit','Amps','(L)Bat','(R)Bat','PF'], spw);
        for (let n = 1; n <= faSubpanelCount; n++) {
          if (!document.getElementById('fa-sp-row-' + n)) continue;
          checkPage(7);
          const sploc  = document.getElementById('fa-sp-loc-' + n)?.value || '';
          const spmake = document.getElementById('fa-sp-make-' + n)?.value || '';
          const spcirc = document.getElementById('fa-sp-circuit-' + n)?.value || '';
          const spamps = document.getElementById('fa-sp-amps-' + n)?.value || '';
          const splbat = document.getElementById('fa-sp-lbatt-' + n)?.value || '';
          const sprbat = document.getElementById('fa-sp-rbatt-' + n)?.value || '';
          const sppf   = document.getElementById('fa-sp-pf-' + n)?.value || '';
          const bgC = sppf === 'FAIL' ? C.failRed : sppf === 'PASS' ? C.passGrn : C.light;
          setFill(bgC); doc.rect(ML, y, usableW, 6, 'F');
          setDraw(C.border); doc.line(ML, y + 6, ML + usableW, y + 6);
          setFont(FS.tiny,'normal'); setTxt([25,25,25]);
          [sploc, spmake, spcirc, spamps, splbat, sprbat, sppf].forEach((v, i) => {
            let cx = ML; for (let j = 0; j < i; j++) cx += spw[j];
            doc.text(String(v||'').slice(0, i === 0 ? 22 : 8), cx + 1.5, y + 4.2);
          });
          y += 6.5;
        }
        y += 2;
      }

      // Failed Batteries
      if (faBatteryCount > 0) {
        subHdr('FAILED BATTERIES');
        const bw = [30, 40, 20, usableW - 90];
        tblHdr(['Size (AH)','Type','Count','Location'], bw);
        for (let n = 1; n <= faBatteryCount; n++) {
          if (!document.getElementById('fa-bat-row-' + n)) continue;
          checkPage(7);
          const bsize = document.getElementById('fa-bat-size-' + n)?.value || '';
          const btype = document.getElementById('fa-bat-type-' + n)?.value || '';
          const bcnt  = document.getElementById('fa-bat-count-' + n)?.value || '';
          const bloc  = document.getElementById('fa-bat-loc-' + n)?.value || '';
          setFill(C.failRed); doc.rect(ML, y, usableW, 6, 'F');
          setDraw(C.border); doc.line(ML, y + 6, ML + usableW, y + 6);
          setFont(FS.tiny,'normal'); setTxt([25,25,25]);
          [bsize, btype, bcnt, bloc].forEach((v, i) => {
            let cx = ML; for (let j = 0; j < i; j++) cx += bw[j];
            doc.text(String(v||'').slice(0,16), cx + 1.5, y + 4.2);
          });
          y += 6.5;
        }
        y += 2;
      }

      // Deficiency List
      const deficTbody = document.getElementById('fa-defic-tbody');
      const deficRows  = deficTbody ? [...deficTbody.querySelectorAll('tr')] : [];
      if (deficRows.length) {
        subHdr('DEFICIENCY LIST');
        deficRows.forEach((drow, idx) => {
          const ddesc = drow.querySelector('td:nth-child(2) input')?.value?.trim() || '';
          if (!ddesc) return;
          const ddl = doc.splitTextToSize(ddesc, usableW - 12);
          const rowH = Math.max(6.5, ddl.length * 4.5 + 2);
          checkPage(rowH + 2);
          setFill([255,236,236]); doc.rect(ML, y, usableW, rowH, 'F');
          setDraw([220,38,38]); doc.line(ML, y + rowH, ML + usableW, y + rowH);
          setFont(FS.tiny,'bold'); setTxt([180,20,20]);
          doc.text(String(idx + 1), ML + 4, y + 4.5);
          setFont(FS.small,'normal'); setTxt([30,30,30]);
          doc.text(ddl, ML + 10, y + 4.5);
          y += rowH + 0.5;
        });
        y += 2;
      }

      // General Notes
      const notesTbody = document.getElementById('fa-notes-tbody');
      if (notesTbody && notesTbody.children.length) {
        subHdr('GENERAL NOTES & OBSERVATIONS');
        notesTbody.querySelectorAll('tr').forEach((nrow, idx) => {
          checkPage(7);
          const ntxt = nrow.querySelector('td:nth-child(2) input')?.value?.trim() || '';
          if (!ntxt) return;
          setFill(C.light); doc.rect(ML, y, usableW, 6, 'F');
          setDraw(C.border); doc.line(ML, y + 6, ML + usableW, y + 6);
          setFont(FS.tiny,'bold'); setTxt(C.slate);
          doc.text(String(idx + 1), ML + 3, y + 4.2, { align:'center' });
          setFont(FS.small,'normal'); setTxt([30,30,30]);
          doc.text(doc.splitTextToSize(ntxt, usableW - 12)[0], ML + 9, y + 4.2);
          y += 6.5;
        });
        y += 2;
      }

    } else {
      // Generic system: inspection rows + notes
      const items = systemInspItems[sys] || [];
      if (items.length > 0) {
        checkPage(10);
        setFill([240,244,252]); doc.rect(ML, y, usableW, 5.5, 'F');
        setFont(FS.tiny,'bold'); setTxt([50,80,130]);
        doc.text('INSPECTION RESULTS', ML + 2, y + 4);
        y += 7;
        items.forEach(id => {
          const row = document.getElementById('row-' + id);
          if (!row) return;
          const label  = row.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id;
          const result = row.dataset.val || '';
          const defic  = document.getElementById('defic-txt-' + id)?.value?.trim() || '';
          inspRow(label, result, defic);
        });
      }
      const notesId  = notesIds[sys];
      const notesVal = notesId ? document.getElementById(notesId)?.value?.trim() : '';
      if (notesVal) {
        checkPage(10);
        setFill([255,253,235]); setDraw([254,215,0]);
        const nl = doc.splitTextToSize('Notes: ' + notesVal, usableW - 6);
        const nh = nl.length * 4 + 5;
        doc.rect(ML, y, usableW, nh, 'FD');
        setFont(FS.small,'italic'); setTxt([92,70,0]);
        doc.text(nl, ML + 3, y + 4.5);
        y += nh + 3;
      }
    }

    y += 4;
  });

  // ── Extinguisher per-unit table ──
  if (activeInspectionSystem === 'extinguisher' && data.extinguishers.length > 0) {
    checkPage(20);
    setFill([240,244,252]); doc.rect(ML, y, usableW, 5.5, 'F');
    setFont(FS.tiny,'bold'); setTxt([50,80,130]);
    doc.text('EXTINGUISHER UNIT DETAIL', ML + 2, y + 4);
    y += 7;

    const cols = ['#','Location','Type','Size','Mfr Date','Pressure','Seal','Label','Result'];
    const cws  = [8, 42, 32, 22, 20, 18, 14, 14, 18];
    // Header
    setFill(C.navy2);
    doc.rect(ML, y, usableW, 6, 'F');
    let tx = ML;
    cols.forEach((c, i) => {
      setFont(FS.tiny,'bold'); setTxt(C.white);
      doc.text(c, tx + 1.5, y + 4.2);
      tx += cws[i];
    });
    y += 6.5;

    data.extinguishers.forEach((ext, idx) => {
      checkPage(8);
      const rowBg = ext.overall === 'FAIL' ? C.failRed : ext.overall === 'PASS' ? C.passGrn : C.light;
      setFill(rowBg); doc.rect(ML, y, usableW, 6, 'F');
      setDraw(C.border); doc.line(ML, y + 6, ML + usableW, y + 6);
      const cells = [String(idx+1), ext.location||'', ext.type||'', ext.size||'', ext.mfrDate||'', ext.pressure||'', ext.seal||'—', ext.label||'—', ext.overall||'—'];
      let cx = ML;
      cells.forEach((cell, i) => {
        setFont(FS.tiny,'normal'); setTxt([25,25,25]);
        doc.text(String(cell).slice(0, cws[i] > 18 ? 20 : 10), cx + 1.5, y + 4.2);
        cx += cws[i];
      });
      y += 6.5;
    });
    y += 4;
  }

  // ── General Notes ──
  if (data.generalNotes) {
    checkPage(20);
    sectionHdr('GENERAL NOTES & RECOMMENDATIONS');
    setFont(FS.body,'normal'); setTxt([30,30,30]);
    const glines = doc.splitTextToSize(data.generalNotes, usableW - 2);
    doc.text(glines, ML, y);
    y += glines.length * 4.5 + 6;
  }

  // ── Overall Status ──
  checkPage(22);
  const stBg     = data.overallStatus === 'COMPLIANT' ? [240,253,244] : data.overallStatus === 'IMPAIRED' ? [254,242,242] : [255,251,235];
  const stBorder = data.overallStatus === 'COMPLIANT' ? C.green : data.overallStatus === 'IMPAIRED' ? C.red : C.amber;
  setFill(stBg); setDraw(stBorder);
  doc.roundedRect(ML, y, usableW, 14, 2, 2, 'FD');
  setFont(FS.heading,'bold'); setTxt(stBorder);
  doc.text('OVERALL SYSTEM STATUS: ' + (data.overallStatus || 'NOT SET'), ML + 5, y + 9);
  y += 18;

  // ── Signature / Certification ──
  checkPage(38);
  setFill(C.light); setDraw(C.border);
  doc.rect(ML, y, usableW, 36, 'FD');
  setFont(FS.tiny,'bold'); setTxt(C.slate);
  doc.text('INSPECTOR CERTIFICATION', ML + 3, y + 5.5);
  setFont(FS.tiny,'normal'); setTxt([60,60,60]);
  const certTxt = 'I certify that this fire protection system has been inspected, tested, and maintained in accordance with applicable NFPA standards and local codes. All test results are accurately documented herein.';
  const certLines = doc.splitTextToSize(certTxt, 120);
  doc.text(certLines, ML + 3, y + 10);

  if (sigHasData) {
    const canvas = document.getElementById('sig-canvas');
    const sigData = canvas.toDataURL('image/png');
    doc.addImage(sigData, 'PNG', ML + 3, y + 18, 55, 14);
  } else {
    setDraw([180,180,180]); doc.line(ML + 3, y + 30, ML + 60, y + 30);
    setFont(FS.tiny); setTxt([160,160,160]); doc.text('Signature', ML + 3, y + 34);
  }

  const sr = ML + 130;
  const fields3 = [['INSPECTOR NAME', data.signature.name||'________________', 0],
                   ['LICENSE / CERT #', data.inspection.inspectorCert||'________________', 11],
                   ['DATE SIGNED', data.signature.date||'________________', 22]];
  fields3.forEach(([lbl,val,off]) => {
    setFont(FS.tiny,'bold'); setTxt(C.slate); doc.text(lbl, sr, y + 6 + off);
    setFont(FS.small,'normal'); setTxt(C.navy); doc.text(val, sr, y + 11 + off);
  });
  y += 40;

  // ── Photos page ──
  if (inspectionPhotos.length > 0) {
    drawPageFooter();
    doc.addPage();
    drawContinuationHeader();
    sectionHdr('INSPECTION PHOTOS');

    const photoColW = (usableW - 6) / 2;
    let col = 0;
    let rowStartY = y;
    const photoH = 60; // image height mm
    const noteH  = 12;
    const cellH  = photoH + noteH + 8;

    for (let i = 0; i < inspectionPhotos.length; i++) {
      const photo = inspectionPhotos[i];
      const px = ML + col * (photoColW + 6);
      checkPage(cellH + 5);
      if (col === 0) rowStartY = y;

      try {
        // Detect image format from data URL
        const fmt = photo.dataUrl.startsWith('data:image/png') ? 'PNG' :
                    photo.dataUrl.startsWith('data:image/gif') ? 'GIF' : 'JPEG';
        doc.addImage(photo.dataUrl, fmt, px, y, photoColW, photoH);
      } catch(e) {
        setFill([240,240,240]); doc.rect(px, y, photoColW, photoH, 'F');
        setTxt([150,150,150]); setFont(FS.small); doc.text('Image error', px + photoColW/2, y + photoH/2, {align:'center'});
      }

      // Photo number badge
      setFill([0,0,0]); doc.roundedRect(px + 2, y + 2, 16, 5, 1, 1, 'F');
      setTxt([255,255,255]); setFont(FS.tiny,'bold');
      doc.text(`Photo ${i+1}`, px + 10, y + 5.5, {align:'center'});

      // Note
      if (photo.note) {
        setFill([255,253,235]); doc.rect(px, y + photoH, photoColW, noteH, 'F');
        setTxt([92,70,0]); setFont(FS.tiny,'italic');
        const nl = doc.splitTextToSize(photo.note, photoColW - 4);
        doc.text(nl, px + 2, y + photoH + 4);
      } else {
        setFill([248,250,252]); doc.rect(px, y + photoH, photoColW, noteH, 'F');
        setTxt([160,160,160]); setFont(FS.tiny,'italic');
        doc.text('No note', px + 2, y + photoH + 4);
      }
      setDraw(C.border); doc.rect(px, y, photoColW, photoH + noteH, 'S');

      col++;
      if (col >= 2) { col = 0; y += cellH + 4; }
    }
    if (col > 0) y += cellH + 4; // finish partial row
  }

  // ── Footers & page numbers ──
  drawPageFooter();
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setFont(FS.tiny); setTxt([160,160,160]);
    doc.text(`Page ${i} of ${pageCount}`, W / 2, 279, { align:'center' });
  }

  return doc;  // caller handles save/upload
}

