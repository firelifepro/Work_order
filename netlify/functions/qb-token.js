// netlify/functions/qb-token.js
// ─────────────────────────────────────────────────────────────────────────────
// QuickBooks OAuth2 token exchange proxy.
// The browser cannot call the QB token endpoint directly (CORS restriction),
// so this serverless function does it server-side and returns the tokens.
//
// Environment variables required (set in Netlify dashboard → Site → Environment):
//   QB_CLIENT_ID      — your QB OAuth2 Client ID
//   QB_CLIENT_SECRET  — your QB OAuth2 Client Secret
// ─────────────────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // CORS headers — allow your Netlify site to call this function
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { grant_type, code, refresh_token, redirect_uri } = body;

  if (!grant_type) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing grant_type' }) };
  }

  const QB_CLIENT_ID     = process.env.QB_CLIENT_ID;
  const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET;

  if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'QB_CLIENT_ID or QB_CLIENT_SECRET not set in Netlify environment variables' })
    };
  }

  // Build form body for QB token endpoint
  const params = new URLSearchParams();
  params.append('grant_type', grant_type);

  if (grant_type === 'authorization_code') {
    if (!code || !redirect_uri) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing code or redirect_uri' }) };
    }
    params.append('code', code);
    params.append('redirect_uri', redirect_uri);
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing refresh_token' }) };
    }
    params.append('refresh_token', refresh_token);
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unsupported grant_type' }) };
  }

  // Base64 encode credentials
  const credentials = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64');

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
      return {
        statusCode: response.status, headers,
        body: JSON.stringify({ error: 'QB token exchange failed', details: data })
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (err) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Network error calling QB', message: err.message })
    };
  }
};
