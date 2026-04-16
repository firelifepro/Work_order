// SPRINKLER PDF
// ─────────────────────────────────────────────────────────────────────────────
async function buildExtinguisherPDFBytes() {
  if (!window.PDFLib) throw new Error('PDF library not loaded. Please refresh.');
  const data = collectAllData();
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const form   = pdfDoc.getForm();
  const hFont  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const rFont  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const W = 612, PH = 792, ML = 36, PW = 540, MT = 36, MB = 36;
  let page, curY, _fid = 0;
  const fid = () => 'ext_' + (++_fid);

  const FIRE_RED = rgb(0.72, 0.08, 0.08);
  const navy  = rgb(0.13, 0.21, 0.42);
  const sky   = rgb(0.71, 0.80, 0.93);
  const gold  = rgb(1.0,  1.0,  0.75);
  const lgray = rgb(0.94, 0.94, 0.94);
  const white = rgb(1, 1, 1);
  const blk   = rgb(0, 0, 0);

  const addPage = () => { page = pdfDoc.addPage([W, PH]); curY = MT; };
  const ry = (h) => PH - curY - h;
  const ty = (h, a = 3) => PH - curY - h + a;
  const checkPage = (needed) => { if (curY + needed > PH - MB) addPage(); };

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

  const secHdr = (title) => {
    checkPage(18);
    page.drawRectangle({ x: ML, y: ry(17), width: PW, height: 17, color: navy });
    page.drawText(title, { x: ML+4, y: ty(17,5), size: 9, font: hFont, color: white });
    curY += 18;
  };
  const mkField = (val, x, fieldY, w, h) => {
    page.drawRectangle({ x, y: fieldY, width: w, height: h, color: gold, borderColor: sky, borderWidth: 0.5 });
    const f = form.createTextField(fid());
    f.setText(String(val || ''));
    f.addToPage(page, { x: x+1, y: fieldY+1, width: w-2, height: h-2, font: rFont });
    f.setFontSize(8);
  };
  const dataRow = (cols, fh = 12, lh = 8, gp = 3) => {
    checkPage(lh + fh + gp);
    let x = ML;
    cols.forEach(c => {
      page.drawText((c.label||'')+':', { x: x+2, y: ty(lh, lh-3), size: 6, font: hFont, color: navy });
      mkField(c.val, x, ry(lh+fh), c.w, fh);
      x += c.w;
    });
    curY += lh + fh + gp;
  };
  const gap = (h) => { curY += h; };

  const dv = (id) => document.getElementById(id)?.value?.trim() || '';
  const fd = data.fieldData || {};

  // ── PAGE 1: COVER ────────────────────────────────────────────────────────────
  addPage();

  // Red title banner
  const titleH = 22;
  const titleText = 'PORTABLE FIRE EXTINGUISHER INSPECTION REPORT';
  page.drawRectangle({ x: 0, y: PH - titleH, width: W, height: titleH, color: FIRE_RED });
  page.drawText(titleText, {
    x: W/2 - hFont.widthOfTextAtSize(titleText, 13)/2,
    y: PH - titleH + 5, size: 13, font: hFont, color: white
  });
  curY = titleH + 6;

  // Logo + company block
  const logoAreaH = 88;
  const logoX = ML, logoW = 90;
  const infoX = ML + logoW + 6, infoW = 160;
  const rtX   = infoX + infoW + 6, rtW = PW - logoW - infoW - 18;

  try {
    const svgText = await fetch('logo.svg').then(r => r.text());
    const sizedSvg = svgText.replace('<svg ', '<svg width="400" height="600" ');
    const svgBlob = new Blob([sizedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    await new Promise((resolve) => {
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
    { text: 'Fire Life Protection System, Inc.', bold: true,  sz: 7.5 },
    { text: '8201 Shaffer Parkway Suite B',       bold: false, sz: 7   },
    { text: 'Littleton, CO 80127',                bold: false, sz: 7   },
    { text: 'Cellular: (303) 726-8847',           bold: false, sz: 7   },
    { text: 'Office: (720) 974-1570',             bold: false, sz: 7   },
    { text: 'Alan.antonio@firelifeprotection',    bold: false, sz: 6.5 },
    { text: 'systems.com',                        bold: false, sz: 6.5 },
  ];
  let compY = ry(logoAreaH) + logoAreaH - 10;
  compLines.forEach(cl => {
    page.drawText(cl.text, { x: infoX+4, y: compY, size: cl.sz, font: cl.bold ? hFont : rFont, color: blk });
    compY -= cl.sz + 1.5;
  });

  // Report type selector boxes
  const rtBoxH = 15, rtBW = rtW / 3;
  const rtCur = (fd['report-type'] || '').toUpperCase();
  ['ANNUAL','SEMI-ANNUAL','QUARTERLY'].forEach((t, i) => {
    const sel = rtCur === t || (t === 'SEMI-ANNUAL' && rtCur.includes('SEMI'));
    const bx = rtX + i * rtBW;
    page.drawRectangle({ x: bx, y: ry(logoAreaH)+logoAreaH-rtBoxH, width: rtBW-1, height: rtBoxH, color: sel ? rgb(1,0.85,0) : white, borderColor: sky, borderWidth: 0.5 });
    page.drawText(t, { x: bx+3, y: ry(logoAreaH)+logoAreaH-rtBoxH+5, size: 6, font: hFont, color: sel ? rgb(0.4,0.25,0) : navy });
  });
  // Job info fields
  const jFields = [
    ['JOB NUMBER',        fd['job-num'] || ''],
    ['PO NUMBER (IF ANY)', ''],
    ['DATE PERFORMED',    dv('insp-date') || data.inspection?.date || ''],
    ['INSPECTOR',         dv('inspector-name') || data.inspection?.inspectorName || ''],
  ];
  let jY = ry(logoAreaH) + logoAreaH - rtBoxH - 3;
  jFields.forEach(([lbl, val]) => {
    jY -= 7;
    page.drawText(lbl, { x: rtX+2, y: jY, size: 5.5, font: hFont, color: navy });
    jY -= 10;
    page.drawRectangle({ x: rtX, y: jY, width: rtW, height: 10, color: gold, borderColor: sky, borderWidth: 0.3 });
    const jf = form.createTextField(fid());
    jf.setText(val); jf.addToPage(page, { x: rtX+1, y: jY+1, width: rtW-2, height: 8, font: rFont }); jf.setFontSize(7);
    jY -= 2;
  });
  curY += logoAreaH + 4;

  // Property fields
  dataRow([{ label: 'BUILDING/PROPERTY NAME', val: data.property?.name || '', w: PW }], 12, 8, 2);
  dataRow([
    { label: 'STREET, CITY, STATE, ZIP CODE', val: (data.property?.address || '') + (data.property?.cityStateZip ? ', ' + data.property.cityStateZip : ''), w: PW * 0.7 },
    { label: 'JURISDICTION', val: fd['jurisdiction'] || '', w: PW * 0.3 }
  ], 12, 8, 2);
  gap(4);

  // NFPA 10 compliance block
  secHdr('NFPA 10 COMPLIANCE REFERENCES AND PROCEDURE');
  const nfpaLines = [
    { text: 'ALL PORTABLE FIRE EXTINGUISHER UNITS ARE REQUIRED TO BE THOROUGHLY INSPECTED EACH YEAR BY AN APPROVED SERVICING COMPANY IN ACCORDANCE WITH', bold: false },
    { text: 'THE FOLLOWING NFPA CHAPTER REFERENCES:  NFPA 10 - 2010;  7.1.2, 7.2.2, 7.2.4, and 7.3.1', bold: false },
    { text: '', bold: false },
    { text: 'FREQUENCY:  FIRE EXTINGUISHERS SHALL BE SUBJECTED TO MAINTENANCE AT INTERVALS OF NOT MORE THAN ONE YEAR, AT THE TIME OF HYDROSTATIC TEST,', bold: true },
    { text: 'OR WHEN SPECIFICALLY INDICATED BY AN INSPECTION.', bold: true },
    { text: '', bold: false },
    { text: 'INSPECTION PROCEDURE:', bold: true },
    { text: '  1.  Date of last service', bold: false },
    { text: '  2.  Unit located in designated place', bold: false },
    { text: '  3.  No obstruction of access or visibility', bold: false },
    { text: '  4.  Pressure gauge reading is in proper range', bold: false },
    { text: '  5.  Fullness of unit (hefted or weighed)', bold: false },
    { text: '  6.  Condition of mechanical parts, including safety pin and pull tab seal', bold: false },
    { text: '  7.  Examination of physical condition and label', bold: false },
    { text: '  8.  All portable fire extinguishers shall be hydrostatically tested at intervals not exceeding those specified in NFPA 10, Table 5.2', bold: false },
    { text: '  9.  The inspection tag shall be filled out and attached to unit', bold: false },
    { text: '  10. Inspect seals and tamper indicators', bold: false },
    { text: '  11. Check for obvious physical damage, corrosion, leakage, or clogged nozzle', bold: false },
  ];
  const nfpaLH = 7.5;
  const nfpaBlockH = nfpaLines.length * nfpaLH + 8;
  checkPage(nfpaBlockH);
  page.drawRectangle({ x: ML, y: ry(nfpaBlockH), width: PW, height: nfpaBlockH, color: lgray, borderColor: sky, borderWidth: 0.3 });
  let nfpaY = ry(nfpaBlockH) + nfpaBlockH - 9;
  nfpaLines.forEach(ln => {
    if (ln.text) page.drawText(ln.text, { x: ML+5, y: nfpaY, size: 6, font: ln.bold ? hFont : rFont, color: blk });
    nfpaY -= nfpaLH;
  });
  curY += nfpaBlockH + 2;

  // Overall status bar (page 1)
  {
    const stH = 18;
    const stVal = (data.overallStatus || '').toUpperCase();
    const stColor = stVal === 'COMPLIANT' ? rgb(0.06, 0.50, 0.22) :
                    stVal === 'DEFICIENT' ? rgb(0.76, 0.10, 0.10) :
                    stVal === 'IMPAIRED'  ? rgb(0.75, 0.38, 0.00) :
                                            rgb(0.38, 0.44, 0.54);
    checkPage(stH + 6);
    page.drawRectangle({ x: ML, y: ry(stH), width: PW, height: stH, color: stColor });
    page.drawText('OVERALL SYSTEM STATUS', { x: ML + 8, y: ty(stH, 6), size: 6.5, font: hFont, color: white });
    page.drawText(stVal || 'PENDING', { x: ML + 130, y: ty(stH, 6), size: 9.5, font: hFont, color: white });
    curY += stH + 6;
  }

  // ── PAGE 2: EXTINGUISHER INVENTORY ───────────────────────────────────────────
  addPage();
  secHdr('EXTINGUISHER UNIT INVENTORY');

  const extCols = [
    { label: '#',         w: 20  },
    { label: 'FLR',       w: 22  },
    { label: 'LOCATION',  w: 85  },
    { label: 'MOUNT',     w: 40  },
    { label: 'CABINET',   w: 48  },
    { label: 'MFG YR',    w: 38  },
    { label: 'SIZE',      w: 44  },
    { label: 'TYPE',      w: 54  },
    { label: 'PASS/FAIL', w: 40  },
    { label: 'HYDRO DUE', w: 40  },
    { label: 'RECHARGE',  w: 36  },
    { label: 'NEW UNIT',  w: 36  },
    { label: 'NOTE',      w: 37  },
  ];

  const drawExtHdr = () => {
    checkPage(13);
    let x = ML;
    extCols.forEach(col => {
      page.drawRectangle({ x, y: ry(13), width: col.w, height: 13, color: navy });
      page.drawText(wrap(col.label, 5, col.w-3)[0]||'', { x: x+2, y: ty(13,4), size: 5, font: hFont, color: white });
      x += col.w;
    });
    curY += 14;
  };
  drawExtHdr();

  const drawExtRow = (ext) => {
    const cellH = 14;
    if (curY + cellH > PH - MB) { addPage(); drawExtHdr(); }
    const pf = (ext.pf || ext.overall || '').toUpperCase();
    const cabMissing = [ext.cabM === 'Y' ? 'Mallet' : '', ext.cabG === 'Y' ? 'Glass' : '', ext.cabS === 'Y' ? 'Sign' : ''].filter(Boolean).join(', ');
    const cells = [
      String(ext.rowNum || ''),
      ext.flr || '',
      ext.location || '',
      ext.mount || '',
      cabMissing,
      ext.mfgYear || ext.mfrDate || '',
      ext.size || '',
      ext.type || '',
      pf,
      ext.hydroDue || '',
      ext.recharge === 'Y' ? 'Y' : 'N',
      ext.newUnit === 'Y' ? 'Y' : 'N',
      ext.noteTxt || '',
    ];
    let x = ML;
    extCols.forEach((col, i) => {
      const isStatus = i === 8;
      const bgColor = isStatus && pf === 'FAIL' ? rgb(0.76, 0.10, 0.10)
                    : isStatus && pf === 'PASS' ? rgb(0.06, 0.50, 0.22)
                    : gold;
      const txtColor = (isStatus && (pf === 'FAIL' || pf === 'PASS')) ? white : blk;
      page.drawRectangle({ x, y: ry(cellH), width: col.w, height: cellH, color: bgColor, borderColor: sky, borderWidth: 0.3 });
      if (isStatus && pf) {
        const tw = hFont.widthOfTextAtSize(pf, 6);
        page.drawText(pf, { x: x + col.w/2 - tw/2, y: ty(cellH, 4), size: 6, font: hFont, color: txtColor });
      } else {
        const f = form.createTextField(fid());
        f.setText(cells[i]);
        f.addToPage(page, { x: x+1, y: ry(cellH)+1, width: col.w-2, height: cellH-2, font: rFont });
        f.setFontSize(5.5);
      }
      x += col.w;
    });
    curY += cellH + 1;
  };

  if (data.extinguishers.length > 0) {
    data.extinguishers.forEach(drawExtRow);
  }
  // Pad to at least 3 rows
  const emptyNeeded = Math.max(0, 3 - data.extinguishers.length);
  for (let i = 0; i < emptyNeeded; i++) {
    drawExtRow({ rowNum: data.extinguishers.length + i + 1 });
  }
  gap(4);

  // ── UNIT STATS (Total / Pass / Fail) ─────────────────────────────────────────
  {
    const total = data.extinguishers.length;
    const pass  = data.extinguishers.filter(e => (e.pf||'').toUpperCase() === 'PASS').length;
    const fail  = data.extinguishers.filter(e => (e.pf||'').toUpperCase() === 'FAIL').length;
    const statH = 18, statW = PW / 3;
    checkPage(statH + 4);
    const statDefs = [
      { label: 'TOTAL UNITS', val: String(total), color: navy },
      { label: 'PASS',        val: String(pass),  color: rgb(0.06, 0.50, 0.22) },
      { label: 'FAIL',        val: String(fail),  color: fail > 0 ? rgb(0.76, 0.10, 0.10) : rgb(0.38, 0.44, 0.54) },
    ];
    statDefs.forEach((s, si) => {
      const sx = ML + si * statW;
      page.drawRectangle({ x: sx, y: ry(statH), width: statW, height: statH, color: s.color });
      page.drawText(s.label, { x: sx + 6, y: ty(statH, 11), size: 6.5, font: hFont, color: white });
      page.drawText(s.val,   { x: sx + 6, y: ty(statH, 3),  size: 9,   font: hFont, color: white });
    });
    curY += statH + 2;
  }
  gap(6);

  // ── SERVICES DUE NOW SUMMARY ──────────────────────────────────────────────────
  if (data.extSvcTable && data.extSvcTable.some(r => r.yr6 || r.hydro || r.recharge || r.newunit || r.notes)) {
    addPage();
    secHdr('SERVICES DUE NOW SUMMARY');
    gap(4);

    // Services due table header
    const svcCols = [
      { label: 'EXTINGUISHER TYPE', w: 130 },
      { label: '6-YEAR MAINT',      w: 70  },
      { label: 'HYDROSTATIC',       w: 70  },
      { label: 'RECHARGE',          w: 70  },
      { label: 'NEW UNIT',          w: 70  },
      { label: 'NOTES',             w: 130 },
    ];
    checkPage(13);
    let sx = ML;
    svcCols.forEach(col => {
      page.drawRectangle({ x: sx, y: ry(13), width: col.w, height: 13, color: navy });
      page.drawText(col.label, { x: sx+2, y: ty(13,4), size: 5.5, font: hFont, color: white });
      sx += col.w;
    });
    curY += 14;
    (data.extSvcTable || []).forEach(row => {
      const hasData = row.yr6 || row.hydro || row.recharge || row.newunit || row.notes;
      if (!hasData) return;
      const rowH = 13;
      checkPage(rowH + 1);
      const vals = [row.type, row.yr6||'', row.hydro||'', row.recharge||'', row.newunit||'', row.notes||''];
      let rx = ML;
      svcCols.forEach((col, ci) => {
        page.drawRectangle({ x: rx, y: ry(rowH), width: col.w, height: rowH, color: gold, borderColor: sky, borderWidth: 0.3 });
        const f = form.createTextField(fid());
        f.setText(vals[ci]); f.addToPage(page, { x: rx+1, y: ry(rowH)+1, width: col.w-2, height: rowH-2, font: rFont }); f.setFontSize(6);
        rx += col.w;
      });
      curY += rowH + 1;
    });
    gap(8);

    // Total services due
    if (data.extTotalSvcDue) {
      checkPage(20);
      page.drawRectangle({ x: ML, y: ry(16), width: PW, height: 16, color: lgray, borderColor: sky, borderWidth: 0.3 });
      page.drawText('Total Services Due:', { x: ML+4, y: ty(16, 5), size: 8, font: hFont, color: navy });
      page.drawText(String(data.extTotalSvcDue), { x: ML+160, y: ty(16, 5), size: 10, font: hFont, color: navy });
      curY += 18;
      gap(4);
    }

    // QA questions
    if (data.extQA && data.extQA.some(q => q.ans)) {
      secHdr('INSPECTION VERIFICATION QUESTIONS');
      const qaLW = 460, qaAW = 80;
      checkPage(13);
      page.drawRectangle({ x: ML,      y: ry(13), width: qaLW, height: 13, color: navy });
      page.drawText('QUESTION', { x: ML+2, y: ty(13,4), size: 6, font: hFont, color: white });
      page.drawRectangle({ x: ML+qaLW, y: ry(13), width: qaAW, height: 13, color: navy });
      page.drawText('ANSWER', { x: ML+qaLW+4, y: ty(13,4), size: 6, font: hFont, color: white });
      curY += 14;
      (data.extQA || []).forEach(qa => {
        const rowH = qa.note ? 22 : 13;
        checkPage(rowH + 1);
        page.drawRectangle({ x: ML, y: ry(rowH), width: qaLW, height: rowH, color: gold, borderColor: sky, borderWidth: 0.3 });
        wrap(qa.q, 6, qaLW - 4).forEach((ln, li) => {
          page.drawText(ln, { x: ML+2, y: ry(rowH) + rowH - 6 - li*7, size: 6, font: rFont, color: blk });
        });
        page.drawRectangle({ x: ML+qaLW, y: ry(rowH), width: qaAW, height: rowH, color: gold, borderColor: sky, borderWidth: 0.3 });
        const af = form.createTextField(fid());
        const ansText = (qa.ans || '') + (qa.note ? ' – ' + qa.note : '');
        af.setText(ansText); af.addToPage(page, { x: ML+qaLW+1, y: ry(rowH)+1, width: qaAW-2, height: rowH-2, font: rFont }); af.setFontSize(6);
        curY += rowH + 1;
      });
      gap(8);
    }
  }

  // ── DEFICIENCY LIST ──────────────────────────────────────────────────────────
  secHdr('DEFICIENCY LIST');
  const deficTrs = [...(document.getElementById('generic-defic-tbody')?.querySelectorAll('tr') || [])];
  if (deficTrs.length === 0) {
    checkPage(14);
    page.drawRectangle({ x: ML, y: ry(13), width: PW, height: 13, color: gold, borderColor: sky, borderWidth: 0.3 });
    page.drawText('No deficiencies noted.', { x: ML+4, y: ty(13,4), size: 8, font: rFont, color: blk });
    curY += 14;
  } else {
    deficTrs.forEach((tr, i) => {
      const desc = tr.querySelector('td:nth-child(2) input')?.value?.trim() || '';
      checkPage(14);
      page.drawRectangle({ x: ML,    y: ry(13), width: 24,     height: 13, color: gold, borderColor: sky, borderWidth: 0.3 });
      page.drawText(String(i+1), { x: ML+8, y: ty(13,4), size: 7, font: hFont, color: blk });
      page.drawRectangle({ x: ML+24, y: ry(13), width: PW-24,  height: 13, color: gold, borderColor: sky, borderWidth: 0.3 });
      const nf = form.createTextField(fid());
      nf.setText(desc); nf.addToPage(page, { x: ML+25, y: ry(13)+1, width: PW-26, height: 11, font: rFont }); nf.setFontSize(7);
      curY += 14;
    });
  }
  gap(6);

  // ── GENERAL NOTES ─────────────────────────────────────────────────────────────
  secHdr('GENERAL NOTES & RECOMMENDATIONS');
  const extNotesVal = dv('ext-notes');
  // Collect unit notes
  const unitNotes = (data.extinguishers || []).filter(e => e.noteTxt).map(e => 'Unit #' + e.rowNum + (e.location ? ' – ' + e.location : '') + ': ' + e.noteTxt);
  const allNotes = [];
  if (extNotesVal) allNotes.push(extNotesVal);
  unitNotes.forEach(n => allNotes.push(n));
  const noteRowCount = Math.max(allNotes.length, 3);
  for (let i = 0; i < noteRowCount; i++) {
    checkPage(14);
    page.drawRectangle({ x: ML,    y: ry(13), width: 24,     height: 13, color: gold, borderColor: sky, borderWidth: 0.3 });
    page.drawText(String(i+1), { x: ML+8, y: ty(13,4), size: 7, font: hFont, color: blk });
    page.drawRectangle({ x: ML+24, y: ry(13), width: PW-24,  height: 13, color: gold, borderColor: sky, borderWidth: 0.3 });
    const nf = form.createTextField(fid());
    nf.setText(allNotes[i] || '');
    nf.addToPage(page, { x: ML+25, y: ry(13)+1, width: PW-26, height: 11, font: rFont }); nf.setFontSize(7);
    curY += 14;
  }
  gap(6);

  // ── OVERALL STATUS & SIGNATURES ───────────────────────────────────────────────
  checkPage(120);
  gap(10);
  secHdr('OVERALL STATUS & SIGNATURES');
  dataRow([{ label: 'OVERALL INSPECTION STATUS', val: data.overallStatus || '', w: PW }]);
  gap(6);

  const sigH = 40, sigW = PW / 2 - 6;
  page.drawText('INSPECTOR / OWNER SIGNATURE:', { x: ML, y: ty(sigH) + sigH + 2, size: 7, font: hFont, color: navy });
  page.drawRectangle({ x: ML, y: ry(sigH), width: sigW, height: sigH, color: gold, borderColor: sky, borderWidth: 0.5 });
  if (sigHasData) {
    try {
      const sc = document.getElementById('sig-canvas');
      const b64 = sc.toDataURL('image/png').split(',')[1];
      const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
      const sImg = await pdfDoc.embedPng(ab);
      const sDims = sImg.scaleToFit(sigW - 8, sigH - 8);
      page.drawImage(sImg, { x: ML + 4, y: ry(sigH) + 4, width: sDims.width, height: sDims.height });
    } catch(_) {}
  } else {
    const sf = form.createTextField(fid());
    sf.setText(''); sf.addToPage(page, { x: ML+2, y: ry(sigH)+2, width: sigW-4, height: sigH-4, font: rFont }); sf.setFontSize(9);
  }
  page.drawText('CLIENT SIGNATURE:', { x: ML+PW/2+10, y: ty(sigH) + sigH + 2, size: 7, font: hFont, color: navy });
  page.drawRectangle({ x: ML+PW/2+8, y: ry(sigH), width: sigW, height: sigH, color: gold, borderColor: sky, borderWidth: 0.5 });
  if (custSigHasData) {
    try {
      const cc = document.getElementById('cust-sig-canvas');
      const b64 = cc.toDataURL('image/png').split(',')[1];
      const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
      const cImg = await pdfDoc.embedPng(ab);
      const cDims = cImg.scaleToFit(sigW - 8, sigH - 8);
      page.drawImage(cImg, { x: ML+PW/2+12, y: ry(sigH) + 4, width: cDims.width, height: cDims.height });
    } catch(_) {}
  } else {
    const cf = form.createTextField(fid());
    cf.setText(''); cf.addToPage(page, { x: ML+PW/2+10, y: ry(sigH)+2, width: sigW-4, height: sigH-4, font: rFont }); cf.setFontSize(9);
  }
  curY += sigH + 4;
  dataRow([
    { label: 'INSPECTOR DATE',      val: data.signature?.date || data.inspection?.date || '', w: PW/2 },
    { label: 'CLIENT DATE',         val: fd['cust-sig-date'] || '', w: PW/2 },
  ]);
  dataRow([
    { label: 'INSPECTOR PRINT NAME', val: fd['sig-name'] || data.inspection?.inspectorName || '', w: PW/2 },
    { label: 'CLIENT PRINT NAME',    val: fd['cust-sig-name'] || '', w: PW/2 },
  ]);

  // ── PHOTOS ───────────────────────────────────────────────────────────────────
  if (inspectionPhotos.length > 0) {
    addPage();
    secHdr('INSPECTION PHOTOS');
    const photoW = Math.floor((PW - 10) / 2);
    const photoH = 140;
    let col = 0;
    for (let i = 0; i < inspectionPhotos.length; i++) {
      const photo = inspectionPhotos[i];
      checkPage(photoH + 30);
      const px = ML + col * (photoW + 10);
      try {
        const b64 = photo.dataUrl.split(',')[1];
        const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
        const img = photo.dataUrl.startsWith('data:image/png')
          ? await pdfDoc.embedPng(ab) : await pdfDoc.embedJpg(ab);
        const dims = img.scaleToFit(photoW, photoH);
        page.drawImage(img, { x: px, y: ry(photoH) + (photoH - dims.height), width: dims.width, height: dims.height });
      } catch(_) {
        page.drawRectangle({ x: px, y: ry(photoH), width: photoW, height: photoH, color: lgray });
      }
      page.drawRectangle({ x: px+2, y: ry(photoH)+photoH-14, width: 40, height: 12, color: rgb(0,0,0) });
      page.drawText('Photo ' + (i+1), { x: px+4, y: ry(photoH)+photoH-7, size: 7, font: hFont, color: white });
      if (photo.note) {
        wrap(photo.note, 7, photoW).forEach((l, li) => {
          page.drawText(l, { x: px, y: ry(photoH) - 10 - li * 9, size: 7, font: rFont, color: blk });
        });
      }
      col++;
      if (col >= 2) { col = 0; curY += photoH + 22; }
    }
    if (col > 0) curY += photoH + 22;
  }

  return await pdfDoc.save();
}

async function buildSprinklerPDFBytes() {
  if (!window.PDFLib) throw new Error('PDF library not loaded. Please refresh.');
  const data = collectAllData();
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const form   = pdfDoc.getForm();
  const hFont  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const rFont  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const W = 612, PH = 792, ML = 36, PW = 540, MT = 36, MB = 36;
  let page, curY, _fid = 0;
  const fid = () => 'sp_' + (++_fid);

  const FIRE_RED = rgb(0.72, 0.08, 0.08);
  const navy  = rgb(0.13, 0.21, 0.42);
  const sky   = rgb(0.71, 0.80, 0.93);
  const gold  = rgb(1.0,  1.0,  0.75);
  const lgray = rgb(0.94, 0.94, 0.94);
  const white = rgb(1, 1, 1);
  const blk   = rgb(0, 0, 0);

  const addPage = () => { page = pdfDoc.addPage([W, PH]); curY = MT; };
  const ry = (h) => PH - curY - h;
  const ty = (h, a = 3) => PH - curY - h + a;
  const checkPage = (needed) => { if (curY + needed > PH - MB) addPage(); };

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

  const secHdr = (title) => {
    checkPage(18);
    page.drawRectangle({ x: ML, y: ry(17), width: PW, height: 17, color: navy });
    page.drawText(title, { x: ML+4, y: ty(17,5), size: 9, font: hFont, color: white });
    curY += 18;
  };
  const subHdr = (title) => {
    checkPage(14);
    page.drawRectangle({ x: ML, y: ry(13), width: PW, height: 13, color: sky });
    page.drawText(title, { x: ML+4, y: ty(13,4), size: 7.5, font: hFont, color: navy });
    curY += 14;
  };
  const mkField = (val, x, fieldY, w, h, multiline) => {
    page.drawRectangle({ x, y: fieldY, width: w, height: h, color: gold, borderColor: sky, borderWidth: 0.5 });
    const f = form.createTextField(fid());
    f.setText(String(val || ''));
    if (multiline) f.enableMultiline();
    f.addToPage(page, { x: x+1, y: fieldY+1, width: w-2, height: h-2, font: rFont });
    f.setFontSize(8);
  };
  const dataRow = (cols, fh = 12, lh = 8, gap = 3) => {
    checkPage(lh + fh + gap);
    let x = ML;
    cols.forEach(c => {
      page.drawText((c.label||'')+':', { x: x+2, y: ty(lh, lh-3), size: 6, font: hFont, color: navy });
      mkField(c.val, x, ry(lh+fh), c.w, fh, false);
      x += c.w;
    });
    curY += lh + fh + gap;
  };
  const gap = (h) => { curY += h; };
  const table = (hdrs, rows, cellH) => {
    const drawHdr = () => {
      checkPage(13);
      let x = ML;
      hdrs.forEach(h => {
        page.drawRectangle({ x, y: ry(13), width: h.w, height: 13, color: navy });
        page.drawText(wrap(h.label, 6, h.w-3)[0]||'', { x: x+2, y: ty(13,4), size: 6, font: hFont, color: white });
        x += h.w;
      });
      curY += 14;
    };
    drawHdr();
    rows.forEach(row => {
      if (curY + cellH > PH - MB) { addPage(); drawHdr(); }
      let x = ML;
      hdrs.forEach((h, i) => {
        page.drawRectangle({ x, y: ry(cellH), width: h.w, height: cellH, color: gold, borderColor: sky, borderWidth: 0.3 });
        const f = form.createTextField(fid());
        f.setText(String(row[i]||''));
        f.addToPage(page, { x: x+1, y: ry(cellH)+1, width: h.w-2, height: cellH-2, font: rFont });
        f.setFontSize(7);
        x += h.w;
      });
      curY += cellH + 1;
    });
  };

  const dv = (id) => document.getElementById(id)?.value?.trim() || '';
  const fd = data.fieldData || {};
  const spPF = (rowId) => {
    const val = document.getElementById('row-' + rowId)?.dataset?.val || '';
    return val;
  };

  // Inspection row helper for PDF (Y/N/NA columns)
  const LW = 340, BW = 32, NW = PW - LW - BW*3;
  const inspHdr = () => {
    checkPage(13);
    page.drawRectangle({ x: ML,         y: ry(13), width: LW,  height: 13, color: navy });
    page.drawText('QUESTION', { x: ML+2, y: ty(13,4), size: 6, font: hFont, color: white });
    page.drawRectangle({ x: ML+LW,      y: ry(13), width: BW,  height: 13, color: navy });
    page.drawText('Y', { x: ML+LW+BW/2-3, y: ty(13,4), size: 7, font: hFont, color: white });
    page.drawRectangle({ x: ML+LW+BW,   y: ry(13), width: BW,  height: 13, color: navy });
    page.drawText('N', { x: ML+LW+BW*1.5-3, y: ty(13,4), size: 7, font: hFont, color: white });
    page.drawRectangle({ x: ML+LW+BW*2, y: ry(13), width: BW,  height: 13, color: navy });
    page.drawText('N/A', { x: ML+LW+BW*2.5-6, y: ty(13,4), size: 6, font: hFont, color: white });
    page.drawRectangle({ x: ML+LW+BW*3, y: ry(13), width: NW,  height: 13, color: navy });
    page.drawText('NOTES', { x: ML+LW+BW*3+2, y: ty(13,4), size: 6, font: hFont, color: white });
    curY += 14;
  };
  const inspRow = (label, rowId) => {
    const val = spPF(rowId);
    const yVal  = val === 'PASS' ? 'X' : '';
    const nVal  = val === 'FAIL' ? 'X' : '';
    const naVal = val === 'N/A'  ? 'X' : '';
    const noteVal = document.getElementById('sp-defic-note-' + rowId)?.value?.trim() || '';
    const h = 13;
    checkPage(h + 1);
    page.drawRectangle({ x: ML, y: ry(h), width: LW, height: h, color: gold, borderColor: sky, borderWidth: 0.3 });
    wrap(label, 6.5, LW - 4).forEach((ln, li) => {
      page.drawText(ln, { x: ML+2, y: ry(h) + h - 6 - li*7, size: 6.5, font: rFont, color: blk });
    });
    page.drawRectangle({ x: ML+LW,      y: ry(h), width: BW, height: h, color: gold, borderColor: sky, borderWidth: 0.3 });
    const yf = form.createTextField(fid());
    yf.setText(yVal); yf.addToPage(page, { x: ML+LW+1,      y: ry(h)+1, width: BW-2, height: h-2, font: rFont }); yf.setFontSize(8);
    page.drawRectangle({ x: ML+LW+BW,   y: ry(h), width: BW, height: h, color: gold, borderColor: sky, borderWidth: 0.3 });
    const nf2 = form.createTextField(fid());
    nf2.setText(nVal); nf2.addToPage(page, { x: ML+LW+BW+1,  y: ry(h)+1, width: BW-2, height: h-2, font: rFont }); nf2.setFontSize(8);
    page.drawRectangle({ x: ML+LW+BW*2, y: ry(h), width: BW, height: h, color: gold, borderColor: sky, borderWidth: 0.3 });
    const naf = form.createTextField(fid());
    naf.setText(naVal); naf.addToPage(page, { x: ML+LW+BW*2+1, y: ry(h)+1, width: BW-2, height: h-2, font: rFont }); naf.setFontSize(8);
    page.drawRectangle({ x: ML+LW+BW*3, y: ry(h), width: NW, height: h, color: gold, borderColor: sky, borderWidth: 0.3 });
    const nf = form.createTextField(fid());
    nf.setText(noteVal); nf.addToPage(page, { x: ML+LW+BW*3+1, y: ry(h)+1, width: NW-2, height: h-2, font: rFont }); nf.setFontSize(6);
    curY += h + 1;
  };

  // ── PAGE 1: COVER ──────────────────────────────────────────────────────────
  addPage();

  // Red title banner
  const titleH = 22;
  page.drawRectangle({ x: 0, y: PH - titleH, width: W, height: titleH, color: FIRE_RED });
  page.drawText('FIRE SPRINKLER INSPECTION REPORT', {
    x: W/2 - hFont.widthOfTextAtSize('FIRE SPRINKLER INSPECTION REPORT', 14)/2,
    y: PH - titleH + 5, size: 14, font: hFont, color: white
  });
  curY = titleH + 6;

  // Logo + company block
  const logoAreaH = 88;
  const logoX = ML, logoW = 90;
  const infoX = ML + logoW + 6, infoW = 160;
  const rtX   = infoX + infoW + 6, rtW = PW - logoW - infoW - 18;

  // Logo embed
  try {
    const svgText = await fetch('logo.svg').then(r => r.text());
    const sizedSvg = svgText.replace('<svg ', '<svg width="400" height="600" ');
    const svgBlob = new Blob([sizedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    await new Promise((resolve, reject) => {
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
        const logoS = 70;
        const logoDims = logoImg.scaleToFit(logoS, logoS);
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
    { text: '8201 Shaffer Parkway Suite B', bold: false, sz: 7 },
    { text: 'Littleton, CO 80127', bold: false, sz: 7 },
    { text: 'Cellular: (303) 726-8847', bold: false, sz: 7 },
    { text: 'Office: (720) 974-1570', bold: false, sz: 7 },
    { text: 'Alan.antonio@firelifeprotection', bold: false, sz: 6.5 },
    { text: 'systems.com', bold: false, sz: 6.5 },
  ];
  let compY = ry(logoAreaH) + logoAreaH - 10;
  compLines.forEach(cl => { page.drawText(cl.text, { x: infoX+4, y: compY, size: cl.sz, font: cl.bold ? hFont : rFont, color: blk }); compY -= cl.sz + 1.5; });

  // Report type + job fields
  // Report type boxes (3 equal segments)
  const rtBoxH = 15;
  const rtBW = rtW / 3;
  const rtCur = (fd['sp-report-type'] || '').toUpperCase();
  ['ANNUAL','SEMI-ANNUAL','QUARTERLY'].forEach((t, i) => {
    const sel = rtCur === t || (t === 'SEMI-ANNUAL' && (rtCur === 'SEMI ANNUAL' || rtCur.includes('SEMI')));
    const bx = rtX + i * rtBW;
    page.drawRectangle({ x: bx, y: ry(logoAreaH)+logoAreaH-rtBoxH, width: rtBW-1, height: rtBoxH, color: sel ? rgb(1,0.85,0) : white, borderColor: sky, borderWidth: 0.5 });
    page.drawText(t, { x: bx+3, y: ry(logoAreaH)+logoAreaH-rtBoxH+5, size: 6, font: hFont, color: sel ? rgb(0.4,0.25,0) : navy });
  });
  // Job info fields (editable)
  const jFields = [
    ['JOB NUMBER', fd['sp-job-num'] || ''],
    ['PO NUMBER (IF ANY)', ''],
    ['DATE PERFORMED', fd['insp-date'] || data.inspection?.date || ''],
    ['INSPECTOR', fd['inspector-name'] || data.inspection?.inspectorName || ''],
  ];
  let jY = ry(logoAreaH) + logoAreaH - rtBoxH - 3;
  jFields.forEach(([lbl, val]) => {
    jY -= 7;
    page.drawText(lbl, { x: rtX+2, y: jY, size: 5.5, font: hFont, color: navy });
    jY -= 10;
    page.drawRectangle({ x: rtX, y: jY, width: rtW, height: 10, color: gold, borderColor: sky, borderWidth: 0.3 });
    const jf = form.createTextField(fid());
    jf.setText(val); jf.addToPage(page, { x: rtX+1, y: jY+1, width: rtW-2, height: 8, font: rFont }); jf.setFontSize(7);
    jY -= 2;
  });
  curY += logoAreaH + 4;

  // Property fields
  dataRow([
    { label: 'BUILDING/PROPERTY NAME', val: data.property?.name || '', w: PW }
  ], 12, 8, 2);
  dataRow([
    { label: 'STREET, CITY, STATE, ZIP CODE', val: (data.property?.address || '') + (data.property?.cityStateZip ? ', ' + data.property.cityStateZip : ''), w: PW * 0.7 },
    { label: 'JURISDICTION', val: fd['jurisdiction'] || '', w: PW * 0.3 }
  ], 12, 8, 2);
  gap(4);

  // NFPA References — two columns
  secHdr('NFPA REFERENCES AND PROCEDURE');
  const nfpaLeft = [
    'ANNUAL INSPECTIONS (PROPERTY SPECIFIC/IF APPLICABLE)',
    '',
    'WET SPRINKLER',
    'NFPA 25 CHAPTER 5.2.1 THRU 5.4.1.5',
    '',
    'DRY VALVE PARTIAL',
    'NFPA 25 CHAPTER 13.4.3.1.1 THRU 13.4.4.1.4',
    '',
    'ANTIFREEZE CHEMICAL',
    'NFPA 25 CHAPTER 5.3.3 THRU 5.3.3.4',
    '',
    'DELUGE VALVE',
    'NFPA 25 CHAPTER 13.4.5.2.2 THRU 13.4.5.2.8',
    '',
    'STANDPIPE ANNUAL/QUARTERLY',
    'NFPA 25 CHAPTER 5.2.1 THRU 5.4.1.5',
  ];
  const nfpaRight = [
    '3 & 5 YEAR INSPECTIONS (PROPERTY SPECIFIC/IF APPLICABLE)',
    '',
    'STANDPIPE HYDROSTATIC (5 YEAR)',
    'NFPA 25 CHAPTER 6.3.2.1 THRU 6.3.2.2.1',
    '',
    'FIRE DEPARTMENT CONNECTION HYDROSTATIC (5 YEAR)',
    'NFPA 25 CHAPTER 13.8.5 (FDC)',
    '',
    'PRESSURE REDUCING VALVE (5 YEAR)',
    'NFPA 25 CHAPTER 13.5 THRU 13.5.3',
    'NFPA 25 CHAPTER 13.4.5.2.2 THRU 13.4.5.2.8',
    '',
    'INTERNAL PIPING INSPECTION (5 YEAR)',
    'NFPA 25 CHAPTER 13.4.2.1',
  ];
  const colW = PW / 2 - 2;
  const nfpaStartY = curY;
  const nfpaLineH = 8;
  const maxLines = Math.max(nfpaLeft.length, nfpaRight.length);
  checkPage(maxLines * nfpaLineH + 4);
  page.drawRectangle({ x: ML,        y: ry(maxLines * nfpaLineH + 4), width: colW, height: maxLines * nfpaLineH + 4, color: lgray, borderColor: sky, borderWidth: 0.3 });
  page.drawRectangle({ x: ML+colW+4, y: ry(maxLines * nfpaLineH + 4), width: colW, height: maxLines * nfpaLineH + 4, color: lgray, borderColor: sky, borderWidth: 0.3 });
  nfpaLeft.forEach((ln, i) => {
    const bold = !ln.startsWith('NFPA') && ln !== '';
    page.drawText(ln, { x: ML+3, y: ry(maxLines * nfpaLineH + 4) + maxLines * nfpaLineH - i * nfpaLineH - 2, size: 6, font: bold ? hFont : rFont, color: blk });
  });
  nfpaRight.forEach((ln, i) => {
    const bold = !ln.startsWith('NFPA') && ln !== '';
    page.drawText(ln, { x: ML+colW+7, y: ry(maxLines * nfpaLineH + 4) + maxLines * nfpaLineH - i * nfpaLineH - 2, size: 6, font: bold ? hFont : rFont, color: blk });
  });
  curY += maxLines * nfpaLineH + 6;

  // ── OVERALL STATUS — shown on page 1 (also rendered again at end of report) ──
  {
    const stH = 18;
    const stVal = (data.overallStatus || '').toUpperCase();
    const stColor = stVal === 'COMPLIANT' ? rgb(0.06, 0.50, 0.22) :
                    stVal === 'DEFICIENT' ? rgb(0.76, 0.10, 0.10) :
                    stVal === 'IMPAIRED'  ? rgb(0.75, 0.38, 0.00) :
                                            rgb(0.38, 0.44, 0.54);
    checkPage(stH + 4);
    page.drawRectangle({ x: ML, y: ry(stH), width: PW, height: stH, color: stColor });
    page.drawText('OVERALL SYSTEM STATUS', { x: ML + 8, y: ty(stH, 6), size: 6.5, font: hFont, color: white });
    page.drawText(stVal || 'PENDING', { x: ML + 130, y: ty(stH, 6), size: 9.5, font: hFont, color: white });
    curY += stH + 4;
  }
  gap(4);

  // ── PAGE 2: SYSTEM OVERVIEW ─────────────────────────────────────────────────
  addPage();
  secHdr('SYSTEM CONFIGURATION');
  dataRow([
    { label: 'SYSTEM TYPE',          val: fd['sp-type']        || '', w: PW/3 },
    { label: 'MANUFACTURER / MAKE',  val: fd['sp-mfr']         || '', w: PW/3 },
    { label: 'YEAR INSTALLED',       val: fd['sp-year']        || '', w: PW/3 },
  ]);
  dataRow([
    { label: '# SPRINKLER HEADS',    val: fd['sp-heads']       || '', w: PW/3 },
    { label: 'COVERAGE AREA (SQ FT)',val: fd['sp-coverage']    || '', w: PW/3 },
    { label: 'HAZARD CLASSIFICATION',val: fd['sp-hazard']      || '', w: PW/3 },
  ]);
  dataRow([
    { label: 'WATER SUPPLY SOURCE',  val: fd['sp-water-src']   || '', w: PW/3 },
    { label: 'STATIC PRESSURE (PSI)',val: fd['sp-static-psi']  || '', w: PW/3 },
    { label: 'RESIDUAL PRESSURE (PSI)',val:fd['sp-residual-psi']|| '', w: PW/3 },
  ]);
  dataRow([
    { label: 'HEAD TYPES / MODELS',  val: fd['sp-head-types']  || '', w: PW/2 },
    { label: 'JOB NUMBER',           val: fd['sp-job-num']     || '', w: PW/2 },
  ]);
  gap(4);

  secHdr('EXISTING SPRINKLER SYSTEMS OVERVIEW');
  const ovRows = [
    ['Wet System(s) Present?',       fd['sp-ov-wet-yn']||'',   fd['sp-ov-wet-cnt']||'',   fd['sp-ov-wet-insp']||'',   fd['sp-ov-wet-loc']||''],
    ['Dry System(s) Present?',       fd['sp-ov-dry-yn']||'',   fd['sp-ov-dry-cnt']||'',   fd['sp-ov-dry-insp']||'',   fd['sp-ov-dry-loc']||''],
    ['Fire Pump(s) Present?',        fd['sp-ov-pump-yn']||'',  fd['sp-ov-pump-cnt']||'',  fd['sp-ov-pump-insp']||'',  fd['sp-ov-pump-loc']||''],
    ['Test Header(s) Present?',      fd['sp-ov-hdr-yn']||'',   fd['sp-ov-hdr-cnt']||'',   fd['sp-ov-hdr-insp']||'',   fd['sp-ov-hdr-loc']||''],
    ['FDC Present?',                 fd['sp-ov-fdc-yn']||'',   fd['sp-ov-fdc-cnt']||'',   fd['sp-ov-fdc-insp']||'',   fd['sp-ov-fdc-loc']||''],
    ['PRV Valve(s) Present?',        fd['sp-ov-prv-yn']||'',   fd['sp-ov-prv-cnt']||'',   fd['sp-ov-prv-insp']||'',   fd['sp-ov-prv-loc']||''],
    ['Antifreeze System(s) Present?',fd['sp-ov-af-yn']||'',    fd['sp-ov-af-cnt']||'',    fd['sp-ov-af-insp']||'',    fd['sp-ov-af-loc']||''],
    ['Standpipe(s) Present?',        fd['sp-ov-standp-yn']||'',fd['sp-ov-standp-cnt']||'',fd['sp-ov-standp-insp']||'',fd['sp-ov-standp-loc']||''],
    ['Deluge Valve(s) Present?',     fd['sp-ov-del-yn']||'',   fd['sp-ov-del-cnt']||'',   fd['sp-ov-del-insp']||'',   fd['sp-ov-del-loc']||''],
  ];
  table(
    [{label:'QUESTION',w:180},{label:'Y/N/NA',w:45},{label:'#',w:35},{label:'INSPECTING?',w:65},{label:'LOCATIONS/NOTES',w:PW-325}],
    ovRows, 14
  );
  gap(4);

  secHdr('3 & 5 YEAR — PREVIOUS INSPECTION YEAR (IF APPLICABLE)');
  const y35Rows = [
    ['Dry Valve (3 Year Full Trip)', fd['sp-35-dv-app']||'',    fd['sp-35-dv-last']||'',    fd['sp-35-dv-next']||'',    fd['sp-35-dv-insp']||'',    fd['sp-35-dv-loc']||''],
    ['Roof Top Flow (5 Year)',       fd['sp-35-rt-app']||'',    fd['sp-35-rt-last']||'',    fd['sp-35-rt-next']||'',    fd['sp-35-rt-insp']||'',    fd['sp-35-rt-loc']||''],
    ['FDC Hydrostatic (5 Year)',     fd['sp-35-fdc-app']||'',   fd['sp-35-fdc-last']||'',   fd['sp-35-fdc-next']||'',   fd['sp-35-fdc-insp']||'',   fd['sp-35-fdc-loc']||''],
    ['Internal Piping (5 Year)',     fd['sp-35-ip-app']||'',    fd['sp-35-ip-last']||'',    fd['sp-35-ip-next']||'',    fd['sp-35-ip-insp']||'',    fd['sp-35-ip-loc']||''],
    ['Standpipe (5 Year)',           fd['sp-35-standp-app']||'',fd['sp-35-standp-last']||'',fd['sp-35-standp-next']||'',fd['sp-35-standp-insp']||'',fd['sp-35-standp-loc']||''],
  ];
  table(
    [{label:'SERVICE',w:155},{label:'APPLICABLE?',w:65},{label:'LAST YEAR',w:70},{label:'NEXT YEAR DUE',w:75},{label:'INSPECTING?',w:65},{label:'LOCATION/NOTES',w:PW-430}],
    y35Rows, 14
  );

  // ── PAGE 3: PRE-INSPECTION + INSPECTION ITEMS ────────────────────────────────
  addPage();
  secHdr('PRE-INSPECTION GENERAL QUESTIONS');
  const preQs = [
    ['Is the building occupied?', spPF('sp-pre-occupied')],
    ['Has the occupancy classification and hazard or contents remained the same since last inspection?', spPF('sp-pre-occ-same')],
    ['All fire protection systems in service?', spPF('sp-pre-in-svc')],
    ['Has the system remained in service without modification since the last inspection?', spPF('sp-pre-no-mod')],
    ['Was the system free of actuation of devices or alarms since the last inspection?', spPF('sp-pre-no-alarm')],
  ];
  table(
    [{label:'QUESTION',w:340},{label:'Y',w:50},{label:'N',w:50},{label:'N/A',w:PW-440}],
    preQs.map(([q,v]) => [q, v==='PASS'?'X':'', v==='FAIL'?'X':'', v==='N/A'?'X':'']),
    13
  );
  gap(4);

  subHdr('FIRE DEPT CONNECTIONS');
  inspHdr();
  ['sp-fdc-visible','sp-fdc-couplings','sp-fdc-caps','sp-fdc-gaskets','sp-fdc-sign','sp-fdc-check','sp-fdc-drain'].forEach(id => {
    const el = document.getElementById('row-' + id);
    const lbl = el?.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id;
    inspRow(lbl, id);
  });
  gap(3);

  subHdr('VALVES / GAGES');
  inspHdr();
  ['sp-cv-supervised','sp-bfv-position','sp-bfv-sealed','sp-bfv-leaks','sp-bfv-test','sp-gauges-cond','sp-gauges-pressure','sp-prv-open','sp-prv-handles','sp-nameplate','sp-signage'].forEach(id => {
    const el = document.getElementById('row-' + id);
    const lbl = el?.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id;
    inspRow(lbl, id);
  });
  gap(3);

  subHdr('VISIBLE PIPE');
  inspHdr();
  ['sp-pipe-cond','sp-pipe-damage','sp-pipe-aligned','sp-hangers-cond','sp-pipe-heat'].forEach(id => {
    const el = document.getElementById('row-' + id);
    const lbl = el?.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id;
    inspRow(lbl, id);
  });
  gap(3);

  subHdr('SPRINKLER HEADS / COMPONENTS');
  inspHdr();
  ['sp-head-box','sp-head-wrench','sp-head-count-ok','sp-heads-corrosion','sp-heads-obstruction','sp-heads-paint','sp-heads-date','sp-heads-fast','sp-heads-standard','sp-dp-heads','sp-escutcheons'].forEach(id => {
    const el = document.getElementById('row-' + id);
    const lbl = el?.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id;
    inspRow(lbl, id);
  });
  gap(3);

  subHdr('WATERFLOW ALARM');
  inspHdr();
  ['sp-waterflow','sp-waterflow-cs','sp-wf-cv'].forEach(id => {
    const el = document.getElementById('row-' + id);
    const lbl = el?.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id;
    inspRow(lbl, id);
  });
  dataRow([
    { label: 'WATERFLOW RESPONSE TIME (SEC)', val: fd['sp-wf-time'] || '', w: PW },
  ]);
  gap(3);

  subHdr('MAIN DRAIN OBSERVATIONS');
  inspHdr();
  ['sp-drain-flow','sp-drain-comparable','sp-drain-flowswitch','sp-drain-obstruction'].forEach(id => {
    const el = document.getElementById('row-' + id);
    const lbl = el?.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id;
    inspRow(lbl, id);
  });
  gap(3);

  subHdr('DRY PIPE / PRE-ACTION (IF APPLICABLE)');
  inspHdr();
  ['sp-air-pressure','sp-dp-valve','sp-low-air','sp-quick-open'].forEach(id => {
    const el = document.getElementById('row-' + id);
    const lbl = el?.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id;
    inspRow(lbl, id);
  });
  dataRow([
    { label: 'LAST TRIP TEST DATE', val: fd['sp-trip-date'] || '', w: PW/2 },
    { label: 'TRIP PRESSURE (PSI)', val: fd['sp-trip-psi']  || '', w: PW/2 },
  ]);
  gap(3);

  subHdr('5-YEAR ITEMS (IF DUE)');
  inspHdr();
  ['sp-5yr-pipe','sp-5yr-fdc','sp-gauges-5yr'].forEach(id => {
    const el = document.getElementById('row-' + id);
    const lbl = el?.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id;
    inspRow(lbl, id);
  });
  dataRow([{ label: '5-YEAR ITEMS NEXT DUE DATE', val: fd['sp-5yr-due'] || '', w: PW }]);

  // ── PAGE 4: MAIN DRAIN TEST RESULTS ─────────────────────────────────────────
  addPage();
  secHdr('MAIN DRAIN TEST RESULTS');
  const drainDOMRows = [...(document.getElementById('sp-drain-tbody')?.querySelectorAll('tr') || [])];
  const drainRows = drainDOMRows.map((tr, i) => [
    String(i + 1),
    tr.querySelector('input[type=text]')?.value || '',
    tr.querySelectorAll('input[type=number]')[0]?.value || '',
    tr.querySelectorAll('input[type=number]')[1]?.value || '',
    tr.querySelectorAll('input[type=number]')[2]?.value || '',
  ]);
  if (drainRows.length === 0) drainRows.push(['1', '', '', '', '']);
  table(
    [{label:'#',w:28},{label:'SYSTEM LOCATION',w:PW-268},{label:'STATIC (PSI)',w:80},{label:'RESIDUAL (PSI)',w:80},{label:'POST (PSI)',w:80}],
    drainRows, 14
  );
  gap(6);

  // Deficiency list
  secHdr('WET SPRINKLER DEFICIENCY LIST');
  const spDeficRows = [...(document.getElementById('sp-defic-tbody')?.querySelectorAll('tr') || [])];
  if (spDeficRows.length === 0) {
    checkPage(14);
    page.drawRectangle({ x: ML, y: ry(13), width: PW, height: 13, color: gold, borderColor: sky, borderWidth: 0.3 });
    page.drawText('No deficiencies noted.', { x: ML+4, y: ty(13,4), size: 8, font: rFont, color: blk });
    curY += 14;
  } else {
    spDeficRows.forEach((tr, i) => {
      const desc = tr.querySelector('td:nth-child(2) input')?.value?.trim() || '';
      checkPage(14);
      page.drawRectangle({ x: ML,    y: ry(13), width: 24,     height: 13, color: gold, borderColor: sky, borderWidth: 0.3 });
      page.drawText(String(i+1), { x: ML+8, y: ty(13,4), size: 7, font: hFont, color: blk });
      const nf = form.createTextField(fid());
      nf.setText(desc);
      page.drawRectangle({ x: ML+24, y: ry(13), width: PW-24, height: 13, color: gold, borderColor: sky, borderWidth: 0.3 });
      nf.addToPage(page, { x: ML+25, y: ry(13)+1, width: PW-26, height: 11, font: rFont });
      nf.setFontSize(7);
      curY += 14;
    });
  }
  gap(6);

  // General notes
  secHdr('GENERAL NOTES & SITE OBSERVATIONS');
  const spNoteRows = [...(document.getElementById('sp-notes-tbody')?.querySelectorAll('tr') || [])];
  const noteRowCount = Math.max(spNoteRows.length, 3);
  for (let i = 0; i < noteRowCount; i++) {
    const note = i < spNoteRows.length ? (spNoteRows[i].querySelector('td:nth-child(2) input')?.value?.trim() || '') : '';
    checkPage(14);
    page.drawRectangle({ x: ML,    y: ry(13), width: 24,     height: 13, color: gold, borderColor: sky, borderWidth: 0.3 });
    page.drawText(String(i+1), { x: ML+8, y: ty(13,4), size: 7, font: hFont, color: blk });
    const nf = form.createTextField(fid());
    nf.setText(note);
    page.drawRectangle({ x: ML+24, y: ry(13), width: PW-24, height: 13, color: gold, borderColor: sky, borderWidth: 0.3 });
    nf.addToPage(page, { x: ML+25, y: ry(13)+1, width: PW-26, height: 11, font: rFont });
    nf.setFontSize(7);
    curY += 14;
  }

  // ── SIGNATURES ───────────────────────────────────────────────────────────────
  checkPage(120);
  gap(10);
  secHdr('OVERALL STATUS & SIGNATURES');

  // Overall status
  const statusVal = data.overallStatus || '';
  dataRow([{ label: 'OVERALL INSPECTION STATUS', val: statusVal, w: PW }]);
  gap(6);

  // Inspector signature
  const sigH = 40;
  const sigW = PW / 2 - 6;
  page.drawText('INSPECTOR / OWNER SIGNATURE:', { x: ML, y: ty(sigH) + sigH + 2, size: 7, font: hFont, color: navy });
  page.drawRectangle({ x: ML, y: ry(sigH), width: sigW, height: sigH, color: gold, borderColor: sky, borderWidth: 0.5 });
  if (sigHasData) {
    try {
      const sc  = document.getElementById('sig-canvas');
      const b64 = sc.toDataURL('image/png').split(',')[1];
      const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
      const sImg  = await pdfDoc.embedPng(ab);
      const sDims = sImg.scaleToFit(sigW - 8, sigH - 8);
      page.drawImage(sImg, { x: ML + 4, y: ry(sigH) + 4, width: sDims.width, height: sDims.height });
    } catch(_) {}
  } else {
    const sf = form.createTextField(fid());
    sf.setText('');
    sf.addToPage(page, { x: ML+2, y: ry(sigH)+2, width: sigW-4, height: sigH-4, font: rFont });
    sf.setFontSize(9);
  }
  // Client signature
  page.drawText('CLIENT SIGNATURE:', { x: ML+PW/2+10, y: ty(sigH) + sigH + 2, size: 7, font: hFont, color: navy });
  page.drawRectangle({ x: ML+PW/2+8, y: ry(sigH), width: sigW, height: sigH, color: gold, borderColor: sky, borderWidth: 0.5 });
  if (custSigHasData) {
    try {
      const cc  = document.getElementById('cust-sig-canvas');
      const b64 = cc.toDataURL('image/png').split(',')[1];
      const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
      const cImg  = await pdfDoc.embedPng(ab);
      const cDims = cImg.scaleToFit(sigW - 8, sigH - 8);
      page.drawImage(cImg, { x: ML+PW/2+12, y: ry(sigH) + 4, width: cDims.width, height: cDims.height });
    } catch(_) {}
  } else {
    const cf = form.createTextField(fid());
    cf.setText('');
    cf.addToPage(page, { x: ML+PW/2+10, y: ry(sigH)+2, width: sigW-4, height: sigH-4, font: rFont });
    cf.setFontSize(9);
  }
  curY += sigH + 4;
  dataRow([
    { label: 'INSPECTOR DATE', val: data.signature?.date || data.inspection?.date || '', w: PW/2 },
    { label: 'CLIENT DATE',    val: fd['cust-sig-date'] || '', w: PW/2 },
  ]);
  dataRow([
    { label: 'INSPECTOR PRINT NAME', val: fd['sig-name'] || data.inspection?.inspectorName || '', w: PW/2 },
    { label: 'CLIENT PRINT NAME',    val: fd['cust-sig-name'] || '', w: PW/2 },
  ]);

  // Photos page
  if (inspectionPhotos.length > 0) {
    addPage();
    secHdr('INSPECTION PHOTOS');
    const photoW = Math.floor((PW - 10) / 2);
    const photoH = 140;
    let col = 0;
    for (let i = 0; i < inspectionPhotos.length; i++) {
      const photo = inspectionPhotos[i];
      checkPage(photoH + 30);
      const px = ML + col * (photoW + 10);
      try {
        const b64 = photo.dataUrl.split(',')[1];
        const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
        const img = photo.dataUrl.startsWith('data:image/png')
          ? await pdfDoc.embedPng(ab) : await pdfDoc.embedJpg(ab);
        const dims = img.scaleToFit(photoW, photoH);
        page.drawImage(img, { x: px, y: ry(photoH) + (photoH - dims.height), width: dims.width, height: dims.height });
      } catch(_) {
        page.drawRectangle({ x: px, y: ry(photoH), width: photoW, height: photoH, color: lgray });
      }
      page.drawRectangle({ x: px+2, y: ry(photoH)+photoH-14, width: 40, height: 12, color: rgb(0,0,0) });
      page.drawText('Photo ' + (i+1), { x: px+4, y: ry(photoH)+photoH-7, size: 7, font: hFont, color: white });
      if (photo.note) {
        const noteLines = wrap(photo.note, 7, photoW);
        noteLines.forEach((l, li) => {
          page.drawText(l, { x: px, y: ry(photoH) - 10 - li * 9, size: 7, font: rFont, color: blk });
        });
      }
      col++;
      if (col >= 2) { col = 0; curY += photoH + 22; }
    }
    if (col > 0) curY += photoH + 22;
  }

  return await pdfDoc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC SYSTEM PDF (fire-pump, standpipe, hood, hydrant, bda, smoke-control,
// gas-detection, special-suppression, backflow) — pdf-lib editable format
// ─────────────────────────────────────────────────────────────────────────────
async function buildGenericSystemPDFBytes() {
  if (!window.PDFLib) throw new Error('PDF library not loaded. Please refresh.');
  const data = collectAllData();
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const form   = pdfDoc.getForm();
  const hFont  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const rFont  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const W = 612, PH = 792, ML = 36, PW = 540, MT = 36, MB = 36;
  let page, curY, _fid = 0;
  const fid = () => 'gen_' + (++_fid);

  const FIRE_RED = rgb(0.72, 0.08, 0.08);
  const navy  = rgb(0.13, 0.21, 0.42);
  const sky   = rgb(0.71, 0.80, 0.93);
  const gold  = rgb(1.0, 1.0, 0.75);
  const lgray = rgb(0.94, 0.94, 0.94);
  const white = rgb(1, 1, 1);
  const green = rgb(0.06, 0.50, 0.22);
  const red   = rgb(0.76, 0.10, 0.10);
  const amber = rgb(0.75, 0.38, 0.00);
  const slate = rgb(0.39, 0.45, 0.55);

  const addPage = () => { page = pdfDoc.addPage([W, PH]); curY = MT; };
  const ry = (h) => PH - curY - h;
  const ty = (h, a = 3) => PH - curY - h + a;
  const checkPage = (needed) => { if (curY + needed > PH - MB) addPage(); };
  const gap = (h) => { curY += h; };

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

  const secHdr = (title) => {
    checkPage(20);
    page.drawRectangle({ x: ML, y: ry(17), width: PW, height: 17, color: navy });
    page.drawText(title, { x: ML+4, y: ty(17,5), size: 9, font: hFont, color: white });
    curY += 18;
  };
  const subHdr = (title) => {
    checkPage(14);
    page.drawRectangle({ x: ML, y: ry(12), width: PW, height: 12, color: sky });
    page.drawText(title, { x: ML+4, y: ty(12,4), size: 7.5, font: hFont, color: navy });
    curY += 13;
  };
  const mkField = (val, x, fieldY, w, h, ml) => {
    page.drawRectangle({ x, y: fieldY, width: w, height: h, color: gold, borderColor: sky, borderWidth: 0.5 });
    const f = form.createTextField(fid());
    f.setText(String(val || ''));
    if (ml) f.enableMultiline();
    f.addToPage(page, { x: x+1, y: fieldY+1, width: w-2, height: h-2, font: rFont });
    f.setFontSize(8);
  };
  const dataRow = (cols, fh = 12, lh = 8, gp = 3) => {
    checkPage(lh + fh + gp);
    let x = ML;
    cols.forEach(c => {
      page.drawText((c.label||'')+':', { x: x+2, y: ty(lh, lh-3), size: 6, font: hFont, color: navy });
      mkField(c.val, x, ry(lh+fh), c.w, fh);
      x += c.w;
    });
    curY += lh + fh + gp;
  };

  const sys = activeInspectionSystem;
  const meta = SYS_META[sys] || { label: sys, icon: '' };

  // System title map
  const SYS_TITLE = {
    'fire-pump':           'FIRE PUMP INSPECTION REPORT',
    'standpipe':           'STANDPIPE SYSTEM INSPECTION REPORT',
    'hood':                'KITCHEN HOOD SUPPRESSION INSPECTION REPORT',
    'hydrant':             'PRIVATE HYDRANT INSPECTION REPORT',
    'bda':                 'BDA / EMERGENCY RADIO INSPECTION REPORT',
    'smoke-control':       'SMOKE CONTROL SYSTEM INSPECTION REPORT',
    'gas-detection':       'GAS DETECTION SYSTEM INSPECTION REPORT',
    'special-suppression': 'SPECIAL SUPPRESSION SYSTEM INSPECTION REPORT',
    'backflow':            'BACKFLOW PREVENTION DEVICE TEST REPORT',
  };
  const NFPA_REF = {
    'fire-pump':'NFPA 25 Ch. 8','standpipe':'NFPA 25 Ch. 6','hood':'NFPA 17A',
    'hydrant':'NFPA 25 Ch. 7','bda':'NFPA 72 Ch. 24','smoke-control':'NFPA 92',
    'gas-detection':'NFPA 72','special-suppression':'NFPA 2001 / 11 / 17','backflow':'AWWA',
  };

  // System data fields (ids → labels)
  const SYS_FIELDS = {
    'fire-pump': { sections: [
      { title: 'PUMP INFORMATION', rows: [
        [{label:'Manufacturer',id:'fp-mfr',w:180},{label:'Model',id:'fp-model',w:180},{label:'Serial #',id:'fp-serial',w:180}],
        [{label:'Driver Type',id:'fp-type',w:180},{label:'Rated GPM',id:'fp-rated-gpm',w:180},{label:'Rated PSI',id:'fp-rated-psi',w:180}],
        [{label:'Rated RPM',id:'fp-rpm',w:180},{label:'Horsepower',id:'fp-hp',w:180},{label:'Year Installed',id:'fp-year',w:180}],
      ]},
      { title: 'CHURN / NO-FLOW TEST DATA', rows: [
        [{label:'Churn Suction PSI',id:'fp-churn-suction',w:180},{label:'Churn Discharge PSI',id:'fp-churn-discharge',w:180},{label:'Churn RPM',id:'fp-churn-rpm',w:180}],
        [{label:'Voltage — All Phases',id:'fp-churn-volts',w:270},{label:'Amps — All Phases',id:'fp-churn-amps',w:270}],
      ]},
      { title: '100% FLOW TEST DATA (ANNUAL)', rows: [
        [{label:'Flow Rate (GPM)',id:'fp-flow-gpm',w:135},{label:'Suction PSI',id:'fp-flow-suction',w:135},{label:'Discharge PSI',id:'fp-flow-discharge',w:135},{label:'RPM at Flow',id:'fp-flow-rpm',w:135}],
        [{label:'Voltage at Flow',id:'fp-flow-volts',w:270},{label:'Amps at Flow',id:'fp-flow-amps',w:270}],
      ]},
      { title: 'DIESEL ENGINE DATA (IF APPLICABLE)', rows: [
        [{label:'Oil Pressure (PSI)',id:'fp-diesel-oil',w:180},{label:'Coolant Temp (°F)',id:'fp-diesel-temp',w:180},{label:'Engine Hours',id:'fp-diesel-hours',w:180}],
      ]},
    ]},
    'standpipe': [
      [{label:'Standpipe Class',id:'std-class',w:180},{label:'System Type',id:'std-type',w:180},{label:'# Standpipes',id:'std-count',w:180}],
      [{label:'# Floors Served',id:'std-floors',w:180},{label:'# Hose Stations',id:'std-hose-stations',w:180},{label:'Last Flow Test Date',id:'std-flow-date',w:180}],
      [{label:'PRV Static PSI',id:'std-prv-static',w:180},{label:'PRV Residual PSI',id:'std-prv-residual',w:180},{label:'Flow Test PSI',id:'std-flow-psi',w:180}],
    ],
    'hood': [
      [{label:'Manufacturer',id:'hood-mfr',w:180},{label:'Model / Cylinder #',id:'hood-model',w:180},{label:'Year Installed',id:'hood-install',w:180}],
      [{label:'Agent Type',id:'hood-agent',w:180},{label:'# Nozzles',id:'hood-nozzle-count',w:180},{label:'Last Service Date',id:'hood-last-service',w:180}],
      [{label:'Cylinder Wt (actual)',id:'hood-cyl-wt-actual',w:180},{label:'Min Acceptable Wt (lbs)',id:'hood-cyl-wt-min',w:180},{label:'Next Service Due',id:'hood-next-service',w:180}],
    ],
    'hydrant': [
      [{label:'# Hydrants',id:'hy-count',w:180},{label:'Hydrant Type',id:'hy-type',w:180},{label:'Last Flow Test Date',id:'hy-last-flow',w:180}],
      [{label:'Static PSI',id:'hy-flow-static',w:180},{label:'Residual PSI',id:'hy-flow-residual',w:180},{label:'Flow GPM',id:'hy-flow-gpm',w:180}],
    ],
    'bda': [
      [{label:'Manufacturer',id:'bda-mfr',w:180},{label:'Model',id:'bda-model',w:180},{label:'Year Installed',id:'bda-install',w:180}],
      [{label:'Frequencies',id:'bda-freqs',w:270},{label:'AHJ Cert / FCC License',id:'bda-ahj-cert',w:270}],
      [{label:'Min Signal (dBm)',id:'bda-min-signal',w:180},{label:'Worst Coverage Location',id:'bda-worst-loc',w:180},{label:'Next Test Date',id:'bda-next-test',w:180}],
    ],
    'smoke-control': [
      [{label:'System Type',id:'sc-type',w:180},{label:'# Zones',id:'sc-zones',w:180},{label:'Year Installed',id:'sc-year',w:180}],
      [{label:'# Fans',id:'sc-fans',w:135},{label:'# Dampers',id:'sc-dampers',w:135},{label:'Pressure Differential',id:'sc-pressure-val',w:135},{label:'# HVAC Units',id:'sc-hvac-count',w:135}],
    ],
    'gas-detection': [
      [{label:'Manufacturer',id:'gd-mfr',w:180},{label:'Model',id:'gd-model',w:180},{label:'Gas Type',id:'gd-gas-type',w:180}],
      [{label:'# Sensors',id:'gd-sensor-count',w:135},{label:'# Zones',id:'gd-zones',w:135},{label:'Year Installed',id:'gd-install-date',w:135},{label:'Next Replacement Due',id:'gd-sensor-due',w:135}],
      [{label:'Low Alarm Setpoint',id:'gd-alarm-setpoint-lo',w:270},{label:'High Alarm Setpoint',id:'gd-alarm-setpoint-hi',w:270}],
    ],
    'special-suppression': [
      [{label:'System Type',id:'ss-type',w:180},{label:'Manufacturer',id:'ss-mfr',w:180},{label:'Protected Area',id:'ss-area',w:180}],
      [{label:'Agent Name',id:'ss-agent',w:180},{label:'# Cylinders',id:'ss-cylinders',w:180},{label:'Year Installed',id:'ss-install',w:180}],
      [{label:'Actual Weight (lbs)',id:'ss-actual-wt',w:180},{label:'Min. Required (lbs)',id:'ss-min-wt',w:180},{label:'Cylinder PSI',id:'ss-pressure',w:180}],
    ],
    'backflow': [
      [{label:'Manufacturer',id:'bf-mfr',w:180},{label:'Model',id:'bf-model',w:180},{label:'Serial #',id:'bf-serial',w:180}],
      [{label:'Device Type',id:'bf-type',w:180},{label:'Size',id:'bf-size',w:180},{label:'Location',id:'bf-location',w:180}],
      [{label:'Check 1 Open PSI',id:'bf-check1-open',w:135},{label:'Check 1 Close PSI',id:'bf-check1-close',w:135},{label:'Check 2 Open PSI',id:'bf-check2-open',w:135},{label:'Check 2 Close PSI',id:'bf-check2-close',w:135}],
      [{label:'RV Diff PSI',id:'bf-rv-open',w:180},{label:'Test Date',id:'bf-test-date',w:180},{label:"Tester's Cert #",id:'bf-cert-number',w:180}],
    ],
  };

  // Inspection item IDs per system
  const SYS_ITEMS = {
    'fire-pump':   ['fp-controller-cond','fp-controller-auto','fp-jockey-type','fp-jockey-cycles','fp-churn-test','fp-flow-test','fp-diesel-start','fp-diesel-fuel','fp-diesel-battery','fp-diesel-coolant','fp-diesel-run','fp-power-fail-alarm','fp-phase-alarm','fp-room-temp','fp-suction-valve'],
    'standpipe':   ['std-fdc','std-fdc-sign','std-hose-valves','std-prv','std-check-valve','std-flow-test','std-hose-cond','std-nozzle','std-cabinet'],
    'hood':        ['hood-cylinder-wt','hood-pull-station','hood-auto-detect','hood-micro-switch','hood-nozzle-cond','hood-nozzle-coverage','hood-duct-protected','hood-gas-shutoff','hood-power-shutoff','hood-fa-integration','hood-ansul-reset','hood-grease-buildup','hood-filter-cond','hood-service-tag'],
    'hydrant':     ['hy-caps','hy-drainage','hy-painted','hy-clearance','hy-operation','hy-gate-valve','hy-outlet-threads','hy-flow-test'],
    'bda':         ['bda-uplink','bda-downlink','bda-coverage','bda-power','bda-backup-power','bda-donor-antenna','bda-internal-antenna','bda-alarms','bda-fa-interface','bda-permit','bda-coverage-map'],
    'smoke-control':['sc-fans-op','sc-cfm','sc-pressure','sc-dampers-op','sc-fire-dampers','sc-damper-access','sc-control-panel','sc-fa-integration','sc-override','sc-detector-input'],
    'gas-detection':['gd-sensor-test','gd-alarm-test','gd-gas-shutoff','gd-ventilation','gd-power','gd-backup','gd-control-panel','gd-fa-integration','gd-calibration-cert'],
    'special-suppression':['ss-agent-wt','ss-detection','ss-pull','ss-abort','ss-discharge-time','ss-nozzles','ss-coverage','ss-room-integrity','ss-hvac-shutoff','ss-power-shutoff','ss-fa-integration','ss-recharge-cert'],
    'backflow':    ['bf-test','bf-passed','bf-casing','bf-shutoffs','bf-clearance','bf-freeze'],
  };
  const NOTES_ID = {
    'standpipe':'std-notes','hood':'hood-notes','hydrant':'hy-notes',
    'bda':'bda-notes','smoke-control':'sc-notes','gas-detection':'gd-notes',
    'special-suppression':'ss-notes','backflow':'bf-notes',
  };

  // ── PAGE 1: HEADER ──────────────────────────────────────────────────────────
  addPage();

  // Red title banner
  const titleText = SYS_TITLE[sys] || (meta.label.toUpperCase() + ' INSPECTION REPORT');
  page.drawRectangle({ x: 0, y: PH - 22, width: W, height: 22, color: FIRE_RED });
  page.drawText(titleText, {
    x: W/2 - hFont.widthOfTextAtSize(titleText, 12)/2,
    y: PH - 22 + 5, size: 12, font: hFont, color: white
  });
  curY = 22 + 6;

  // Logo + company block  (5 fields × 21pt + 4pt top pad = 109; use 112 for breathing room)
  const logoAreaH = 112;
  const logoX = ML, logoW = 88;
  const infoX = ML + logoW + 6, infoW = 162;
  const rtX = infoX + infoW + 6, rtW = PW - logoW - infoW - 18;

  try {
    const svgText = await fetch('logo.svg').then(r => r.text());
    const sizedSvg = svgText.replace('<svg ', '<svg width="400" height="600" ');
    const svgBlob = new Blob([sizedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    await new Promise((resolve) => {
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
        const logoDims = logoImg.scaleToFit(66, 66);
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
    { text: 'Fire Life Protection System, Inc.', bold: true,  sz: 9   },
    { text: '8201 Shaffer Parkway Suite B',       bold: false, sz: 8   },
    { text: 'Littleton, CO 80127',                bold: false, sz: 8   },
    { text: 'Cell: (303) 726-8847  |  Office: (720) 974-1570', bold: false, sz: 7.5 },
    { text: 'Alan.antonio@firelifeprotectionsystems.com',       bold: false, sz: 7.5 },
  ];
  let clY = ry(logoAreaH) + logoAreaH - 9;
  compLines.forEach(l => {
    page.drawText(l.text, { x: infoX + 4, y: clY, size: l.sz, font: l.bold ? hFont : rFont, color: navy });
    clY -= l.sz + 5;
  });

  // Report info box (right side)
  page.drawRectangle({ x: rtX, y: ry(logoAreaH), width: rtW, height: logoAreaH, color: lgray, borderColor: sky, borderWidth: 0.5 });
  const rtFields = [
    { label: 'DATE', val: data.inspection.date || '' },
    { label: 'REPORT TYPE', val: data.inspection.reportType || '' },
    { label: 'INSPECTOR', val: data.inspection.inspectorName || '' },
    { label: 'LICENSE/CERT', val: data.inspection.inspectorCert || '' },
    { label: 'NFPA REF.', val: data.inspection.nfpaRef || NFPA_REF[sys] || '' },
  ];
  // 5 fields × 21pt (6 label + 2 gap + 10 box + 3 bottom) + 4 top pad = 109pt ≤ 112
  let rfY = ry(logoAreaH) + logoAreaH - 4;
  rtFields.forEach(f => {
    rfY -= 6; // label line height
    page.drawText(f.label + ':', { x: rtX+3, y: rfY, size: 6, font: hFont, color: slate });
    rfY -= 2; // gap label→box
    page.drawRectangle({ x: rtX+2, y: rfY - 10, width: rtW-4, height: 10, color: gold, borderColor: sky, borderWidth: 0.3 });
    const tf = form.createTextField(fid());
    tf.setText(f.val); tf.addToPage(page, { x: rtX+4, y: rfY-9, width: rtW-8, height: 8, font: rFont }); tf.setFontSize(7);
    rfY -= 13; // box (10) + bottom gap (3)
  });
  curY += logoAreaH + 4;

  // Property block
  secHdr('PROPERTY INFORMATION');
  gap(3);
  const propAddress = data.property.address || '';
  const propCSZ     = data.property.cityStateZip || '';
  const propMgr     = data.property.contact || '';
  const propEmail   = data.property.contactEmail || '';
  // Street address
  if (propAddress) {
    wrap(propAddress, 8, PW - 8).forEach(line => {
      checkPage(12);
      page.drawText(line, { x: ML+4, y: ry(12)+3, size: 8, font: rFont, color: navy });
      curY += 12;
    });
  }
  // City, State, ZIP
  if (propCSZ) {
    checkPage(12);
    page.drawText(propCSZ, { x: ML+4, y: ry(12)+3, size: 8, font: rFont, color: navy });
    curY += 12;
  }
  // Property manager and email
  const mgr = [propMgr ? 'Property Manager: ' + propMgr : '', propEmail ? 'Email: ' + propEmail : ''].filter(Boolean).join('   |   ');
  if (mgr) {
    wrap(mgr, 7.5, PW - 8).forEach(line => {
      checkPage(11);
      page.drawText(line, { x: ML+4, y: ry(11)+3, size: 7.5, font: rFont, color: slate });
      curY += 11;
    });
  }
  gap(4);

  // Overall status bar
  const stVal = (data.overallStatus || '').toUpperCase();
  const stColor = stVal === 'COMPLIANT' ? green : stVal === 'DEFICIENT' ? red : stVal === 'IMPAIRED' ? amber : slate;
  checkPage(22);
  page.drawRectangle({ x: ML, y: ry(18), width: PW, height: 18, color: stColor });
  page.drawText('OVERALL SYSTEM STATUS', { x: ML+8, y: ty(18,6), size: 6.5, font: hFont, color: white });
  page.drawText(stVal || 'PENDING', { x: ML+130, y: ty(18,6), size: 9.5, font: hFont, color: white });
  curY += 18;
  gap(6);

  // System info fields
  const sysFields = SYS_FIELDS[sys];
  if (sysFields) {
    if (sysFields.sections) {
      // Sectioned format (e.g. fire pump)
      secHdr('SYSTEM INFORMATION');
      gap(4);
      sysFields.sections.forEach(sec => {
        subHdr(sec.title);
        gap(3);
        sec.rows.forEach(row => {
          const cols = row.map(c => ({ label: c.label, val: document.getElementById(c.id)?.value?.trim() || '', w: c.w }));
          dataRow(cols);
        });
        gap(8);
      });
      gap(2);
    } else if (sysFields.length) {
      // Flat array format
      secHdr('SYSTEM INFORMATION');
      gap(4);
      sysFields.forEach(row => {
        const cols = row.map(c => ({ label: c.label, val: document.getElementById(c.id)?.value?.trim() || '', w: c.w }));
        dataRow(cols);
      });
      gap(4);
    }
  }

  // Deficiencies
  if (data.deficiencies.length > 0) {
    secHdr('DEFICIENCIES — ' + data.deficiencies.length + ' ITEM(S)');
    gap(2);
    data.deficiencies.forEach(d => {
      const sanitize = s => (s || '').replace(/≥/g, '>=').replace(/≤/g, '<=');
      const text = sanitize(d.item) + (d.description ? ': ' + sanitize(d.description) : '');
      const rowH = 13;
      checkPage(rowH + 2);
      page.drawRectangle({ x: ML, y: ry(rowH), width: 12, height: rowH, color: rgb(0.99, 0.93, 0.93), borderColor: red, borderWidth: 0.3 });
      page.drawText('\u2022', { x: ML+4, y: ry(rowH) + rowH/2 - 1, size: 8, font: hFont, color: red });
      page.drawRectangle({ x: ML+12, y: ry(rowH), width: PW-12, height: rowH, color: rgb(0.99, 0.93, 0.93), borderColor: red, borderWidth: 0.3 });
      const dff = form.createTextField(fid());
      dff.setText(text);
      dff.addToPage(page, { x: ML+14, y: ry(rowH)+1, width: PW-16, height: rowH-2, font: rFont });
      dff.setFontSize(7.5);
      curY += rowH + 2;
    });
    gap(4);
  }

  // Inspection checklist
  const inspItems = SYS_ITEMS[sys] || [];
  if (inspItems.length) {
    secHdr('INSPECTION RESULTS');
    gap(2);
    inspItems.forEach(id => {
      const row = document.getElementById('row-' + id);
      if (!row) return;
      const label = (row.querySelector('.inspect-label')?.childNodes[0]?.textContent?.trim() || id).replace(/≥/g, '>=').replace(/≤/g, '<=');
      const result = (row.dataset.val || '').toUpperCase();
      const deficTxt = document.getElementById('defic-txt-' + id)?.value?.trim() || '';
      const labelLines = wrap(label, 7.5, PW - 50);
      const rowH = Math.max(13, labelLines.length * 9 + 4);
      checkPage(rowH + (result === 'FAIL' && deficTxt ? 13 : 0) + 1);
      const bg = result === 'PASS' ? rgb(0.94, 0.99, 0.95) : result === 'FAIL' ? rgb(0.99, 0.93, 0.93) : rgb(0.97, 0.97, 0.97);
      page.drawRectangle({ x: ML, y: ry(rowH), width: PW, height: rowH, color: bg, borderColor: sky, borderWidth: 0.3 });
      labelLines.forEach((line, li) => {
        page.drawText(line, { x: ML+4, y: ry(rowH) + rowH - 7 - li*9, size: 7.5, font: rFont, color: navy });
      });
      // Editable result badge with colored background
      const bColor = result === 'PASS' ? green : result === 'FAIL' ? red : (result ? slate : lgray);
      const bW = 36;
      const bX = ML + PW - bW - 2;
      page.drawRectangle({ x: bX, y: ry(rowH)+1, width: bW, height: rowH-2, color: bColor });
      const rf = form.createTextField(fid());
      rf.setText(result || '');
      rf.addToPage(page, { x: bX+1, y: ry(rowH)+2, width: bW-2, height: rowH-4, font: hFont });
      rf.setFontSize(7);
      curY += rowH + 3;
      if (result === 'FAIL' && deficTxt) {
        const defH = 12;
        checkPage(defH + 2);
        page.drawRectangle({ x: ML+4, y: ry(defH), width: PW-4, height: defH, color: rgb(0.99, 0.93, 0.93), borderColor: red, borderWidth: 0.3 });
        const defField = form.createTextField(fid());
        defField.setText('Deficiency: ' + deficTxt);
        defField.addToPage(page, { x: ML+6, y: ry(defH)+1, width: PW-10, height: defH-2, font: rFont });
        defField.setFontSize(7);
        curY += defH + 3;
      }
    });
    gap(4);
  }

  // Notes
  const notesId = NOTES_ID[sys];
  const notesVal = notesId ? document.getElementById(notesId)?.value?.trim() : '';
  if (notesVal) {
    secHdr('NOTES');
    const nl = wrap(notesVal, 8, PW - 8);
    nl.forEach(line => {
      checkPage(12);
      page.drawText(line, { x: ML+4, y: ry(12)+3, size: 8, font: rFont, color: navy });
      curY += 12;
    });
    gap(4);
  }

  // Photos
  if (inspectionPhotos && inspectionPhotos.length > 0) {
    addPage();
    secHdr('INSPECTION PHOTOS');
    const photoW = Math.floor((PW - 10) / 2);
    const photoH = 140;
    let col = 0;
    for (let i = 0; i < inspectionPhotos.length; i++) {
      const photo = inspectionPhotos[i];
      checkPage(photoH + 30);
      const px = ML + col * (photoW + 10);
      try {
        const b64 = photo.dataUrl.split(',')[1];
        const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
        const img = photo.dataUrl.startsWith('data:image/png')
          ? await pdfDoc.embedPng(ab) : await pdfDoc.embedJpg(ab);
        const dims = img.scaleToFit(photoW, photoH);
        page.drawImage(img, { x: px, y: ry(photoH) + (photoH - dims.height), width: dims.width, height: dims.height });
      } catch(_) {
        page.drawRectangle({ x: px, y: ry(photoH), width: photoW, height: photoH, color: lgray });
      }
      page.drawRectangle({ x: px+2, y: ry(photoH)+photoH-14, width: 40, height: 12, color: rgb(0,0,0) });
      page.drawText('Photo ' + (i+1), { x: px+4, y: ry(photoH)+photoH-7, size: 7, font: hFont, color: white });
      if (photo.note) {
        wrap(photo.note, 7, photoW).forEach((l, li) => {
          page.drawText(l, { x: px, y: ry(photoH) - 10 - li * 9, size: 7, font: rFont, color: navy });
        });
      }
      col++;
      if (col >= 2) { col = 0; curY += photoH + 22; }
    }
    if (col > 0) curY += photoH + 22;
  }

  // Signatures
  checkPage(120);
  secHdr('OVERALL STATUS & SIGNATURES');
  gap(4);
  dataRow([{ label: 'OVERALL INSPECTION STATUS', val: data.overallStatus || '', w: PW }]);
  gap(14);
  const genSigH = 40, genSigW = PW / 2 - 6;
  page.drawText('INSPECTOR SIGNATURE:', { x: ML, y: ry(0) + 2, size: 7, font: hFont, color: navy });
  page.drawText('CLIENT SIGNATURE:',    { x: ML+PW/2+10, y: ry(0) + 2, size: 7, font: hFont, color: navy });
  gap(10);
  page.drawRectangle({ x: ML, y: ry(genSigH), width: genSigW, height: genSigH, color: gold, borderColor: sky, borderWidth: 0.5 });
  if (sigHasData) {
    try {
      const sc = document.getElementById('sig-canvas');
      const b64 = sc.toDataURL('image/png').split(',')[1];
      const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
      const sImg = await pdfDoc.embedPng(ab);
      const sDims = sImg.scaleToFit(genSigW - 8, genSigH - 8);
      page.drawImage(sImg, { x: ML + 4, y: ry(genSigH) + 4, width: sDims.width, height: sDims.height });
    } catch(_) {}
  } else {
    const sf2 = form.createTextField(fid());
    sf2.setText(''); sf2.addToPage(page, { x: ML+2, y: ry(genSigH)+2, width: genSigW-4, height: genSigH-4, font: rFont }); sf2.setFontSize(9);
  }
  page.drawRectangle({ x: ML+PW/2+8, y: ry(genSigH), width: genSigW, height: genSigH, color: gold, borderColor: sky, borderWidth: 0.5 });
  if (custSigHasData) {
    try {
      const cc = document.getElementById('cust-sig-canvas');
      const b64 = cc.toDataURL('image/png').split(',')[1];
      const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
      const cImg = await pdfDoc.embedPng(ab);
      const cDims = cImg.scaleToFit(genSigW - 8, genSigH - 8);
      page.drawImage(cImg, { x: ML+PW/2+12, y: ry(genSigH) + 4, width: cDims.width, height: cDims.height });
    } catch(_) {}
  } else {
    const cf2 = form.createTextField(fid());
    cf2.setText(''); cf2.addToPage(page, { x: ML+PW/2+10, y: ry(genSigH)+2, width: genSigW-4, height: genSigH-4, font: rFont }); cf2.setFontSize(9);
  }
  curY += genSigH + 4;
  dataRow([
    { label: 'INSPECTOR DATE',      val: data.signature?.date || data.inspection?.date || '', w: PW/2 },
    { label: 'CLIENT DATE',         val: document.getElementById('cust-sig-date')?.value || '', w: PW/2 },
  ]);
  dataRow([
    { label: 'INSPECTOR PRINT NAME', val: data.signature?.name || data.inspection?.inspectorName || '', w: PW/2 },
    { label: 'CLIENT PRINT NAME',    val: document.getElementById('cust-sig-name')?.value || '', w: PW/2 },
  ]);
  gap(4);

  return await pdfDoc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// EXIT SIGN & LIGHTING PDF — pdf-lib editable format
// ─────────────────────────────────────────────────────────────────────────────
async function buildExitSignLightingPDFBytes() {
  if (!window.PDFLib) throw new Error('PDF library not loaded. Please refresh.');
  const data = collectAllData();
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const form   = pdfDoc.getForm();
  const hFont  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const rFont  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const W = 612, PH = 792, ML = 36, PW = 540, MT = 36, MB = 36;
  let page, curY, _fid = 0;
  const fid = () => 'esl_' + (++_fid);

  const FIRE_RED = rgb(0.72, 0.08, 0.08);
  const navy  = rgb(0.13, 0.21, 0.42);
  const sky   = rgb(0.71, 0.80, 0.93);
  const gold  = rgb(1.0, 1.0, 0.75);
  const lgray = rgb(0.94, 0.94, 0.94);
  const white = rgb(1, 1, 1);
  const green = rgb(0.06, 0.50, 0.22);
  const red   = rgb(0.76, 0.10, 0.10);
  const amber = rgb(0.75, 0.38, 0.00);
  const slate = rgb(0.39, 0.45, 0.55);

  const addPage = () => { page = pdfDoc.addPage([W, PH]); curY = MT; };
  const ry = (h) => PH - curY - h;
  const ty = (h, a = 3) => PH - curY - h + a;
  const checkPage = (needed) => { if (curY + needed > PH - MB) addPage(); };
  const gap = (h) => { curY += h; };

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

  const secHdr = (title) => {
    checkPage(20);
    page.drawRectangle({ x: ML, y: ry(17), width: PW, height: 17, color: navy });
    page.drawText(title, { x: ML+4, y: ty(17,5), size: 9, font: hFont, color: white });
    curY += 18;
  };

  // ── HEADER (same logo pattern as other PDFs) ─────────────────────────────
  addPage();
  const titleText = 'EXIT SIGN & EMERGENCY LIGHTING INSPECTION REPORT';
  page.drawRectangle({ x: 0, y: PH - 22, width: W, height: 22, color: FIRE_RED });
  page.drawText(titleText, {
    x: W/2 - hFont.widthOfTextAtSize(titleText, 11)/2,
    y: PH - 22 + 5, size: 11, font: hFont, color: white
  });
  curY = 22 + 6;

  const logoAreaH = 84;
  const logoX = ML, logoW = 88;
  const infoX = ML + logoW + 6, infoW = 162;
  const rtX = infoX + infoW + 6, rtW = PW - logoW - infoW - 18;

  try {
    const svgText = await fetch('logo.svg').then(r => r.text());
    const sizedSvg = svgText.replace('<svg ', '<svg width="400" height="600" ');
    const svgBlob = new Blob([sizedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    await new Promise((resolve) => {
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
        const logoDims = logoImg.scaleToFit(66, 66);
        page.drawImage(logoImg, { x: logoX, y: ry(logoAreaH) + (logoAreaH - logoDims.height)/2, width: logoDims.width, height: logoDims.height });
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    });
  } catch(_) {}

  page.drawRectangle({ x: infoX, y: ry(logoAreaH), width: infoW, height: logoAreaH, color: lgray, borderColor: sky, borderWidth: 0.5 });
  const compLines2 = [
    { text: 'Fire Life Protection System, Inc.', bold: true, sz: 7.5 },
    { text: '8201 Shaffer Parkway Suite B',       bold: false, sz: 7 },
    { text: 'Littleton, CO 80127',                bold: false, sz: 7 },
    { text: 'Cell: (303) 726-8847  |  Office: (720) 974-1570', bold: false, sz: 6.5 },
    { text: 'Alan.antonio@firelifeprotectionsystems.com',       bold: false, sz: 6.5 },
  ];
  let clY2 = ry(logoAreaH) + logoAreaH - 8;
  compLines2.forEach(l => {
    page.drawText(l.text, { x: infoX+4, y: clY2, size: l.sz, font: l.bold ? hFont : rFont, color: navy });
    clY2 -= l.sz + 4;
  });

  page.drawRectangle({ x: rtX, y: ry(logoAreaH), width: rtW, height: logoAreaH, color: lgray, borderColor: sky, borderWidth: 0.5 });
  const rtFields2 = [
    { label: 'DATE',         val: data.inspection.date || '' },
    { label: 'REPORT TYPE',  val: data.inspection.reportType || '' },
    { label: 'INSPECTOR',    val: data.inspection.inspectorName || '' },
    { label: 'LICENSE/CERT', val: data.inspection.inspectorCert || '' },
    { label: 'NFPA REF.',    val: data.inspection.nfpaRef || 'NFPA 101' },
  ];
  let rfY2 = ry(logoAreaH) + logoAreaH - 8;
  rtFields2.forEach(f => {
    page.drawText(f.label + ':', { x: rtX+3, y: rfY2, size: 5.5, font: hFont, color: slate });
    rfY2 -= 5;
    page.drawRectangle({ x: rtX+2, y: rfY2-2, width: rtW-4, height: 9, color: gold, borderColor: sky, borderWidth: 0.3 });
    const tf = form.createTextField(fid());
    tf.setText(f.val); tf.addToPage(page, { x: rtX+3, y: rfY2-1, width: rtW-6, height: 7, font: rFont }); tf.setFontSize(7);
    rfY2 -= 11;
  });
  curY += logoAreaH + 4;

  // Property
  secHdr('PROPERTY INFORMATION');
  const propName = data.property.name || 'Property Not Selected';
  const addrLine = [data.property.address, data.property.cityStateZip].filter(Boolean).join('  |  ');
  [
    { text: propName, sz: 10, font: hFont, color: navy },
    { text: addrLine, sz: 8, font: rFont, color: navy },
  ].forEach(l => {
    if (!l.text) return;
    wrap(l.text, l.sz, PW - 8).forEach(line => {
      checkPage(l.sz + 4);
      page.drawText(line, { x: ML+4, y: ry(l.sz+4)+2, size: l.sz, font: l.font, color: l.color });
      curY += l.sz + 4;
    });
  });
  gap(4);

  // Overall status
  const stVal2 = (data.overallStatus || '').toUpperCase();
  const stColor2 = stVal2 === 'COMPLIANT' ? green : stVal2 === 'DEFICIENT' ? red : stVal2 === 'IMPAIRED' ? amber : slate;
  checkPage(22);
  page.drawRectangle({ x: ML, y: ry(18), width: PW, height: 18, color: stColor2 });
  page.drawText('OVERALL STATUS', { x: ML+8, y: ty(18,6), size: 6.5, font: hFont, color: white });
  page.drawText(stVal2 || 'PENDING', { x: ML+100, y: ty(18,6), size: 9.5, font: hFont, color: white });
  curY += 18;
  gap(6);

  // Deficiencies
  if (data.deficiencies.length > 0) {
    secHdr('DEFICIENCIES — ' + data.deficiencies.length + ' ITEM(S)');
    data.deficiencies.forEach(d => {
      checkPage(14);
      const text = d.item + (d.description ? ': ' + d.description : '');
      const lines = wrap(text, 8, PW - 16);
      const rh = lines.length * 11 + 4;
      page.drawRectangle({ x: ML, y: ry(rh), width: PW, height: rh, color: rgb(0.99, 0.93, 0.93), borderColor: red, borderWidth: 0.5 });
      page.drawText('\u2022', { x: ML+4, y: ty(rh, rh/2+3), size: 8, font: hFont, color: red });
      lines.forEach((line, li) => {
        page.drawText(line, { x: ML+12, y: ty(rh, rh-4-li*11), size: 8, font: li===0?hFont:rFont, color: red });
      });
      curY += rh + 3;
    });
    gap(4);
  }

  // Helper: draw a device table
  const drawDeviceTable = (title, units, colDefs) => {
    if (!units || !units.length) return;
    secHdr(title);
    // Table header
    checkPage(14);
    let hx = ML;
    colDefs.forEach(c => {
      page.drawRectangle({ x: hx, y: ry(13), width: c.w, height: 13, color: navy });
      page.drawText(c.label, { x: hx+2, y: ty(13,4), size: 5.5, font: hFont, color: white });
      hx += c.w;
    });
    curY += 14;

    units.forEach((u, idx) => {
      const rowH = 13;
      checkPage(rowH + 1);
      const bg = u.pf === 'FAIL' ? rgb(0.99, 0.93, 0.93) : u.pf === 'PASS' ? rgb(0.94, 0.99, 0.95) : rgb(0.97, 0.97, 0.97);
      page.drawRectangle({ x: ML, y: ry(rowH), width: PW, height: rowH, color: bg, borderColor: sky, borderWidth: 0.3 });
      let cx = ML;
      colDefs.forEach(c => {
        const val = String(c.get(u, idx) || '');
        const color = (c.isPF && val === 'FAIL') ? red : (c.isPF && val === 'PASS') ? green : navy;
        page.drawText(val.slice(0, Math.floor(c.w / 4.5)), { x: cx+2, y: ty(rowH, 4), size: 7, font: c.isPF ? hFont : rFont, color });
        cx += c.w;
      });
      curY += rowH + 1;
    });
    gap(6);
  };

  // EL table
  drawDeviceTable('EMERGENCY LIGHTING UNITS (NFPA 101 7.9)', data.elUnits, [
    { label: '#',          w: 22,  get: (u, i) => String(i+1) },
    { label: 'LOCATION',   w: 140, get: u => u.loc },
    { label: 'TYPE',       w: 80,  get: u => u.type },
    { label: '30-SEC',     w: 56,  get: u => u.pf30s },
    { label: '90-MIN',     w: 56,  get: u => u.pf90m },
    { label: 'BATTERY',    w: 56,  get: u => u.pfBatt },
    { label: 'PASS/FAIL',  w: 56,  get: u => u.pf, isPF: true },
    { label: 'COMMENTS',   w: 74,  get: u => u.comments },
  ]);

  // ES table
  drawDeviceTable('EXIT SIGNS (NFPA 101 7.10)', data.esUnits, [
    { label: '#',          w: 22,  get: (u, i) => String(i+1) },
    { label: 'LOCATION',   w: 140, get: u => u.loc },
    { label: 'TYPE',       w: 80,  get: u => u.type },
    { label: 'ILLUMINATED',w: 60,  get: u => u.pfIllum },
    { label: 'ARROWS',     w: 52,  get: u => u.pfArrows },
    { label: 'BATT. BKUP', w: 52,  get: u => u.pfBatt },
    { label: 'PASS/FAIL',  w: 60,  get: u => u.pf, isPF: true },
    { label: 'COMMENTS',   w: 74,  get: u => u.comments },
  ]);

  // Notes
  const notesVal = document.getElementById('esl-notes')?.value?.trim() || '';
  if (notesVal) {
    secHdr('NOTES');
    wrap(notesVal, 8, PW - 8).forEach(line => {
      checkPage(12);
      page.drawText(line, { x: ML+4, y: ry(12)+3, size: 8, font: rFont, color: navy });
      curY += 12;
    });
    gap(4);
  }

  // Signature
  checkPage(50);
  secHdr('INSPECTOR CERTIFICATION');
  const sigName2 = data.signature?.name || '';
  const sigDate2 = data.signature?.date || '';
  const halfW2 = PW / 2 - 4;
  page.drawText('Inspector Signature:', { x: ML+2, y: ty(8,5), size: 6.5, font: hFont, color: navy });
  page.drawText('Date:', { x: ML+halfW2+10, y: ty(8,5), size: 6.5, font: hFont, color: navy });
  curY += 8;
  page.drawRectangle({ x: ML, y: ry(20), width: halfW2, height: 20, color: gold, borderColor: sky, borderWidth: 0.5 });
  const sf2 = form.createTextField(fid());
  sf2.setText(sigName2); sf2.addToPage(page, { x: ML+2, y: ry(20)+2, width: halfW2-4, height: 16, font: rFont }); sf2.setFontSize(9);
  page.drawRectangle({ x: ML+halfW2+8, y: ry(20), width: halfW2, height: 20, color: gold, borderColor: sky, borderWidth: 0.5 });
  const df2 = form.createTextField(fid());
  df2.setText(sigDate2); df2.addToPage(page, { x: ML+halfW2+10, y: ry(20)+2, width: halfW2-4, height: 16, font: rFont }); df2.setFontSize(9);
  curY += 24;

  return await pdfDoc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF GENERATION — returns a Uint8Array of the PDF bytes
// ─────────────────────────────────────────────────────────────────────────────
async function buildEditablePDFBytes() {
  if (!window.PDFLib) throw new Error('PDF library not loaded. Please refresh.');
  const data = collectAllData();
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const form = pdfDoc.getForm();
    const hFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const rFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const W = 612, PH = 792, ML = 36, PW = 540, MT = 36, MB = 36;
    let page, curY, _fid = 0;
    const fid = () => 'fld_' + (++_fid);

    // Colors
    const navy  = rgb(0.13, 0.21, 0.42);
    const sky   = rgb(0.71, 0.80, 0.93);
    const gold  = rgb(1.0,  1.0,  0.75);
    const lgray = rgb(0.94, 0.94, 0.94);
    const white = rgb(1, 1, 1);
    const blk   = rgb(0, 0, 0);

    const addPage = () => { page = pdfDoc.addPage([W, PH]); curY = MT; };
    // pdf-lib: origin bottom-left. ry() gives bottom-y of a strip at curY with height h.
    const ry = (h) => PH - curY - h;
    const ty = (h, a = 3) => PH - curY - h + a; // text baseline

    const checkPage = (needed) => { if (curY + needed > PH - MB) addPage(); };

    // Word-wrap helper
    const wrap = (text, sz, maxW) => {
      if (!text) return [''];
      const words = String(text).split(' ');
      const lines = []; let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (rFont.widthOfTextAtSize(test, sz) > maxW && cur) { lines.push(cur); cur = w; }
        else { cur = test; }
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [''];
    };

    // Section header (navy bar)
    const secHdr = (title) => {
      checkPage(18);
      page.drawRectangle({ x: ML, y: ry(17), width: PW, height: 17, color: navy });
      page.drawText(title, { x: ML+4, y: ty(17,5), size: 9, font: hFont, color: white });
      curY += 18;
    };
    // Sub-header (sky bar)
    const subHdr = (title) => {
      checkPage(14);
      page.drawRectangle({ x: ML, y: ry(13), width: PW, height: 13, color: sky });
      page.drawText(title, { x: ML+4, y: ty(13,4), size: 7.5, font: hFont, color: navy });
      curY += 14;
    };

    // Single editable text field (no label, no curY advance)
    const mkField = (val, x, fieldY, w, h, multiline) => {
      page.drawRectangle({ x, y: fieldY, width: w, height: h, color: gold, borderColor: sky, borderWidth: 0.5 });
      const f = form.createTextField(fid());
      f.setText(String(val || ''));
      if (multiline) f.enableMultiline();
      f.addToPage(page, { x: x+1, y: fieldY+1, width: w-2, height: h-2, font: rFont });
      f.setFontSize(8);
    };

    // Draw a row of labeled fields and advance curY
    const dataRow = (cols, fh = 12, lh = 8, gap = 3) => {
      checkPage(lh + fh + gap);
      let x = ML;
      cols.forEach(c => {
        page.drawText((c.label||'')+':', { x: x+2, y: ty(lh, lh-3), size: 6, font: hFont, color: navy });
        mkField(c.val, x, ry(lh+fh), c.w, fh, false);
        x += c.w;
      });
      curY += lh + fh + gap;
    };

    // Multi-line text area spanning full width
    const textArea = (val, h) => {
      checkPage(h + 2);
      mkField(val, ML, ry(h), PW, h, true);
      curY += h + 2;
    };

    // Static wrapped text (no field)
    const staticText = (text, sz, indent) => {
      wrap(text, sz, PW - indent - 4).forEach(line => {
        checkPage(sz + 3);
        page.drawText(line, { x: ML+indent, y: ry(sz+3)+2, size: sz, font: rFont, color: blk });
        curY += sz + 3;
      });
    };
    const bulletText = (text, sz) => {
      wrap(text, sz, PW - 12).forEach((line, i) => {
        checkPage(sz + 3);
        if (i === 0) page.drawText('\u2022', { x: ML+4, y: ry(sz+3)+2, size: sz, font: rFont, color: blk });
        page.drawText(line, { x: ML+10, y: ry(sz+3)+2, size: sz, font: rFont, color: blk });
        curY += sz + 3;
      });
    };
    const gap = (h) => { curY += h; };

    // Table: draws header + rows of editable cells, handles page breaks
    const table = (hdrs, rows, cellH) => {
      const drawHdr = () => {
        checkPage(13);
        let x = ML;
        hdrs.forEach(h => {
          page.drawRectangle({ x, y: ry(13), width: h.w, height: 13, color: navy });
          page.drawText(wrap(h.label, 6, h.w-3)[0]||'', { x: x+2, y: ty(13,4), size: 6, font: hFont, color: white });
          x += h.w;
        });
        curY += 14;
      };
      drawHdr();
      rows.forEach(row => {
        if (curY + cellH > PH - MB) { addPage(); drawHdr(); }
        let x = ML;
        hdrs.forEach((h, i) => {
          page.drawRectangle({ x, y: ry(cellH), width: h.w, height: cellH, color: gold, borderColor: sky, borderWidth: 0.3 });
          const f = form.createTextField(fid());
          f.setText(String(row[i]||''));
          f.addToPage(page, { x: x+1, y: ry(cellH)+1, width: h.w-2, height: cellH-2, font: rFont });
          f.setFontSize(7);
          x += h.w;
        });
        curY += cellH + 1;
      });
    };

    // Helpers to read DOM values
    const dv = (id) => document.getElementById(id)?.value?.trim() || '';
    const fd = data.fieldData || {};
    const getYNA = (el) => {
      if (!el) return 'N/A';
      if (el.querySelector('.yna-btn.y.selected'))  return 'Y';
      if (el.querySelector('.yna-btn.n.selected'))  return 'N';
      if (el.querySelector('.yna-btn.na.selected')) return 'N/A';
      return 'N/A';
    };
    const getPF = (cardId, rowIdx, grpIdx) => {
      const rows = document.getElementById(cardId)?.querySelectorAll('.inspect-row') || [];
      return rows[rowIdx]?.querySelectorAll('.pf-group')[grpIdx]?.querySelector('.pf-btn.selected')?.textContent?.trim() || '';
    };
    // Returns [leftBoxVal, rightBoxVal] routing FAIL to the right box, PASS/other to the left
    const pfBoxes = (cardId, rowIdx) => {
      const rows = document.getElementById(cardId)?.querySelectorAll('.inspect-row') || [];
      const grps = rows[rowIdx]?.querySelectorAll('.pf-group') || [];
      const g0 = grps[0]?.querySelector('.pf-btn.selected')?.textContent?.trim() || '';
      const g1 = grps.length >= 2 ? (grps[1]?.querySelector('.pf-btn.selected')?.textContent?.trim() || '') : null;
      if (g1 !== null) {
        // Two-group row (Present/Operational): if present=N/A, whole row N/A
        if (g0 === 'N/A') return ['N/A', ''];
        // Route operational result: PASS/N/A → left, FAIL → right
        return [g1 !== 'FAIL' ? g1 : '', g1 === 'FAIL' ? 'FAIL' : ''];
      }
      // Single-group: PASS/YES/N/A → left, FAIL → right
      return [g0 !== 'FAIL' ? g0 : '', g0 === 'FAIL' ? 'FAIL' : ''];
    };

    // Collect device table rows — query DOM directly so gaps from deletions are handled
    const collectRows = (prefix, fields) =>
      [...document.querySelectorAll(`[id^="${prefix}-row-"]`)].map(row => {
        const n = row.id.slice((prefix + '-row-').length);
        return fields.map(f => dv(f + '-' + n));
      });
    const detRows    = collectRows('fa-det',    ['fa-det-type','fa-det-loc','fa-det-scan','fa-det-addr','fa-det-alarm','fa-det-sup']);
    const flowRows   = collectRows('fa-flow',   ['fa-flow-type','fa-flow-loc','fa-flow-scan','fa-flow-addr','fa-flow-sup','fa-flow-secs']);
    const tamperRows = collectRows('fa-tamper', ['fa-tamper-type','fa-tamper-loc','fa-tamper-scan','fa-tamper-addr','fa-tamper-sup','fa-tamper-notes']);
    const spRows     = collectRows('fa-sp',     ['fa-sp-loc','fa-sp-make','fa-sp-circuit','fa-sp-amps','fa-sp-lbatt','fa-sp-rbatt','fa-sp-spvsd','fa-sp-pf']);
    const batRows    = collectRows('fa-bat',    ['fa-bat-size','fa-bat-type','fa-bat-count','fa-bat-loc']);
    const preRows  = [...(document.getElementById('fa-pre-checklist')?.querySelectorAll('.inspect-row')  || [])];
    const postRows = [...(document.getElementById('fa-post-checklist')?.querySelectorAll('.inspect-row') || [])];

    // ── PAGE 1: Header + Property + NFPA ─────────────────────────────────────
    addPage();

    // Red title banner
    const FIRE_RED = rgb(0.72, 0.08, 0.08);
    const titleH = 22;
    page.drawRectangle({ x: ML, y: ry(titleH), width: PW, height: titleH, color: FIRE_RED });
    page.drawText('FIRE ALARM INSPECTION REPORT', { x: ML+PW/2-97, y: ty(titleH,7), size: 13, font: hFont, color: white });
    curY += titleH + 1;

    // Info block: left=logo+company (315pt), right=report type+fields (225pt)
    const iH = 88;
    const divX = ML + 315;
    const rcW = ML + PW - divX;

    // Left background
    page.drawRectangle({ x: ML, y: ry(iH), width: 313, height: iH, color: lgray, borderColor: sky, borderWidth: 0.5 });

    // Load FLPS logo from SVG file → canvas → PNG → pdf-lib
    let logoImg = null;
    try {
      const svgResp = await fetch('logo.svg');
      const svgText = await svgResp.text();
      // Inject explicit dimensions so all browsers render SVG at a known pixel size
      const sizedSvg = svgText.replace('<svg ', '<svg width="400" height="600" ');
      const svgBlob = new Blob([sizedSvg], { type: 'image/svg+xml' });
      const svgUrl  = URL.createObjectURL(svgBlob);
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Step 1: Render full SVG to canvas at 3× scale (guaranteed 400×600 coordinate space)
          const scale = 3;
          const fullCanvas = document.createElement('canvas');
          fullCanvas.width = 400 * scale; fullCanvas.height = 600 * scale;
          fullCanvas.getContext('2d').drawImage(img, 0, 0, fullCanvas.width, fullCanvas.height);
          // Step 2: Crop just the shield+flame (SVG y=0 to y=445, full width)
          const cropW = 400 * scale, cropH = 445 * scale;
          const canvas = document.createElement('canvas');
          canvas.width = cropW; canvas.height = cropH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(fullCanvas, 0, 0, cropW, cropH, 0, 0, cropW, cropH);
          URL.revokeObjectURL(svgUrl);
          const dataUrl = canvas.toDataURL('image/png');
          const b64 = dataUrl.split(',')[1];
          const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
          pdfDoc.embedPng(ab).then(i => { logoImg = i; resolve(); }).catch(resolve);
        };
        img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(); };
        img.src = svgUrl;
      });
    } catch(_) {}

    // Draw logo (transparent PNG — no background square needed)
    if (logoImg) {
      const logoS = 70;
      const dims  = logoImg.scaleToFit(logoS, logoS);
      page.drawImage(logoImg, {
        x: ML + 2,
        y: ry(iH) + (iH - dims.height) / 2,
        width:  dims.width,
        height: dims.height,
      });
    }

    // Company info text
    const compX = ML + 65;
    const compInfo = [
      { t: 'Fire Life Protection System, Inc.', sz: 8.5, f: hFont },
      { t: '8201 Shaffer Parkway Suite B',        sz: 7.5, f: rFont },
      { t: 'Littleton, CO 80127',                sz: 7.5, f: rFont },
      { t: 'Cell: (303) 726-8847  |  Office: (720) 974-1570', sz: 7, f: rFont },
      { t: 'Alan.antonio@firelifeprotectionsystems.com', sz: 7, f: rFont },
    ];
    let clY = ry(iH) + iH - 10;
    compInfo.forEach(l => { page.drawText(l.t, { x: compX, y: clY, size: l.sz, font: l.f, color: navy }); clY -= l.sz + 4; });

    // Right column: ANNUAL/SEMI-ANNUAL/QUARTERLY
    const rtCur = (data.inspection?.reportType || '').toUpperCase();
    const rtBoxH = 15;
    const rtBW = rcW / 3;
    ['ANNUAL','SEMI-ANNUAL','QUARTERLY'].forEach((t, i) => {
      const sel = rtCur === t || (t === 'SEMI-ANNUAL' && (rtCur === 'SEMI ANNUAL' || rtCur.includes('SEMI')));
      const bx = divX + i * rtBW;
      page.drawRectangle({ x: bx, y: ry(iH)+iH-rtBoxH, width: rtBW-1, height: rtBoxH, color: sel ? rgb(1,0.85,0) : white, borderColor: sky, borderWidth: 0.5 });
      page.drawText(t, { x: bx+3, y: ry(iH)+iH-rtBoxH+5, size: 6, font: hFont, color: sel ? rgb(0.4,0.25,0) : navy });
    });

    // Right column: job info fields
    const jFields = [
      ['JOB NUMBER', ''],
      ['PO NUMBER (IF ANY)', ''],
      ['DATE PERFORMED', data.inspection?.date || ''],
      ['INSPECTOR', data.inspection?.inspectorName || ''],
    ];
    let jY = ry(iH) + iH - rtBoxH - 3;
    jFields.forEach(([lbl, val]) => {
      jY -= 7;
      page.drawText(lbl, { x: divX+2, y: jY, size: 5.5, font: hFont, color: navy });
      jY -= 10;
      page.drawRectangle({ x: divX, y: jY, width: rcW, height: 10, color: gold, borderColor: sky, borderWidth: 0.3 });
      const jf = form.createTextField(fid());
      jf.setText(val); jf.addToPage(page, { x: divX+1, y: jY+1, width: rcW-2, height: 8, font: rFont }); jf.setFontSize(7);
      jY -= 2;
    });

    curY += iH + 4;

    // Overall System Status bar — full width, prominently colored
    {
      const stH = 18;
      const stVal = (data.overallStatus || '').toUpperCase();
      const stColor = stVal === 'COMPLIANT' ? rgb(0.06, 0.50, 0.22) :
                      stVal === 'DEFICIENT' ? rgb(0.76, 0.10, 0.10) :
                      stVal === 'IMPAIRED'  ? rgb(0.75, 0.38, 0.00) :
                                              rgb(0.38, 0.44, 0.54);
      page.drawRectangle({ x: ML, y: ry(stH), width: PW, height: stH, color: stColor });
      page.drawText('OVERALL SYSTEM STATUS', { x: ML + 8, y: ty(stH, 6), size: 6.5, font: hFont, color: white });
      page.drawText(stVal || 'PENDING', { x: ML + 130, y: ty(stH, 6), size: 9.5, font: hFont, color: white });
      curY += stH + 4;
    }

    // Property + contact info
    dataRow([{ label: 'BUILDING/PROPERTY NAME', val: data.property?.name || '', w: PW }]);
    dataRow([
      { label: 'SERVICE ADDRESS',    val: data.property?.address || '',     w: PW*0.6 },
      { label: 'CITY / STATE / ZIP', val: data.property?.cityStateZip || '', w: PW*0.4 },
    ]);
    gap(6);
    subHdr('SITE CONTACT INFORMATION');
    dataRow([
      { label: 'PRIMARY CONTACT NAME',  val: data.property?.contact || '',      w: PW/2 },
      { label: 'COMPANY',               val: data.property?.company || '',       w: PW/2 },
    ]);
    dataRow([{ label: 'PRIMARY CONTACT EMAIL', val: data.property?.contactEmail || '', w: PW }]);
    gap(8);
    subHdr('NFPA REFERENCES AND PROCEDURE');
    gap(2);
    [
      'YOUR ENTIRE FIRE ALARM SYSTEM IS REQUIRED TO BE THROUGHLY INSPECTED, TESTED AND MAINTAINED EACH YEAR BY AN APPROVED SERVICING COMPANY IN ACCORDANCE WITH THE FOLLOWING NFPA CHAPTER REFERENCES:',
      'CHAPTER 14 OF NFPA 72 (SEE NFPA 72(10), TABLES 14.3.1 AND 14.4.5; SEE ALSO: NFPA 90A(12), SEC.6.4.1).',
      'TESTING MUST INCLUDE CONTROL EQUIPMENT, REMOTE ANNUNCIATORS, INITIATING DEVICES, HVAC SHUTDOWN DEVICES AND ALARM NOTIFICATION APPLIANCES. SEE THE BELOW LIST OF VARIOUS TESTING DEVICES:',
    ].forEach(p => { staticText(p, 6.5, 2); gap(2); });
    [
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
    ].forEach(b => bulletText(b, 6.5));
    gap(4);

    // ── PAGE 2: Panel + Monitoring + Checklists ───────────────────────────────
    addPage();
    secHdr('MAIN FIRE ALARM CONTROL PANEL & MONITORING INFORMATION');
    subHdr('CONTROL PANEL SPECIFICATION');
    dataRow([
      { label:'MAKE',        val: fd['fa-cp-make'],      w: PW/4 },
      { label:'MODEL',       val: fd['fa-cp-model'],     w: PW/4 },
      { label:'LOCATION',    val: fd['fa-cp-location'],  w: PW/4 },
      { label:'TYPE',        val: fd['fa-cp-type'],      w: PW/4 },
    ]);
    dataRow([
      { label:'SERIAL #',       val: fd['fa-cp-serial'],    w: PW/3 },
      { label:'# ZONES/LOOPS',  val: fd['fa-cp-zones'],     w: PW/3 },
      { label:'YEAR INSTALLED', val: fd['fa-cp-year'],      w: PW/3 },
    ]);
    dataRow([
      { label:'BATTERY INSTALL DATE', val: fd['fa-cp-batt-date'], w: PW/2 },
    ]);
    subHdr('DIALER/RADIO SPECIFICATIONS');
    dataRow([
      { label:'MAKE',  val: fd['fa-dr-make'],  w: PW/4 },
      { label:'MODEL', val: fd['fa-dr-model'], w: PW/4 },
      { label:'TYPE',  val: fd['fa-dr-type'],  w: PW/4 },
      { label:'LOCATION', val: '',             w: PW/4 },
    ]);
    subHdr('PANEL TESTING / DISABLE INSTRUCTIONS');
    textArea(fd['fa-panel-instructions'], 35);
    subHdr('MONITORING SPECIFICATIONS');
    dataRow([
      { label:'IS SYSTEM MONITORED?',  val: fd['fa-monitored'],        w: PW/4 },
      { label:'MONITORING COMPANY',    val: fd['fa-monitor-company'],   w: PW/4 },
      { label:'PHONE',                 val: fd['fa-monitor-phone'],     w: PW/4 },
      { label:'ACCOUNT #',             val: fd['fa-monitor-account'],   w: PW/4 },
    ]);
    dataRow([
      { label:'TIME OFFLINE', val: fd['fa-monitor-offline'], w: PW/3 },
      { label:'TIME ONLINE',  val: fd['fa-monitor-online'],  w: PW/3 },
      { label:'NOTES',        val: fd['fa-monitor-notes'],   w: PW/3 },
    ]);
    gap(4);
    subHdr('PRE & POST INSPECTION CHECKLIST');
    const preLabels  = ['CHECK IN WITH THE ENGINEER?','WERE KEYS PROVIDED?','ALL FIRE EQUIPMENT IN WORKING ORDER?','PANEL SHOWING "NORMAL" UPON ARRIVAL?','PANEL TAKEN OFFLINE/DISABLED?','ALL LAMPS/LEDs/LCDs FUNCTIONING?','ALL FUSES IN GOOD CONDITION/FUNCTIONAL'];
    const postLabels = ['SIGNALS RECEIVED AT CENTRAL STATION?','PANEL "NORMAL" STATE UPON DEPARTURE?','PANEL REENABLED & PLACED ONLINE?','APPLICABLE DEVICE TAGS UPDATED?','CHECKOUT WITH ENG/KEYS RETURNED','CUSTOMER NOTIFIED OF DEFICIENCIES?','FCC LEFT CLEAN & ORGANIZED?'];
    for (let i = 0; i < preLabels.length; i++) {
      checkPage(20);
      const halfW = PW / 2 - 5;
      // Pre (left)
      const pLines = wrap(preLabels[i], 6, halfW - 38);
      pLines.forEach((l, li) => page.drawText(l, { x: ML+2, y: ry(16)+(pLines.length-1-li)*8+4, size: 6, font: rFont, color: blk }));
      mkField(getYNA(preRows[i]), ML+halfW-32, ry(14)+1, 30, 12, false);
      // Post (right)
      const poLines = wrap(postLabels[i]||'', 6, halfW - 38);
      poLines.forEach((l, li) => page.drawText(l, { x: ML+halfW+8, y: ry(16)+(poLines.length-1-li)*8+4, size: 6, font: rFont, color: blk }));
      mkField(getYNA(postRows[i]), ML+PW-32, ry(14)+1, 30, 12, false);
      curY += 17;
    }

    // ── PAGE 3: Device Testing Summary + On-Site Notes ────────────────────────
    addPage();
    secHdr('DEVICE/SIGNAL TESTING SUMMARY');
    const PDF_FA_DEVICES = [
      ['Smoke Detector','SD'],['Combo Smoke/CO2/Other','CBO'],['Heat Detector','HD'],
      ['Manual Pull Station','PS'],['Duct Detector','DD'],['Beam Detector','BD'],
      ['CO2 Detector','CO'],['Wet Flow Switch','FS'],['Dry Pressure Switch','PRS'],
      ['Tamper Switch','TS'],['Low Air Switch','LA'],['High Air Switch','HA'],
      ['Power Supply','PWR'],['Batteries','BAT'],['Annunciator','ANN'],
      ['Elevator Recall Bank','ELV'],['Phone Jack','PJ'],['Fire Phone','FP'],['Other (Specify)',''],
    ];
    const sumData = {};
    PDF_FA_DEVICES.forEach((d, i) => {
      const id = 'fa-dev-' + i;
      sumData[d[1]] = {
        total:   document.getElementById(id+'-total')?.value || '',
        passN:   document.getElementById(id+'-pass')?.value  || '',
        failN:   document.getElementById(id+'-fail')?.value  || '',
        passPct: document.getElementById(id+'-pct-pass')?.textContent?.trim() || '',
        failPct: document.getElementById(id+'-pct-fail')?.textContent?.trim() || '',
        nt:      document.getElementById(id+'-nt')?.value    || '',
        nf:      document.getElementById(id+'-nf')?.value    || '',
        notes:   document.getElementById(id+'-notes')?.value || '',
      };
    });
    const sumCols = [
      {label:'DEVICES/SIGNALS/SYSTEMS',w:120},{label:'KEY',w:30},{label:'TOTAL',w:40},
      {label:'PASS #',w:40},{label:'FAIL #',w:40},{label:'PASS %',w:40},{label:'FAIL %',w:40},
      {label:'NT',w:30},{label:'NF',w:30},{label:'NOTES',w:130},
    ]; // 540
    table(sumCols, PDF_FA_DEVICES.map(([name,key]) => {
      const d = sumData[key] || {};
      return [name,key,d.total||'',d.passN||'',d.failN||'',d.passPct||'',d.failPct||'',d.nt||'',d.nf||'',d.notes||''];
    }), 13);
    gap(6);
    subHdr('ON SITE SYSTEM NOTES');
    table(
      [{label:'EQUIPMENT',w:130},{label:'CONDITION',w:130},{label:'NOTES & OBSERVATIONS',w:280}],
      [1,2,3,4,5].map(n => {
        const row = document.getElementById('fa-onsite-row-'+n);
        const cond = row?.querySelector('.pf-btn.selected')?.textContent?.trim() || '';
        return [dv('fa-onsite-eq-'+n), cond, dv('fa-onsite-notes-'+n)];
      }),
      14
    );

    // ── PAGE 4: AV / Door / HVAC + Additional Notes ───────────────────────────
    addPage();
    secHdr('AUXILIARY SYSTEM INFORMATION & INSPECTION RESULTS');
    subHdr('AUDIO/VISUAL FUNCTIONALITY - ANNUAL ONLY');
    [
      'VISUAL NOTIFICATION PRESENT? (TO INCLUDE STROBES & COMBOS)',
      'IF PRESENT - WHEN IN ALARM, LIGHTING IS SYNCHRONIZED?',
      'IF PRESENT - ALL LIGHTING APPLIANCES ARE UNOBSTRUCTED AND CLEARLY VISIBLE?',
      'AUDIBLE NOTIFICATION PRESENT? (TO INCLUDE BELLS, CHIMES, & HORNS & COMBOS)',
    ].forEach((lbl, i) => {
      checkPage(18);
      const [v1, v2] = pfBoxes('fa-av-card', i);
      wrap(lbl,6.5,PW-84).forEach((l,li,arr) => page.drawText(l, { x:ML+2, y:ry(16)+(arr.length-1-li)*8+4, size:6.5, font:rFont, color:blk }));
      mkField(v1, ML+PW-80, ry(14)+1, 36, 12, false);
      mkField(v2, ML+PW-42, ry(14)+1, 36, 12, false);
      curY += 17;
    });
    dataRow([{ label:'A/V NOTES', val: dv('fa-av-notes'), w: PW }], 16, 8, 3);
    gap(4);
    subHdr('DOOR HOLDER FUNCTIONALITY - ANNUAL ONLY');
    [
      'DOOR HOLDER HARDWARE PRESENT (TO INCLUDE MAGNETIC LOCKS, CARD ACCESS)',
      'IF PRESENT - ALL DOOR HARDWARE FREE FROM DAMAGE?',
      'IF PRESENT - ALL DOOR RELEASE AND CLOSE AS INTENDED UPON ALARM ACTIVATION?',
    ].forEach((lbl, i) => {
      checkPage(18);
      const [v1, v2] = pfBoxes('fa-door-card', i);
      wrap(lbl,6.5,PW-84).forEach((l,li,arr) => page.drawText(l, { x:ML+2, y:ry(16)+(arr.length-1-li)*8+4, size:6.5, font:rFont, color:blk }));
      mkField(v1, ML+PW-80, ry(14)+1, 36, 12, false);
      mkField(v2, ML+PW-42, ry(14)+1, 36, 12, false);
      curY += 17;
    });
    dataRow([{ label:'DOOR HOLDER NOTES', val: dv('fa-door-notes'), w: PW }], 16, 8, 3);
    gap(4);
    subHdr('HVAC CONTROL - ANNUAL ONLY');
    checkPage(18);
    {
      const [v1, v2] = pfBoxes('fa-hvac-card', 0);
      page.drawText('HVAC SHUT DOWN PRESENT?', { x:ML+2, y:ry(16)+4, size:6.5, font:rFont, color:blk });
      mkField(v1, ML+PW-80, ry(14)+1, 36, 12, false);
      mkField(v2, ML+PW-42, ry(14)+1, 36, 12, false);
      curY += 17;
    }
    dataRow([
      { label:'HVAC METHOD', val: dv('fa-hvac-method'), w: PW/2 },
      { label:'HVAC NOTES',  val: dv('fa-hvac-notes'),  w: PW/2 },
    ]);
    gap(6);
    subHdr('ADDITIONAL NOTES/OBSERVATIONS/SITE SPECIFIC NOTES');
    const onsiteNotesEl = document.getElementById('fa-onsite-notes-text');
    textArea(onsiteNotesEl?.value?.trim() || '', 50);

    // ── PAGE 5: Sub Panel ─────────────────────────────────────────────────────
    addPage();
    secHdr('SUB PANEL / POWER SUPPLY INFORMATION');
    while (spRows.length < 15) spRows.push(Array(8).fill(''));
    table(
      [{label:'LOCATION',w:80},{label:'MAKE',w:60},{label:'CIRCUIT',w:55},{label:'AMPS',w:45},
       {label:'L BATT',w:50},{label:'R BATT',w:50},{label:'SPVSD?',w:50},{label:'PASS/FAIL',w:50},{label:'NOTES',w:100}],
      spRows.map(r => [...r, '']), 13
    );

    // ── PAGE 6: Detection Devices ─────────────────────────────────────────────
    addPage();
    secHdr('(LEVEL) (FLOOR/LOCATION) DEVICES — FIRE DETECTION');
    while (detRows.length < 20) detRows.push(Array(6).fill(''));
    table(
      [{label:'TYPE',w:60},{label:'LOCATION',w:200},{label:'SCAN ID',w:60},{label:'ADDRESS',w:60},{label:'ALARM',w:80},{label:'SUPERVISORY',w:80}],
      detRows, 13
    );

    // ── PAGE 7: Flow Switches ─────────────────────────────────────────────────
    addPage();
    secHdr('FLOW SWITCHES (SPRINKLER SYSTEMS)');
    while (flowRows.length < 20) flowRows.push(Array(6).fill(''));
    table(
      [{label:'TYPE',w:60},{label:'LOCATION',w:200},{label:'SCAN ID',w:60},{label:'ADDRESS',w:60},{label:'SUPERVISORY',w:80},{label:'SECONDS',w:80}],
      flowRows, 13
    );

    // ── PAGE 8: Tamper Switches ───────────────────────────────────────────────
    addPage();
    secHdr('TAMPER SWITCHES (SPRINKLER SYSTEMS)');
    while (tamperRows.length < 20) tamperRows.push(Array(6).fill(''));
    table(
      [{label:'TYPE',w:60},{label:'LOCATION',w:200},{label:'SCAN ID',w:60},{label:'ADDRESS',w:60},{label:'SUPERVISORY',w:80},{label:'NOTES',w:80}],
      tamperRows, 13
    );

    // ── PAGE 9: Deficiency + Batteries + Notes + Signatures ───────────────────
    addPage();
    secHdr('DEFICIENCY LIST & PROPOSED SOLUTIONS');
    const deficList = [];
    document.querySelectorAll('#fa-defic-tbody tr').forEach((r, i) => {
      deficList.push([String(i+1), r.querySelector('td:nth-child(2) input')?.value?.trim()||'', '']);
    });
    (data.deficiencies||[]).forEach((d,i) => {
      if (!deficList.find(r => r[1]===d.item)) deficList.push([String(deficList.length+1), d.item||'', '']);
    });
    while (deficList.length < 10) deficList.push(Array(3).fill(''));
    table(
      [{label:'#',w:25},{label:'DEFICIENCY & PROPOSED SOLUTIONS',w:425},{label:'MAKE/MODEL',w:90}],
      deficList, 14
    );
    gap(6);
    subHdr('FAILED BATTERIES (IF APPLICABLE)');
    while (batRows.length < 4) batRows.push(Array(4).fill(''));
    const batPairs = [];
    for (let i = 0; i < batRows.length; i+=2) {
      batPairs.push([...(batRows[i]||Array(4).fill('')), ...(batRows[i+1]||Array(4).fill(''))]);
    }
    while (batPairs.length < 3) batPairs.push(Array(8).fill(''));
    table(
      [{label:'SIZE (AH)',w:68},{label:'TYPE',w:68},{label:'COUNT',w:67},{label:'LOCATIONS',w:67},
       {label:'SIZE (AH)',w:68},{label:'TYPE',w:68},{label:'COUNT',w:67},{label:'LOCATIONS',w:67}],
      batPairs, 14
    );
    gap(6);
    subHdr('GENERAL NOTES & SITE OBSERVATIONS');
    const notesList = [];
    document.querySelectorAll('#fa-notes-tbody tr').forEach((r, i) => {
      const txt = r.querySelector('td:nth-child(2) input')?.value?.trim()||'';
      notesList.push([String(i+1), txt]);
    });
    while (notesList.length < 3) notesList.push(['','']);
    table([{label:'#',w:25},{label:'NOTE',w:515}], notesList, 14);
    gap(10);
    // Signatures
    checkPage(60);
    const sigH = 35, sigW = PW/2-10;
    page.drawRectangle({ x:ML, y:ry(sigH), width:sigW, height:sigH, color:lgray, borderColor:navy, borderWidth:0.5 });
    page.drawText('INSPECTOR SIGNATURE:', { x:ML+3, y:ry(sigH)+sigH-8, size:7, font:hFont, color:navy });
    if (sigHasData) {
      try {
        const sc  = document.getElementById('sig-canvas');
        const b64 = sc.toDataURL('image/png').split(',')[1];
        const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
        const sImg  = await pdfDoc.embedPng(ab);
        const sDims = sImg.scaleToFit(sigW - 8, sigH - 14);
        page.drawImage(sImg, { x: ML + 4, y: ry(sigH) + 3, width: sDims.width, height: sDims.height });
      } catch(_) {}
    } else {
      const sf = form.createTextField(fid());
      sf.setText(data.signature?.name||'');
      sf.addToPage(page, { x:ML+2, y:ry(sigH)+2, width:sigW-4, height:sigH-12, font: rFont });
      sf.setFontSize(9);
    }
    page.drawRectangle({ x:ML+PW/2+10, y:ry(sigH), width:sigW, height:sigH, color:lgray, borderColor:navy, borderWidth:0.5 });
    page.drawText('CLIENT SIGNATURE:', { x:ML+PW/2+13, y:ry(sigH)+sigH-8, size:7, font:hFont, color:navy });
    if (custSigHasData) {
      try {
        const cc  = document.getElementById('cust-sig-canvas');
        const b64 = cc.toDataURL('image/png').split(',')[1];
        const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
        const cImg  = await pdfDoc.embedPng(ab);
        const cDims = cImg.scaleToFit(sigW - 8, sigH - 14);
        page.drawImage(cImg, { x: ML+PW/2+14, y: ry(sigH) + 3, width: cDims.width, height: cDims.height });
      } catch(_) {}
    } else {
      const cf = form.createTextField(fid());
      cf.setText('');
      cf.addToPage(page, { x:ML+PW/2+12, y:ry(sigH)+2, width:sigW-4, height:sigH-12, font: rFont });
      cf.setFontSize(9);
    }
    curY += sigH + 4;
    dataRow([
      { label:'INSPECTOR DATE', val: data.signature?.date || data.inspection?.date || '', w: PW/2 },
      { label:'CLIENT DATE',    val: '', w: PW/2 },
    ]);

    // ── Photos page ───────────────────────────────────────────────────────────
    if (inspectionPhotos.length > 0) {
      addPage();
      secHdr('INSPECTION PHOTOS');
      const photoW = Math.floor((PW - 10) / 2);
      const photoH = 140;
      let col = 0;
      for (let i = 0; i < inspectionPhotos.length; i++) {
        const photo = inspectionPhotos[i];
        checkPage(photoH + 30);
        const px = ML + col * (photoW + 10);
        try {
          const b64 = photo.dataUrl.split(',')[1];
          const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
          const img = photo.dataUrl.startsWith('data:image/png')
            ? await pdfDoc.embedPng(ab)
            : await pdfDoc.embedJpg(ab);
          const dims = img.scaleToFit(photoW, photoH);
          page.drawImage(img, { x: px, y: ry(photoH) + (photoH - dims.height), width: dims.width, height: dims.height });
        } catch(_) {
          page.drawRectangle({ x: px, y: ry(photoH), width: photoW, height: photoH, color: rgb(0.93,0.93,0.93) });
          page.drawText('Image unavailable', { x: px + photoW/2 - 30, y: ry(photoH) + photoH/2, size: 8, font: rFont, color: rgb(0.5,0.5,0.5) });
        }
        // Photo number badge
        page.drawRectangle({ x: px+2, y: ry(photoH)+photoH-14, width: 40, height: 12, color: rgb(0,0,0) });
        page.drawText('Photo ' + (i+1), { x: px+4, y: ry(photoH)+photoH-7, size: 7, font: hFont, color: white });
        // Note below photo
        if (photo.note) {
          const noteLines = wrap(photo.note, 7, photoW);
          noteLines.forEach((l, li) => {
            page.drawText(l, { x: px, y: ry(photoH) - 10 - li * 9, size: 7, font: rFont, color: blk });
          });
        }
        col++;
        if (col >= 2) { col = 0; curY += photoH + 22; }
      }
      if (col > 0) curY += photoH + 22;
    }

    // Return bytes to caller
    return await pdfDoc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// KITCHEN HOOD SUPPRESSION PDF — fire-alarm-style editable format
// ─────────────────────────────────────────────────────────────────────────────
async function buildHoodPDFBytes() {
  if (!window.PDFLib) throw new Error('PDF library not loaded. Please refresh.');
  const data = collectAllData();
  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const form   = pdfDoc.getForm();
  const hFont  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const rFont  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const W = 612, PH = 792, ML = 36, PW = 540, MT = 36, MB = 36;
  let page, curY, _fid = 0;
  const fid = () => 'hood_' + (++_fid);

  const FIRE_RED = rgb(0.72, 0.08, 0.08);
  const amber  = rgb(0.85, 0.47, 0.00);
  const navy   = rgb(0.13, 0.21, 0.42);
  const sky    = rgb(0.71, 0.80, 0.93);
  const gold   = rgb(1.0,  1.0,  0.75);
  const lgray  = rgb(0.94, 0.94, 0.94);
  const white  = rgb(1, 1, 1);
  const blk    = rgb(0, 0, 0);
  const green  = rgb(0.06, 0.50, 0.22);
  const red    = rgb(0.76, 0.10, 0.10);
  const slate  = rgb(0.39, 0.45, 0.55);

  const addPage = () => { page = pdfDoc.addPage([W, PH]); curY = MT; };
  const ry = (h) => PH - curY - h;
  const ty = (h, a = 3) => PH - curY - h + a;
  const checkPage = (needed) => { if (curY + needed > PH - MB) addPage(); };
  const gap = (h) => { curY += h; };

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

  const secHdr = (title) => {
    checkPage(18);
    page.drawRectangle({ x: ML, y: ry(17), width: PW, height: 17, color: navy });
    page.drawText(title, { x: ML+4, y: ty(17,5), size: 9, font: hFont, color: white });
    curY += 18;
  };
  const subHdr = (title) => {
    checkPage(14);
    page.drawRectangle({ x: ML, y: ry(13), width: PW, height: 13, color: sky });
    page.drawText(title, { x: ML+4, y: ty(13,4), size: 7.5, font: hFont, color: navy });
    curY += 14;
  };
  const mkField = (val, x, fieldY, w, h, multiline) => {
    page.drawRectangle({ x, y: fieldY, width: w, height: h, color: gold, borderColor: sky, borderWidth: 0.5 });
    const f = form.createTextField(fid());
    f.setText(String(val || ''));
    if (multiline) f.enableMultiline();
    f.addToPage(page, { x: x+1, y: fieldY+1, width: w-2, height: h-2, font: rFont });
    f.setFontSize(8);
  };
  const dataRow = (cols, fh = 12, lh = 8, gp = 3) => {
    checkPage(lh + fh + gp);
    let x = ML;
    cols.forEach(c => {
      page.drawText((c.label||'')+':', { x: x+2, y: ty(lh, lh-3), size: 6, font: hFont, color: navy });
      mkField(c.val, x, ry(lh+fh), c.w, fh, false);
      x += c.w;
    });
    curY += lh + fh + gp;
  };

  const dv = (id) => document.getElementById(id)?.value?.trim() || '';
  const fd = data.fieldData || {};

  // ── PAGE 1: HEADER ─────────────────────────────────────────────────────────
  addPage();

  // Red title banner
  page.drawRectangle({ x: ML, y: ry(22), width: PW, height: 22, color: FIRE_RED });
  page.drawText('KITCHEN HOOD SUPPRESSION INSPECTION REPORT', {
    x: ML + PW/2 - hFont.widthOfTextAtSize('KITCHEN HOOD SUPPRESSION INSPECTION REPORT', 12)/2,
    y: ty(22, 7), size: 12, font: hFont, color: white
  });
  curY += 23;

  // Info block: left = logo + company (315pt), right = report type + fields (225pt)
  const iH = 88;
  const divX = ML + 315;
  const rcW  = ML + PW - divX;

  page.drawRectangle({ x: ML, y: ry(iH), width: 313, height: iH, color: lgray, borderColor: sky, borderWidth: 0.5 });

  // Logo
  try {
    const svgText = await fetch('logo.svg').then(r => r.text());
    const sizedSvg = svgText.replace('<svg ', '<svg width="400" height="600" ');
    const svgBlob = new Blob([sizedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    await new Promise((resolve) => {
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
        const logoDims = logoImg.scaleToFit(60, 60);
        page.drawImage(logoImg, { x: ML+4, y: ry(iH)+(iH-logoDims.height)/2, width: logoDims.width, height: logoDims.height });
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    });
  } catch(_) {}

  // Company info
  const compX = ML + 70;
  const compInfo = [
    { t: 'Fire Life Protection System, Inc.', sz: 8, f: hFont },
    { t: '8201 Shaffer Parkway Suite B',       sz: 7.5, f: rFont },
    { t: 'Littleton, CO 80127',                sz: 7.5, f: rFont },
    { t: 'Cell: (303) 726-8847  |  Office: (720) 974-1570', sz: 7, f: rFont },
    { t: 'Alan.antonio@firelifeprotectionsystems.com',       sz: 7, f: rFont },
  ];
  let clY = ry(iH) + iH - 10;
  compInfo.forEach(l => { page.drawText(l.t, { x: compX, y: clY, size: l.sz, font: l.f, color: navy }); clY -= l.sz + 4; });

  // Right column: ANNUAL / SEMI-ANNUAL
  const rtCur = (data.inspection?.reportType || '').toUpperCase();
  const rtBoxH = 15;
  const rtBW = rcW / 2;
  ['ANNUAL', 'SEMI-ANNUAL'].forEach((t, i) => {
    const sel = rtCur === t || (t === 'SEMI-ANNUAL' && rtCur.includes('SEMI'));
    const bx = divX + i * rtBW;
    page.drawRectangle({ x: bx, y: ry(iH)+iH-rtBoxH, width: rtBW-1, height: rtBoxH, color: sel ? rgb(1,0.85,0) : white, borderColor: sky, borderWidth: 0.5 });
    page.drawText(t, { x: bx+3, y: ry(iH)+iH-rtBoxH+5, size: 6, font: hFont, color: sel ? rgb(0.4,0.25,0) : navy });
  });

  const jFields = [
    ['DATE PERFORMED', data.inspection?.date || ''],
    ['INSPECTOR',      data.inspection?.inspectorName || ''],
    ['LICENSE / CERT', data.inspection?.inspectorCert || ''],
    ['NFPA REFERENCE', 'NFPA 17A'],
  ];
  let jY = ry(iH) + iH - rtBoxH - 3;
  jFields.forEach(([lbl, val]) => {
    jY -= 7;
    page.drawText(lbl, { x: divX+2, y: jY, size: 5.5, font: hFont, color: navy });
    jY -= 10;
    page.drawRectangle({ x: divX, y: jY, width: rcW, height: 10, color: gold, borderColor: sky, borderWidth: 0.3 });
    const jf = form.createTextField(fid());
    jf.setText(val);
    jf.addToPage(page, { x: divX+1, y: jY+1, width: rcW-2, height: 8, font: rFont });
    jf.setFontSize(7);
    jY -= 2;
  });
  curY += iH + 4;

  // Hood identifier bar
  const hoodId = data.hoodIdentifier || activeHoodIdentifier || '';
  checkPage(22);
  page.drawRectangle({ x: ML, y: ry(18), width: PW, height: 18, color: amber });
  page.drawText('HOOD IDENTIFIER:', { x: ML+8, y: ty(18,6), size: 7, font: hFont, color: white });
  page.drawText(hoodId || '(not specified)', { x: ML+100, y: ty(18,6), size: 9, font: hFont, color: white });
  curY += 18;
  gap(2);

  // Overall status bar
  const stVal = (data.overallStatus || '').toUpperCase();
  const stColor = stVal === 'COMPLIANT' ? green : stVal === 'DEFICIENT' ? red : stVal === 'IMPAIRED' ? amber : slate;
  checkPage(22);
  page.drawRectangle({ x: ML, y: ry(18), width: PW, height: 18, color: stColor });
  page.drawText('OVERALL SYSTEM STATUS', { x: ML+8, y: ty(18,6), size: 6.5, font: hFont, color: white });
  page.drawText(stVal || 'PENDING', { x: ML+130, y: ty(18,6), size: 9.5, font: hFont, color: white });
  curY += 18;
  gap(6);

  // Property info
  dataRow([{ label: 'BUILDING / PROPERTY NAME', val: data.property?.name || '', w: PW }]);
  dataRow([
    { label: 'SERVICE ADDRESS',    val: data.property?.address || '',      w: PW * 0.6 },
    { label: 'CITY / STATE / ZIP', val: data.property?.cityStateZip || '', w: PW * 0.4 },
  ]);
  dataRow([
    { label: 'PROPERTY CONTACT', val: data.property?.contact || '',      w: PW / 2 },
    { label: 'COMPANY',          val: data.property?.company || '',       w: PW / 2 },
  ]);
  gap(6);

  // Deficiencies
  if (data.deficiencies.length > 0) {
    secHdr('DEFICIENCIES — ' + data.deficiencies.length + ' ITEM(S)');
    data.deficiencies.forEach(d => {
      const text = d.item + (d.description ? ': ' + d.description : '');
      const defRowH = 18;
      checkPage(defRowH + 2);
      page.drawRectangle({ x: ML, y: ry(defRowH), width: PW, height: defRowH, color: rgb(0.99, 0.93, 0.93), borderColor: red, borderWidth: 0.5 });
      page.drawText('\u2022', { x: ML+4, y: ry(defRowH) + defRowH/2 + 2, size: 8, font: hFont, color: red });
      const df = form.createTextField(fid());
      df.setText(text);
      df.addToPage(page, { x: ML+14, y: ry(defRowH)+2, width: PW-16, height: defRowH-4, font: rFont });
      df.setFontSize(8);
      curY += defRowH + 3;
    });
    gap(4);
  }

  // System Information
  secHdr('SYSTEM INFORMATION');
  gap(4);
  dataRow([
    { label: 'MANUFACTURER',      val: fd['hood-mfr']   || '', w: 180 },
    { label: 'MODEL / CYLINDER #', val: fd['hood-model'] || '', w: 180 },
    { label: 'YEAR INSTALLED',    val: fd['hood-install']|| '', w: 180 },
  ]);
  dataRow([
    { label: 'SUPPRESSION AGENT TYPE', val: fd['hood-agent']        || '', w: 180 },
    { label: '# OF NOZZLES',           val: fd['hood-nozzle-count'] || '', w: 180 },
    { label: 'LAST SERVICE DATE',      val: fd['hood-last-service'] || '', w: 180 },
  ]);
  dataRow([
    { label: 'KITCHEN EQUIPMENT PROTECTED', val: fd['hood-area']      || '', w: 270 },
    { label: 'APPLIANCE MANUFACTURER',      val: fd['hood-appliance'] || '', w: 270 },
  ]);
  dataRow([
    { label: 'ACTUAL CYLINDER WEIGHT (LBS)', val: fd['hood-cyl-wt-actual'] || '', w: 180 },
    { label: 'MIN ACCEPTABLE WEIGHT (LBS)',  val: fd['hood-cyl-wt-min']    || '', w: 180 },
    { label: 'NEXT SERVICE DUE',             val: fd['hood-next-service']  || '', w: 180 },
  ]);
  dataRow([
    { label: 'TAG COLOR / ID', val: fd['hood-tag-color'] || '', w: 270 },
  ]);
  gap(4);

  // ── Inspection Results ────────────────────────────────────────────────────
  const HOOD_ITEMS = [
    { id: 'hood-cylinder-wt',    section: 'AGENT CYLINDERS & ACTUATION',  label: 'Cylinder Weight / Pressure Check',        note: 'Within manufacturer spec; not expired' },
    { id: 'hood-pull-station',   section: null,                            label: 'Manual Pull Station',                     note: 'Accessible; pin and seal intact' },
    { id: 'hood-auto-detect',    section: null,                            label: 'Fusible Links / Detectors',               note: 'Replaced as required; properly positioned' },
    { id: 'hood-micro-switch',   section: null,                            label: 'Micro-Switch Actuation',                  note: 'Gas shut-off activates on system discharge' },
    { id: 'hood-nozzle-cond',    section: 'NOZZLES & DISTRIBUTION',       label: 'Nozzle Condition',                        note: 'No blockage; proper orientation and caps' },
    { id: 'hood-nozzle-coverage',section: null,                            label: 'Nozzle Coverage',                         note: 'All appliances and plenum protected per design' },
    { id: 'hood-duct-protected', section: null,                            label: 'Duct & Plenum Protection',                note: 'Entire duct and plenum covered' },
    { id: 'hood-gas-shutoff',    section: 'INTERLOCK & SUPPRESSION TEST', label: 'Gas Shutoff Interlock',                   note: 'Gas valve closes on system activation' },
    { id: 'hood-power-shutoff',  section: null,                            label: 'Electrical Interlock',                    note: 'Power to cooking equipment cut on alarm' },
    { id: 'hood-fa-integration', section: null,                            label: 'Fire Alarm Integration',                  note: 'Alarm transmitted to fire alarm panel' },
    { id: 'hood-ansul-reset',    section: null,                            label: 'System Reset Procedure Verified',         note: 'Staff aware of reset; recharge service tag' },
    { id: 'hood-grease-buildup', section: 'HOOD & GREASE MANAGEMENT',     label: 'Grease Buildup — Hood & Filters',         note: 'Excessive grease noted (document)' },
    { id: 'hood-filter-cond',    section: null,                            label: 'Filter Condition & Clearance',            note: 'Filters in place; properly seated' },
    { id: 'hood-service-tag',    section: null,                            label: 'Current Inspection Tag Affixed',          note: 'Tag shows contractor, date, and next due' },
  ];

  secHdr('INSPECTION RESULTS');
  let lastSection = null;
  HOOD_ITEMS.forEach(item => {
    if (item.section && item.section !== lastSection) {
      subHdr(item.section);
      lastSection = item.section;
    }
    const row = document.getElementById('row-' + item.id);
    const result = (row?.dataset.val || '').toUpperCase();
    const deficTxt = document.getElementById('defic-txt-' + item.id)?.value?.trim() || '';
    // rowH=20 so two lines of text (label + note) fit without overflowing into adjacent elements
    const rowH = 20;
    checkPage(rowH + (result === 'FAIL' && deficTxt ? 16 : 0));
    const bg = result === 'PASS' ? rgb(0.94, 0.99, 0.95) : result === 'FAIL' ? rgb(0.99, 0.93, 0.93) : lgray;
    page.drawRectangle({ x: ML, y: ry(rowH), width: PW, height: rowH, color: bg, borderColor: sky, borderWidth: 0.3 });
    // Label — positioned so cap-height stays inside the row rectangle
    page.drawText(item.label, { x: ML+4, y: ty(rowH, rowH-8), size: 7.5, font: rFont, color: navy });
    // Note — smaller text below label
    if (item.note) {
      page.drawText(item.note, { x: ML+4, y: ty(rowH, 5), size: 6, font: rFont, color: slate });
    }
    // Result badge — editable field so inspector can update in reader
    const bW = 36;
    page.drawRectangle({ x: ML+PW-bW-2, y: ry(rowH)+3, width: bW, height: rowH-6, color: result === 'PASS' ? green : result === 'FAIL' ? red : rgb(0.7,0.7,0.7) });
    const badgeField = form.createTextField(fid());
    badgeField.setText(result || 'N/A');
    badgeField.addToPage(page, { x: ML+PW-bW-1, y: ry(rowH)+4, width: bW-2, height: rowH-8, font: hFont });
    badgeField.setFontSize(7);
    curY += rowH + 1;
    if (result === 'FAIL' && deficTxt) {
      // Editable deficiency note row
      const dRowH = 14;
      checkPage(dRowH + 2);
      page.drawRectangle({ x: ML+4, y: ry(dRowH), width: PW-4, height: dRowH, color: rgb(0.99, 0.93, 0.93), borderColor: red, borderWidth: 0.3 });
      const dnf = form.createTextField(fid());
      dnf.setText('Deficiency: ' + deficTxt);
      dnf.addToPage(page, { x: ML+6, y: ry(dRowH)+2, width: PW-8, height: dRowH-4, font: rFont });
      dnf.setFontSize(7);
      curY += dRowH + 2;
    }
  });
  gap(6);

  // Notes — always render as an editable multiline field
  secHdr('NOTES');
  const notesVal = fd['hood-notes'] || dv('hood-notes') || '';
  const notesLineCount = notesVal ? Math.max(3, wrap(notesVal, 8, PW - 8).length) : 3;
  const notesH = Math.min(120, notesLineCount * 12 + 8);
  checkPage(notesH + 4);
  mkField(notesVal, ML, ry(notesH), PW, notesH, true);
  curY += notesH + 6;

  // ── Signatures (same style as fire alarm) ─────────────────────────────────
  checkPage(60);
  secHdr('CERTIFICATION & SIGNATURES');
  gap(4);
  const sigH = 35, sigW = PW / 2 - 10;

  // Inspector sig box
  page.drawRectangle({ x: ML, y: ry(sigH), width: sigW, height: sigH, color: lgray, borderColor: navy, borderWidth: 0.5 });
  page.drawText('INSPECTOR SIGNATURE:', { x: ML+3, y: ry(sigH)+sigH-8, size: 7, font: hFont, color: navy });
  if (sigHasData) {
    try {
      const sc  = document.getElementById('sig-canvas');
      const b64 = sc.toDataURL('image/png').split(',')[1];
      const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
      const sImg  = await pdfDoc.embedPng(ab);
      const sDims = sImg.scaleToFit(sigW - 8, sigH - 14);
      page.drawImage(sImg, { x: ML+4, y: ry(sigH)+3, width: sDims.width, height: sDims.height });
    } catch(_) {}
  } else {
    const sf = form.createTextField(fid());
    sf.setText(data.signature?.name || '');
    sf.addToPage(page, { x: ML+2, y: ry(sigH)+2, width: sigW-4, height: sigH-12, font: rFont });
    sf.setFontSize(9);
  }

  // Client sig box
  page.drawRectangle({ x: ML+PW/2+10, y: ry(sigH), width: sigW, height: sigH, color: lgray, borderColor: navy, borderWidth: 0.5 });
  page.drawText('CLIENT / REPRESENTATIVE SIGNATURE:', { x: ML+PW/2+13, y: ry(sigH)+sigH-8, size: 7, font: hFont, color: navy });
  if (typeof custSigHasData !== 'undefined' && custSigHasData) {
    try {
      const cc  = document.getElementById('cust-sig-canvas');
      const b64 = cc.toDataURL('image/png').split(',')[1];
      const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
      const cImg  = await pdfDoc.embedPng(ab);
      const cDims = cImg.scaleToFit(sigW - 8, sigH - 14);
      page.drawImage(cImg, { x: ML+PW/2+14, y: ry(sigH)+3, width: cDims.width, height: cDims.height });
    } catch(_) {}
  } else {
    const cf = form.createTextField(fid());
    cf.setText('');
    cf.addToPage(page, { x: ML+PW/2+12, y: ry(sigH)+2, width: sigW-4, height: sigH-12, font: rFont });
    cf.setFontSize(9);
  }
  curY += sigH + 4;

  dataRow([
    { label: 'INSPECTOR DATE', val: data.signature?.date || data.inspection?.date || '', w: PW/2 },
    { label: 'CLIENT DATE',    val: '', w: PW/2 },
  ]);
  gap(4);
  dataRow([
    { label: 'INSPECTOR PRINTED NAME', val: data.signature?.name || '', w: PW/2 },
    { label: 'CLIENT PRINTED NAME',    val: dv('cust-sig-name') || '', w: PW/2 },
  ]);

  // ── Photos ────────────────────────────────────────────────────────────────
  if (inspectionPhotos && inspectionPhotos.length > 0) {
    addPage();
    secHdr('INSPECTION PHOTOS');
    const photoW = Math.floor((PW - 10) / 2);
    const photoH = 140;
    let col = 0;
    for (let i = 0; i < inspectionPhotos.length; i++) {
      const photo = inspectionPhotos[i];
      checkPage(photoH + 30);
      const px = ML + col * (photoW + 10);
      try {
        const b64 = photo.dataUrl.split(',')[1];
        const ab  = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
        const img = photo.dataUrl.startsWith('data:image/png')
          ? await pdfDoc.embedPng(ab)
          : await pdfDoc.embedJpg(ab);
        const dims = img.scaleToFit(photoW, photoH);
        page.drawImage(img, { x: px, y: ry(photoH) + (photoH - dims.height), width: dims.width, height: dims.height });
      } catch(_) {
        page.drawRectangle({ x: px, y: ry(photoH), width: photoW, height: photoH, color: rgb(0.93,0.93,0.93) });
        page.drawText('Image unavailable', { x: px+photoW/2-30, y: ry(photoH)+photoH/2, size: 8, font: rFont, color: rgb(0.5,0.5,0.5) });
      }
      page.drawRectangle({ x: px+2, y: ry(photoH)+photoH-14, width: 40, height: 12, color: rgb(0,0,0) });
      page.drawText('Photo ' + (i+1), { x: px+4, y: ry(photoH)+photoH-7, size: 7, font: hFont, color: white });
      if (photo.note) {
        const noteLines = wrap(photo.note, 7, photoW);
        noteLines.forEach((l, li) => {
          page.drawText(l, { x: px, y: ry(photoH) - 10 - li*9, size: 7, font: rFont, color: blk });
        });
      }
      col++;
      if (col >= 2) { col = 0; curY += photoH + 22; }
    }
    if (col > 0) curY += photoH + 22;
  }

  return await pdfDoc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
