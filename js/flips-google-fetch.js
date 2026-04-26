// ─────────────────────────────────────────────────────────────────────────────
// FLIPS Google fetch helpers — single source of truth for 401-refresh logic.
//
// Depends on these page-scope globals (declared by the page or flips-shared.js):
//   accessToken, tokenClient
// Optional: toast(msg), setStatus(id, msg, cls), gapi (create-invoices only).
//
// Load AFTER the script that declares accessToken/tokenClient.
// ─────────────────────────────────────────────────────────────────────────────

let _tokenRefreshPromise = null;

function refreshAccessToken() {
  if (_tokenRefreshPromise) return _tokenRefreshPromise;
  _tokenRefreshPromise = new Promise((resolve, reject) => {
    if (typeof tokenClient === 'undefined' || !tokenClient) {
      reject(new Error('Not initialized')); return;
    }
    tokenClient.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      accessToken = resp.access_token;
      try { localStorage.setItem('flips_access_token', accessToken); } catch(_) {}
      try { localStorage.setItem('flips_token_expiry', Date.now() + 55 * 60 * 1000); } catch(_) {}
      if (typeof gapi !== 'undefined' && gapi.client && gapi.client.setToken) {
        try { gapi.client.setToken({ access_token: accessToken }); } catch(_) {}
      }
      resolve();
    };
    tokenClient.error_callback = (err) => {
      accessToken = null;
      try { localStorage.removeItem('flips_access_token'); } catch(_) {}
      try { localStorage.removeItem('flips_token_expiry'); } catch(_) {}
      if (typeof setStatus === 'function') {
        try { setStatus('conn-status', '✗ Session expired — click Connect Google', 'err'); } catch(_) {}
      }
      reject(new Error(err.message || err.type || 'token_refresh_failed'));
    };
    tokenClient.requestAccessToken({ prompt: '' });
  }).finally(() => { _tokenRefreshPromise = null; });
  return _tokenRefreshPromise;
}

async function googleFetch(url, method = 'GET', body = null) {
  const makeOpts = () => {
    const opts = { method, headers: { 'Authorization': 'Bearer ' + accessToken } };
    if (body !== null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return opts;
  };
  let res = await fetch(url, makeOpts());
  if (res.status === 401) {
    console.warn('[Google] 401 — requesting fresh token…');
    if (typeof toast === 'function') toast('⏳ Google session expired — reconnecting…');
    await refreshAccessToken();
    res = await fetch(url, makeOpts());
  }
  return res;
}

function apiFetch(url, method = 'GET', body = null) {
  return googleFetch(url, method, body);
}
