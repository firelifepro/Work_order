// ─── DRAFT MODAL ──────────────────────────────────────────────────────────────
let _draftModalResumeCallback  = null;
let _draftModalFreshCallback   = null;
let _draftModalDiscardCallback = null;
let _draftModalPendingAction   = null; // 'fresh' | 'discard'

function showDraftModal(draft, isFromDrive, onResume, onFresh, onDiscard) {
  const saved   = new Date(draft.savedAt);
  const label   = saved.toLocaleDateString() + ' at ' + saved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const stepLabel = { panel:'Panel Info', devices:'Devices', aux:'Aux Systems', defic:'Deficiency/Sign' };
  const onStep  = stepLabel[draft.currentFAStep] || draft.currentFAStep || 'Panel Info';
  const source  = isFromDrive ? ' (recovered from Google Drive)' : '';
  document.getElementById('draft-modal-info').innerHTML =
    '<strong>Saved:</strong> ' + label + source + '<br>' +
    '<strong>Last step:</strong> ' + onStep;
  document.getElementById('draft-modal-main').style.display = '';
  document.getElementById('draft-modal-confirm').style.display = 'none';
  _draftModalResumeCallback  = onResume;
  _draftModalFreshCallback   = onFresh;
  _draftModalDiscardCallback = onDiscard;
  const ov = document.getElementById('draft-modal-overlay');
  ov.style.display = 'flex';
}

function _draftModalClose() {
  document.getElementById('draft-modal-overlay').style.display = 'none';
  _draftModalResumeCallback  = null;
  _draftModalFreshCallback   = null;
  _draftModalDiscardCallback = null;
}

function _draftModalResume() {
  const cb = _draftModalResumeCallback;
  _draftModalClose();
  if (cb) cb();
}

function _draftModalFresh() {
  const cb = _draftModalFreshCallback;
  _draftModalClose();
  if (cb) cb();
}

function _draftModalShowConfirm(source) {
  _draftModalPendingAction = source || 'discard';
  const titleEl = document.getElementById('draft-modal-confirm-title');
  const msgEl   = document.getElementById('draft-modal-confirm-msg');
  if (titleEl) titleEl.textContent = source === 'fresh' ? 'Start fresh inspection?' : 'Discard this draft?';
  if (msgEl)   msgEl.textContent   = source === 'fresh'
    ? 'Starting fresh will permanently discard your saved draft. This cannot be undone.'
    : 'This cannot be undone. The saved draft will be permanently deleted.';
  document.getElementById('draft-modal-main').style.display = 'none';
  document.getElementById('draft-modal-confirm').style.display = '';
}

function _draftModalHideConfirm() {
  document.getElementById('draft-modal-main').style.display = '';
  document.getElementById('draft-modal-confirm').style.display = 'none';
}

function _draftModalConfirmAction() {
  const action = _draftModalPendingAction;
  _draftModalPendingAction = null;
  const cb = action === 'fresh' ? _draftModalFreshCallback : _draftModalDiscardCallback;
  _draftModalClose();
  if (cb) cb();
}

// ─── DRAFT SAVE / RESTORE ─────────────────────────────────────────────────────
function draftKey() {
  const propKey = (_currentPropertyAcct || document.getElementById('property-select')?.value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return 'flips_draft_' + propKey + '_' + (activeInspectionSystem || 'unknown');
}

// ─── DRIVE DRAFT BACKUP ───────────────────────────────────────────────────────
// Saves draft to "FLPS Drafts" folder. Called in background after localStorage save.
async function saveDraftToDrive(draft, key) {
  if (!accessToken) return;
  try {
    const folderId = await findOrCreateFolder('FLPS Drafts', await getFlpsRootFolderId());
    const q = `'${folderId}' in parents and appProperties has { key='flips_draft_key' and value='${key}' } and trashed=false`;
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id)`,
      { headers: { 'Authorization': 'Bearer ' + accessToken } }
    );
    const existingId = (await listRes.json()).files?.[0]?.id || null;
    const sysKey    = activeInspectionSystem || 'unknown';
    // Human-readable property name (first line only, stripped of special chars)
    const rawPropName = document.getElementById('property-select')?.value || '';
    const propDisplay = rawPropName.split(/\r\n|\r|\n/)[0].replace(/[^a-zA-Z0-9 ]/g, ' ').trim().slice(0, 50);
    const propSlugHR  = propDisplay.replace(/\s+/g, '_') || _currentPropertyAcct || 'Unknown';
    const sysLabel    = { 'fire-alarm':'FireAlarm','sprinkler':'Sprinkler','fire-pump':'FirePump','hood':'Hood','extinguisher':'Extinguisher','backflow':'Backflow','standpipe':'Standpipe','hydrant':'Hydrant','bda':'BDA','smoke-control':'SmokeControl','gas-detection':'GasDetection','special-suppression':'SpecialSuppression' }[sysKey] || sysKey;
    const datePart    = (draft.savedAt || '').slice(0, 10);
    const fileName    = `FLPS_Draft_${propSlugHR}_${sysLabel}_${datePart}.json`;
    const content     = JSON.stringify(draft, null, 2);
    const uploaded    = await driveUploadFile(fileName, 'application/json', content, folderId, existingId);
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}?supportsAllDrives=true`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ appProperties: {
        flips_draft_key:       key,
        flips_draft_sys:       sysKey,
        flips_draft_prop_name: propDisplay,
        flips_draft_prop_acct: _currentPropertyAcct || '',
        flips_draft_active:    'true',
        flips_draft_saved:     draft.savedAt
      }})
    });
    console.log('[Draft] Backed up to Drive:', fileName);
  } catch(e) {
    console.warn('[Draft] Drive backup failed:', e.message);
  }
}

// Loads an active draft from Drive by key. Returns parsed draft or null.
async function loadDraftFromDrive(key) {
  if (!accessToken) return null;
  try {
    const folderId = await findOrCreateFolder('FLPS Drafts', await getFlpsRootFolderId());
    const q = `'${folderId}' in parents and appProperties has { key='flips_draft_key' and value='${key}' } and appProperties has { key='flips_draft_active' and value='true' } and trashed=false`;
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`,
      { headers: { 'Authorization': 'Bearer ' + accessToken } }
    );
    const file = (await listRes.json()).files?.[0];
    if (!file) return null;
    const dlRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`,
      { headers: { 'Authorization': 'Bearer ' + accessToken } }
    );
    if (!dlRes.ok) return null;
    return await dlRes.json();
  } catch(e) {
    console.warn('[Draft] Drive load failed:', e.message);
    return null;
  }
}

// Marks a Drive draft as inactive (soft-delete — data stays indefinitely for recovery).
async function clearDraftFromDrive(key) {
  if (!accessToken) return;
  try {
    const folderId = await findOrCreateFolder('FLPS Drafts', await getFlpsRootFolderId());
    const q = `'${folderId}' in parents and appProperties has { key='flips_draft_key' and value='${key}' } and trashed=false`;
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id)`,
      { headers: { 'Authorization': 'Bearer ' + accessToken } }
    );
    const fileId = (await listRes.json()).files?.[0]?.id;
    if (!fileId) return;
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ appProperties: { flips_draft_active: 'false' } })
    });
    console.log('[Draft] Drive draft marked inactive');
  } catch(e) {
    console.warn('[Draft] Drive clear failed:', e.message);
  }
}

function saveDraft() {
  if (!activeInspectionSystem) return;
  // Sync current input values into HTML attributes so innerHTML captures them
  const allStepIds = ['step-fa-panel','step-fa-devices','step-fa-aux','step-fa-defic',
                      'step-sp-overview','step-sp-inspection','step-sp-drain','step-sp-defic'];
  allStepIds.forEach(stepId => {
    const div = document.getElementById(stepId);
    if (!div) return;
    div.querySelectorAll('input:not([type=button])').forEach(inp => inp.setAttribute('value', inp.value));
    div.querySelectorAll('textarea').forEach(ta => { ta.textContent = ta.value; });
    div.querySelectorAll('select').forEach(sel => {
      sel.querySelectorAll('option').forEach(opt => {
        if (opt.value === sel.value) opt.setAttribute('selected', ''); else opt.removeAttribute('selected');
      });
    });
  });
  // Capture innerHTML of each step
  const stepHTML = {};
  allStepIds.forEach(id => { stepHTML[id] = document.getElementById(id)?.innerHTML || ''; });
  // Capture sys-forms for non-FA/SP system types
  let sysFormsHTML = '';
  if (!['fire-alarm','sprinkler'].includes(activeInspectionSystem)) {
    const sf = document.getElementById('sys-forms');
    if (sf) {
      sf.querySelectorAll('input:not([type=button])').forEach(inp => inp.setAttribute('value', inp.value));
      sf.querySelectorAll('textarea').forEach(ta => { ta.textContent = ta.value; });
      sf.querySelectorAll('select').forEach(sel => {
        sel.querySelectorAll('option').forEach(opt => {
          if (opt.value === sel.value) opt.setAttribute('selected', ''); else opt.removeAttribute('selected');
        });
      });
      sysFormsHTML = sf.innerHTML;
    }
  }
  // Step-4 text fields (overall status, notes, customer sig fields)
  const step4Fields = {};
  ['overall-status-val','general-notes','cust-sig-name','cust-sig-title','cust-sig-date','sig-name'].forEach(id => {
    step4Fields[id] = document.getElementById(id)?.value || '';
  });
  // FA notes tbody
  const notesTbodyEl = document.getElementById('fa-notes-tbody');
  if (notesTbodyEl) {
    notesTbodyEl.querySelectorAll('input:not([type=button])').forEach(inp => inp.setAttribute('value', inp.value));
  }
  const notesHTML = notesTbodyEl?.innerHTML || '';
  // SP defic + notes tbody
  const spDeficTbodyEl = document.getElementById('sp-defic-tbody');
  if (spDeficTbodyEl) spDeficTbodyEl.querySelectorAll('input:not([type=button])').forEach(inp => inp.setAttribute('value', inp.value));
  const spDeficHTML = spDeficTbodyEl?.innerHTML || '';
  const spNotesTbodyEl = document.getElementById('sp-notes-tbody');
  if (spNotesTbodyEl) spNotesTbodyEl.querySelectorAll('input:not([type=button])').forEach(inp => inp.setAttribute('value', inp.value));
  const spNotesHTML = spNotesTbodyEl?.innerHTML || '';
  // Generic defic tbody
  const genericDeficTbodyEl = document.getElementById('generic-defic-tbody');
  if (genericDeficTbodyEl) genericDeficTbodyEl.querySelectorAll('input:not([type=button])').forEach(inp => inp.setAttribute('value', inp.value));
  const genericDeficHTML = genericDeficTbodyEl?.innerHTML || '';
  // Photos (base64 dataURL + note text)
  const photos = inspectionPhotos.map(p => ({ dataUrl: p.dataUrl, note: p.note }));
  // Signature canvases → dataURL (only if drawn)
  let sigData = null, custSigData = null;
  try {
    const sc = document.getElementById('sig-canvas');
    if (sigHasData && sc) sigData = sc.toDataURL('image/png');
    const cc = document.getElementById('cust-sig-canvas');
    if (custSigHasData && cc) custSigData = cc.toDataURL('image/png');
  } catch(_) {}
  const draft = {
    sysKey:      activeInspectionSystem,
    savedAt:     new Date().toISOString(),
    stepHTML,
    sysFormsHTML,
    step4Fields,
    notesHTML,
    spDeficHTML,
    spNotesHTML,
    genericDeficHTML,
    photos,
    sigData,
    custSigData,
    counters:    { faSubpanelCount, faDetectionCount, faFlowCount, faTamperCount, faBatteryCount, faDeficCount, faNoteCount, spDeficCount, spNoteCount, spDrainCount, genericDeficCount, extUnitCount, extDeficCount, elCount, esCount },
    overallStatus,
    onsiteUnsat: Object.assign({}, _onsiteUnsat),
    currentFAStep,
    currentSPStep
  };
  const key = draftKey();
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    toast('Draft saved');
  } catch(e) {
    toast('Save failed — storage full?');
  }
  // Background Drive backup — does not block the UI
  saveDraftToDrive(draft, key).catch(() => {});
}

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(draftKey())); } catch(e) { return null; }
}

function clearDraft() {
  const key = draftKey();
  localStorage.removeItem(key);
  clearDraftFromDrive(key).catch(() => {});
}

function restoreDraft(draft) {
  // Restore counters
  faSubpanelCount  = draft.counters?.faSubpanelCount  || 0;
  faDetectionCount = draft.counters?.faDetectionCount || 0;
  faFlowCount      = draft.counters?.faFlowCount      || 0;
  faTamperCount    = draft.counters?.faTamperCount    || 0;
  faBatteryCount   = draft.counters?.faBatteryCount   || 0;
  faDeficCount     = draft.counters?.faDeficCount     || 0;
  faNoteCount      = draft.counters?.faNoteCount      || 0;
  // Restore innerHTML (includes button states, dynamic rows, field values via attributes)
  Object.entries(draft.stepHTML || {}).forEach(([id, html]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
  // Restore sys-forms for non-FA/SP system types
  if (draft.sysFormsHTML) {
    const sf = document.getElementById('sys-forms');
    if (sf) sf.innerHTML = draft.sysFormsHTML;
  }
  // Restore step-4 fields
  Object.entries(draft.step4Fields || {}).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  // Restore overall status variable and visual
  if (draft.overallStatus) {
    overallStatus = draft.overallStatus;
    document.querySelectorAll('.ost-btn').forEach(b => {
      if (b.textContent.includes(draft.overallStatus)) b.classList.add('selected');
    });
  }
  // Restore _onsiteUnsat tracking
  Object.assign(_onsiteUnsat, draft.onsiteUnsat || {});
  genericDeficCount = draft.counters?.genericDeficCount || 0;
  extUnitCount = draft.counters?.extUnitCount || 0;
  extDeficCount = draft.counters?.extDeficCount || 0;
  elCount = draft.counters?.elCount || 0;
  esCount = draft.counters?.esCount || 0;
  // Restore general notes tbody (lives in step-4, outside faSteps)
  if (draft.notesHTML !== undefined) {
    const el = document.getElementById('fa-notes-tbody');
    if (el) el.innerHTML = draft.notesHTML;
  }
  // Restore generic defic tbody
  if (draft.genericDeficHTML) {
    const el = document.getElementById('generic-defic-tbody');
    if (el) el.innerHTML = draft.genericDeficHTML;
  }
  // Restore photos
  if (draft.photos?.length) {
    inspectionPhotos.length = 0;
    draft.photos.forEach(p => inspectionPhotos.push({ dataUrl: p.dataUrl, note: p.note || '' }));
    renderPhotoGrid();
  }
  // Restore inspector signature canvas
  if (draft.sigData) {
    initSig();
    const img = new Image();
    img.onload = () => { if (sigCtx) { sigCtx.drawImage(img, 0, 0); sigHasData = true; } };
    img.src = draft.sigData;
  }
  // Restore customer signature canvas
  if (draft.custSigData) {
    initCustSig();
    const img = new Image();
    img.onload = () => { if (custSigCtx) { custSigCtx.drawImage(img, 0, 0); custSigHasData = true; } };
    img.src = draft.custSigData;
  }
  // Rebuild item→panel map since innerHTML was replaced
  buildItemPanelMap();
  updateDeficiencySummary();
  syncDeviceSummary();
  const saved = new Date(draft.savedAt);
  const label = saved.toLocaleDateString() + ' ' + saved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  toast('Draft restored — saved ' + label);
}

function syncSubpanelDefic(n) {
  const descEl = document.getElementById('fa-defic-sp-desc-' + n);
  if (!descEl) return;
  const loc   = document.getElementById('fa-sp-loc-' + n)?.value || 'Sub Panel ' + n;
  const notes = document.getElementById('fa-sp-defic-txt-' + n)?.value || '';
  descEl.value = 'Sub Panel — ' + loc + (notes ? ': ' + notes : '');
}

function initFireAlarmPanel() {
  faSubpanelCount = 0; faDetectionCount = 0; faFlowCount = 0;
  faTamperCount = 0; faBatteryCount = 0; faYNANoteCounter = 0;
  faDeficCount = 0; faNoteCount = 0;
  Object.keys(_onsiteUnsat).forEach(k => delete _onsiteUnsat[k]);
  // Always rebuild device table and checklists (clearFAInspectionState wiped them)
  buildFADeviceTable();
  buildFAChecklists();
  syncDeviceSummary();
}

// ─────────────────────────────────────────────────────────────────────────────

// DRIVE FOLDER MANAGEMENT
// Searches ALL drives (My Drive + Shared Drives) for the folder.
// Creates in the first available Shared Drive if found; falls back to My Drive.
// ─────────────────────────────────────────────────────────────────────────────
const FOLDER_CACHE = {};

async function getSharedDriveId() {
  // Cache the first available Shared Drive ID
  if (FOLDER_CACHE['__sharedDriveId__'] !== undefined) return FOLDER_CACHE['__sharedDriveId__'];
  try {
    const res = await googleFetch(
      'https://www.googleapis.com/drive/v3/drives?pageSize=10&fields=drives(id,name)'
    );
    if (!res.ok) { FOLDER_CACHE['__sharedDriveId__'] = null; return null; }
    const json = await res.json();
    const drives = json.drives || [];
    const id = drives.length > 0 ? drives[0].id : null;
    FOLDER_CACHE['__sharedDriveId__'] = id;
    if (id) console.log('[Drive] Using Shared Drive:', drives[0].name, id);
    else     console.log('[Drive] No Shared Drives found — using My Drive');
    return id;
  } catch(e) {
    console.warn('[Drive] Could not list Shared Drives:', e.message);
    FOLDER_CACHE['__sharedDriveId__'] = null;
    return null;
  }
}

// Returns the ID of the top-level "FLPS Software" folder in the Shared Drive.
// All sub-folders are created inside this one.
let _flpsRootId = null;
async function getFlpsRootFolderId() {
  if (_flpsRootId) return _flpsRootId;
  _flpsRootId = await findOrCreateFolder('FLPS Software');
  return _flpsRootId;
}

async function findOrCreateFolder(name, parentId) {
  const sharedDriveId = await getSharedDriveId();
  const cacheKey = name + (parentId || '') + (sharedDriveId || '');
  if (FOLDER_CACHE[cacheKey]) return FOLDER_CACHE[cacheKey];

  // Search for existing folder — include all drives
  let q = `mimeType="application/vnd.google-apps.folder" and name="${name.replace(/"/g,'\\"')}" and trashed=false`;
  if (parentId) q += ` and "${parentId}" in parents`;
  else if (sharedDriveId) q += ` and "${sharedDriveId}" in parents`;

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
    `&fields=files(id,name,parents,driveId)&includeItemsFromAllDrives=true&supportsAllDrives=true&corpora=allDrives`;
  const searchRes = await googleFetch(searchUrl);
  if (!searchRes.ok) throw new Error('Folder search failed: ' + searchRes.status);
  const searchJson = await searchRes.json();
  if (searchJson.files && searchJson.files.length > 0) {
    FOLDER_CACHE[cacheKey] = searchJson.files[0].id;
    return searchJson.files[0].id;
  }

  // Create the folder — in Shared Drive if available, otherwise My Drive
  const createBody = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    createBody.parents = [parentId];
  } else if (sharedDriveId) {
    createBody.parents = [sharedDriveId];
  }

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,parents,driveId', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(createBody)
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error('Folder create failed: ' + createRes.status + ' ' + errText);
  }
  const created = await createRes.json();
  FOLDER_CACHE[cacheKey] = created.id;
  const loc = created.driveId ? 'Shared Drive' : 'My Drive';
  console.log(`[Drive] Created folder "${name}" in ${loc} — id: ${created.id}`);
  return created.id;
}

async function driveUploadFile(fileName, mimeType, content, folderId, existingFileId) {
  const isBase64 = mimeType === 'application/pdf';
  const boundary = '-------flipsUpload314159';
  const meta = JSON.stringify({
    name: fileName,
    mimeType,
    ...(folderId && !existingFileId ? { parents: [folderId] } : {})
  });

  let bodyParts;
  if (isBase64) {
    bodyParts = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${content}\r\n--${boundary}--`;
  } else {
    bodyParts = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;
  }
  const contentType = `multipart/related; boundary="${boundary}"`;

  const baseUploadUrl = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&supportsAllDrives=true`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`;
  const method = existingFileId ? 'PATCH' : 'POST';

  const res = await fetch(baseUploadUrl, {
    method,
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': contentType },
    body: bodyParts
  });
  if (!res.ok) throw new Error('Upload failed: ' + res.status + ' ' + await res.text());
  return await res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// FIND LATEST INSPECTION FOR A PROPERTY
// Searches FLPS Software Inspection Data folder for files matching the property.
// Uses Drive appProperties metadata so we never have to read file content.
// ─────────────────────────────────────────────────────────────────────────────
async function findLatestInspectionFile(propName) {
  try {
    const folderId = await findOrCreateFolder('FLPS Software Inspection Data', await getFlpsRootFolderId());
    const safeSearch = propName.replace(/'/g, "\\'").replace(/"/g, '\\"');
    const q = `"${folderId}" in parents and trashed=false and appProperties has { key='flips_insp_property' and value='${safeSearch}' }`;
    const res = await googleFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
      `&fields=files(id,name,appProperties,modifiedTime)&orderBy=modifiedTime+desc&pageSize=20` +
      `&includeItemsFromAllDrives=true&supportsAllDrives=true&corpora=allDrives`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const files = json.files || [];
    if (files.length === 0) return null;
    return files[0];
  } catch(e) {
    console.warn('[findLatestInspection] error:', e.message);
    return null;
  }
}

async function loadLatestInspection(propName) {
  const file = await findLatestInspectionFile(propName);
  if (!file) return null;
  try {
    const res = await googleFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
    if (!res.ok) return null;
    return await res.json();
  } catch(e) {
    console.warn('[loadLatestInspection] read error:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPERTY PROFILE — one JSON per property, tracks per-system last inspection
// Stored in "FLPS Property Profiles" with appProperties for fast search
// ─────────────────────────────────────────────────────────────────────────────
async function findPropertyProfileFile(propName) {
  try {
    const folderId = await findOrCreateFolder('FLPS Property Profiles', await getFlpsRootFolderId());
    // Prefer acct-based lookup (stable key); fall back to property name for older profiles
    let q;
    if (_currentPropertyAcct) {
      const safeAcct = _currentPropertyAcct.replace(/'/g, "\\'").replace(/"/g, '\\"');
      q = `"${folderId}" in parents and trashed=false and appProperties has { key='flips_profile_acct' and value='${safeAcct}' }`;
    } else {
      const safeSearch = propName.replace(/'/g, "\\'").replace(/"/g, '\\"');
      q = `"${folderId}" in parents and trashed=false and appProperties has { key='flips_profile_property' and value='${safeSearch}' }`;
    }
    const res = await googleFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
      `&fields=files(id,name,appProperties,modifiedTime)&orderBy=modifiedTime+desc&pageSize=5` +
      `&includeItemsFromAllDrives=true&supportsAllDrives=true&corpora=allDrives`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const files = json.files || [];
    if (files.length > 0) return files[0];

    // Fallback: search by filename (handles manually-uploaded profiles without appProperties)
    const acctSlug = _currentPropertyAcct ? _currentPropertyAcct.replace(/[^a-zA-Z0-9]/g, '_') : '';
    const nameSlug = propName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);
    const nameVariants = [
      acctSlug ? `FLPS_Profile_${acctSlug}_${nameSlug}.json` : null,
      `FLPS_Profile_${nameSlug}.json`,
    ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    console.log('[findPropertyProfileFile] trying filename fallback:', nameVariants, 'in folder:', folderId);
    // Search in folder first, then Drive-wide as last resort
    for (const scope of ['folder', 'drive']) {
      for (const fname of nameVariants) {
        const safeN = fname.replace(/'/g, "\\'");
        const qn = scope === 'folder'
          ? `"${folderId}" in parents and trashed=false and name='${safeN}'`
          : `trashed=false and name='${safeN}'`;
        const r2 = await googleFetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qn)}` +
          `&fields=files(id,name,appProperties,modifiedTime)&orderBy=modifiedTime+desc&pageSize=5` +
          `&includeItemsFromAllDrives=true&supportsAllDrives=true&corpora=allDrives`
        );
        if (!r2.ok) continue;
        const j2 = await r2.json();
        console.log(`[findPropertyProfileFile] ${scope} search for "${fname}":`, j2.files?.length ?? 0, 'results');
        if (j2.files && j2.files.length > 0) return j2.files[0];
      }
    }
    return null;
  } catch(e) {
    console.warn('[findPropertyProfileFile] error:', e.message);
    return null;
  }
}

async function loadPropertyProfile(propName) {
  const file = await findPropertyProfileFile(propName);
  if (!file) return null;
  try {
    const res = await googleFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
    if (!res.ok) return null;
    const profile = await res.json();
    profile._fileId = file.id;  // stash for upsert on next save
    return profile;
  } catch(e) {
    console.warn('[loadPropertyProfile] read error:', e.message);
    return null;
  }
}

async function savePropertyProfile(propName, profile) {
  const folderId = await findOrCreateFolder('FLPS Property Profiles', await getFlpsRootFolderId());
  const acctPart = _currentPropertyAcct ? `_${_currentPropertyAcct.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const slug = propName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);
  const fileName = `FLPS_Profile_${acctPart ? acctPart.slice(1) + '_' : ''}${slug}.json`;
  const existingId = profile._fileId || null;
  const content = JSON.stringify(profile, null, 2);
  const uploaded = await driveUploadFile(fileName, 'application/json', content, folderId, existingId);
  await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ appProperties: {
      flips_profile_property: propName.split(/\r\n|\r|\n/)[0].trim().slice(0, 100),
      ...(_currentPropertyAcct ? { flips_profile_acct: _currentPropertyAcct } : {}),
      flips_profile_updated:  profile.updatedAt || todayMT(),
      flips_profile_systems:  (profile.systems || []).join(','),
      flips_profile_version:  '1.0'
    }})
  });
  profile._fileId = uploaded.id;
}

async function updatePropertyProfileAfterSave(data, sysKey) {
  if (!accessToken || !sysKey) return;
  const propName = data.property.name;
  const profile = _propertyProfile || { property: propName, acct: _currentPropertyAcct, systems: [...activeSystems], lastInspBySystem: {} };
  if (_currentPropertyAcct) profile.acct = _currentPropertyAcct;

  profile.systems = [...activeSystems];
  profile.updatedAt = data.inspection.date || todayMT();
  profile.lastInspBySystem = profile.lastInspBySystem || {};
  const inspRecord = {
    date:         data.inspection.date || todayMT(),
    inspector:    data.inspection.inspectorName || '',
    reportType:   data.inspection.reportType || '',
    status:       data.overallStatus || '',
    deficiencies: data.deficiencies || [],
    fieldData:    data.fieldData || {},
    pfStates:     data.pfStates || {},
    extinguishers:data.extinguishers || [],
    devices:      sysKey === 'fire-alarm' ? collectFADeviceRows() : (data.devices || undefined),
    keySheet:     data.keySheet      || undefined,
  };
  profile.lastInspBySystem[sysKey] = inspRecord;

  // For hood, also save per-identifier data so multiple hoods are tracked separately
  if (sysKey === 'hood' && activeHoodIdentifier) {
    profile.lastInspByHood = profile.lastInspByHood || {};
    profile.lastInspByHood[activeHoodIdentifier] = inspRecord;
    profile.hoodIdentifiers = profile.hoodIdentifiers || [];
    if (!profile.hoodIdentifiers.includes(activeHoodIdentifier)) {
      profile.hoodIdentifiers.push(activeHoodIdentifier);
    }
  }

  _propertyProfile = profile;
  await savePropertyProfile(propName, profile);
}

// Collect FA device rows without pass/fail for property profile persistence
function collectFADeviceRows() {
  const detection = [];
  for (let n = 1; n <= faDetectionCount; n++) {
    if (!document.getElementById('fa-det-row-' + n)) continue;
    detection.push({
      type: document.getElementById('fa-det-type-' + n)?.value || '',
      loc:  document.getElementById('fa-det-loc-' + n)?.value  || '',
      scan: document.getElementById('fa-det-scan-' + n)?.value || '',
      addr: document.getElementById('fa-det-addr-' + n)?.value || ''
    });
  }
  const flow = [];
  for (let n = 1; n <= faFlowCount; n++) {
    if (!document.getElementById('fa-flow-row-' + n)) continue;
    flow.push({
      type: document.getElementById('fa-flow-type-' + n)?.value || '',
      loc:  document.getElementById('fa-flow-loc-' + n)?.value  || '',
      scan: document.getElementById('fa-flow-scan-' + n)?.value || '',
      addr: document.getElementById('fa-flow-addr-' + n)?.value || '',
      secs: document.getElementById('fa-flow-secs-' + n)?.value || ''
    });
  }
  const tamper = [];
  for (let n = 1; n <= faTamperCount; n++) {
    if (!document.getElementById('fa-tamper-row-' + n)) continue;
    tamper.push({
      type:  document.getElementById('fa-tamper-type-' + n)?.value  || '',
      loc:   document.getElementById('fa-tamper-loc-' + n)?.value   || '',
      scan:  document.getElementById('fa-tamper-scan-' + n)?.value  || '',
      addr:  document.getElementById('fa-tamper-addr-' + n)?.value  || '',
      notes: document.getElementById('fa-tamper-notes-' + n)?.value || ''
    });
  }
  const subpanel = [];
  for (let n = 1; n <= faSubpanelCount; n++) {
    if (!document.getElementById('fa-sp-row-' + n)) continue;
    subpanel.push({
      loc:    document.getElementById('fa-sp-loc-' + n)?.value     || '',
      make:   document.getElementById('fa-sp-make-' + n)?.value    || '',
      circuit:document.getElementById('fa-sp-circuit-' + n)?.value || '',
      amps:   document.getElementById('fa-sp-amps-' + n)?.value    || ''
    });
  }
  return { detection, flow, tamper, subpanel };
}

// Restore FA device rows from saved profile data (no pass/fail — fresh inspection)
function restoreFADevices(devices) {
  if (!devices) return;
  (devices.detection || []).forEach(d => {
    addFADetectionRow();
    const n = faDetectionCount;
    const typeEl = document.getElementById('fa-det-type-' + n);
    if (typeEl) {
      const opt = [...typeEl.options].find(o => o.value === d.type);
      if (opt) typeEl.value = d.type;
    }
    const el = (id) => document.getElementById(id);
    if (el('fa-det-loc-'  + n)) el('fa-det-loc-'  + n).value = d.loc  || '';
    if (el('fa-det-scan-' + n)) el('fa-det-scan-' + n).value = d.scan || '';
    if (el('fa-det-addr-' + n)) el('fa-det-addr-' + n).value = d.addr || '';
  });
  (devices.flow || []).forEach(d => {
    addFAFlowRow();
    const n = faFlowCount;
    const el = (id) => document.getElementById(id);
    if (el('fa-flow-type-' + n)) el('fa-flow-type-' + n).value = d.type || 'FS';
    if (el('fa-flow-loc-'  + n)) el('fa-flow-loc-'  + n).value = d.loc  || '';
    if (el('fa-flow-scan-' + n)) el('fa-flow-scan-' + n).value = d.scan || '';
    if (el('fa-flow-addr-' + n)) el('fa-flow-addr-' + n).value = d.addr || '';
    if (el('fa-flow-secs-' + n)) el('fa-flow-secs-' + n).value = d.secs || '';
  });
  (devices.tamper || []).forEach(d => {
    addFATamperRow();
    const n = faTamperCount;
    const el = (id) => document.getElementById(id);
    if (el('fa-tamper-type-'  + n)) el('fa-tamper-type-'  + n).value = d.type  || 'TS';
    if (el('fa-tamper-loc-'   + n)) el('fa-tamper-loc-'   + n).value = d.loc   || '';
    if (el('fa-tamper-scan-'  + n)) el('fa-tamper-scan-'  + n).value = d.scan  || '';
    if (el('fa-tamper-addr-'  + n)) el('fa-tamper-addr-'  + n).value = d.addr  || '';
    if (el('fa-tamper-notes-' + n)) el('fa-tamper-notes-' + n).value = d.notes || '';
  });
  (devices.subpanel || []).forEach(d => {
    addFASubpanelRow();
    const n = faSubpanelCount;
    const el = (id) => document.getElementById(id);
    if (el('fa-sp-loc-'     + n)) el('fa-sp-loc-'     + n).value = d.loc     || '';
    if (el('fa-sp-make-'    + n)) el('fa-sp-make-'    + n).value = d.make    || '';
    if (el('fa-sp-circuit-' + n)) el('fa-sp-circuit-' + n).value = d.circuit || '';
    if (el('fa-sp-amps-'    + n)) el('fa-sp-amps-'    + n).value = d.amps    || '';
  });
  syncDeviceSummary();
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE INSPECTION JSON TO DRIVE
// ─────────────────────────────────────────────────────────────────────────────
async function saveInspectionToDrive() {
  if (!accessToken) { toast('⚠ Connect Google first'); return; }
  const btn = event.target; btn.disabled = true; btn.textContent = '⏳ Saving…';
  try {
    const data = collectAllData();
    const propName = data.property.name || 'Unknown';
    const dateStr  = data.inspection.date || todayMT();
    const fileSlug = buildFileSlug(data);
    const fileName = `FLPS_Insp_${fileSlug}_${dateStr}.json`;

    const folderId = await findOrCreateFolder('FLPS Software Inspection Data', await getFlpsRootFolderId());

    // Check if a file for this property+date already exists (update vs create)
    const existing = await findLatestInspectionFile(propName);
    const existingId = (existing && existing.appProperties?.flips_insp_date === dateStr) ? existing.id : null;

    const content = JSON.stringify(data, null, 2);
    const uploaded = await driveUploadFile(fileName, 'application/json', content, folderId, existingId);

    // Write metadata as appProperties for fast search
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}?supportsAllDrives=true`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ appProperties: {
        flips_insp_property: propName,
        flips_insp_date:     dateStr,
        flips_insp_type:     data.inspection.reportType || '',
        flips_insp_status:   data.overallStatus || '',
        flips_insp_inspector:data.inspection.inspectorName || '',
        flips_insp_version:  '2.0'
      }})
    });

    document.getElementById('pdf-status').textContent = `✓ Inspection data saved to Drive: ${fileName}`;
    toast('✓ Inspection saved to FLPS Software Inspection Data');
    clearDraft(); // Remove draft now that inspection is fully saved
  } catch(e) {
    toast('✗ Save failed: ' + e.message);
    document.getElementById('pdf-status').textContent = '✗ Save error: ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = '💾 Save Inspection Data';
  }
}

