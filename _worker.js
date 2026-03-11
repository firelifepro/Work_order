// _worker.js
// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Worker — handles API routes and serves static assets.
//
// Environment variables (set in Cloudflare dashboard → Worker → Settings → Variables):
//   QB_CLIENT_ID      — your QB OAuth2 Client ID
//   QB_CLIENT_SECRET  — your QB OAuth2 Client Secret
// ─────────────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function corsResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── CORS preflight ──────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // ── /api/qb-token — QB OAuth2 token exchange ────────────────────
    if (url.pathname === '/api/qb-token' && request.method === 'POST') {
      let body;
      try { body = await request.json(); }
      catch (e) { return corsResponse({ error: 'Invalid JSON body' }, 400); }

      const { grant_type, code, refresh_token, redirect_uri } = body;
      if (!grant_type) return corsResponse({ error: 'Missing grant_type' }, 400);

      const QB_CLIENT_ID     = env.QB_CLIENT_ID;
      const QB_CLIENT_SECRET = env.QB_CLIENT_SECRET;
      if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) {
        return corsResponse({ error: 'QB_CLIENT_ID or QB_CLIENT_SECRET not configured' }, 500);
      }

      const params = new URLSearchParams();
      params.append('grant_type', grant_type);
      if (grant_type === 'authorization_code') {
        if (!code || !redirect_uri) return corsResponse({ error: 'Missing code or redirect_uri' }, 400);
        params.append('code', code);
        params.append('redirect_uri', redirect_uri);
      } else if (grant_type === 'refresh_token') {
        if (!refresh_token) return corsResponse({ error: 'Missing refresh_token' }, 400);
        params.append('refresh_token', refresh_token);
      } else {
        return corsResponse({ error: 'Unsupported grant_type' }, 400);
      }

      const credentials = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);
      try {
        const resp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: params.toString(),
        });
        const data = await resp.json();
        return corsResponse(data, resp.status);
      } catch (err) {
        return corsResponse({ error: 'Network error calling QB', message: err.message }, 500);
      }
    }

    // ── /api/qb-api — QB API proxy ──────────────────────────────────
    if (url.pathname === '/api/qb-api' && request.method === 'POST') {
      let body;
      try { body = await request.json(); }
      catch (e) { return corsResponse({ error: 'Invalid JSON body' }, 400); }

      const { access_token, realm_id, method, path, payload, env: qbEnv } = body;
      if (!access_token || !realm_id || !method || !path) {
        return corsResponse({ error: 'Missing required fields: access_token, realm_id, method, path' }, 400);
      }

      const baseUrl = qbEnv === 'production'
        ? `https://quickbooks.api.intuit.com/v3/company/${realm_id}`
        : `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}`;

      try {
        const fetchOpts = {
          method,
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        };
        if (payload) fetchOpts.body = JSON.stringify(payload);

        const resp = await fetch(`${baseUrl}${path}`, fetchOpts);
        const data = await resp.json();
        return corsResponse(data, resp.status);
      } catch (err) {
        return corsResponse({ error: 'QB API request failed', message: err.message }, 500);
      }
    }

    // ── Static assets — pass everything else through ─────────────────
    return env.ASSETS.fetch(request);
  },
};
