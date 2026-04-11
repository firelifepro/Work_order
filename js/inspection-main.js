// ─────────────────────────────────────────────────────────────────────────────
// SAVE & DOWNLOAD  (combined: save JSON to Drive + save PDF to Drive + download)
function startNewInspection() {
  document.getElementById('pdf-status').innerHTML = '';
  document.getElementById('new-insp-btn-wrap').style.display = 'none';
  if (activeInspectionSystem === 'fire-alarm') {
    exitFireAlarmInspection('property');
  } else if (activeInspectionSystem === 'sprinkler') {
    exitSprinklerInspection('property');
  } else {
    // Other system types (extinguisher, hood, etc.) use step-3/step-4 directly
    document.getElementById('step-generic-prevdefic').style.display = 'none';
    document.getElementById('step-3').style.display = 'none';
    document.getElementById('step-4').style.display = 'none';
    document.getElementById('step-nav').style.display = 'flex';
    const prevDeficTab = document.getElementById('step-nav-prevdefic-tab');
    if (prevDeficTab) { prevDeficTab.style.display = 'none'; prevDeficTab.classList.remove('active', 'done'); }
    const summaryTabReset = document.getElementById('step-nav-summary-tab');
    if (summaryTabReset) { summaryTabReset.style.display = 'none'; summaryTabReset.classList.remove('active', 'done'); }
    const extSummaryReset = document.getElementById('step-ext-summary');
    if (extSummaryReset) extSummaryReset.style.display = 'none';
    activeInspectionSystem = null;
    syncMainNavDisabled();
    goStep(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function saveAndDownload() {
  // ── 0. Google Drive connection check ──────────────────────────────────────────
  if (!accessToken) {
    const proceed = confirm('⚠ Not connected to Google Drive — the PDF will download locally but will NOT be saved to Drive, and the property profile will NOT be updated.\n\nConnect via the top bar for full save, or click OK to download locally only.');
    if (!proceed) return;
  }

  // ── 1. Signature check — BOTH drawn signature AND printed name required ───────
  const warnEl = document.getElementById('sig-warning');

  // Auto-fill inspector name ↔ sig-name if either is blank
  const inspNameEl  = document.getElementById('inspector-name');
  const sigNameEl   = document.getElementById('sig-name');
  const inspNameVal = (inspNameEl?.value || '').trim();
  const sigNameVal  = (sigNameEl?.value  || '').trim();
  if (inspNameEl && !inspNameVal && sigNameVal)  inspNameEl.value = sigNameVal;
  if (sigNameEl  && !sigNameVal  && inspNameVal) sigNameEl.value  = inspNameVal;

  // Re-read after potential auto-fill
  const finalSigName = (document.getElementById('sig-name')?.value || '').trim();
  const hasName      = finalSigName.length > 0;
  const hasSig       = sigHasData;

  if (!hasSig || !hasName) {
    // Show specific message based on what's missing
    if (!hasSig && !hasName) {
      if (warnEl) { warnEl.textContent = '⚠ Signature required: please draw your signature AND enter your printed name before saving.'; warnEl.style.display = 'block'; }
    } else if (!hasSig) {
      if (warnEl) { warnEl.textContent = '⚠ Please draw your signature in the signature box — a printed name alone is not sufficient to certify this report.'; warnEl.style.display = 'block'; }
    } else {
      if (warnEl) { warnEl.textContent = '⚠ Please enter your printed name below the signature before saving.'; warnEl.style.display = 'block'; }
    }
    document.getElementById('sig-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (warnEl) warnEl.style.display = 'none';

  // ── 2. Button state ─────────────────────────────────────────────────────────
  const btn = document.getElementById('save-download-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving…'; }
  const statusEl = document.getElementById('pdf-status');
  const setStatus2 = (msg, color) => { if (statusEl) { statusEl.innerHTML += `<div style="color:${color||'inherit'}">${msg}</div>`; } };
  if (statusEl) statusEl.innerHTML = '';
  document.getElementById('new-insp-btn-wrap').style.display = 'none';

  let pdfBytes = null;
  let filename = '';
  let jsonSaveOk = false;

  const downloadPDF = (bytes, name) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  try {
    // ── 3. Build the PDF ───────────────────────────────────────────────────────
    setStatus2('Building PDF…', 'var(--slate)');
    if (activeInspectionSystem === 'sprinkler') {
      pdfBytes = await buildSprinklerPDFBytes();
    } else if (activeInspectionSystem === 'fire-alarm') {
      pdfBytes = await buildEditablePDFBytes();
    } else if (activeInspectionSystem === 'extinguisher') {
      pdfBytes = await buildExtinguisherPDFBytes();
    } else if (activeInspectionSystem === 'exit-sign-lighting') {
      pdfBytes = await buildExitSignLightingPDFBytes();
    } else {
      pdfBytes = await buildGenericSystemPDFBytes();
    }
    const data = collectAllData();
    const propSlug = buildFileSlug(data);
    const dateSlug = data.inspection.date || todayMT();
    const sysSlug  = activeInspectionSystem ? activeInspectionSystem.replace(/-/g, '_') : 'inspection';
    filename = `FLPS_${sysSlug}_${propSlug}_${dateSlug}.pdf`;

    // ── 4. Save JSON inspection data to Drive ──────────────────────────────────
    if (accessToken) {
      try {
        setStatus2('Saving inspection data…', 'var(--slate)');
        const propName = data.property.name || 'Unknown';
        const dateStr  = data.inspection.date || todayMT();
        const jsonFileName = `FLPS_Insp_${sysSlug}_${propSlug}_${dateStr}.json`;
        const folderId = await findOrCreateFolder('FLPS Inspection History', await getFlpsRootFolderId());
        const content = JSON.stringify({ ...data, photos: inspectionPhotos.map(p => ({ note: p.note })) }, null, 2);
        const uploaded = await driveUploadFile(jsonFileName, 'application/json', content, folderId, null);
        await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}?supportsAllDrives=true`, {
          method: 'PATCH',
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ appProperties: {
            flips_insp_property: propName,
            flips_insp_system:   activeInspectionSystem || '',
            flips_insp_date:     dateStr,
            flips_insp_type:     data.inspection.reportType || '',
            flips_insp_status:   data.overallStatus || '',
            flips_insp_inspector:data.inspection.inspectorName || finalSigName || '',
            flips_insp_version:  '3.0'
          }})
        });
        jsonSaveOk = true;
        setStatus2('✓ Inspection data saved to FLPS Inspection History', 'var(--green)');

        // ── 4b. Update property profile ────────────────────────────────────────
        try {
          setStatus2('Updating property profile…', 'var(--slate)');
          await updatePropertyProfileAfterSave(data, activeInspectionSystem);
          setStatus2('✓ Property profile updated', 'var(--green)');
        } catch(e) {
          setStatus2('⚠ Profile update failed: ' + e.message, 'var(--amber)');
        }
      } catch(e) {
        setStatus2('⚠ JSON save failed: ' + e.message + ' (PDF still downloading)', 'var(--amber)');
      }

      // ── 5. Save PDF to Drive ─────────────────────────────────────────────────
      try {
        setStatus2('Saving PDF to Drive…', 'var(--slate)');
        const binary   = Array.from(new Uint8Array(pdfBytes)).map(b => String.fromCharCode(b)).join('');
        const pdfBase64 = btoa(binary);
        const pdfFolderId = await findOrCreateFolder('FLPS Inspection Reports', await getFlpsRootFolderId());
        await driveUploadFile(filename, 'application/pdf', pdfBase64, pdfFolderId, null);
        setStatus2('✓ PDF saved to FLPS Inspection Reports', 'var(--green)');
      } catch(e) {
        setStatus2('⚠ PDF Drive save failed: ' + e.message + ' (still downloading locally)', 'var(--amber)');
      }
    } else {
      setStatus2('⚠ Not connected to Google — skipping Drive saves', 'var(--amber)');
    }

    // ── 6. Download PDF locally ────────────────────────────────────────────────
    downloadPDF(pdfBytes, filename);
    setStatus2(`✓ Downloaded: ${filename}`, 'var(--green)');
    setStatus2('Upload to thecomplianceengine.com to complete reporting.', 'var(--slate)');
    toast('✓ Report saved & downloaded!');

    // ── 7. Clear the draft — inspection is complete ────────────────────────────
    clearDraft();
    document.getElementById('new-insp-btn-wrap').style.display = 'block';

  } catch(e) {
    setStatus2('✗ Error: ' + e.message, 'var(--red)');
    toast('✗ Save failed: ' + e.message);
    if (pdfBytes) { try { downloadPDF(pdfBytes, filename || 'inspection.pdf'); } catch(_) {} }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📄 Save & Download PDF'; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function setStatus(msg, cls) {
  const el = document.getElementById('conn-status');
  el.textContent = cls === 'ok' ? '✓ Google connected' : msg;
  el.className = 'conn-status-pill ' + (cls === 'ok' ? 'ok' : cls === 'err' ? 'err' : 'warn');
  if (cls === 'ok') document.getElementById('conn-drawer').classList.remove('open');
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ─────────────────────────────────────────────────────────────────────────────
// ON LOAD
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  const k = localStorage.getItem('flips_api_key');
  const c = localStorage.getItem('flips_client_id');
  if (k) document.getElementById('api-key').value = k;
  if (c) document.getElementById('client-id').value = c;

  document.getElementById('insp-date').value = todayMT();

  if (k && c) {
    const cachedToken  = localStorage.getItem('flips_access_token');
    const tokenExpiry  = Number(localStorage.getItem('flips_token_expiry')) || 0;
    if (cachedToken && Date.now() < tokenExpiry) {
      accessToken = cachedToken;
      setStatus('✓ Connected', 'ok');
      loadSheet();
    } else {
      setStatus('⚠ Session expired', 'err');
      document.getElementById('conn-drawer').classList.add('open');
    }
  }

  // Load cached client data for dropdown even if token expired
  try {
    const cached = JSON.parse(sessionStorage.getItem('flips_client_cache') || 'null');
    if (cached?.data) { clientData = cached.data; buildDropdown(); }
  } catch(_) {}

  syncMainNavDisabled();

  // Init sig pad when step 4 is visited
  const observer = new MutationObserver(() => {
    if (document.getElementById('step-4').style.display !== 'none') { initSig(); initCustSig(); }
  });
  observer.observe(document.getElementById('step-4'), { attributes: true, attributeFilter: ['style'] });
});
