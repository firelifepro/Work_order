/* ── Setup guide ── */

#setup-guide {
  background: #fff8e1;
  border: 1px solid #ffe082;
  border-left: 4px solid #f9a825;
  border-radius: 4px;
  margin-bottom: 18px;
  font-size: 0.82rem;
}
#setup-guide summary {
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 600;
  color: #7b5800;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
}
#setup-guide .guide-body { padding: 0 14px 14px; }
.step { display: flex; gap: 10px; margin-top: 10px; color: #444; line-height: 1.5; }
.step-n {
  background: #f9a825; color: white; border-radius: 50%;
  width: 22px; height: 22px; display: flex; align-items: center;
  justify-content: center; font-size: 0.72rem; font-weight: 700; flex-shrink: 0;
}
.step a { color: #2e6da4; font-weight: 600; }
code { background: #ffe082; padding: 1px 5px; border-radius: 3px; font-size: 0.78rem; }

<details id="setup-guide">
  <summary>⚙️ First-time Google setup — click to expand</summary>
  <div class="guide-body">
    <div class="step"><div class="step-n">1</div><div>Go to <a href="https://console.cloud.google.com" target="_blank">console.cloud.google.com</a>, sign in with the Google account that owns your Drive, and create a new project (e.g. <code>FLIPS Work Orders</code>).</div></div>
    <div class="step"><div class="step-n">2</div><div>Go to <strong>APIs & Services → Library</strong>. Enable: <code>Google Sheets API</code>, <code>Google Drive API</code>, and <code>Google Docs API</code>.</div></div>
    <div class="step"><div class="step-n">3</div><div>Go to <strong>APIs & Services → Credentials → Create Credentials → API Key</strong>. Copy and paste it into the <strong>API Key</strong> field above.</div></div>
    <div class="step"><div class="step-n">4</div><div>On the same page, click <strong>Create Credentials → OAuth 2.0 Client ID → Web Application</strong>. Under <em>Authorized JavaScript origins</em>, add the full URL where you open this file (e.g. <code>file://</code> won't work — you need to serve it, even locally via VS Code Live Server or Python's <code>http.server</code>). Copy the Client ID above.</div></div>
    <div class="step"><div class="step-n">5</div><div>Click <strong>Connect</strong>, sign in once, and the property dropdown will load from your Google Sheet automatically.</div></div>
    <div class="step"><div class="step-n">💡</div><div><strong>Running locally?</strong> Open Terminal and run: <code>python3 -m http.server 8080</code> in the folder containing this file, then open <code>http://localhost:8080/FireLifeProtection_WorkOrder_Master.html</code>. Add <code>http://localhost:8080</code> as an authorized origin in your OAuth Client ID.</div></div>
  </div>
</details>
