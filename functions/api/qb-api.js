// functions/api/qb-api.js
// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Function — QuickBooks API proxy.
// Replaces netlify/functions/qb-api.js
//
// Routes all QB API calls (customer query/create, invoice create) server-side
// to avoid CORS restrictions on the QuickBooks API.
// ─────────────────────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request } = context;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const { access_token, realm_id, method, path, payload, env } = body;

  if (!access_token || !realm_id || !method || !path) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: access_token, realm_id, method, path' }),
      { status: 400, headers }
    );
  }

  const baseUrl = env === 'production'
    ? `https://quickbooks.api.intuit.com/v3/company/${realm_id}`
    : `https://sandbox-quickbooks.api.intuit.com/v3/company/${realm_id}`;

  const url = `${baseUrl}${path}`;

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

    const response = await fetch(url, fetchOpts);
    const data = await response.json();

    return new Response(JSON.stringify(data), { status: response.status, headers });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'QB API request failed', message: err.message }),
      { status: 500, headers }
    );
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
