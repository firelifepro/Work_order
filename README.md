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
When the google extention changes you have to redeploy because it will cache the old ones.  That gives you a new url.  You need to add the url from the google extention app script to each of the .html pages in the APPS_SCRIPT_URL
also run set secret



Log Verbosity — Two Switches
Browser side (HTML pages): There's now a let flipsLogLevel = 'NORMAL' constant near the top of each page. In NORMAL mode, only WARN, ERROR, and the two key OK events (WO_SAVED, INVOICE_CREATED) are sent to the sheet — maybe 2-3 rows per work order instead of 10+. To turn it up temporarily without redeploying, open browser DevTools console and type:
flipsLogLevel = 'VERBOSE'
Set it back to 'NORMAL' the same way, or just refresh the page.
Apps Script side: The same logic lives in maybeLog() — INFO rows are suppressed in NORMAL mode, WARN/ERROR always write. To switch the Apps Script verbosity without editing code, go to Project Settings → Script Properties and add/change LOG_LEVEL to VERBOSE or NORMAL. No re-deploy needed since it's read at runtime via PropertiesService.



Done. Here's the summary:

10 JS files in js/:

File	Lines	Contents
inspection-config.js	      44	Constants, global state vars, SYS_META
inspection-utils.js	        83	todayMT, buildFileSlug, toast, escHtml, setStatus, photo management
inspection-nav.js	          763	Step wizard, FA/SP multi-step nav, start/exit/proceed functions
inspection-google.js	      593	Auth, sheet loading, property selection, building config, system toggles, form building
inspection-panels.js	      1,655	Panel builder helpers + all 13 system panel builders + extinguisher logic + ESL logic
inspection-deficiencies.js	1,175	FA devices/checklists, SP/FA/generic PF handlers, deficiency tracking, signatures, overall status
inspection-drafts.js	      754	Draft modal, save/load/restore drafts, Drive folder mgmt, property profiles
inspection-pdf.js	          1,243	collectAllData, restorePanelFields, buildPDFDoc (jsPDF)
inspection-pdf-editable.js	2,454	All pdf-lib builders (FA, SP, Ext, ESL, Generic)
inspection-main.js	        233	saveAndDownload, startNewInspection, window.onload
