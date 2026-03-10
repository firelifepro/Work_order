// functions/api/qb-token.js
// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Function — QuickBooks OAuth2 token exchange proxy.
// Replaces netlify/functions/qb-token.js
//
// Environment variables (set in Cloudflare dashboard → Pages → Settings → Variables):
//   QB_CLIENT_ID      — your QB OAuth2 Client ID
//   QB_CLIENT_SECRET  — your QB OAuth2 Client Secret
// ─────────────────────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;

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

  const { grant_type, code, refresh_token, redirect_uri } = body;

  if (!grant_type) {
    return new Response(JSON.stringify({ error: 'Missing grant_type' }), { status: 400, headers });
  }

  const QB_CLIENT_ID     = env.QB_CLIENT_ID;
  const QB_CLIENT_SECRET = env.QB_CLIENT_SECRET;

  if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: 'QB_CLIENT_ID or QB_CLIENT_SECRET not set in environment variables' }),
      { status: 500, headers }
    );
  }

  const params = new URLSearchParams();
  params.append('grant_type', grant_type);

  if (grant_type === 'authorization_code') {
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing code or redirect_uri' }), { status: 400, headers });
    }
    params.append('code', code);
    params.append('redirect_uri', redirect_uri);
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return new Response(JSON.stringify({ error: 'Missing refresh_token' }), { status: 400, headers });
    }
    params.append('refresh_token', refresh_token);
  } else {
    return new Response(JSON.stringify({ error: 'Unsupported grant_type' }), { status: 400, headers });
  }

  const credentials = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);

  try {
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'QB token exchange failed', details: data }),
        { status: response.status, headers }
      );
    }

    return new Response(JSON.stringify(data), { status: 200, headers });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Network error calling QB', message: err.message }),
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
