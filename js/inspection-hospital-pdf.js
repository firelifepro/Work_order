// ════════════════════════════════════════════════════════════════
//  PDF BYTES WRAPPER
// ════════════════════════════════════════════════════════════════
async function buildHospitalPDFBytes() {
  return await buildHospPDF();
}

// ════════════════════════════════════════════════════════════════
//  SAVE & DOWNLOAD — full flow: Drive JSON + Drive PDF + schedule
// ════════════════════════════════════════════════════════════════
async function hospSaveAndDownload() {
  if (!accessToken) {
    if (!confirm('⚠ Not connected to Google Drive — PDF will download locally only.\n\nDrive save, schedule update, and property profile will be skipped.\n\nOK to continue?')) return;
  }

  const sigWarn  = document.getElementById('h-sig-warning');
  const sigName  = fv('h-sig-name');
  const hasSig   = !!H.inspSig;
  const hasName  = sigName.length > 0;
  if (!hasSig || !hasName) {
    if (sigWarn) {
      sigWarn.textContent = !hasSig && !hasName
        ? '⚠ Please draw your signature AND enter your printed name before saving.'
        : !hasSig ? '⚠ Please draw your signature in the signature box.'
                  : '⚠ Please enter your printed name below the signature.';
      sigWarn.classList.add('visible');
    }
    document.getElementById('sig-canvas')?.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  if (sigWarn) sigWarn.classList.remove('visible');

  const btn      = document.getElementById('h-save-download-btn');
  const statusEl = document.getElementById('h-pdf-status');
  if (btn)      { btn.disabled = true; btn.textContent = '⏳ Saving…'; }
  if (statusEl)   statusEl.innerHTML = '';
  const setStatus = (msg, color) => {
    if (statusEl) statusEl.innerHTML += `<div style="color:${color||'inherit'}">${msg}</div>`;
  };
  document.getElementById('h-new-insp-btn-wrap').style.display = 'none';

  saveDraft();

  let pdfBytes = null;
  let filename  = '';

  const downloadPDF = (bytes, name) => {
    const blob = new Blob([bytes], { type:'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  try {
    setStatus('Building PDF…', 'var(--slate)');
    pdfBytes = await buildHospitalPDFBytes();

    const propName = fv('property-name') || 'Hospital';
    const propSlug = propName.replace(/[^a-zA-Z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'').slice(0,30);
    const dateStr  = fv('insp-date') || todayMT();
    const dateSlug = dateStr.replace(/-/g,'');
    filename = `FLPS_hospital_${propSlug}_${dateSlug}.pdf`;

    if (accessToken) {
      try {
        setStatus('Saving inspection data…', 'var(--slate)');
        const formState    = collectFormState();
        const jsonName     = `FLPS_Insp_hospital_${propSlug}_${dateStr}.json`;
        const rootId       = await getFlpsRootFolderId();
        const histFolderId = await findOrCreateFolder('FLPS Inspection History', rootId);
        await driveUploadFile(jsonName, 'application/json', JSON.stringify(formState, null, 2), histFolderId, null);
        setStatus('✓ Inspection data saved to FLPS Inspection History', 'var(--green)');

        try {
          setStatus('Updating property profile…', 'var(--slate)');
          const hospData = {
            property:    { name: propName, acct: '' },
            inspection:  { date: dateStr, reportType: fv('hosp-report-type') || H.reportType || 'Annual', inspectorName: sigName },
            overallStatus: H.overallStatus || '',
            inspectionSystem: 'hospital',
            deficiencies: Array.from(document.querySelectorAll('#h-defic-tbody tr td:nth-child(2) input'))
                              .map(i => i.value.trim()).filter(Boolean),
            fieldData: formState.fields || {},
            pfStates:  {},
          };
          await updatePropertyProfileAfterSave(hospData, 'hospital');
          setStatus('✓ Property profile updated', 'var(--green)');
        } catch(e) {
          setStatus('⚠ Profile update failed: ' + e.message, 'var(--amber)');
        }
      } catch(e) {
        setStatus('⚠ Data save failed: ' + e.message + ' (PDF still saving)', 'var(--amber)');
      }

      try {
        setStatus('Saving PDF to Drive…', 'var(--slate)');
        const binary   = Array.from(new Uint8Array(pdfBytes)).map(b => String.fromCharCode(b)).join('');
        const b64      = btoa(binary);
        const rootId2  = await getFlpsRootFolderId();
        const rptFolderId = await findOrCreateFolder('FLPS Inspection Reports', rootId2);
        await driveUploadFile(filename, 'application/pdf', b64, rptFolderId, null);
        setStatus('✓ PDF saved to FLPS Inspection Reports', 'var(--green)');
      } catch(e) {
        setStatus('⚠ PDF Drive save failed: ' + e.message, 'var(--amber)');
      }
    } else {
      setStatus('⚠ Not connected to Google — skipping Drive saves', 'var(--amber)');
    }

    downloadPDF(pdfBytes, filename);
    setStatus(`✓ Downloaded: ${filename}`, 'var(--green)');
    setStatus('Upload to thecomplianceengine.com to complete reporting.', 'var(--slate)');
    showToast('✓ Report saved & downloaded!');

    const schedData = {
      property:    { name: propName, acct: '' },
      inspection:  { date: dateStr, reportType: fv('hosp-report-type') || H.reportType || 'Annual' },
      inspectionSystem: 'hospital',
    };
    updateInspectionSchedule(schedData).catch(e => console.warn('[Schedule] Exception:', e.message));

    discardDraft();
    document.getElementById('h-new-insp-btn-wrap').style.display = 'block';

  } catch(e) {
    setStatus('✗ Error: ' + e.message, 'var(--red)');
    showToast('✗ Save failed: ' + e.message);
    if (pdfBytes) { try { downloadPDF(pdfBytes, filename || 'hospital_inspection.pdf'); } catch(_) {} }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📄 Save & Download PDF'; }
  }
}

// ════════════════════════════════════════════════════════════════
//  PDF GENERATION — pdf-lib builder
//  Theme: navy / sky-blue / gold editable fields
//  Letter 8.5"×11" = 612×792 points
// ════════════════════════════════════════════════════════════════
async function buildHospPDF() {
  if (!window.PDFLib) throw new Error('PDF library not loaded. Please refresh.');
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const form   = pdfDoc.getForm();
  const hFont  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const rFont  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // ── Page dimensions ──
  const W = 612, PH = 792, ML = 36, PW = 540, MB = 36;
  let page, curY, pageNum = 0, _fid = 0;
  const fid = () => 'h_' + (++_fid);

  // ── Colours ──
  const navy   = rgb(0.13, 0.21, 0.42);
  const midnav = rgb(0.26, 0.41, 0.67);
  const sky    = rgb(0.71, 0.80, 0.93);
  const gold   = rgb(1.0,  1.0,  0.75);
  const lgray  = rgb(0.94, 0.94, 0.94);
  const white  = rgb(1, 1, 1);
  const blk    = rgb(0, 0, 0);
  const PGREEN       = rgb(0.06, 0.50, 0.22);
  const PRED        = rgb(0.76, 0.10, 0.10);
  const AMBER       = rgb(0.75, 0.38, 0.00);
  const PGREEN_LIGHT = rgb(0.82, 0.93, 0.82);
  const PRED_LIGHT  = rgb(0.98, 0.84, 0.84);

  // ── Coordinate helpers ──
  // curY = distance from TOP of page (increases downward)
  // ry(h) converts to PDF coords (from bottom)
  const ry = (h) => PH - curY - h;
  const ty = (h, a = 3) => PH - curY - h + a;
  const HDR_H = 28; // two-bar per-page header height
  const checkPage = (needed) => { if (curY + needed > PH - MB) addPage(); };
  const gap = (h) => { curY += h; };

  // ── Live field reader ──
  const fv = (id) => document.getElementById(id)?.value?.trim() || '';

  // ── Read once for per-page header ──
  const bldName  = fv('property-name');
  const inspDate = fv('insp-date');

  // ── Text wrapper ──
  const wrap = (text, sz, maxW) => {
    if (!text) return [''];
    const words = String(text).split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (rFont.widthOfTextAtSize(test, sz) > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  };

  // ── Editable field ──
  const mkField = (val, x, fieldY, w, h, fs = 8, bg = gold) => {
    page.drawRectangle({ x, y: fieldY, width: w, height: h, color: bg, borderColor: sky, borderWidth: 0.3 });
    const f = form.createTextField(fid());
    f.setText(String(val || ''));
    f.addToPage(page, { x: x+1, y: fieldY+1, width: w-2, height: h-2, font: rFont });
    f.setFontSize(fs);
  };

  // ── Label + editable field row ──
  const dataRow = (cols, fh = 14, lh = 9, gp = 3) => {
    checkPage(lh + fh + gp);
    let x = ML;
    cols.forEach(c => {
      if (!c.label && !c.val) { x += c.w; return; }
      page.drawText((c.label || '') + ':', { x: x+3, y: ty(lh, lh-2), size: 7, font: hFont, color: navy });
      mkField(c.val, x, ry(lh + fh), c.w, fh, 8);
      x += c.w;
    });
    curY += lh + fh + gp;
  };

  // ── Per-page header + new page ──
  const addPage = (title) => {
    pageNum++;
    page = pdfDoc.addPage([W, PH]);
    // Dark top bar
    page.drawRectangle({ x: 0, y: PH - 15, width: W, height: 15, color: navy });
    page.drawText('Fire Life Protection Systems', { x: ML, y: PH - 10, size: 8.5, font: hFont, color: white });
    page.drawText(`Page ${pageNum}`, { x: W - 65, y: PH - 10, size: 8.5, font: rFont, color: white });
    if (pageNum > 1) {
      // Blue subheader — building + date only (skip on cover page)
      page.drawRectangle({ x: 0, y: PH - 28, width: W, height: 13, color: midnav });
      page.drawText(`BUILDING: ${bldName}`, { x: ML, y: PH - 24.5, size: 8, font: hFont, color: white });
      page.drawText(`DATE: ${inspDate}`, { x: W - 155, y: PH - 24.5, size: 8, font: hFont, color: white });
    }
    curY = pageNum > 1 ? HDR_H : 15;
    if (title) secHdr(title);
  };

  // ── Section header (navy bar) — wraps long titles to second line ──
  const secHdr = (text) => {
    const txt   = text.toUpperCase();
    const lines = wrap(txt, 9.5, PW - 10);
    const hdrH  = lines.length > 1 ? 28 : 19;
    checkPage(hdrH + 2);
    page.drawRectangle({ x: ML, y: ry(hdrH), width: PW, height: hdrH, color: navy });
    lines.forEach((ln, li) => {
      const lineY = ry(hdrH) + hdrH - 13 - li * 11;
      page.drawText(ln, { x: ML+4, y: lineY, size: 9.5, font: hFont, color: white });
    });
    curY += hdrH + 2;
  };

  // ── Sub-header (sky bar) ──
  const subHdr = (text) => {
    checkPage(17);
    page.drawRectangle({ x: ML, y: ry(15), width: PW, height: 15, color: sky });
    page.drawText(text, { x: ML+4, y: ty(15, 5), size: 8.5, font: hFont, color: navy });
    curY += 16;
  };

  // ── Table header row ──
  const tblHdr = (cols) => {
    checkPage(17);
    let x = ML;
    cols.forEach(col => {
      page.drawRectangle({ x, y: ry(16), width: col.w, height: 16, color: navy });
      page.drawText(wrap(col.label || '', 7, col.w - 4)[0] || '', { x: x+3, y: ty(16, 5.5), size: 7, font: hFont, color: white });
      x += col.w;
    });
    curY += 17;
  };

  // ── Table data row — pfColIdx = index of PASS/FAIL column (-1 = none) ──
  const tblRow = (cols, vals, pfColIdx = -1, rowColor = null) => {
    const cellH = 16;
    checkPage(cellH + 1);
    const pfVal = pfColIdx >= 0 ? String(vals[pfColIdx] ?? '').toUpperCase() : '';
    const rowBg = rowColor ?? (pfVal === 'PASS' ? PGREEN_LIGHT : pfVal === 'FAIL' ? PRED_LIGHT : gold);
    let x = ML;
    cols.forEach((col, i) => {
      const v = String(vals[i] ?? '');
      const isPF = i === pfColIdx;
      const bg = isPF && pfVal === 'PASS' ? PGREEN
               : isPF && pfVal === 'FAIL' ? PRED
               : isPF && pfVal === 'N/A'  ? sky
               : rowBg;
      mkField(v, x, ry(cellH), col.w, cellH, 7.5, bg);
      x += col.w;
    });
    curY += cellH + 1;
  };

  // ── Y/N/NA highlight row (question | Y col | N col | NA col | notes) ──
  const ynaRow = (label, ynaVal, note, lblW, btnW, noteW) => {
    const h = 16;
    checkPage(h + 1);
    // Label cell (static text)
    page.drawRectangle({ x: ML, y: ry(h), width: lblW, height: h, color: lgray, borderColor: sky, borderWidth: 0.3 });
    wrap(label, 7.5, lblW - 6).forEach((ln, li) => {
      page.drawText(ln, { x: ML+4, y: ry(h) + h - 7 - li * 8, size: 7.5, font: rFont, color: blk });
    });
    // Y / N / NA cells
    let bx = ML + lblW;
    ['Y','N','NA'].forEach(opt => {
      const sel = ynaVal === opt || (opt === 'Y' && ynaVal === 'PASS') || (opt === 'N' && ynaVal === 'FAIL');
      const bg  = sel && opt === 'Y' ? PGREEN : sel && opt === 'N' ? PRED : sel && opt === 'NA' ? sky : gold;
      const tc  = sel && (opt === 'Y' || opt === 'N') ? white : blk;
      page.drawRectangle({ x: bx, y: ry(h), width: btnW, height: h, color: bg, borderColor: sky, borderWidth: 0.3 });
      if (sel) {
        const tw = hFont.widthOfTextAtSize('X', 8);
        page.drawText('X', { x: bx + btnW/2 - tw/2, y: ty(h, 5), size: 8, font: hFont, color: tc });
      }
      bx += btnW;
    });
    // Notes cell (editable)
    mkField(note, bx, ry(h), noteW, h, 7.5);
    curY += h + 1;
  };

  // ── Inline label + editable field on one row (fixed 90pt label column for alignment) ──
  const INLINE_LBL_W = 90;
  const inlineRow = (label, val) => {
    const rowH = 15;
    checkPage(rowH + 2);
    page.drawText(label + ':', { x: ML + 3, y: ty(rowH, 5), size: 8, font: hFont, color: navy });
    mkField(val, ML + INLINE_LBL_W, ry(rowH), PW - INLINE_LBL_W, rowH, 8);
    curY += rowH + 2;
  };

  // ── Generic device page helper ──
  const inp = (n) => (row) => row.querySelectorAll('input')[n]?.value || '';
  const selOpt = (n) => (row) => { const el = row.querySelectorAll('select')[n]; return el?.options[el.selectedIndex]?.text || ''; };

  const devicePage = (title, tbodyId, cols, getters, pfColIdx = -1) => {
    addPage(title);
    tblHdr(cols);
    const rows = document.querySelectorAll(`#${tbodyId} tr`);
    if (!rows.length) {
      checkPage(14);
      page.drawRectangle({ x: ML, y: ry(13), width: PW, height: 13, color: lgray, borderColor: sky, borderWidth: 0.3 });
      page.drawText('No devices recorded.', { x: ML+4, y: ty(13, 4), size: 8.5, font: rFont, color: blk });
      curY += 14;
    } else {
      rows.forEach((row) => { tblRow(cols, getters.map(fn => fn(row)), pfColIdx); });
      checkPage(14);
      page.drawText(`EQUIPMENT COUNT: ${rows.length}`, { x: ML, y: ty(13, 4), size: 8, font: hFont, color: navy });
      curY += 14;
    }
  };

  const pagedDevicePage = (title, tbodyId, cols, getters, pfColIdx = -1, rpp = 30) => {
    const allRows = Array.from(document.querySelectorAll(`#${tbodyId} tr`));
    if (!allRows.length) {
      addPage(title);
      checkPage(14);
      page.drawRectangle({ x: ML, y: ry(13), width: PW, height: 13, color: lgray, borderColor: sky, borderWidth: 0.3 });
      page.drawText('No devices recorded.', { x: ML+4, y: ty(13, 4), size: 8.5, font: rFont, color: blk });
      curY += 14;
      return;
    }
    for (let start = 0; start < allRows.length; start += rpp) {
      addPage(title);
      tblHdr(cols);
      allRows.slice(start, start + rpp).forEach(row => { tblRow(cols, getters.map(fn => fn(row)), pfColIdx); });
      if (start + rpp >= allRows.length) {
        checkPage(14);
        page.drawText(`EQUIPMENT COUNT: ${allRows.length}`, { x: ML, y: ty(13, 4), size: 8, font: hFont, color: navy });
        curY += 14;
      }
    }
  };

  // ════════════════════════════════════════════════════════════════
  // PAGE 1: COVER PAGE
  // ════════════════════════════════════════════════════════════════
  addPage();

  // Title banner
  const bannerH = 16;
  page.drawRectangle({ x: 0, y: ry(bannerH), width: W, height: bannerH, color: navy });
  const titleTxt = 'ANNUAL TJC / CMS INSPECTION REPORT';
  const titleW   = hFont.widthOfTextAtSize(titleTxt, 12);
  page.drawText(titleTxt, { x: W/2 - titleW/2, y: ty(bannerH, 5), size: 12, font: hFont, color: white });
  curY += bannerH + 6;

  // Logo + company info + report type block
  const logoAreaH = 88;
  const logoX = ML, logoW = 90;
  const infoX = ML + logoW + 6, infoW = 160;
  const rtX   = infoX + infoW + 6, rtW = PW - logoW - infoW - 18;

  // Logo
  try {
    const svgText = await fetch('logo.svg').then(r => r.text());
    const sizedSvg = svgText.replace('<svg ', '<svg width="400" height="600" ');
    const svgBlob = new Blob([sizedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    await new Promise(resolve => {
      const img = new Image();
      img.onload = async () => {
        const scale = 3;
        const full = document.createElement('canvas');
        full.width = 400 * scale; full.height = 600 * scale;
        full.getContext('2d').drawImage(img, 0, 0, full.width, full.height);
        const cropW = 400 * scale, cropH = 445 * scale;
        const crop = document.createElement('canvas');
        crop.width = cropW; crop.height = cropH;
        crop.getContext('2d').drawImage(full, 0, 0, cropW, cropH, 0, 0, cropW, cropH);
        const b64 = crop.toDataURL('image/png').split(',')[1];
        const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
        const logoImg = await pdfDoc.embedPng(ab);
        const logoDims = logoImg.scaleToFit(70, 70);
        page.drawImage(logoImg, { x: logoX, y: ry(logoAreaH) + (logoAreaH - logoDims.height)/2, width: logoDims.width, height: logoDims.height });
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    });
  } catch(_) {}

  // Company info box
  page.drawRectangle({ x: infoX, y: ry(logoAreaH), width: infoW, height: logoAreaH, color: lgray, borderColor: sky, borderWidth: 0.5 });
  const compLines = [
    { text: 'Fire Life Protection System, Inc.', bold: true, sz: 7.5 },
    { text: '8201 Shaffer Parkway Suite B',       bold: false, sz: 7 },
    { text: 'Littleton, CO 80127',                bold: false, sz: 7 },
    { text: 'Cellular: (303) 726-8847',           bold: false, sz: 7 },
    { text: 'Office: (720) 974-1570',             bold: false, sz: 7 },
    { text: 'Alan.antonio@firelifeprotection',    bold: false, sz: 6.5 },
    { text: 'systems.com',                        bold: false, sz: 6.5 },
  ];
  let compY = ry(logoAreaH) + logoAreaH - 10;
  compLines.forEach(cl => {
    page.drawText(cl.text, { x: infoX+4, y: compY, size: cl.sz, font: cl.bold ? hFont : rFont, color: blk });
    compY -= cl.sz + 2;
  });

  // Report type panel (right column)
  page.drawRectangle({ x: rtX, y: ry(logoAreaH), width: rtW, height: logoAreaH, color: lgray, borderColor: sky, borderWidth: 0.3 });
  const rt    = fv('hosp-report-type') || 'Annual';
  const rtUC  = rt.toUpperCase();
  const rtTypes = ['ANNUAL','SEMI-ANNUAL','QUARTERLY','MONTHLY','3/4/5/6 YR INTERVAL'];
  let rtY = ry(logoAreaH) + logoAreaH - 8;
  page.drawText('REPORT TYPE', { x: rtX+4, y: rtY, size: 7, font: hFont, color: navy });
  rtY -= 4;
  rtTypes.forEach(t => {
    const sel = rtUC === t || (t === 'SEMI-ANNUAL' && rtUC.includes('SEMI'));
    rtY -= 13;
    page.drawRectangle({ x: rtX+4, y: rtY, width: rtW-8, height: 12,
      color: sel ? navy : white, borderColor: sky, borderWidth: 0.3 });
    page.drawText(t, { x: rtX+7, y: rtY+3.5, size: 7, font: sel ? hFont : rFont, color: sel ? white : navy });
  });

  curY += logoAreaH + 4;

  // Building/property info
  secHdr('Building / Property Information');
  gap(5);
  dataRow([{ label: 'BUILDING/PROPERTY NAME', val: fv('property-name'), w: PW }], 12, 8, 4);
  dataRow([
    { label: 'STREET ADDRESS', val: fv('service-address'), w: PW * 0.6 },
    { label: 'CITY, STATE, ZIP', val: fv('city-state-zip'), w: PW * 0.4 },
  ], 12, 8, 4);
  dataRow([
    { label: 'JURISDICTION', val: fv('jurisdiction'), w: PW * 0.5 },
    { label: 'DATE PERFORMED', val: fv('insp-date'), w: PW * 0.5 },
  ], 12, 8, 4);
  gap(4);

  // Site contacts
  secHdr('Site Contact Information');
  gap(5);
  const halfW = PW / 2 - 3;
  // Header row
  page.drawRectangle({ x: ML,           y: ry(16), width: halfW, height: 16, color: midnav });
  page.drawText('PRIMARY CONTACT', { x: ML+4, y: ty(16,5.5), size: 8.5, font: hFont, color: white });
  page.drawRectangle({ x: ML+halfW+6,   y: ry(16), width: halfW, height: 16, color: midnav });
  page.drawText('SECONDARY CONTACT', { x: ML+halfW+10, y: ty(16,5.5), size: 8.5, font: hFont, color: white });
  curY += 17;
  gap(5);
  const contFields = [
    ['NAME',  'primary-name',  'secondary-name'],
    ['TITLE', 'primary-title', 'secondary-title'],
    ['PHONE', 'primary-phone', 'secondary-phone'],
    ['EMAIL', 'primary-email', 'secondary-email'],
  ];
  contFields.forEach(([label, id1, id2]) => {
    checkPage(30);
    page.drawText(label+':', { x: ML+3, y: ty(9, 7), size: 7, font: hFont, color: navy });
    page.drawText(label+':', { x: ML+halfW+9, y: ty(9, 7), size: 7, font: hFont, color: navy });
    mkField(fv(id1), ML, ry(23), halfW, 14, 8);
    mkField(fv(id2), ML+halfW+6, ry(23), halfW, 14, 8);
    curY += 30;
  });
  gap(6);

  // NFPA References and Procedure
  secHdr('NFPA References and Procedure');
  const nfpaLines = [
    'YOUR ENTIRE FIRE ALARM SYSTEM IS REQUIRED TO BE THOROUGHLY INSPECTED, TESTED AND MAINTAINED EACH YEAR BY AN APPROVED SERVICING',
    'COMPANY IN ACCORDANCE WITH THE FOLLOWING NFPA CHAPER REFERENCES:',
    'CHAPTER 14 OF NFPA 72 [SEE NFPA 72(10), TABLES 14.3.1 AND 14.4.5; SEE ALSO: NFPA 90A(12), SEC. 6.4.1].',
    'TESTING MUST INCLUDE CONTROL EQUIPMENT, REMOTE ANNUNCIATORS, INITIATING DEVICES, HVAC SHUTDOWN DEVICES AND ALARM',
    'NOTIFICATION APPLIANCES. SEE THE BELOW LIST OF VARIOUS TESTING DEVICES:',
    '\u2022 VISUAL AND FUNCTIONAL TESTING OF THE FIRE ALARM CONTROL PANEL (FACP) AND COMPONENTS.',
    '\u2022 VISUAL AND FUNCTIONAL TESTING OF THE REMOTE POWER SUPPLIES (IF APPLICABLE).',
    '\u2022 VISUAL AND FUNCTIONAL LOAD TESTING OF THE FACP AND REMOTE POWER SUPPLY BATTERIES. (ANNUAL & SEMI ANNUAL)',
    '\u2022 VISUAL AND FUNCTIONAL TESTING OF THE AUTOMATIC AND MANUAL ALARM INITIATING DEVICES. (ANNUAL ONLY/FUNCTIONAL)',
    '\u2022 VISUAL AND FUNCTIONAL TESTING OF THE TAMPER AND WATER FLOW DEVICES.',
    '\u2022 VISUAL AND FUNCTIONAL TESTING OF AUDIBLE AND VISUAL NOTIFICATION APPLIANCES (ANNUAL ONLY/FUNCTIONAL).',
    '\u2022 ALARM SIGNAL TRANSMISSION TO CENTRAL STATION VERIFICATION (IF APPLICABLE)',
    '\u2022 VISUAL AND FUNCTIONAL TESTING OF THE REMOTE SYSTEM ANNUNCIATORS (IF APPLICABLE).',
    '\u2022 GRAPHIC MAP DEVICE LOCATION VERIFICATION & ACCURACY (IF APPLICABLE).',
    '\u2022 HVAC AND DAMPER CONTROL RELAYS FUNCTIONAL TESTING (ANNUAL ONLY/FUNCTIONAL).',
    '\u2022 DOOR RELEASING RELAYS FUNCTIONAL TESTING (IF APPLICABLE) (ANNUAL ONLY/FUNCTIONAL).',
    '\u2022 DOCUMENTATION OF SYSTEM TESTING AND WHEN APPLICABLE GENERATION OF SYSTEM DEFICIENCIES REPORT.',
  ];
  // Pre-wrap all NFPA lines to the box width
  const nfpaMaxW = PW - 20;
  const nfpaWrapped = nfpaLines.flatMap(ln => {
    const isBullet = ln.startsWith('\u2022');
    const textW    = isBullet ? nfpaMaxW - 8 : nfpaMaxW;
    const textStr  = isBullet ? ln.slice(2) : ln; // strip bullet for wrapping
    const wrapped  = wrap(textStr, 7.5, textW);
    return wrapped.map((wl, wi) => ({ text: wl, bullet: isBullet && wi === 0, indent: isBullet && wi > 0 }));
  });
  const nfpaBlockH = nfpaWrapped.length * 10 + 12;
  checkPage(nfpaBlockH);
  page.drawRectangle({ x: ML, y: ry(nfpaBlockH), width: PW, height: nfpaBlockH, color: lgray, borderColor: sky, borderWidth: 0.3 });
  let nfpaY = ry(nfpaBlockH) + nfpaBlockH - 11;
  nfpaWrapped.forEach(({ text, bullet, indent }) => {
    const x = bullet ? ML + 6 : indent ? ML + 14 : ML + 6;
    if (bullet) page.drawText('\u2022', { x: ML + 6, y: nfpaY, size: 7.5, font: rFont, color: blk });
    page.drawText(text, { x: bullet ? ML + 14 : x, y: nfpaY, size: 7.5, font: bullet ? rFont : rFont, color: blk });
    nfpaY -= 10;
  });
  curY += nfpaBlockH + 4;

  // ════════════════════════════════════════════════════════════════
  // PAGE 2: PANEL & MONITORING
  // ════════════════════════════════════════════════════════════════
  addPage('Main Fire Alarm Control Panel Information');

  subHdr('Panel');
  gap(3);
  [['MAKE','h-cp-make'],['MODEL','h-cp-model'],['LOCATION','h-cp-location']].forEach(([l,id]) => {
    inlineRow(l, fv(id));
  });
  gap(4);
  subHdr('Monitoring');
  gap(3);
  [['COMPANY','h-monitor-company'],['PHONE','h-monitor-phone'],['ACCOUNT','h-monitor-account'],
   ['TIME OFFLINE','h-monitor-offline'],['TIME ONLINE','h-monitor-online']].forEach(([l,id]) => {
    inlineRow(l, fv(id));
  });
  gap(4);
  subHdr('Panel Testing / Disable Instructions');
  gap(4);
  const instrTxt = fv('h-panel-instructions') || '—';
  const instrLines = wrap(instrTxt, 8, PW - 8);
  const instrH = Math.max(instrLines.length * 10 + 10, 28);
  checkPage(instrH);
  mkField(instrTxt, ML, ry(instrH), PW, instrH, 8);
  curY += instrH + 4;

  subHdr('Dialer / Radio');
  gap(3);
  [['MAKE','h-dr-make'],['MODEL','h-dr-model'],['LOCATION','h-dr-location'],['TYPE','h-dr-type']].forEach(([l,id]) => {
    inlineRow(l, fv(id));
  });
  gap(4);

  // Pre/post checklist
  subHdr('Pre & Post Inspection Checklist');
  const lblW  = PW * 0.4, btnW = PW * 0.1, noteW = PW * 0.4, noteBW = PW * 0.1;
  // Two-column header
  const chkHdrCols = [
    { label: 'PRE-INSPECTION QUESTION', w: PW * 0.4 },
    { label: 'Y/N/NA', w: PW * 0.1 },
    { label: 'POST-INSPECTION QUESTION', w: PW * 0.4 },
    { label: 'Y/N/NA', w: PW * 0.1 },
  ];
  tblHdr(chkHdrCols);
  const preItems  = PRE_CHECKLIST_ITEMS.map(item => ({ label: item.label, val: document.getElementById(item.id)?.value || '' }));
  const postItems = POST_CHECKLIST_ITEMS.map(item => ({ label: item.label, val: document.getElementById(item.id)?.value || '' }));
  preItems.forEach((pre, i) => {
    const post = postItems[i] || { label: '', val: '' };
    tblRow(chkHdrCols, [pre.label, pre.val, post.label, post.val]);
  });
  gap(4);

  // Recurring schedule
  subHdr('Recurring Inspection Type and Month');
  const recCols = [
    { label: 'INSPECTION TYPE', w: PW * 0.35 },
    { label: 'MONTH', w: PW * 0.15 },
    { label: 'INSPECTION TYPE', w: PW * 0.35 },
    { label: 'MONTH', w: PW * 0.15 },
  ];
  tblHdr(recCols);
  document.querySelectorAll('#h-recurring-tbody tr').forEach(row => {
    const cells  = row.querySelectorAll('td');
    const inputs = row.querySelectorAll('input');
    tblRow(recCols, [
      cells[0]?.textContent?.trim() || '',
      inputs[0]?.value || '',
      cells[2]?.textContent?.trim() || '',
      inputs[1]?.value || '',
    ]);
  });

  // ════════════════════════════════════════════════════════════════
  // PAGE 3: TJC KEY SHEET — FIRE ALARM
  // ════════════════════════════════════════════════════════════════
  addPage('TJC/CMS Testing Interval Key Sheet — Fire Alarm Systems & Components');
  const kCols = [
    { label: 'System Device Specifics',     w: PW * 0.28 },
    { label: 'Current Totals',              w: PW * 0.10 },
    { label: 'Previous Totals',             w: PW * 0.10 },
    { label: 'Test/Inspection Interval',    w: PW * 0.16 },
    { label: 'Code Publication',            w: PW * 0.18 },
    { label: 'Activity: Freq.',             w: PW * 0.12 },
    { label: 'EP LS #',                     w: PW * 0.06 },
  ];
  tblHdr(kCols);
  document.querySelectorAll('#h-fa-key-tbody tr').forEach(row => {
    const cells    = row.querySelectorAll('td');
    const inps     = row.querySelectorAll('input');
    const fullCode = cells[4]?.textContent?.trim() || '';
    const m        = fullCode.match(/^(.+?\(\d{4}\))\s+(.*)$/);
    const codePub  = m ? m[1].trim() : fullCode;
    const codeAct  = m ? m[2].trim() : '';
    tblRow(kCols, [
      cells[0]?.textContent?.trim() || '',
      inps[0]?.value || '',
      inps[1]?.value || '',
      cells[3]?.textContent?.trim() || '',
      codePub,
      codeAct,
      cells[5]?.textContent?.trim() || '',
    ]);
  });

  // ════════════════════════════════════════════════════════════════
  // PAGE 4: TJC KEY SHEET — SPRINKLER/OTHER
  // ════════════════════════════════════════════════════════════════
  addPage('TJC/CMS Testing Interval Key Sheet — Sprinkler, Hood, Extinguishers, Dampers, Doors, Emergency Lights');
  tblHdr(kCols);
  document.querySelectorAll('#h-sp-key-tbody tr').forEach(row => {
    const cells    = row.querySelectorAll('td');
    const inps     = row.querySelectorAll('input');
    const fullCode = cells[4]?.textContent?.trim() || '';
    const m        = fullCode.match(/^(.+?\(\d{4}\))\s+(.*)$/);
    const codePub  = m ? m[1].trim() : fullCode;
    const codeAct  = m ? m[2].trim() : '';
    tblRow(kCols, [
      cells[0]?.textContent?.trim() || '',
      inps[0]?.value || '',
      inps[1]?.value || '',
      cells[3]?.textContent?.trim() || '',
      codePub,
      codeAct,
      cells[5]?.textContent?.trim() || '',
    ]);
  });

  // ════════════════════════════════════════════════════════════════
  // PAGE 5: FA OVERALL RESULT SUMMARY
  // ════════════════════════════════════════════════════════════════
  addPage('Fire Alarm Systems Overall Test Summary — Device/System Result Summary Page (Alarm)');
  const resCols = [
    { label: 'Devices/Signals/Systems', w: PW * 0.22 },
    { label: 'Key',      w: PW * 0.07 },
    { label: '#',        w: PW * 0.07 },
    { label: 'Pass #',   w: PW * 0.09 },
    { label: 'Fail #',   w: PW * 0.09 },
    { label: '% Pass',   w: PW * 0.09 },
    { label: '% Fail',   w: PW * 0.09 },
    { label: 'Not Tested', w: PW * 0.09 },
    { label: 'Not Found',  w: PW * 0.09 },
    { label: 'Notes',    w: PW * 0.11 },
  ];
  tblHdr(resCols);
  document.querySelectorAll('#h-fa-result-tbody tr').forEach(row => {
    const cells    = row.querySelectorAll('td');
    const numInps  = row.querySelectorAll('input[type=number]');
    const txtInps  = row.querySelectorAll('input[type=text]');
    tblRow(resCols, [
      cells[0]?.textContent?.trim() || '',
      cells[1]?.textContent?.trim() || '',
      numInps[0]?.value || '', numInps[1]?.value || '', numInps[2]?.value || '',
      row.querySelector('.pct-pass')?.textContent || '',
      row.querySelector('.pct-fail')?.textContent || '',
      numInps[3]?.value || '', numInps[4]?.value || '',
      txtInps[0]?.value || '',
    ]);
  });

  // ════════════════════════════════════════════════════════════════
  // PAGE 6: SP OVERALL RESULT SUMMARY
  // ════════════════════════════════════════════════════════════════
  addPage('Fire Suppression Systems & Others Overall Test Summary — Device/System Result Summary Page (Sprinkler & Others)');
  tblHdr(resCols);
  document.querySelectorAll('#h-sp-result-tbody tr').forEach(row => {
    const cells   = row.querySelectorAll('td');
    const numInps = row.querySelectorAll('input[type=number]');
    const txtInps = row.querySelectorAll('input[type=text]');
    tblRow(resCols, [
      cells[0]?.textContent?.trim() || '',
      cells[1]?.textContent?.trim() || '',
      numInps[0]?.value || '', numInps[1]?.value || '', numInps[2]?.value || '',
      row.querySelector('.pct-pass')?.textContent || '',
      row.querySelector('.pct-fail')?.textContent || '',
      numInps[3]?.value || '', numInps[4]?.value || '',
      txtInps[0]?.value || '',
    ]);
  });

  // ════════════════════════════════════════════════════════════════
  // PAGE 7: EXISTING SYSTEMS OVERVIEW
  // ════════════════════════════════════════════════════════════════
  addPage('Existing Life Safety Systems Overview Information');

  const ovLblW = PW * 0.43, ovBtnW = PW * 0.08, ovCntW = PW * 0.07, ovInspW = PW * 0.10, ovNoteW = PW * 0.24;
  const ovCols = [
    { label: 'Question',        w: ovLblW },
    { label: 'Y/N/NA',         w: ovBtnW },
    { label: '#',              w: ovCntW },
    { label: 'Inspecting?',    w: ovInspW },
    { label: 'Locations/Notes', w: ovNoteW },
  ];

  const ynaTblSection = (tbodyId, label) => {
    subHdr(label);
    tblHdr(ovCols);
    document.querySelectorAll(`#${tbodyId} tr`).forEach(row => {
      const cells  = row.querySelectorAll('td');
      const q      = cells[0]?.textContent?.trim() || '';
      const ynaEl  = cells[1]?.querySelector('.pf-btn.selected');
      const yna    = ynaEl?.textContent?.trim() || '';
      const cnt    = cells[2]?.querySelector('input')?.value || '';
      const inspEl = cells[3]?.querySelector('.pf-btn.selected');
      const insp   = inspEl?.textContent?.trim() || '';
      const notes  = cells[4]?.querySelector('input')?.value || '';
      const h = 16;
      const rowBg = yna === 'Y' ? PGREEN_LIGHT : yna === 'N' ? PRED_LIGHT : gold;
      checkPage(h + 1);
      // Q cell (static)
      page.drawRectangle({ x: ML, y: ry(h), width: ovLblW, height: h, color: rowBg, borderColor: sky, borderWidth: 0.3 });
      wrap(q, 7.5, ovLblW - 6).forEach((ln, li) => {
        page.drawText(ln, { x: ML+4, y: ry(h) + h - 7 - li * 8, size: 7.5, font: rFont, color: blk });
      });
      // YNA cell
      const ynaColor = yna === 'Y' ? PGREEN : yna === 'N' ? PRED : rowBg;
      const ynaTc    = (yna === 'Y' || yna === 'N') ? white : blk;
      page.drawRectangle({ x: ML+ovLblW, y: ry(h), width: ovBtnW, height: h, color: ynaColor, borderColor: sky, borderWidth: 0.3 });
      if (yna) { const tw = hFont.widthOfTextAtSize(yna, 7.5); page.drawText(yna, { x: ML+ovLblW + ovBtnW/2 - tw/2, y: ty(h,5), size: 7.5, font: hFont, color: ynaTc }); }
      // Count, Inspecting, Notes — editable
      mkField(cnt,   ML+ovLblW+ovBtnW,               ry(h), ovCntW,  h, 7.5, rowBg);
      mkField(insp,  ML+ovLblW+ovBtnW+ovCntW,         ry(h), ovInspW, h, 7.5, rowBg);
      mkField(notes, ML+ovLblW+ovBtnW+ovCntW+ovInspW, ry(h), ovNoteW, h, 7.5, rowBg);
      curY += h + 1;
    });
    gap(3);
  };

  ynaTblSection('h-ov-fa-tbody',      'Fire Alarm Systems');
  ynaTblSection('h-ov-sp-tbody',      'Fire Suppression Systems');
  ynaTblSection('h-ov-special-tbody', 'Special Hazards Systems');

  // 3 & 5 Year table
  checkPage(30);
  subHdr('3 & 5 Year — Previous Inspection Year (If Applicable)');
  const yr35Cols = [
    { label: 'Service',          w: PW * 0.28 },
    { label: 'Applicable?',      w: PW * 0.12 },
    { label: 'Last Year',        w: PW * 0.12 },
    { label: 'Next Due',         w: PW * 0.12 },
    { label: 'Inspecting Now?',  w: PW * 0.14 },
    { label: 'Locations/Notes',  w: PW * 0.22 },
  ];
  tblHdr(yr35Cols);
  document.querySelectorAll('#h-35yr-tbody tr').forEach(row => {
    const cells  = row.querySelectorAll('td');
    const appEl  = cells[1]?.querySelector('.pf-btn.selected');
    const inspEl = cells[4]?.querySelector('.pf-btn.selected');
    tblRow(yr35Cols, [
      cells[0]?.textContent?.trim() || '',
      appEl?.textContent?.trim() || '',
      cells[2]?.querySelector('input')?.value || '',
      cells[3]?.querySelector('input')?.value || '',
      inspEl?.textContent?.trim() || '',
      cells[5]?.querySelector('input')?.value || '',
    ]);
  });

  // ════════════════════════════════════════════════════════════════
  // PAGES 8+: INDIVIDUAL DEVICE SHEETS
  // ════════════════════════════════════════════════════════════════
  const stdCols6 = (c1w, c2w, c3w, c4w, c5w, c6w, c1l, c2l, c3l, c4l, c5l, c6l) => [
    { label: c1l, w: PW*c1w }, { label: c2l, w: PW*c2w }, { label: c3l, w: PW*c3w },
    { label: c4l, w: PW*c4w }, { label: c5l, w: PW*c5w }, { label: c6l, w: PW*c6w },
  ];

  // PAGE 8: SUPERVISORY SIGNALS (PF col = 5)
  devicePage('Supervisory Signals (Excluding Tampers & Duct Detectors) — EC.02.03.05 EP 01',
    'h-supervisory-tbody',
    [{ label:'Floor',w:PW*0.09},{label:'Type',w:PW*0.10},{label:'Location',w:PW*0.38},
     {label:'Address',w:PW*0.15},{label:'Visual',w:PW*0.14},{label:'Functional',w:PW*0.14}],
    [inp(0), selOpt(0), inp(1), inp(2), selOpt(1), selOpt(2)], 5);

  // PAGE 9: FLOW & PRESSURE SWITCHES
  devicePage('Flow & Pressure Switches — EC.02.03.05 EP 02', 'h-flow-tbody',
    [{label:'Floor',w:PW*0.08},{label:'Type',w:PW*0.09},{label:'Location',w:PW*0.28},
     {label:'Address',w:PW*0.13},{label:'Visual',w:PW*0.10},{label:'Functional',w:PW*0.10},
     {label:'Time (sec)',w:PW*0.12},{label:'Note',w:PW*0.10}],
    [inp(0), selOpt(0), inp(1), inp(2), selOpt(1), selOpt(2), inp(3), inp(4)], 5);

  // PAGE 10: TAMPER SWITCHES  (Type is a text input, not select)
  devicePage('Tamper Switches (Supervisory) — EC.02.03.05 EP 02', 'h-tamper-tbody',
    [{label:'Floor',w:PW*0.09},{label:'Type',w:PW*0.10},{label:'Location',w:PW*0.38},
     {label:'Address',w:PW*0.15},{label:'Visual',w:PW*0.14},{label:'Functional',w:PW*0.14}],
    [inp(0), inp(1), inp(2), inp(3), selOpt(0), selOpt(1)], 5);

  // PAGES 11+: SMOKE DETECTORS (30/page)
  const smokeAlSel = (row) => { const el = row.querySelectorAll('select')[1]; return el?.options[el.selectedIndex]?.text || 'AL'; };
  pagedDevicePage('Smoke Detectors — EC.02.03.05 EP 03', 'h-smoke-tbody',
    [{label:'Floor',w:PW*0.07},{label:'Type',w:PW*0.09},{label:'Location',w:PW*0.31},
     {label:'Address',w:PW*0.14},{label:'AL/SPV',w:PW*0.09},{label:'Visual',w:PW*0.14},{label:'Functional',w:PW*0.16}],
    [inp(0), selOpt(0), inp(1), inp(2), smokeAlSel, selOpt(2), selOpt(3)], 6, 30);

  // PAGE 12: HEAT DETECTORS  (Type is a text input, not select)
  devicePage('Heat Detectors — EC.02.03.05 EP 03', 'h-heat-tbody',
    [{label:'Floor',w:PW*0.09},{label:'Type',w:PW*0.10},{label:'Location',w:PW*0.38},
     {label:'Address',w:PW*0.15},{label:'Visual',w:PW*0.14},{label:'Functional',w:PW*0.14}],
    [inp(0), inp(1), inp(2), inp(3), selOpt(0), selOpt(1)], 5);

  // PAGES 13+: MANUAL PULL STATIONS  (Type is a text input, not select)
  pagedDevicePage('Manual Pull Stations — EC.02.03.05 EP 03', 'h-pull-tbody',
    [{label:'Floor',w:PW*0.09},{label:'Type',w:PW*0.10},{label:'Location',w:PW*0.38},
     {label:'Address',w:PW*0.15},{label:'Visual',w:PW*0.14},{label:'Functional',w:PW*0.14}],
    [inp(0), inp(1), inp(2), inp(3), selOpt(0), selOpt(1)], 5, 30);

  // PAGE 14: DUCT DETECTORS  (Type is a text input, not select)
  devicePage('Duct Detectors — EC.02.03.05 EP 03', 'h-duct-tbody',
    [{label:'Floor',w:PW*0.09},{label:'Type',w:PW*0.10},{label:'Location',w:PW*0.38},
     {label:'Address',w:PW*0.15},{label:'Visual',w:PW*0.14},{label:'Functional',w:PW*0.14}],
    [inp(0), inp(1), inp(2), inp(3), selOpt(0), selOpt(1)], 5);

  // PAGES 15+: AUDIO/VISUAL
  pagedDevicePage('Audio/Visual Notification — EC.02.03.05 EP 04', 'h-av-tbody',
    [{label:'Floor',w:PW*0.09},{label:'Type',w:PW*0.12},{label:'Location',w:PW*0.51},
     {label:'Visual',w:PW*0.14},{label:'Functional',w:PW*0.14}],
    [inp(0), selOpt(0), inp(1), selOpt(1), selOpt(2)], 4, 33);

  // PAGE 16: DOOR RELEASING DEVICES
  devicePage('Door Releasing Devices — EC.02.03.05 EP 04', 'h-door-release-tbody',
    [{label:'Floor',w:PW*0.09},{label:'Type',w:PW*0.12},{label:'Location',w:PW*0.51},
     {label:'Visual',w:PW*0.14},{label:'Functional',w:PW*0.14}],
    [inp(0), selOpt(0), inp(1), selOpt(1), selOpt(2)], 4);

  // ════════════════════════════════════════════════════════════════
  // PAGE 17: OFF-PREMISE MONITORING
  // ════════════════════════════════════════════════════════════════
  addPage('Off Premise Monitoring — EC.02.03.05 EP 05');
  const offCols = [
    { label: 'Monitoring Company',           w: PW*0.23 },
    { label: 'Time Offline',                 w: PW*0.13 },
    { label: 'Signals Sent (HH:MM:SS)',      w: PW*0.18 },
    { label: 'Signals Received (HH:MM:SS)',  w: PW*0.18 },
    { label: 'Time Online',                  w: PW*0.14 },
    { label: 'Pass/Fail',                    w: PW*0.14 },
  ];
  tblHdr(offCols);
  document.querySelectorAll('#h-offprem-tbody tr').forEach(row => {
    const ins  = row.querySelectorAll('input');
    const sels = row.querySelectorAll('select');
    tblRow(offCols, [
      ins[0]?.value||'', ins[1]?.value||'', ins[2]?.value||'',
      ins[3]?.value||'', ins[4]?.value||'',
      sels[0]?.options[sels[0].selectedIndex]?.text||'',
    ], 5);
  });

  // ════════════════════════════════════════════════════════════════
  // PAGE 18: ELEVATOR RECALL
  // ════════════════════════════════════════════════════════════════
  addPage('Annual — Elevator Recall Testing — LS 02.01.50 EP 07');
  const bankCards = document.querySelectorAll('#h-elevator-banks > div');
  const elvCols = [
    { label: '',                     w: PW*0.35 },
    { label: 'Recall Floor',         w: PW*0.15 },
    { label: 'Operational?',         w: PW*0.20 },
    { label: 'Device Used for Recall', w: PW*0.30 },
  ];
  bankCards.forEach((card, bi) => {
    checkPage(50);
    const ins  = card.querySelectorAll('input');
    const sels = card.querySelectorAll('select');
    // ins[0]=Month/Year, ins[1]=Location/Bank#, ins[2]=Primary Recall Floor,
    // ins[3]=Primary Device Used, ins[4]=Primary Note (hidden), ins[5]=Secondary Recall Floor,
    // ins[6]=Secondary Device Used, ins[7]=Secondary Note (hidden)
    const bankNum  = bi + 1;
    const bankLoc  = ins[1]?.value || `Bank ${bankNum}`;
    const bankMoYr = ins[0]?.value || '';
    subHdr(`Elevator Recall Bank ${bankNum} — Location / Bank #: ${bankLoc}  (${bankMoYr})`);
    tblHdr(elvCols);
    tblRow(elvCols, ['PRIMARY RECALL FLOOR',   ins[2]?.value||'1ST',  sels[0]?.options[sels[0].selectedIndex]?.text||'', ins[3]?.value||''], 2);
    tblRow(elvCols, ['SECONDARY RECALL FLOOR', ins[5]?.value||'BSMT', sels[1]?.options[sels[1].selectedIndex]?.text||'', ins[6]?.value||''], 2);
    gap(4);
  });
  checkPage(14);
  page.drawText(`ELEVATOR BANK TOTAL COUNT: ${bankCards.length}`, { x: ML, y: ty(13,4), size: 8, font: hFont, color: navy });
  curY += 14;

  // ════════════════════════════════════════════════════════════════
  // PAGES 19+: SUB PANEL / POWER SUPPLY
  // ════════════════════════════════════════════════════════════════
  const spRows = Array.from(document.querySelectorAll('#h-subpanel-tbody tr'));
  if (spRows.length) {
    const spCols = [
      {label:'Location',w:PW*0.18},{label:'Make',w:PW*0.09},{label:'Model',w:PW*0.09},
      {label:'Panel/Ckt',w:PW*0.08},{label:'AH',w:PW*0.06},{label:'Avail NACS',w:PW*0.07},
      {label:'Install Date',w:PW*0.09},{label:'(L) Batt %',w:PW*0.07},{label:'(R) Batt %',w:PW*0.07},
      {label:'SPVSD?',w:PW*0.06},{label:'Pass/Fail',w:PW*0.08},{label:'Style',w:PW*0.06},
    ];
    for (let start = 0; start < spRows.length; start += 15) {
      addPage('Sub Panel / Power Supply Information — LS 02.01.34 EP 10');
      tblHdr(spCols);
      spRows.slice(start, start + 15).forEach(row => {
        const ins  = row.querySelectorAll('input');
        const sls  = row.querySelectorAll('select');
        tblRow(spCols, [
          ins[0]?.value||'', ins[1]?.value||'', ins[2]?.value||'', ins[3]?.value||'',
          ins[4]?.value||'', ins[5]?.value||'', ins[6]?.value?.substring(0,10)||'',
          ins[7]?.value||'', ins[8]?.value||'', ins[9]?.value||'',
          sls[0]?.options[sls[0].selectedIndex]?.text||'', ins[10]?.value||'',
        ], 10);
      });
    }
    checkPage(14);
    page.drawText(`FACP, SUB PANEL AND POWER SUPPLY TOTAL COUNT: ${spRows.length}`, { x: ML, y: ty(13,4), size: 8, font: hFont, color: navy });
    curY += 14;
  }

  // ════════════════════════════════════════════════════════════════
  // PAGE 20: ANNUNCIATORS
  // ════════════════════════════════════════════════════════════════
  addPage('Annunciator Information — LS 02.01.34 EP 10');
  const annCards = document.querySelectorAll('#h-annunciator-grid > div');
  let annIdx = 0;
  const hw = PW / 2 - 3;
  while (annIdx < annCards.length) {
    const card1 = annCards[annIdx];
    const card2 = annCards[annIdx + 1];
    checkPage(35);
    const renderAnnCard = (card, cx) => {
      if (!card) return;
      const ins  = card.querySelectorAll('input');
      const sls  = card.querySelectorAll('select');
      page.drawRectangle({ x: cx, y: ry(13), width: hw, height: 13, color: midnav });
      page.drawText('ANNUNCIATOR', { x: cx+4, y: ty(13,4), size: 8.5, font: hFont, color: white });
      curY += 18; // 14 for header + 4 padding before first label
      [['MAKE', ins[0]?.value||''], ['MODEL', ins[1]?.value||''],
       ['LOCATION', ins[2]?.value||''], ['PASS/FAIL', sls[0]?.options[sls[0].selectedIndex]?.text||''],
       ['NOTES', ins[3]?.value||'']].forEach(([l, v]) => {
        page.drawText(l+':', { x: cx+3, y: ty(9, 7), size: 7, font: hFont, color: navy });
        mkField(v, cx, ry(23), hw, 14, 8);
        curY += 26;
      });
    };
    const savedY = curY;
    renderAnnCard(card1, ML);
    const afterCard1Y = curY;
    curY = savedY;
    renderAnnCard(card2, ML + hw + 6);
    curY = Math.max(afterCard1Y, curY);
    gap(4);
    annIdx += 2;
  }
  checkPage(14);
  page.drawText(`ANNUNCIATOR TOTAL COUNT: ${annCards.length}`, { x: ML, y: ty(13,4), size: 8, font: hFont, color: navy });
  curY += 14;

  // ════════════════════════════════════════════════════════════════
  // PAGE 21: AHU SHUTDOWN
  // ════════════════════════════════════════════════════════════════
  devicePage('Air Handling Unit (AHU) Shutdown — EC.02.03.05 EP 19', 'h-ahu-tbody',
    [{label:'Floor',w:PW*0.09},{label:'Type',w:PW*0.10},{label:'Location',w:PW*0.53},
     {label:'Visual',w:PW*0.14},{label:'Functional',w:PW*0.14}],
    [inp(0), inp(1), inp(2), selOpt(0), selOpt(1)], 4);

  // ════════════════════════════════════════════════════════════════
  // PAGE 22: MAIN DRAIN
  // ════════════════════════════════════════════════════════════════
  addPage('Main Drain Results — EC.02.03.05 EP 09');
  const mdCols = [
    {label:'#',w:PW*0.06},{label:'System Location',w:PW*0.36},{label:'Static PSI',w:PW*0.14},
    {label:'Residual PSI',w:PW*0.14},{label:'Post PSI',w:PW*0.14},{label:'Pass/Fail',w:PW*0.16},
  ];
  tblHdr(mdCols);
  document.querySelectorAll('#h-main-drain-tbody tr').forEach((row, i) => {
    const ins  = row.querySelectorAll('input');
    const sls  = row.querySelectorAll('select');
    tblRow(mdCols, [String(i+1), ins[0]?.value||'', ins[1]?.value||'', ins[2]?.value||'', ins[3]?.value||'',
      sls[0]?.options[sls[0].selectedIndex]?.text||''], 5);
  });
  const mdCount = document.querySelectorAll('#h-main-drain-tbody tr').length;
  checkPage(14);
  page.drawText(`EQUIPMENT COUNT: MD ${mdCount}`, { x: ML, y: ty(13,4), size: 8, font: hFont, color: navy });
  curY += 14;

  // PAGE 23: FDC
  devicePage('Fire Department Connections (FDC) — EC.02.03.05 EP 10', 'h-fdc-tbody',
    [{label:'Floor',w:PW*0.07},{label:'Type',w:PW*0.09},{label:'Location',w:PW*0.32},
     {label:'Visual',w:PW*0.11},{label:'Functional',w:PW*0.11},{label:'Inlet',w:PW*0.14},{label:'Condition',w:PW*0.16}],
    [inp(0), selOpt(0), inp(1), selOpt(1), selOpt(2), inp(2), inp(3)], 4);

  // PAGE 24: HOSE VALVES
  devicePage('Hose Valve Connections — EC.02.03.05 EP 10', 'h-hose-valve-tbody',
    [{label:'Floor',w:PW*0.07},{label:'Type',w:PW*0.09},{label:'Location',w:PW*0.32},
     {label:'Visual',w:PW*0.11},{label:'Functional',w:PW*0.11},{label:'Cap Style',w:PW*0.14},{label:'Size',w:PW*0.16}],
    [inp(0), inp(1), inp(2), selOpt(0), selOpt(1), inp(3), inp(4)], 4);

  // PAGE 25: STANDPIPES
  devicePage('Standpipes — LS 02.01.35 EP 14', 'h-standpipe-tbody',
    [{label:'Floor',w:PW*0.08},{label:'Type',w:PW*0.10},{label:'Location',w:PW*0.38},
     {label:'Visual',w:PW*0.14},{label:'Condition',w:PW*0.16},{label:'Size (in)',w:PW*0.14}],
    [inp(0), inp(1), inp(2), selOpt(0), inp(3), inp(4)], 3);

  // PAGE 26: SPARE HEAD BOXES
  devicePage('Sprinkler Spare Head Box(es) — LS 02.01.35 EP 14', 'h-spare-heads-tbody',
    [{label:'Floor',w:PW*0.06},{label:'Type',w:PW*0.08},{label:'Location',w:PW*0.23},
     {label:'Visual',w:PW*0.09},{label:'Count',w:PW*0.08},{label:'Head Type',w:PW*0.10},
     {label:'Temp °F',w:PW*0.09},{label:'Response',w:PW*0.10},{label:'Note',w:PW*0.17}],
    [inp(0), selOpt(0), inp(1), selOpt(3), inp(2), selOpt(1), inp(3), selOpt(2), inp(4)], 3);

  // PAGE 27: SPRINKLER CONTROL VALVES
  devicePage('Sprinkler Control Valves — LS 02.01.35 EP 14', 'h-valves-tbody',
    [{label:'Floor',w:PW*0.07},{label:'Type',w:PW*0.09},{label:'Location',w:PW*0.36},
     {label:'Visual',w:PW*0.12},{label:'Functional',w:PW*0.12},{label:'Valve Type',w:PW*0.24}],
    [inp(0), inp(1), inp(2), selOpt(0), selOpt(1), inp(3)], 4);

  // PAGE 28: HYDRAULIC CALC PLATES
  devicePage('Hydraulic Calc Plates — LS 02.01.35 EP 14', 'h-hydraulic-tbody',
    [{label:'Floor',w:PW*0.08},{label:'Type',w:PW*0.10},{label:'Location',w:PW*0.48},
     {label:'Visual',w:PW*0.17},{label:'Legible?',w:PW*0.17}],
    [inp(0), inp(1), inp(2), selOpt(0), selOpt(1)], 4);

  // PAGE 29: SPRINKLER GAUGES
  devicePage('Sprinkler Gauges — LS 02.01.35 EP 14', 'h-gauges-tbody',
    [{label:'Floor',w:PW*0.07},{label:'Type',w:PW*0.09},{label:'Location',w:PW*0.36},
     {label:'Visual',w:PW*0.12},{label:'Functional',w:PW*0.12},{label:'Manf. Year',w:PW*0.24}],
    [inp(0), inp(1), inp(2), selOpt(0), selOpt(1), inp(3)], 4);

  // ════════════════════════════════════════════════════════════════
  // PAGE 30: SPRINKLER CHECKLIST
  // ════════════════════════════════════════════════════════════════
  addPage('Sprinkler Inspection Checklist — LS 02.01.35 EP 14');

  const spLblW = PW * 0.50, spBtnW = PW * 0.09, spNoteW = PW - spLblW - spBtnW * 3;
  const spChkHdrCols = [
    { label: 'Question',          w: spLblW },
    { label: 'Y',                 w: spBtnW },
    { label: 'N',                 w: spBtnW },
    { label: 'NA',                w: spBtnW },
    { label: 'Notes/Deficiency',  w: spNoteW },
  ];

  const spChkSection = (label, items) => {
    subHdr(label);
    tblHdr(spChkHdrCols);
    items.forEach(item => {
      const ynaGroup = document.querySelector(`[data-id="${item.id}"] .yna-group`);
      const selBtn   = ynaGroup?.querySelector('.yna-btn.selected')?.textContent?.trim() || '';
      const note     = document.getElementById('sp-defic-note-' + item.id)?.value || '';
      const h = 16;
      const rowBg = selBtn === 'Y' ? PGREEN_LIGHT : selBtn === 'N' ? PRED_LIGHT : gold;
      checkPage(h + 1);
      // Label
      page.drawRectangle({ x: ML, y: ry(h), width: spLblW, height: h, color: rowBg, borderColor: sky, borderWidth: 0.3 });
      wrap(item.label, 7.5, spLblW - 6).forEach((ln, li) => {
        page.drawText(ln, { x: ML+4, y: ry(h) + h - 7 - li * 8, size: 7.5, font: rFont, color: blk });
      });
      // Y / N / NA buttons
      let bx = ML + spLblW;
      ['Y','N','NA'].forEach(opt => {
        const sel = selBtn === opt;
        const bg  = sel && opt === 'Y' ? PGREEN : sel && opt === 'N' ? PRED : sel && opt === 'NA' ? sky : rowBg;
        const tc  = sel && (opt === 'Y' || opt === 'N') ? white : blk;
        page.drawRectangle({ x: bx, y: ry(h), width: spBtnW, height: h, color: bg, borderColor: sky, borderWidth: 0.3 });
        if (sel) {
          const tw = hFont.widthOfTextAtSize('X', 8);
          page.drawText('X', { x: bx + spBtnW/2 - tw/2, y: ty(h,5), size: 8, font: hFont, color: tc });
        } else {
          const f = form.createTextField(fid());
          f.setText('');
          f.addToPage(page, { x: bx+1, y: ry(h)+1, width: spBtnW-2, height: h-2, font: rFont });
          f.setFontSize(8);
        }
        bx += spBtnW;
      });
      // Notes
      mkField(note, bx, ry(h), spNoteW, h, 7.5, rowBg);
      curY += h + 1;
    });
    gap(3);
  };

  spChkSection('Pre-Inspection',                     SP_CHECKLIST.pre);
  spChkSection('Fire Dept Connections',              SP_CHECKLIST.fdc);
  spChkSection('Valves / Gauges',                   SP_CHECKLIST.valve);
  checkPage(60);
  spChkSection('Sprinkler Heads / Components',       SP_CHECKLIST.heads);
  spChkSection('Visible Pipe',                      SP_CHECKLIST.pipe);
  spChkSection('Main Drain Observations',           SP_CHECKLIST.drain);
  checkPage(50);
  spChkSection('Dry Pipe / Pre-Action (If Applicable)', SP_DRY_ITEMS);
  spChkSection('5-Year Items (If Due)',              SP_5YR_ITEMS);

  // Dry/5yr extra fields
  const tripDate = fv('h-sp-trip-date'), tripPsi = fv('h-sp-trip-psi'), due5yr = fv('h-sp-5yr-due');
  if (tripDate || tripPsi || due5yr) {
    checkPage(14);
    dataRow([
      { label: 'Last Trip Test Date', val: tripDate, w: PW*0.33 },
      { label: 'Trip Pressure (PSI)', val: tripPsi,  w: PW*0.33 },
      { label: '5-Yr Items Next Due', val: due5yr,   w: PW*0.34 },
    ], 12, 8, 4);
  }

  // ════════════════════════════════════════════════════════════════
  // PAGE 31: INVENTORY CHANGE SHEET
  // ════════════════════════════════════════════════════════════════
  addPage('Inventory Change Sheet');
  const invCols = [
    {label:'Floor',w:PW*0.07},{label:'Type',w:PW*0.09},{label:'Location',w:PW*0.31},
    {label:'Address',w:PW*0.14},{label:'Add/Rem',w:PW*0.12},{label:'Pass/Fail',w:PW*0.12},{label:'Note',w:PW*0.15},
  ];
  tblHdr(invCols);
  const invRows = document.querySelectorAll('#h-inventory-tbody tr');
  invRows.forEach(row => {
    const ins  = row.querySelectorAll('input');
    const sls  = row.querySelectorAll('select');
    tblRow(invCols, [
      ins[0]?.value||'', ins[1]?.value||'', ins[2]?.value||'', ins[3]?.value||'',
      sls[0]?.options[sls[0].selectedIndex]?.text||'',
      sls[1]?.options[sls[1].selectedIndex]?.text||'',
      ins[4]?.value||'',
    ], 5);
  });
  const addedCount   = Array.from(invRows).filter(r => r.querySelector('select')?.value === 'ADDED').length;
  const removedCount = invRows.length - addedCount;
  checkPage(14);
  page.drawText(`STATUS — ADDED: ${addedCount}   REMOVED: ${removedCount}`, { x: ML, y: ty(13,4), size: 8, font: hFont, color: navy });
  curY += 14;

  // ════════════════════════════════════════════════════════════════
  // PAGES 32+: FIRE EXTINGUISHER RESULTS
  // ════════════════════════════════════════════════════════════════
  const _extUnits = [];
  for (let _ei = 1; _ei <= extUnitCount; _ei++) {
    if (!document.getElementById('ext-unit-row-' + _ei)) continue;
    _extUnits.push({
      flr:      document.getElementById('u-flr-'     + _ei)?.value || '',
      loc:      document.getElementById('u-loc-'     + _ei)?.value || '',
      mount:    document.getElementById('u-mount-'   + _ei)?.value || '',
      mfg:      document.getElementById('u-mfg-'     + _ei)?.value || '',
      size:     document.getElementById('u-size-'    + _ei)?.value || '',
      type:     document.getElementById('u-type-'    + _ei)?.value || '',
      pf:       document.getElementById('u-pf-'      + _ei)?.value || '',
      hydro:    document.getElementById('u-hydro-'   + _ei)?.value || '',
      recharge: document.getElementById('u-recharge-'+ _ei)?.value || '',
      newunit:  document.getElementById('u-newunit-' + _ei)?.value || '',
      cabM:     document.getElementById('u-cab-m-'   + _ei)?.value || '',
      cabG:     document.getElementById('u-cab-g-'   + _ei)?.value || '',
      cabS:     document.getElementById('u-cab-s-'   + _ei)?.value || '',
    });
  }
  if (_extUnits.length) {
    // Key/info page
    addPage('Fire Extinguisher Information & Key — EC.02.03.05 EP 16');
    subHdr('Inspection Results Key and Information');
    const keyInfo = [
      ['Unit Passed Inspection',   'PASS'],
      ['Unit is Deficient/Missing','FAIL'],
      ['ABC Units Service Interval','Every 6 years — alternating 6-year maintenance and hydrostatic pressure test'],
      ['Special Hazard Units',     'Every 5 years — hydrostatic pressure test'],
      ['Cabinet Requirements',     'Cabinets must have glass, strike mallets, and signage if obstructed from view'],
    ];
    tblHdr([{label:'Item',w:PW*0.35},{label:'Detail',w:PW*0.65}]);
    keyInfo.forEach(([l,v]) => tblRow([{w:PW*0.35},{w:PW*0.65}], [l,v]));
    gap(5);

    subHdr('Services Due Now Summary');
    // Ensure the services table is populated from unit data
    if (typeof buildExtSvcTable === 'function' && !document.getElementById('ext-svc-tbody')?.children.length) {
      buildExtSvcTable();
    }
    if (typeof autoFillExtSvcFromUnits === 'function') autoFillExtSvcFromUnits();
    const extSumCols = [
      {label:'Type',w:PW*0.20},{label:'6-Year Maint',w:PW*0.16},{label:'Hydrostatic',w:PW*0.16},
      {label:'Recharge',w:PW*0.16},{label:'New Unit',w:PW*0.16},{label:'Notes',w:PW*0.16},
    ];
    tblHdr(extSumCols);
    document.querySelectorAll('#ext-svc-tbody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      const vals  = Array.from(cells).map(c => c.querySelector('input')?.value || c.textContent?.trim() || '');
      tblRow(extSumCols, vals.slice(0, 6));
    });
    gap(4);
    checkPage(14);
    page.drawText(`TOTAL EXTINGUISHERS ON REPORT: ${_extUnits.length}`, { x: ML, y: ty(13,4), size: 8, font: hFont, color: navy });
    curY += 14;

    // Detail pages — 33 per page
    const extCols = [
      {label:'Floor',w:PW*0.06},{label:'Location',w:PW*0.21},{label:'Mount',w:PW*0.07},
      {label:'Cabinet',w:PW*0.09},{label:'MFG Yr',w:PW*0.07},{label:'Size',w:PW*0.06},
      {label:'Type',w:PW*0.07},{label:'P/F',w:PW*0.07},{label:'Hydro Due',w:PW*0.09},
      {label:'Recharge',w:PW*0.08},{label:'New Unit',w:PW*0.13},
    ];
    for (let start = 0; start < _extUnits.length; start += 33) {
      addPage('Annual — Fire Extinguisher Inspection Results — EC.02.03.05 EP 16');
      tblHdr(extCols);
      _extUnits.slice(start, start + 33).forEach(u => {
        const cab = [u.cabM==='Y'?'Mallet':'', u.cabG==='Y'?'Glass':'', u.cabS==='Y'?'Sign':''].filter(Boolean).join('/') || '—';
        tblRow(extCols, [u.flr, u.loc, u.mount, cab, u.mfg, u.size, u.type, u.pf,
          u.hydro, u.recharge==='Y'?'YES':'', u.newunit==='Y'?'YES':''], 7);
      });
      if (start + 33 >= _extUnits.length) {
        checkPage(14);
        page.drawText(`UNIT COUNT: ${_extUnits.length}`, { x: ML, y: ty(13,4), size: 8, font: hFont, color: navy });
        curY += 14;
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // LAST PAGE: DEFICIENCY INFORMATION
  // ════════════════════════════════════════════════════════════════
  addPage('Deficiency Information');

  const defRows = document.querySelectorAll('#h-defic-tbody tr');
  const defCols = [{label:'#',w:PW*0.06},{label:'Deficiency',w:PW*0.78},{label:'Make/Model',w:PW*0.16}];
  tblHdr(defCols);
  if (defRows.length) {
    defRows.forEach((row, i) => {
      const ins = row.querySelectorAll('input');
      tblRow(defCols, [String(i+1), ins[0]?.value||'', ins[1]?.value||''], -1, PRED_LIGHT);
    });
  } else {
    checkPage(14);
    page.drawRectangle({ x: ML, y: ry(13), width: PW, height: 13, color: lgray, borderColor: sky, borderWidth: 0.3 });
    page.drawText('No deficiencies recorded.', { x: ML+4, y: ty(13,4), size: 8.5, font: rFont, color: blk });
    curY += 14;
  }
  gap(4);

  // Failed batteries
  checkPage(30);
  secHdr('Failed Batteries (If Applicable)');
  const batRows = document.querySelectorAll('#h-battery-tbody tr');
  const batCols = [{label:'Size (AH)',w:PW*0.18},{label:'Type',w:PW*0.18},{label:'Count',w:PW*0.14},{label:'Locations',w:PW*0.50}];
  tblHdr(batCols);
  if (batRows.length) {
    batRows.forEach(row => {
      const ins = row.querySelectorAll('input');
      tblRow(batCols, [ins[0]?.value||'', ins[1]?.value||'', ins[2]?.value||'', ins[3]?.value||'']);
    });
  } else {
    checkPage(14);
    page.drawRectangle({ x: ML, y: ry(13), width: PW, height: 13, color: lgray, borderColor: sky, borderWidth: 0.3 });
    page.drawText('No battery failures recorded.', { x: ML+4, y: ty(13,4), size: 8.5, font: rFont, color: blk });
    curY += 14;
  }
  gap(4);

  // General notes
  checkPage(20);
  secHdr('General Notes & Site Observations');
  const noteRows = document.querySelectorAll('#h-notes-tbody tr');
  if (noteRows.length) {
    noteRows.forEach((row, i) => {
      const ins = row.querySelectorAll('input');
      tblRow([{w:PW*0.06},{w:PW*0.94}], [String(i+1), ins[0]?.value||'']);
    });
  } else {
    checkPage(14);
    page.drawRectangle({ x: ML, y: ry(13), width: PW, height: 13, color: lgray, borderColor: sky, borderWidth: 0.3 });
    page.drawText('No general notes recorded.', { x: ML+4, y: ty(13,4), size: 8.5, font: rFont, color: blk });
    curY += 14;
  }
  gap(6);

  // Overall status bar
  if (H.overallStatus) {
    const stVal = H.overallStatus.toUpperCase();
    const stColor = stVal === 'COMPLIANT' ? PGREEN : stVal === 'IMPAIRED' ? AMBER : PRED;
    checkPage(16);
    page.drawRectangle({ x: ML, y: ry(14), width: PW, height: 14, color: stColor });
    const stTxt = `OVERALL STATUS: ${stVal}`;
    const stTxtW = hFont.widthOfTextAtSize(stTxt, 13);
    page.drawText(stTxt, { x: W/2 - stTxtW/2, y: ty(14, 4), size: 13, font: hFont, color: white });
    curY += 18;
  }

  // Photos
  const photos = document.querySelectorAll('#h-photo-grid .photo-thumb img');
  if (photos.length) {
    checkPage(50);
    secHdr('Inspection Photos');
    const photoW = Math.floor((PW - 10) / 3);
    const photoH = Math.floor(photoW * 0.75);
    let col = 0, rowY = curY;
    for (let i = 0; i < photos.length; i++) {
      const img = photos[i];
      checkPage(photoH + 20);
      const px = ML + col * (photoW + 5);
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth || 200;
        canvas.height = img.naturalHeight || 150;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const b64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
        const pImg  = await pdfDoc.embedJpg(ab);
        const pDims = pImg.scaleToFit(photoW, photoH);
        page.drawImage(pImg, { x: px, y: ry(photoH) + (photoH - pDims.height), width: pDims.width, height: pDims.height });
        const caption = img.closest('.photo-thumb')?.querySelector('textarea')?.value || '';
        if (caption) page.drawText(wrap(caption, 6, photoW)[0], { x: px, y: ry(photoH) - 8, size: 6, font: rFont, color: blk });
      } catch(_) {}
      col++;
      if (col >= 3) { col = 0; curY += photoH + 16; }
    }
    if (col > 0) curY += photoH + 16;
    gap(4);
  }

  // Signatures
  checkPage(80);
  secHdr('Signatures');
  gap(6);
  const sigH = 40, sigW = PW / 2 - 6;
  // Draw labels at current curY, then advance, then draw sig boxes
  page.drawText('INSPECTOR SIGNATURE:', { x: ML, y: ty(10, 7), size: 8.5, font: hFont, color: navy });
  page.drawText('CUSTOMER SIGNATURE (Optional):', { x: ML+PW/2+10, y: ty(10, 7), size: 8.5, font: hFont, color: navy });
  curY += 12;
  if (H.inspSig) {
    try {
      const b64 = H.inspSig.split(',')[1];
      const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
      const sImg  = await pdfDoc.embedPng(ab);
      const sDims = sImg.scaleToFit(sigW - 8, sigH - 8);
      page.drawImage(sImg, { x: ML+4, y: ry(sigH)+4, width: sDims.width, height: sDims.height });
    } catch(_) {}
  } else {
    mkField('', ML, ry(sigH), sigW, sigH, 9);
  }
  if (H.custSig) {
    try {
      const b64 = H.custSig.split(',')[1];
      const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
      const cImg  = await pdfDoc.embedPng(ab);
      const cDims = cImg.scaleToFit(sigW - 8, sigH - 8);
      page.drawImage(cImg, { x: ML+PW/2+12, y: ry(sigH)+4, width: cDims.width, height: cDims.height });
    } catch(_) {}
  } else {
    mkField('', ML+PW/2+8, ry(sigH), sigW, sigH, 9);
  }
  curY += sigH + 6;
  dataRow([
    { label: 'INSPECTOR PRINT NAME', val: fv('h-sig-name'),      w: PW/2 },
    { label: 'CUSTOMER PRINT NAME',  val: fv('h-cust-sig-name'), w: PW/2 },
  ], 12, 8, 4);
  gap(4);
  dataRow([
    { label: 'INSPECTOR DATE', val: fv('h-sig-date'),      w: PW/2 },
    { label: 'CUSTOMER DATE',  val: fv('h-cust-sig-date'), w: PW/2 },
  ], 12, 8, 4);

  // ── Footer on every page ──
  pdfDoc.getPages().forEach(pg => {
    const footerTxt = 'Fire Life Protection Systems  |  firelifeprotection.com';
    const ftW = rFont.widthOfTextAtSize(footerTxt, 7.5);
    pg.drawText(footerTxt, { x: W/2 - ftW/2, y: 10, size: 7.5, font: rFont, color: rgb(0.47, 0.47, 0.47) });
  });

  return await pdfDoc.save();
}
