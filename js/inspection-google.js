// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE AUTH
// ─────────────────────────────────────────────────────────────────────────────

// Dispatches to whichever status function the host page defines.
// inspection.html uses setStatus(msg, cls); hospital uses setConnStatus(state, msg).
function _updateConnStatus(state, msg) {
  if (typeof setStatus === 'function') setStatus(msg, state);
  else if (typeof setConnStatus === 'function') setConnStatus(state, msg);
}

// Schedules a silent token refresh 5 minutes before the current token expires,
// so the 401 retry path in googleFetch is never needed for active sessions.
function _scheduleTokenRefresh() {
  const expiry = Number(localStorage.getItem('flips_token_expiry')) || 0;
  const delay  = expiry - Date.now() - 5 * 60 * 1000;
  if (delay <= 0 || !tokenClient) return;
  setTimeout(() => {
    if (!tokenClient) return;
    const savedCb = tokenClient.callback;
    tokenClient.callback = (resp) => {
      tokenClient.callback = savedCb;
      if (resp.error) return;
      accessToken = resp.access_token;
      localStorage.setItem('flips_access_token', accessToken);
      localStorage.setItem('flips_token_expiry', Date.now() + 55 * 60 * 1000);
      _updateConnStatus('ok', '✓ Connected');
      _scheduleTokenRefresh();
    };
    tokenClient.requestAccessToken({ prompt: '' });
  }, delay);
}

function initGoogle() {
  const apiKey   = document.getElementById('api-key').value.trim();
  const clientId = document.getElementById('client-id').value.trim();
  if (!apiKey || !clientId) { toast('⚠ Enter API Key and Client ID'); return; }
  localStorage.setItem('flips_api_key', apiKey);
  localStorage.setItem('flips_client_id', clientId);
  setStatus('Connecting…', '');
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) { setStatus('✗ ' + resp.error, 'err'); return; }
        accessToken = resp.access_token;
        localStorage.setItem('flips_access_token', accessToken);
        localStorage.setItem('flips_token_expiry', Date.now() + 55 * 60 * 1000);
        setStatus('✓ Connected', 'ok');
        _scheduleTokenRefresh();
        loadSheet();
      },
      error_callback: (err) => setStatus('✗ ' + (err.message || err.type), 'err')
    });
    tokenClient.requestAccessToken({ prompt: '' });
  } catch(e) { setStatus('✗ ' + e.message, 'err'); }
}

let _tokenRefreshPromise = null;
function _refreshAccessTokenInspection() {
  if (_tokenRefreshPromise) return _tokenRefreshPromise;
  _tokenRefreshPromise = new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      accessToken = resp.access_token;
      localStorage.setItem('flips_access_token', accessToken);
      localStorage.setItem('flips_token_expiry', Date.now() + 55 * 60 * 1000);
      _updateConnStatus('ok', '✓ Connected');
      _scheduleTokenRefresh();
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: '' });
  }).finally(() => { _tokenRefreshPromise = null; });
  return _tokenRefreshPromise;
}

async function googleFetch(url, method = 'GET', body = null) {
  if (!accessToken) throw new Error('Not authenticated — connect Google first');
  const makeOpts = () => {
    const opts = { method, headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    return opts;
  };
  let res = await fetch(url, makeOpts());
  if (res.status === 401) {
    if (!tokenClient) {
      _updateConnStatus('err', '⚠ Session expired — reconnect');
      document.getElementById('conn-drawer').classList.add('open');
      throw new Error('Session expired — please reconnect Google');
    }
    if (typeof toast === 'function') toast('⏳ Reconnecting…');
    await _refreshAccessTokenInspection();
    res = await fetch(url, makeOpts());
  }
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD CLIENT SHEET
// ─────────────────────────────────────────────────────────────────────────────
async function loadSheet(forceRefresh = false) {
  const CACHE_KEY = 'flips_client_cache';
  const CACHE_TTL = 30 * 60 * 1000;
  if (!forceRefresh) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
        clientData = cached.data; buildDropdown(); return;
      }
    } catch(_) {}
  }
  document.getElementById('prop-loading')?.style && (document.getElementById('prop-loading').style.display = 'block');
  try {
    const metaRes = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`);
    if (!metaRes.ok) throw new Error('Sheet error ' + metaRes.status);
    const metaJson = await metaRes.json();
    let tabName = metaJson.sheets[0].properties.title;
    for (const s of metaJson.sheets) {
      if (String(s.properties.sheetId) === String(SHEET_GID)) { tabName = s.properties.title; break; }
    }
    const valRes = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tabName)}`);
    const valJson = await valRes.json();
    const rows = valJson.values || [];
    if (rows.length < 2) { toast('Sheet appears empty'); return; }
    const headers = rows[0].map(h => (h||'').trim().toLowerCase());
    clientData = {};
    for (let i = 1; i < rows.length; i++) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (rows[i][idx] || '').trim(); });
      const nameKey = headers.find(h => ['property name','property','name'].some(k => h.includes(k))) || headers[0];
      const label = obj[nameKey] || `Row ${i + 1}`;
      if (label.trim()) clientData[label] = obj;
    }
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: clientData })); } catch(_) {}
    buildDropdown();
    toast('✓ Loaded ' + Object.keys(clientData).length + ' properties');
  } catch(e) {
    _updateConnStatus('err', '⚠ ' + e.message);
  } finally {
    document.getElementById('prop-loading')?.style && (document.getElementById('prop-loading').style.display = 'none');
  }
}

function buildDropdown() {
  const sel = document.getElementById('property-select');
  sel.innerHTML = '<option value="">— Select property —</option>';
  Object.keys(clientData).sort().forEach(name => {
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    sel.appendChild(o);
  });
  // Dropdown rebuild always resets to placeholder — clear any browser-restored
  // field values so they don't look like a real property selection.
  if (!sel.value) _clearPropertyFields();
}

function _clearPropertyFields() {
  ['property-name','service-address','city-state-zip','client-company',
   'property-contact-name','property-contact-email','primary-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  _updatePropertyBadge('');
}

function _updatePropertyBadge(propName) {
  const badge = document.getElementById('prop-selected-badge');
  if (!badge) return;
  if (propName) {
    badge.textContent = '✓ ' + propName;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

function filterPropDropdown(query) {
  const sel   = document.getElementById('property-select');
  const clear = document.getElementById('prop-search-clear');
  const q = query.trim().toLowerCase();
  clear.style.display = q ? 'block' : 'none';
  const prevVal = sel.value;
  const names = Object.keys(clientData).sort();
  sel.innerHTML = '';
  const ph = document.createElement('option');
  const matches = names.filter(n => !q || n.toLowerCase().includes(q));
  ph.value = ''; ph.textContent = q ? `— ${matches.length} match${matches.length !== 1 ? 'es' : ''} —` : '— Select property —';
  sel.appendChild(ph);
  matches.forEach(name => {
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    sel.appendChild(o);
  });
  if (matches.length === 1) {
    sel.value = matches[0];
    if (matches[0] !== prevVal) onPropertySelect();
  } else if (prevVal && matches.includes(prevVal)) {
    sel.value = prevVal; // keep existing selection visible when search widens
  }
}

function clearPropSearch() {
  document.getElementById('prop-search').value = '';
  document.getElementById('prop-search-clear').style.display = 'none';
  filterPropDropdown('');
}

function onPropertySelect() {
  const propName = document.getElementById('property-select').value;
  if (!propName || !clientData[propName]) { _updatePropertyBadge(''); return; }
  const d = clientData[propName];
  const fill = (id, ...keys) => {
    const el = document.getElementById(id);
    if (!el) return;
    for (const k of keys) {
      const match = Object.keys(d).find(h => h.includes(k));
      if (match && d[match]) { el.value = d[match]; return; }
    }
    el.value = '';
  };
  fill('client-company', 'management','client','company');
  // Service address: parse from raw clientData before touching the DOM,
  // because input[type=text].value strips \n so split-after-fill never works.
  const addrKey = Object.keys(d).find(h => h.includes('service address') || h.includes('address'));
  const rawAddr = addrKey ? (d[addrKey] || '') : '';
  const addrParts = rawAddr.split(/\r\n|\r|\n|\u2028|\u2029/).map(s => s.trim()).filter(Boolean);
  const saEl  = document.getElementById('service-address');
  const cszEl = document.getElementById('city-state-zip');
  if (saEl)  saEl.value  = addrParts[0] || rawAddr;
  if (addrParts.length >= 2) {
    if (cszEl) cszEl.value = addrParts[addrParts.length - 1];
  } else {
    fill('city-state-zip', 'city','zip');
  }
  // Populate property name field from dropdown selection
  const pnEl = document.getElementById('property-name');
  if (pnEl) {
    // propName may contain embedded newlines (spreadsheet cell with line break) — take first line only
    const pnLines = propName.split(/\r\n|\r|\n|\u2028|\u2029/);
    pnEl.value = pnLines[0].trim() || propName;
  }
  fill('property-contact-name', 'property manager','contact name');
  fill('property-contact-email', 'contact email','email','e-mail');
  _updatePropertyBadge(propName);

  // Extract FLPS account number for stable Drive profile lookup
  const acctHeader = Object.keys(d).find(h => h.includes('acct') || h.includes('account'));
  _currentPropertyAcct = (acctHeader && d[acctHeader]) ? d[acctHeader].trim() : '';

  // Reset state
  window._prevInspectionData = null;
  _propertyProfile = null;
  activeInspectionSystem = null;
  document.getElementById('prev-insp-banner').style.display = 'none';
  document.getElementById('prev-insp-summary').textContent = '';
  const _saveSystemsRow = document.getElementById('save-systems-row');
  if (_saveSystemsRow) _saveSystemsRow.style.display = 'none';

  // Load saved building system config (local cache — instant)
  const saved = loadBuildingConfig(propName);
  if (saved && saved.systems) {
    activeSystems = new Set(saved.systems);
    document.querySelectorAll('.sys-toggle').forEach(el => {
      el.classList.toggle('active', activeSystems.has(el.dataset.sys));
    });
  } else {
    activeSystems = new Set();
    document.querySelectorAll('.sys-toggle').forEach(el => el.classList.remove('active'));
  }

  // Render cards immediately with local data (no prev info yet)
  renderInspectionStartCards();

  // Load property profile from Drive for per-system history
  if (accessToken) {
    const searchEl = document.getElementById('prev-insp-searching');
    if (searchEl) searchEl.style.display = 'block';

    loadPropertyProfile(propName).then(profile => {
      if (searchEl) searchEl.style.display = 'none';
      _propertyProfile = profile;

      if (profile) {
        // Restore systems from profile if nothing saved locally
        if (profile.systems && profile.systems.length > 0 &&
            (!saved || !saved.systems || saved.systems.length === 0)) {
          activeSystems = new Set(profile.systems);
          document.querySelectorAll('.sys-toggle').forEach(el => {
            el.classList.toggle('active', activeSystems.has(el.dataset.sys));
          });
          saveBuildingConfig();
        }

        // Step 1 banner — show summary of inspected systems
        const sysList = Object.keys(profile.lastInspBySystem || {});
        if (sysList.length > 0) {
          const banner  = document.getElementById('prev-insp-banner');
          const summary = document.getElementById('prev-insp-summary');
          if (banner && summary) {
            summary.textContent = ` ${sysList.length} system${sysList.length !== 1 ? 's' : ''} with prior inspection data on file`;
            banner.style.display = 'block';
          }
        }
      }

      // Re-render cards with profile data
      renderInspectionStartCards();
    }).catch(err => {
      if (searchEl) searchEl.style.display = 'none';
      console.warn('[onPropertySelect] Profile load failed:', err.message);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDING CONFIG — save/load system selections per property (localStorage)
// ─────────────────────────────────────────────────────────────────────────────
function buildingConfigKey(propName) {
  return 'flips_bldg_' + propName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
}
function saveBuildingConfig() {
  const propName = document.getElementById('property-select').value;
  if (!propName) return;
  const config = { systems: [...activeSystems], savedAt: new Date().toISOString() };
  localStorage.setItem(buildingConfigKey(propName), JSON.stringify(config));
  const ind = document.getElementById('save-indicator');
  ind.classList.add('show');
  setTimeout(() => ind.classList.remove('show'), 2000);
}
function loadBuildingConfig(propName) {
  try { return JSON.parse(localStorage.getItem(buildingConfigKey(propName)) || 'null'); } catch(_) { return null; }
}

async function saveBuildingSystemsToDrive() {
  const propName = document.getElementById('property-select').value;
  if (!propName) { toast('⚠ Select a property first'); return; }
  if (!accessToken) { toast('⚠ Connect Google first'); return; }
  if (activeSystems.size === 0) { toast('⚠ Select at least one system before saving'); return; }

  const btn = document.getElementById('save-systems-btn');
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ Saving…';

  try {
    // Upsert the profile — preserve existing lastInspBySystem, just update systems list
    const profile = _propertyProfile || { property: propName, lastInspBySystem: {} };
    profile.systems   = [...activeSystems];
    profile.updatedAt = todayMT();
    await savePropertyProfile(propName, profile);
    _propertyProfile = profile;

    // Also keep localStorage in sync as local cache
    saveBuildingConfig();

    document.getElementById('save-systems-row').style.display = 'none';
    toast('✓ Systems saved — synced across devices');
  } catch(e) {
    toast('✗ Save failed: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSPECTION START CARDS — per-system cards on Step 2
// ─────────────────────────────────────────────────────────────────────────────
function renderInspectionStartCards() {
  const card = document.getElementById('inspection-start-card');
  const grid = document.getElementById('insp-start-grid');
  if (!card || !grid) return;

  if (activeSystems.size === 0) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';

  const lastBySystem = (_propertyProfile && _propertyProfile.lastInspBySystem) || {};
  const SYS_ORDER = ['fire-alarm','sprinkler','extinguisher','hood','exit-sign-lighting','fire-pump','standpipe','hydrant','bda','smoke-control','gas-detection','special-suppression','backflow','hospital'];
  const ordered = SYS_ORDER.filter(k => activeSystems.has(k));

  grid.innerHTML = '';
  ordered.forEach(sysKey => {
    const meta = SYS_META[sysKey] || { label: sysKey, icon: '⚙️' };
    const last = lastBySystem[sysKey];

    let prevHtml = '';
    if (last) {
      const statusCls = last.status === 'COMPLIANT' ? 'compliant' : last.status === 'DEFICIENT' ? 'deficient' : last.status === 'IMPAIRED' ? 'impaired' : '';
      const statusPill = last.status
        ? `<span class="sys-status-pill ${statusCls}">${last.status}</span>`
        : '';
      const deficCount = (last.deficiencies || []).length;
      const deficHtml = deficCount > 0
        ? `<span style="font-size:0.72rem;color:var(--red);font-weight:600;"> · ⚠ ${deficCount} prior deficiencie${deficCount !== 1 ? 's' : ''}</span>`
        : `<span style="font-size:0.72rem;color:var(--green);"> · ✓ No deficiencies</span>`;
      prevHtml = `<div style="font-size:0.75rem;color:var(--slate);margin-top:3px;">
        Last: <strong>${last.date || '—'}</strong> · ${last.inspector || '—'} · ${last.reportType || '—'} ${statusPill}${deficHtml}
      </div>`;
    } else {
      prevHtml = `<div style="font-size:0.75rem;color:var(--slate);margin-top:3px;font-style:italic;">No previous inspection on file</div>`;
    }

    const div = document.createElement('div');
    div.className = 'insp-start-card';
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.5rem;flex-shrink:0;">${meta.icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.88rem;font-weight:700;color:var(--navy);">${meta.label}</div>
          ${prevHtml}
        </div>
        <button class="btn-primary fire" style="font-size:0.78rem;padding:8px 14px;white-space:nowrap;flex-shrink:0;"
          onclick="startInspectionForSystem('${sysKey}')">Inspect →</button>
      </div>`;
    grid.appendChild(div);
  });
}

function startInspectionForSystem(sysKey) {
  activeInspectionSystem = sysKey;
  syncMainNavDisabled();

  // Hospital TJC/CMS uses its own multi-step inspection flow
  if (sysKey === 'hospital') {
    if (typeof startHospInspection === 'function') startHospInspection();
    return;
  }

  // Hood has multiple hoods per property — prev data is loaded after the
  // identifier is chosen in the picker, so skip loading here.
  if (sysKey === 'hood') {
    activeHoodIdentifier = '';
    window._prevInspectionData = null;
    buildInspectionForms();
    return;
  }

  const lastBySystem = (_propertyProfile && _propertyProfile.lastInspBySystem) || {};
  const last = lastBySystem[sysKey];

  // Build _prevInspectionData from the profile's per-system record
  window._prevInspectionData = last ? {
    inspection: {
      date:          last.date,
      inspectorName: last.inspector,
      reportType:    last.reportType
    },
    overallStatus: last.status,
    systems:       [sysKey],
    fieldData:     last.fieldData     || {},
    pfStates:      last.pfStates      || {},
    deficiencies:  last.deficiencies  || [],
    extinguishers: last.extinguishers || [],
    devices:       last.devices       || null
  } : null;

  buildInspectionForms();
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM TOGGLES
// ─────────────────────────────────────────────────────────────────────────────
function toggleSys(el) {
  const sys = el.dataset.sys;
  if (activeSystems.has(sys)) { activeSystems.delete(sys); el.classList.remove('active'); }
  else { activeSystems.add(sys); el.classList.add('active'); }
  saveBuildingConfig();
  document.getElementById('save-systems-row').style.display = 'block';
  renderInspectionStartCards();
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD INSPECTION FORMS
// ─────────────────────────────────────────────────────────────────────────────
function buildInspectionForms() {
  if (!activeInspectionSystem) { toast('⚠ Select a system to inspect from the Start an Inspection section'); return; }
  saveBuildingConfig();

  // Hood uses a dedicated identifier picker before the inspection panel
  if (activeInspectionSystem === 'hood') {
    showHoodIdentifierPicker();
    return;
  }

  // Fire alarm and sprinkler use static multi-step navigation
  if (activeInspectionSystem === 'fire-alarm') {
    startFireAlarmInspection();
    return;
  }
  if (activeInspectionSystem === 'sprinkler') {
    startSprinklerInspection();
    return;
  }

  // Check for an existing draft for this system
  const existingDraft = loadDraft();
  if (existingDraft && existingDraft.sysKey === activeInspectionSystem && existingDraft.sysFormsHTML) {
    showDraftModal(existingDraft, false,
      () => {
        _resumeGenericFromDraft(existingDraft);
      },
      () => { clearDraft(); _buildFreshGenericInspection(); },
      () => { clearDraft(); _buildFreshGenericInspection(); }
    );
    return;
  }
  _buildFreshGenericInspection();
}

function _resumeGenericFromDraft(draft) {
  overallStatus = '';
  overallStatusUserSet = false;
  document.querySelectorAll('.ost-btn').forEach(b => b.classList.remove('selected'));
  // Restore banner + sys-forms from draft
  const sysKey = draft.sysKey;
  activeInspectionSystem = sysKey;
  syncMainNavDisabled();
  const meta = SYS_META[sysKey] || { label: sysKey, icon: '⚙️' };
  const banner = document.getElementById('active-system-banner');
  if (banner) {
    banner.innerHTML = '';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = `${meta.icon}  Inspecting: ${meta.label}`;
    labelSpan.style.flex = '1';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 Save Draft';
    saveBtn.onclick = saveDraft;
    saveBtn.style.cssText = 'background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.4);color:white;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:0.72rem;font-weight:600;font-family:inherit;white-space:nowrap;';
    banner.appendChild(labelSpan);
    banner.appendChild(saveBtn);
    banner.style.display = 'flex';
  }
  restoreDraft(draft);
  buildItemPanelMap();
  updateDeficiencySummary();
  goStep(3);
}

// ─────────────────────────────────────────────────────────────────────────────
// KITCHEN HOOD IDENTIFIER PICKER
// ─────────────────────────────────────────────────────────────────────────────
function showHoodIdentifierPicker() {
  const identifiers = (_propertyProfile && _propertyProfile.hoodIdentifiers) || [];
  const datalist = document.getElementById('hood-ident-list');
  if (datalist) {
    datalist.innerHTML = '';
    identifiers.forEach(id => {
      const opt = document.createElement('option');
      opt.value = id;
      datalist.appendChild(opt);
    });
  }
  const input = document.getElementById('hood-ident-input');
  if (input) input.value = activeHoodIdentifier || '';
  document.getElementById('step-2').style.display = 'none';
  document.getElementById('step-hood-ident').style.display = 'block';
  updateHoodIdentPrevInfo();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateHoodIdentPrevInfo() {
  const val = (document.getElementById('hood-ident-input')?.value || '').trim();
  const lastByHood = (_propertyProfile && _propertyProfile.lastInspByHood) || {};
  const prev = lastByHood[val];
  const prevEl = document.getElementById('hood-ident-prev-info');
  const summEl = document.getElementById('hood-ident-prev-summary');
  const newEl  = document.getElementById('hood-ident-new-notice');
  if (!val) {
    if (prevEl) prevEl.style.display = 'none';
    if (newEl)  newEl.style.display  = 'none';
    return;
  }
  if (prev) {
    if (summEl) summEl.textContent = ` ${prev.date || '?'} — ${prev.inspector || '?'} — ${prev.status || '?'}`;
    if (prevEl) prevEl.style.display = 'block';
    if (newEl)  newEl.style.display  = 'none';
  } else {
    if (prevEl) prevEl.style.display = 'none';
    if (newEl)  newEl.style.display  = 'block';
  }
}

function exitHoodIdentPicker() {
  document.getElementById('step-hood-ident').style.display = 'none';
  document.getElementById('step-2').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function confirmHoodIdentifier() {
  const val = (document.getElementById('hood-ident-input')?.value || '').trim();
  if (!val) { toast('Enter a kitchen hood identifier before continuing.'); return; }
  activeHoodIdentifier = val;

  // Load previous data for this specific hood from profile
  const lastByHood = (_propertyProfile && _propertyProfile.lastInspByHood) || {};
  const last = lastByHood[val];
  window._prevInspectionData = last ? {
    inspection: { date: last.date, inspectorName: last.inspector, reportType: last.reportType },
    overallStatus: last.status,
    systems: ['hood'],
    fieldData:    last.fieldData    || {},
    pfStates:     last.pfStates     || {},
    deficiencies: last.deficiencies || [],
    extinguishers: [],
    devices: null
  } : null;

  document.getElementById('step-hood-ident').style.display = 'none';

  // Check for an existing draft for this system
  const existingDraft = loadDraft();
  if (existingDraft && existingDraft.sysKey === 'hood' && existingDraft.sysFormsHTML) {
    showDraftModal(existingDraft, false,
      () => { _resumeGenericFromDraft(existingDraft); },
      () => { clearDraft(); _buildFreshGenericInspection(); },
      () => { clearDraft(); _buildFreshGenericInspection(); }
    );
    return;
  }
  _buildFreshGenericInspection();
}

function _buildFreshGenericInspection() {
  overallStatus = '';
  overallStatusUserSet = false;
  document.querySelectorAll('.ost-btn').forEach(b => b.classList.remove('selected'));
  const container = document.getElementById('sys-forms');
  container.innerHTML = '';

  const BUILDERS = {
    'fire-alarm':          buildFireAlarmPanel,
    'sprinkler':           buildSprinklerPanel,
    'fire-pump':           buildFirePumpPanel,
    'standpipe':           buildStandpipePanel,
    'hood':                buildHoodPanel,
    'extinguisher':        buildExtinguisherPanel,
    'hydrant':             buildHydrantPanel,
    'bda':                 buildBDAPanel,
    'smoke-control':       buildSmokeControlPanel,
    'gas-detection':       buildGasDetectionPanel,
    'special-suppression': buildSpecialSuppressionPanel,
    'backflow':            buildBackflowPanel,
    'exit-sign-lighting':  buildExitSignLightingPanel
  };
  const builder = BUILDERS[activeInspectionSystem];
  if (!builder) { toast('⚠ Unknown system: ' + activeInspectionSystem); return; }
  container.appendChild(builder());

  // System-specific panel initialization (dynamic tables, checklists)
  if (activeInspectionSystem === 'fire-alarm') initFireAlarmPanel();

  // Show active system banner in step 3
  const meta = SYS_META[activeInspectionSystem] || { label: activeInspectionSystem, icon: '⚙️' };
  const banner = document.getElementById('active-system-banner');
  if (banner) {
    banner.innerHTML = '';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = `${meta.icon}  Inspecting: ${meta.label}`;
    labelSpan.style.flex = '1';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 Save Draft';
    saveBtn.onclick = saveDraft;
    saveBtn.style.cssText = 'background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.4);color:white;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:0.72rem;font-weight:600;font-family:inherit;white-space:nowrap;';
    banner.appendChild(labelSpan);
    banner.appendChild(saveBtn);
    banner.style.display = 'flex';
  }

  // Restore previous inspection data (typed fields + previous deficiencies)
  const prev = window._prevInspectionData;
  if (prev) {
    // Restore all typed panel field values (notes, serials, counts, etc.)
    restorePanelFields(prev);

    // Restore exit sign & emergency lighting rows (location/type persist)
    if (prev.elUnits && prev.elUnits.length > 0) {
      const elTbody = document.getElementById('el-tbody');
      if (elTbody) { elTbody.innerHTML = ''; elCount = 0; }
      prev.elUnits.forEach(u => addELRow({ loc: u.loc, type: u.type }));
    }
    if (prev.esUnits && prev.esUnits.length > 0) {
      const esTbody = document.getElementById('es-tbody');
      if (esTbody) { esTbody.innerHTML = ''; esCount = 0; }
      prev.esUnits.forEach(u => addESRow({ loc: u.loc, type: u.type }));
    }

    // Restore extinguisher rows — clear per-inspection fields, keep persistent ones
    if (prev.extinguishers && prev.extinguishers.length > 0) {
      const tbody = document.getElementById('ext-tbody');
      if (tbody) { tbody.innerHTML = ''; extUnitCount = 0; }
      prev.extinguishers.forEach(ext => {
        addExtUnitRow({
          flr:      ext.flr,
          loc:      ext.location || ext.loc,
          mount:    ext.mount,
          mfg:      ext.mfgYear  || ext.mfg,
          size:     ext.size,
          type:     ext.type,
          hydroDue: ext.hydroDue,
        });
      });
    }

    toast('✓ Previous inspection data pre-filled. All items start fresh — review prior deficiencies on the Prior Defic. tab if shown.');
  }

  // Build the item→panel map THEN run deficiency summary
  buildItemPanelMap();
  updateDeficiencySummary();   // populate deficiency box from restored FAILs

  // Show prevdefic interstitial if previous deficiencies exist
  const prevDefics = (prev && prev.deficiencies) || [];
  if (prevDefics.length > 0) {
    const tbody = document.getElementById('generic-prevdefic-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      prevDefics.forEach((d, i) => {
        const tr = document.createElement('tr');
        const label = typeof d === 'string' ? d : (d.item || '');
        const note  = typeof d === 'object' ? (d.description || '') : '';
        tr.innerHTML = `<td>${i + 1}</td><td>${label}${note ? `<div style="font-size:0.78rem;color:var(--slate);margin-top:2px;">${note}</div>` : ''}</td>`;
        tbody.appendChild(tr);
      });
    }
    document.getElementById('step-2').style.display = 'none';
    document.getElementById('step-generic-prevdefic').style.display = 'block';
    // Show prevdefic tab in step-nav and mark it active
    const prevDeficTab = document.getElementById('step-nav-prevdefic-tab');
    if (prevDeficTab) prevDeficTab.style.display = '';
    document.querySelectorAll('#step-nav .step-tab[data-step]').forEach(t => {
      t.classList.remove('active', 'done');
      const s = parseInt(t.dataset.step);
      if (s === 1 || s === 2) t.classList.add('done');
    });
    if (prevDeficTab) { prevDeficTab.classList.remove('done'); prevDeficTab.classList.add('active'); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    goStep(3);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
