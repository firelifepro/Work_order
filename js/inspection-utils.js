// ─────────────────────────────────────────────────────────────────────────────
// MOUNTAIN TIME DATE HELPER
// Returns today's date in YYYY-MM-DD in America/Denver timezone
// ─────────────────────────────────────────────────────────────────────────────
function todayMT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' }); // en-CA gives YYYY-MM-DD
}

// Build a safe filename slug from property name + service address
// e.g. "Skyline Apts" + "123 Main St" → "Skyline_Apts_123_Main_St"
function buildFileSlug(data) {
  const name = (data?.property?.name || 'inspection').trim();
  const addr = (data?.property?.address || '').trim();
  const combined = addr ? `${name} ${addr}` : name;
  return combined.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g,'').slice(0, 70);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHOTO MANAGEMENT
// Photos stored as array of { dataUrl, note } in module-level array.
// Included in PDF and serialized to JSON save.
// ─────────────────────────────────────────────────────────────────────────────
const inspectionPhotos = []; // { dataUrl, note }

function handlePhotoUpload(input) {
  const files = [...(input.files || [])];
  if (!files.length) return;
  let loaded = 0;
  files.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      inspectionPhotos.push({ dataUrl: e.target.result, note: '' });
      loaded++;
      if (loaded === files.length) renderPhotoGrid();
    };
    reader.readAsDataURL(file);
  });
  input.value = ''; // allow re-selecting same file
}

function renderPhotoGrid() {
  const grid = document.getElementById('photo-grid');
  const countEl = document.getElementById('photo-count');
  if (!grid) return;
  grid.innerHTML = inspectionPhotos.map((p, i) => `
    <div class="photo-card">
      <img src="${p.dataUrl}" alt="Photo ${i+1}" loading="lazy">
      <span class="photo-num">Photo ${i+1}</span>
      <button class="photo-remove" onclick="removePhoto(${i})" title="Remove photo">✕</button>
      <div class="photo-note-wrap">
        <textarea class="photo-note-input" placeholder="Add a note for this photo…"
          oninput="inspectionPhotos[${i}].note=this.value"
          rows="2">${escHtml(p.note)}</textarea>
      </div>
    </div>`).join('');
  if (countEl) countEl.textContent = inspectionPhotos.length
    ? `${inspectionPhotos.length} photo${inspectionPhotos.length > 1 ? 's' : ''} attached`
    : '';
}

function removePhoto(idx) {
  inspectionPhotos.splice(idx, 1);
  renderPhotoGrid();
}

// ─────────────────────────────────────────────────────────────────────────────
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
