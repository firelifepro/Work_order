// ─────────────────────────────────────────────────────────────────────────────
// PANEL BUILDER HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function makePanel(id, icon, title, bodyHtml) {
  const div = document.createElement('div');
  div.className = 'sys-panel';
  div.id = 'panel-' + id;
  div.innerHTML = `
    <div class="sys-panel-header" id="panel-hdr-${id}" onclick="togglePanel('${id}')">
      <span>${icon}</span><span>${title}</span>
      <span class="defic-badge" id="panel-badge-${id}">0 defic.</span>
      <span class="collapse-arrow">▼</span>
    </div>
    <div class="sys-panel-body" id="panel-body-${id}">${bodyHtml}</div>`;
  return div;
}

function togglePanel(id) {
  const header = document.querySelector('#panel-' + id + ' .sys-panel-header');
  const body   = document.getElementById('panel-body-' + id);
  header.classList.toggle('collapsed');
  body.classList.toggle('hidden');
}

function makeRow(itemId, label, sublabel, opts) {
  const extra = opts || {};
  const naBtn = extra.noNA ? '' : `<button class="pf-btn na" onclick="setPF(this,'${itemId}','N/A')">N/A</button>`;
  return `
    <div class="inspect-row" id="row-${itemId}">
      <div class="inspect-row-top">
        <div class="inspect-label">${label}${sublabel ? `<small>${sublabel}</small>` : ''}</div>
        <div class="pf-group">
          <button class="pf-btn pass" onclick="setPF(this,'${itemId}','PASS')">PASS</button>
          <button class="pf-btn fail" onclick="setPF(this,'${itemId}','FAIL')">FAIL</button>
          ${naBtn}
        </div>
      </div>
      <div class="deficiency-row" id="defic-${itemId}">
        <input type="text" id="defic-txt-${itemId}" placeholder="Describe deficiency / location…" oninput="updateDeficiencySummary()">
      </div>
    </div>`;
}

function dataRow(...fields) {
  const cols = fields.length <= 2 ? 2 : (fields.length === 3 ? 3 : 2);
  const clsMap = { 2: 'cols-2', 3: 'cols-3', 1: 'cols-1' };
  const html = fields.map(f => `
    <div class="data-field">
      <label>${f.label}</label>
      <input type="${f.type||'text'}" id="${f.id}" placeholder="${f.placeholder||''}">
    </div>`).join('');
  return `<div class="data-row ${cols === 3 ? 'cols-3' : ''}">${html}</div>`;
}

function sectionDiv(title) {
  return `<div class="sys-section">${title}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PANELS
// ─────────────────────────────────────────────────────────────────────────────
function buildFireAlarmPanel() {
  const body = `
    ${sectionDiv('Control Panel Information')}
    ${dataRow(
      {id:'fa-cp-make',     label:'Panel Make (Manufacturer)', placeholder:'e.g. Honeywell, EST, Simplex'},
      {id:'fa-cp-model',    label:'Panel Model'},
      {id:'fa-cp-serial',   label:'Serial #'}
    )}
    ${dataRow(
      {id:'fa-cp-location', label:'Panel Location'},
      {id:'fa-cp-type',     label:'Panel Type', placeholder:'e.g. Addressable, Conventional'},
      {id:'fa-cp-zones',    label:'# Zones / Loops', type:'number'}
    )}
    ${dataRow(
      {id:'fa-cp-year',         label:'Year Installed', type:'number'},
      {id:'fa-cp-batt-date',    label:'Battery Install Date', type:'date'}
    )}

    ${sectionDiv('Dialer / Radio Communicator')}
    ${dataRow(
      {id:'fa-dr-make',     label:'Dialer / Radio Make'},
      {id:'fa-dr-model',    label:'Model'},
      {id:'fa-dr-location', label:'Location'},
      {id:'fa-dr-type',     label:'Type', placeholder:'e.g. GSM, DACT, IP'}
    )}

    ${sectionDiv('Monitoring')}
    <div class="data-row cols-3">
      <div class="data-field">
        <label>Is System Monitored?</label>
        <select id="fa-monitored">
          <option value="">— Select —</option>
          <option>Yes</option>
          <option>No</option>
        </select>
      </div>
      <div class="data-field"><label>Monitoring Company</label><input type="text" id="fa-monitor-company"></div>
      <div class="data-field"><label>Account #</label><input type="text" id="fa-monitor-account"></div>
    </div>
    ${dataRow(
      {id:'fa-monitor-phone',   label:'Monitoring Phone'},
      {id:'fa-monitor-offline', label:'Time Offline', type:'time'},
      {id:'fa-monitor-online',  label:'Time Online',  type:'time'}
    )}
    <div class="data-row cols-1" style="margin-bottom:8px;">
      <div class="data-field"><label>Monitoring Notes</label><input type="text" id="fa-monitor-notes"></div>
    </div>

    ${sectionDiv('Panel Testing / Disable Instructions')}
    <div class="data-field" style="margin-bottom:8px;">
      <textarea id="fa-panel-instructions" rows="4" placeholder="Describe panel disable/enable procedure, access codes, key locations…" style="border:1.5px solid var(--border);border-radius:6px;padding:8px 10px;font-size:.82rem;font-family:inherit;color:var(--navy);outline:none;width:100%;background:#fafafa;resize:vertical;"></textarea>
    </div>

    ${sectionDiv('Pre-Inspection Checklist')}
    <div id="fa-pre-checklist"></div>

    ${sectionDiv('Control Panel & Power')}
    ${makeRow('fa-panel-cond','Control Panel Condition','Visual — no damage, labels intact')}
    ${makeRow('fa-battery','Battery / Backup Power','24-hr minimum backup; date on batteries')}
    ${makeRow('fa-batt-date','Battery Date Check','Replace if > 3 years or failed load test')}
    ${makeRow('fa-ac-power','AC Power Indicator','Green LED illuminated')}
    ${makeRow('fa-tamper','Tamper Signals','All supervisory tampers tested and restored')}
    ${makeRow('fa-trouble','Trouble Signals','No active troubles on panel')}

    ${sectionDiv('Detection Devices')}
    ${dataRow(
      {id:'fa-smoke-count', label:'# Smoke Detectors',  type:'number'},
      {id:'fa-heat-count',  label:'# Heat Detectors',   type:'number'},
      {id:'fa-pull-count',  label:'# Pull Stations',    type:'number'}
    )}
    ${makeRow('fa-smoke-test','Smoke Detectors Functional','Representative sample tested per NFPA 72')}
    ${makeRow('fa-heat-test','Heat Detectors Functional','Fixed temp or rate-of-rise — tested')}
    ${makeRow('fa-pull-test','Manual Pull Stations','Each pull station tested')}
    ${makeRow('fa-duct-smoke','Duct Smoke Detectors','Tested per NFPA 72 — HVAC shut down confirmed')}
    ${makeRow('fa-co','CO Detectors (if present)','Functional test performed')}

    ${sectionDiv('Notification Appliances')}
    ${makeRow('fa-horns','Horns / Strobes / Speakers','Audible and visual — all activated')}
    ${makeRow('fa-horn-sync','Horn Synchronization','Synchronized properly')}
    ${makeRow('fa-mass-notif','Mass Notification (if present)','Message clarity and audibility confirmed')}

    ${sectionDiv('Auxiliary — Annual Only')}
    <div class="inspect-row">
      <div class="inspect-row-top">
        <div class="inspect-label">Visual notification present &amp; operational? <small>Strobes, combos — unobstructed, synchronized on alarm</small></div>
        <div class="pf-group">
          <button class="pf-btn pass" onclick="setFAPF(this)">PASS</button>
          <button class="pf-btn fail" onclick="setFAPF(this)">FAIL</button>
          <button class="pf-btn na"   onclick="setFAPF(this)">N/A</button>
        </div>
      </div>
    </div>
    <div class="inspect-row">
      <div class="inspect-row-top">
        <div class="inspect-label">Audible notification present &amp; operational? <small>Bells, chimes, horns — audible in all required areas</small></div>
        <div class="pf-group">
          <button class="pf-btn pass" onclick="setFAPF(this)">PASS</button>
          <button class="pf-btn fail" onclick="setFAPF(this)">FAIL</button>
          <button class="pf-btn na"   onclick="setFAPF(this)">N/A</button>
        </div>
      </div>
    </div>
    <div class="data-row cols-1" style="margin:6px 0 10px;">
      <div class="data-field"><label>A/V Notes</label><input type="text" id="fa-av-notes"></div>
    </div>
    <div class="inspect-row">
      <div class="inspect-row-top">
        <div class="inspect-label">Door holders present &amp; release on alarm? <small>Magnetic locks, card access — release and close as intended</small></div>
        <div class="pf-group">
          <button class="pf-btn pass" onclick="setFAPF(this)">PASS</button>
          <button class="pf-btn fail" onclick="setFAPF(this)">FAIL</button>
          <button class="pf-btn na"   onclick="setFAPF(this)">N/A</button>
        </div>
      </div>
    </div>
    <div class="data-row cols-1" style="margin:6px 0 10px;">
      <div class="data-field"><label>Door Holder Notes</label><input type="text" id="fa-door-notes"></div>
    </div>
    <div class="inspect-row">
      <div class="inspect-row-top">
        <div class="inspect-label">HVAC shutdown on alarm? <small>Tested and confirmed functional</small></div>
        <div class="pf-group">
          <button class="pf-btn pass" onclick="setFAPF(this)">PASS</button>
          <button class="pf-btn fail" onclick="setFAPF(this)">FAIL</button>
          <button class="pf-btn na"   onclick="setFAPF(this)">N/A</button>
        </div>
      </div>
    </div>
    ${dataRow(
      {id:'fa-hvac-method', label:'HVAC Control Method', placeholder:'e.g. Relay, BACnet, Direct wired'},
      {id:'fa-hvac-notes',  label:'HVAC Notes'}
    )}

    ${sectionDiv('Sub Panel / Power Supply')}
    <div style="overflow-x:auto;">
      <table class="dyn-table" id="fa-subpanel-table">
        <thead>
          <tr>
            <th>Location</th><th>Make</th><th>Model</th><th>Address</th>
            <th>Panel/Circuit</th><th>Amps/Style</th><th>Avail. NACs</th>
            <th>Install Date</th><th>(L) Batt Load</th><th>(R) Batt Load</th>
            <th>SPVSD?</th><th style="width:80px;">Pass/Fail</th><th style="width:30px;"></th>
          </tr>
        </thead>
        <tbody id="fa-subpanel-tbody"></tbody>
      </table>
    </div>
    <button class="add-row-btn" onclick="addFASubpanelRow()">+ Add Sub Panel / Power Supply</button>

    ${sectionDiv('Device Testing Summary')}
    <p style="font-size:.72rem;color:var(--slate);margin-bottom:6px;">PASS = Functional/Visual  |  FAIL = Failed Test  |  NT = Not Tested  |  NF = Not Found</p>
    <div style="overflow-x:auto;">
      <table class="dev-table" id="fa-device-table">
        <thead>
          <tr>
            <th class="left" style="min-width:150px;">Device / System</th>
            <th>Key</th>
            <th>Total</th>
            <th>Pass #</th>
            <th>Fail #</th>
            <th>% Pass</th>
            <th>% Fail</th>
            <th>Not Tested</th>
            <th>Not Found</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody id="fa-device-tbody"></tbody>
      </table>
    </div>

    ${sectionDiv('On-Site System Notes')}
    <div style="overflow-x:auto;">
      <table class="dyn-table">
        <thead><tr><th style="min-width:160px;">Equipment</th><th style="width:130px;">Condition</th><th>Notes &amp; Observations</th></tr></thead>
        <tbody>
          <tr><td><input type="text" id="fa-onsite-eq-1" value="Fire Alarm Control Panel"></td><td><input type="text" id="fa-onsite-cond-1"></td><td><input type="text" id="fa-onsite-notes-1"></td></tr>
          <tr><td><input type="text" id="fa-onsite-eq-2" value="Initiating Devices"></td><td><input type="text" id="fa-onsite-cond-2"></td><td><input type="text" id="fa-onsite-notes-2"></td></tr>
          <tr><td><input type="text" id="fa-onsite-eq-3" value="Power Supplies"></td><td><input type="text" id="fa-onsite-cond-3"></td><td><input type="text" id="fa-onsite-notes-3"></td></tr>
          <tr><td><input type="text" id="fa-onsite-eq-4" value="Graphic Maps / Annunciators"></td><td><input type="text" id="fa-onsite-cond-4"></td><td><input type="text" id="fa-onsite-notes-4"></td></tr>
          <tr><td><input type="text" id="fa-onsite-eq-5" value="Other"></td><td><input type="text" id="fa-onsite-cond-5"></td><td><input type="text" id="fa-onsite-notes-5"></td></tr>
        </tbody>
      </table>
    </div>

    ${sectionDiv('Device Locations — Detection')}
    <div style="overflow-x:auto;">
      <table class="dyn-table">
        <thead>
          <tr><th style="width:80px;">Type</th><th>Location</th><th style="width:90px;">Address</th><th style="width:90px;">Alarm</th><th style="width:100px;">Supervisory</th><th style="width:70px;">Note #</th><th style="width:30px;"></th></tr>
        </thead>
        <tbody id="fa-detection-tbody"></tbody>
      </table>
    </div>
    <button class="add-row-btn" onclick="addFADetectionRow()">+ Add Device</button>

    ${sectionDiv('Device Locations — Flow Switches')}
    <div style="overflow-x:auto;">
      <table class="dyn-table">
        <thead>
          <tr><th style="width:80px;">Type</th><th>Location</th><th style="width:90px;">Scan ID</th><th style="width:90px;">Address</th><th style="width:110px;">Supervisory</th><th style="width:80px;">Seconds</th><th style="width:30px;"></th></tr>
        </thead>
        <tbody id="fa-flow-tbody"></tbody>
      </table>
    </div>
    <button class="add-row-btn" onclick="addFAFlowRow()">+ Add Flow Switch</button>

    ${sectionDiv('Device Locations — Tamper Switches')}
    <div style="overflow-x:auto;">
      <table class="dyn-table">
        <thead>
          <tr><th style="width:80px;">Type</th><th>Location</th><th style="width:90px;">Scan ID</th><th style="width:90px;">Address</th><th style="width:110px;">Supervisory</th><th>Notes</th><th style="width:30px;"></th></tr>
        </thead>
        <tbody id="fa-tamper-tbody"></tbody>
      </table>
    </div>
    <button class="add-row-btn" onclick="addFATamperRow()">+ Add Tamper Switch</button>

    ${sectionDiv('Supervisory & Monitoring')}
    ${makeRow('fa-valve-super','Valve Supervisory Switches','All closed valves indicated on panel')}
    ${makeRow('fa-waterflow','Waterflow Alarms','Flow alarm activates within 90 seconds')}
    ${makeRow('fa-monitoring-test','Central Station Transmission','Alarm and trouble signals received at CS')}
    ${makeRow('fa-annunciator','Remote Annunciators','Indicating correct zones')}
    ${makeRow('fa-elevator','Elevator Recall (if present)','Floor-level and lobby recall tested')}
    ${makeRow('fa-door-release','Door Holders / Door Release','All released on alarm')}
    ${makeRow('fa-suppression-rel','Suppression System Release','Agent release tested (if applicable)')}

    ${sectionDiv('Documentation & Tags')}
    ${makeRow('fa-tags','Panel Tags / Labels','Current inspection tag affixed')}
    ${makeRow('fa-logbook','System Log / As-Builts Available','On-site documentation accessible')}

    ${sectionDiv('Post-Inspection Checklist')}
    <div id="fa-post-checklist"></div>

    ${sectionDiv('Failed Batteries')}
    <div style="overflow-x:auto;">
      <table class="dyn-table">
        <thead>
          <tr><th style="width:80px;">Size (AH)</th><th style="width:100px;">Type</th><th style="width:60px;">Count</th><th>Locations</th><th style="width:30px;"></th></tr>
        </thead>
        <tbody id="fa-battery-tbody"></tbody>
      </table>
    </div>
    <button class="add-row-btn" onclick="addFABatteryRow()">+ Add Failed Battery</button>

    <div class="field-group" style="margin-top:12px;">
      <label style="font-size:.66rem;font-weight:700;color:var(--slate);text-transform:uppercase;letter-spacing:.05em;">Fire Alarm System Notes</label>
      <textarea id="fa-notes" rows="3" placeholder="Additional notes, observations…" style="border:1.5px solid var(--border);border-radius:6px;padding:8px 10px;font-size:.82rem;font-family:inherit;color:var(--navy);outline:none;width:100%;background:#fafafa;resize:vertical;min-height:56px;margin-top:4px;"></textarea>
    </div>`;
  return makePanel('fire-alarm', '🔔', 'Fire Alarm System (NFPA 72)', body);
}

function buildSprinklerPanel() {
  const body = `
    ${sectionDiv('System Configuration')}
    <div class="data-row cols-3">
      <div class="data-field"><label>System Type</label>
        <select id="sp-type"><option>Wet Pipe</option><option>Dry Pipe</option><option>Pre-Action</option><option>Deluge</option><option>Foam-Water</option><option>Glycol</option><option>Nitrogen-Filled</option></select>
      </div>
      <div class="data-field"><label>Manufacturer / Make</label><input type="text" id="sp-mfr"></div>
      <div class="data-field"><label>Year Installed</label><input type="number" id="sp-year"></div>
    </div>
    ${dataRow(
      {id:'sp-heads',    label:'Total # of Sprinkler Heads', type:'number'},
      {id:'sp-coverage', label:'Coverage Area (sq ft)', type:'number'},
      {id:'sp-hazard',   label:'Hazard Classification'}
    )}
    ${dataRow(
      {id:'sp-water-src', label:'Water Supply Source'},
      {id:'sp-static-psi',label:'Static Pressure (PSI)', type:'number'},
      {id:'sp-residual-psi', label:'Residual Pressure (PSI)', type:'number'}
    )}

    ${sectionDiv('Valves & Controls')}
    ${makeRow('sp-main-drain','Main Drain Test','Static and residual pressures recorded')}
    ${makeRow('sp-control-valve','Control Valve(s) Open & Supervised','All open; tamper switches operational')}
    ${makeRow('sp-os-y','OS&Y / Gate Valves','All fully open and locked/chained')}
    ${makeRow('sp-piv','Post Indicator Valves (PIV)','Open and supervised; tamper alarm tested')}
    ${makeRow('sp-check-valve','Check Valves','No back-flow; proper operation')}
    ${makeRow('sp-gauges','Pressure Gauges','Calibrated or replaced within 5 years')}

    ${sectionDiv('Waterflow Alarm')}
    ${makeRow('sp-waterflow','Waterflow Alarm Test','Activates within 90 seconds via inspector test connection')}
    ${makeRow('sp-waterflow-cs','Central Station Transmission','CS received waterflow alarm')}
    ${dataRow({id:'sp-wf-time', label:'Waterflow Response Time (sec)', type:'number'})}

    ${sectionDiv('Sprinkler Heads')}
    ${makeRow('sp-heads-visual','Visual Inspection of Heads','100% — no damage, paint, corrosion, obstructions')}
    ${makeRow('sp-heads-clearance','18-inch Clearance Below Heads','Storage below 18" of any deflector')}
    ${makeRow('sp-spare-heads','Spare Sprinkler Head Cabinet','Correct type/temp rating; wrench present')}
    ${makeRow('sp-head-type-match','Head Type Consistency','All listed and appropriate for hazard')}
    ${dataRow({id:'sp-spare-types', label:'Spare Head Types in Cabinet'})}

    ${sectionDiv('Pipe & Hangers')}
    ${makeRow('sp-pipe-visual','Pipe Visual Inspection','No damage, corrosion, leaks, missing hangers')}
    ${makeRow('sp-hanger-spacing','Hanger Spacing & Condition','Per NFPA 13 requirements')}
    ${makeRow('sp-pipe-support','Seismic Bracing (if req\'d)','Intact and undamaged')}

    ${sectionDiv('Dry Pipe / Pre-Action (if applicable)')}
    ${makeRow('sp-air-pressure','Air/Nitrogen Pressure','At set pressure — no excessive leakage')}
    ${makeRow('sp-dp-valve','Dry Pipe / Deluge Valve','No corrosion; priming water level correct')}
    ${makeRow('sp-low-air','Low Air Alarm','Tested and transmitted to panel')}
    ${makeRow('sp-quick-open','Quick Opening Device (if present)','Operational')}
    ${dataRow(
      {id:'sp-trip-date', label:'Last Trip Test Date', type:'date'},
      {id:'sp-trip-psi',  label:'Trip Pressure (PSI)', type:'number'}
    )}

    ${sectionDiv('5-Year Items (if due)')}
    ${makeRow('sp-5yr-pipe','5-Year Internal Pipe Inspection','Obstruction investigation performed',{noNA:false})}
    ${makeRow('sp-5yr-fdc','FDC Hydrostatic / Forward Flow Test','200 PSI for 2 hrs or per standard',{noNA:false})}
    ${makeRow('sp-gauges-5yr','Gauge Replacement / Recalibration','All gauges replaced or tested',{noNA:false})}
    ${dataRow({id:'sp-5yr-due', label:'5-Year Items Next Due Date', type:'date'})}

    <div class="field-group" style="margin-top:8px;">
      <label>Sprinkler System Notes</label>
      <textarea id="sp-notes" rows="3"></textarea>
    </div>`;
  return makePanel('sprinkler', '💧', 'Sprinkler System (NFPA 25)', body);
}

function buildFirePumpPanel() {
  const body = `
    ${sectionDiv('Pump Information')}
    ${dataRow(
      {id:'fp-mfr',      label:'Pump Manufacturer'},
      {id:'fp-model',    label:'Model'},
      {id:'fp-serial',   label:'Serial #'}
    )}
    ${dataRow(
      {id:'fp-type',     label:'Driver Type (Electric/Diesel)'},
      {id:'fp-rated-gpm',label:'Rated GPM', type:'number'},
      {id:'fp-rated-psi',label:'Rated PSI', type:'number'}
    )}
    ${dataRow(
      {id:'fp-rpm',      label:'Rated RPM', type:'number'},
      {id:'fp-hp',       label:'Horsepower', type:'number'},
      {id:'fp-year',     label:'Year Installed', type:'number'}
    )}

    ${sectionDiv('Controller & Jockey Pump')}
    ${makeRow('fp-controller-cond','Fire Pump Controller Condition','No damage; door closed; no alarms')}
    ${makeRow('fp-controller-auto','Controller in AUTO','Selector switch in AUTO position')}
    ${makeRow('fp-jockey-type','Jockey Pump (Pressure Maintenance)','Present and operational')}
    ${dataRow(
      {id:'fp-jockey-start',  label:'Jockey Start Pressure (PSI)', type:'number'},
      {id:'fp-jockey-stop',   label:'Jockey Stop Pressure (PSI)', type:'number'}
    )}
    ${makeRow('fp-jockey-cycles','Jockey Pump Cycling','Starts and stops within normal range')}

    ${sectionDiv('Churn / No-Flow Test')}
    ${makeRow('fp-churn-test','Churn Test Performed','No-flow test for rated speed')}
    ${dataRow(
      {id:'fp-churn-suction', label:'Churn Suction Pressure (PSI)', type:'number'},
      {id:'fp-churn-discharge',label:'Churn Discharge Pressure (PSI)', type:'number'},
      {id:'fp-churn-rpm',     label:'Churn RPM', type:'number'}
    )}
    ${dataRow(
      {id:'fp-churn-volts',   label:'Voltage (all phases)', placeholder:'e.g. 480/480/480'},
      {id:'fp-churn-amps',    label:'Amps (all phases)', placeholder:'e.g. 42/42/42'}
    )}

    ${sectionDiv('100% Flow Test (Annual)')}
    ${makeRow('fp-flow-test','100% Rated Flow Test','GPM, PSI, RPM at rated load')}
    ${dataRow(
      {id:'fp-flow-gpm',      label:'Flow Rate (GPM)', type:'number'},
      {id:'fp-flow-suction',  label:'Suction Pressure (PSI)', type:'number'},
      {id:'fp-flow-discharge',label:'Discharge Pressure (PSI)', type:'number'}
    )}
    ${dataRow(
      {id:'fp-flow-rpm',      label:'RPM at Flow', type:'number'},
      {id:'fp-flow-volts',    label:'Voltage at Flow'},
      {id:'fp-flow-amps',     label:'Amps at Flow'}
    )}

    ${sectionDiv('Diesel Engine (if applicable)')}
    ${makeRow('fp-diesel-start','Engine Auto Start','Starts within 10 seconds')}
    ${makeRow('fp-diesel-fuel','Fuel Level (≥2/3 full)','Adequate fuel for full run')}
    ${makeRow('fp-diesel-battery','Engine Batteries','Both main and backup fully charged')}
    ${makeRow('fp-diesel-coolant','Coolant Level','Within acceptable range')}
    ${makeRow('fp-diesel-run','Engine Run Time','Ran minimum 30 minutes under load')}
    ${dataRow(
      {id:'fp-diesel-oil',    label:'Oil Pressure (PSI)', type:'number'},
      {id:'fp-diesel-temp',   label:'Coolant Temp (°F)', type:'number'},
      {id:'fp-diesel-hours',  label:'Engine Hours', type:'number'}
    )}

    ${sectionDiv('Alarms & Supervision')}
    ${makeRow('fp-power-fail-alarm','Power Failure Alarm','Loss of power transmitted to fire alarm panel')}
    ${makeRow('fp-phase-alarm','Phase Reversal / Loss Alarm','Tested and operational')}
    ${makeRow('fp-room-temp','Pump Room Temperature','Maintained above 40°F')}
    ${makeRow('fp-suction-valve','Suction Valve Open & Supervised','Fully open; tamper alarm tested')}`;
  return makePanel('fire-pump', '🔄', 'Fire Pump (NFPA 25 Ch. 8)', body);
}

function buildStandpipePanel() {
  const body = `
    ${sectionDiv('System Information')}
    <div class="data-row cols-3">
      <div class="data-field"><label>Standpipe Class</label>
        <select id="std-class"><option>Class I (FD use)</option><option>Class II (Occupant use)</option><option>Class III (Combined)</option></select>
      </div>
      <div class="data-field"><label>System Type</label>
        <select id="std-type"><option>Wet</option><option>Dry</option><option>Manual Wet</option><option>Manual Dry</option><option>Semi-Automatic Dry</option></select>
      </div>
      <div class="data-field"><label># of Standpipes / Risers</label><input type="number" id="std-count"></div>
    </div>
    ${dataRow(
      {id:'std-floors', label:'# of Floors Served', type:'number'},
      {id:'std-hose-stations', label:'# of Hose Stations', type:'number'}
    )}

    ${sectionDiv('Hose Connections & Valves')}
    ${makeRow('std-fdc','FDC (Fire Dept. Connection) Condition','Caps secure; no damage; plugs present')}
    ${makeRow('std-fdc-sign','FDC Signage','Properly identified with address')}
    ${makeRow('std-hose-valves','Hose Valves — All Floors','Operate freely; no leaks; identified')}
    ${makeRow('std-prv','Pressure Reducing Valves (PRV)','Static ≤ 175 PSI; residual ≥ 100 PSI at outlet')}
    ${dataRow(
      {id:'std-prv-static',   label:'PRV Static Pressure (PSI)', type:'number'},
      {id:'std-prv-residual', label:'PRV Residual Pressure (PSI)', type:'number'}
    )}
    ${makeRow('std-check-valve','Check Valves','Proper operation; no back-flow')}

    ${sectionDiv('Flow Test')}
    ${makeRow('std-flow-test','Flow Test (Every 5 Years)','Highest outlet flowed at minimum requirements')}
    ${dataRow(
      {id:'std-flow-psi',   label:'Flow Test Pressure (PSI)', type:'number'},
      {id:'std-flow-gpm',   label:'Flow Rate (GPM)', type:'number'},
      {id:'std-flow-date',  label:'Last Flow Test Date', type:'date'}
    )}

    ${sectionDiv('Hose Equipment (Class II/III)')}
    ${makeRow('std-hose-cond','Hose Condition','No damage, mold, mildew; properly racked')}
    ${makeRow('std-nozzle','Nozzle Condition','Present, undamaged, compatible type')}
    ${makeRow('std-cabinet','Hose Cabinet','Accessible; not blocked; label visible')}

    <div class="field-group" style="margin-top:8px;">
      <label>Standpipe Notes</label>
      <textarea id="std-notes" rows="3"></textarea>
    </div>`;
  return makePanel('standpipe', '🚿', 'Standpipe System (NFPA 25 Ch. 6)', body);
}

// ─────────────────────────────────────────────────────────────────────────────
// KITCHEN HOOD — MULTI-HOOD SECTION
// ─────────────────────────────────────────────────────────────────────────────

const HOOD_CHECKLIST_ITEMS = [
  {key:'no-fire-signs',      label:'SYSTEM SHOWS NO VISIBLE SIGNS THAT IT HAS FIRED OR BEEN TAMPERED WITH'},
  {key:'no-design-change',   label:'SYSTEM DESIGN HAS NOT BEEN CHANGED'},
  {key:'fusible-link-test',  label:'FUSIBLE LINK TESTED & SYSTEM ACTIVATED UPON TEST'},
  {key:'pull-station-op',    label:'MANUAL PULL STATION OPERATION & SUCCESSFULLY ACTIVATED SYSTEMS'},
  {key:'conduit-secured',    label:'CONFIRMED ALL CONDUIT & PIPING IS SECURED'},
  {key:'blown-down',         label:'PROPER BLOWN DOWN PERFORMED'},
  {key:'hazard-covered',     label:'EACH HAZARD PROPERLY COVERED WITH CORRECT NOZZLES'},
  {key:'nozzle-caps',        label:'ALL NOZZLE CAPS/SEALS ARE REPLACED & CLEAR OF BLOCKAGE'},
  {key:'pressure-gauge',     label:'CHECKED PRESSURE GAUGE INDICATOR FOR OPERABLE RANGE'},
  {key:'chem-weight',        label:'INTERNAL INSPECTION & CHEMICAL WEIGHT VERIFIED (ANSUL)'},
  {key:'actuation-hose',     label:'ACTUATION HOSE INSPECTED FOR DAMAGE'},
  {key:'exhaust-fan',        label:'VERIFIED EXHAUST FAN IS OPERATIONAL'},
  {key:'makeup-air-pb',      label:'VERIFIED MAKE-UP AIR IS OPERATIONAL (PAINT BOOTH)'},
  {key:'elec-shutdown1',     label:'ELECTRIC SHUT DOWN OPERATIONAL'},
  {key:'makeup-air',         label:'VERIFIED MAKE-UP AIR IS OPERATIONAL'},
  {key:'elec-shutdown2',     label:'ELECTRIC SHUTDOWN OPERATIONAL'},
  {key:'gas-valve',          label:'PROPER OPERATION OF WORKING GAS VALVE(S)'},
  {key:'fan-warning-sign',   label:'FAN WARNING SIGN ON HOOD'},
  {key:'filters-replaced',   label:'ALL FILTERS ARE REPLACED'},
  {key:'service-tag',        label:'INSPECTION & SERVICE TAG ON SYSTEM CYLINDER/MANUAL PULL'},
  {key:'compliant',          label:'SYSTEM IS COMPLIANT'},
  {key:'reset-normal',       label:'SYSTEM RESET TO NORMAL OPERATION'},
  {key:'no-deficiencies',    label:'NO DEFICIENCIES WITH OPERATION OR COVERAGE'},
  {key:'portable-ext',       label:'PROPER HAND HELD PORTABLE EXTINGUISHER(S)'},
  {key:'class-k',            label:'PROPERLY SERVICED (CLASS K IN KITCHEN)'},
];

function _hoodRow(h, key, label) {
  const rowId = `h${h}-${key}`;
  return `
    <div class="inspect-row hood-inspect-row" id="row-${rowId}">
      <div class="inspect-row-top">
        <div class="inspect-label">${label}</div>
        <div class="pf-group">
          <button class="pf-btn pass" onclick="setHoodYNN(this,'${rowId}','Y')">Y</button>
          <button class="pf-btn fail" onclick="setHoodYNN(this,'${rowId}','N')">N</button>
          <button class="pf-btn na"   onclick="setHoodYNN(this,'${rowId}','N/A')">N/A</button>
          <button class="hood-note-btn" onclick="toggleHoodNote('${rowId}')" title="Add note">📝</button>
        </div>
      </div>
      <div class="hood-note-row" id="note-row-${rowId}">
        <input type="text" id="note-${rowId}" placeholder="Note…" class="hood-note-input">
      </div>
    </div>`;
}

function _hoodDateRow(h, key, label) {
  const rowId = `h${h}-${key}`;
  return `
    <div class="inspect-row hood-inspect-row" id="row-${rowId}">
      <div class="inspect-row-top">
        <div class="inspect-label">${label}</div>
        <div class="pf-group" style="gap:4px;flex-wrap:wrap;">
          <span class="hood-date-label">Date:</span>
          <input type="date" id="h${h}-${key}-date" class="hood-date-input">
          <button class="pf-btn pass" onclick="setHoodYNN(this,'${rowId}','Y')">Y</button>
          <button class="pf-btn fail" onclick="setHoodYNN(this,'${rowId}','N')">N</button>
          <button class="pf-btn na"   onclick="setHoodYNN(this,'${rowId}','N/A')">N/A</button>
          <button class="hood-note-btn" onclick="toggleHoodNote('${rowId}')" title="Add note">📝</button>
        </div>
      </div>
      <div class="hood-note-row" id="note-row-${rowId}">
        <input type="text" id="note-${rowId}" placeholder="Note…" class="hood-note-input">
      </div>
    </div>`;
}

function _hoodCardBodyHTML(h) {
  return `
    <div class="hood-sys-section">SYSTEM INFORMATION</div>
    <div class="hood-sys-grid">
      <div class="hood-sys-cell"><label>SYSTEM TYPE</label><input type="text" id="h${h}-sys-type"></div>
      <div class="hood-sys-cell"><label>MANUFACTURER</label><input type="text" id="h${h}-mfr"></div>
      <div class="hood-sys-cell"><label>MODEL</label><input type="text" id="h${h}-model"></div>
      <div class="hood-sys-cell"><label>TEST DATE / LAST HYDRO</label><input type="text" id="h${h}-test-date"></div>
      <div class="hood-sys-cell"><label>CARTRIDGE DATE</label><input type="text" id="h${h}-cart-date"></div>
      <div class="hood-sys-cell"><label>CARTRIDGE WEIGHT</label><input type="text" id="h${h}-cart-weight"></div>
      <div class="hood-sys-cell"><label>6 YR / HYDRO DUE DATE</label><input type="text" id="h${h}-hydro-due"></div>
      <div class="hood-sys-cell">
        <label>U.L 300 COMPLIANT</label>
        <div class="hood-yn-toggle">
          <button class="hood-yn-btn" id="h${h}-ul300-yes" onclick="setUL300(this,${h},'YES')">YES</button>
          <button class="hood-yn-btn" id="h${h}-ul300-no"  onclick="setUL300(this,${h},'NO')">NO</button>
        </div>
        <input type="hidden" id="h${h}-ul300" value="">
      </div>
    </div>

    <div class="hood-sec-hdr">INSPECTION RESULTS</div>
    ${HOOD_CHECKLIST_ITEMS.map(item => _hoodRow(h, item.key, item.label)).join('')}

    <div class="hood-sec-hdr" style="margin-top:10px;">DATE ITEMS</div>
    ${_hoodDateRow(h, 'battery',  'DATES ON MODULAR BATTERY')}
    ${_hoodDateRow(h, 'actuator', 'LINEAR ACTUATOR MANUFACTURER DATE')}

    <div class="hood-sec-hdr" style="margin-top:10px;">OPERATIONS</div>
    <div class="hood-ops-row">
      <span class="hood-ops-label">ELECTRICAL SHUNT LOCATION</span>
      <input type="text" id="h${h}-shunt-loc" class="hood-ops-input" placeholder="Location">
    </div>
    <div class="hood-ops-row" style="align-items:flex-start;">
      <span class="hood-ops-label">GREASE ACCUMULATION</span>
      <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
        <div class="hood-yn-toggle">
          <button class="hood-grease-btn" id="h${h}-grease-low"      onclick="setGrease(this,${h},'LOW')">LOW</button>
          <button class="hood-grease-btn" id="h${h}-grease-moderate" onclick="setGrease(this,${h},'MODERATE')">MODERATE</button>
          <button class="hood-grease-btn" id="h${h}-grease-excessive" onclick="setGrease(this,${h},'EXCESSIVE')">EXCESSIVE</button>
        </div>
        <input type="hidden" id="h${h}-grease" value="">
        <input type="text" id="h${h}-grease-note" class="hood-ops-input" placeholder="Notes">
      </div>
    </div>
    <div class="hood-ops-row" style="align-items:flex-start;">
      <span class="hood-ops-label">VERIFIED OPERATIONS</span>
      <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <div class="hood-verif-group">
            <span class="hood-verif-label">ALARM</span>
            <div class="pf-group" style="gap:2px;">
              <button class="pf-btn pass" onclick="setHoodYNN(this,'h${h}-verif-alarm','Y')">Y</button>
              <button class="pf-btn fail" onclick="setHoodYNN(this,'h${h}-verif-alarm','N')">N</button>
              <button class="pf-btn na"   onclick="setHoodYNN(this,'h${h}-verif-alarm','N/A')">N/A</button>
            </div>
            <input type="hidden" id="row-h${h}-verif-alarm" data-val="">
          </div>
          <div class="hood-verif-group">
            <span class="hood-verif-label">ELEC/LIGHTS</span>
            <div class="pf-group" style="gap:2px;">
              <button class="pf-btn pass" onclick="setHoodYNN(this,'h${h}-verif-elec','Y')">Y</button>
              <button class="pf-btn fail" onclick="setHoodYNN(this,'h${h}-verif-elec','N')">N</button>
              <button class="pf-btn na"   onclick="setHoodYNN(this,'h${h}-verif-elec','N/A')">N/A</button>
            </div>
            <input type="hidden" id="row-h${h}-verif-elec" data-val="">
          </div>
          <div class="hood-verif-group">
            <span class="hood-verif-label">APPLIANCES</span>
            <div class="pf-group" style="gap:2px;">
              <button class="pf-btn pass" onclick="setHoodYNN(this,'h${h}-verif-appl','Y')">Y</button>
              <button class="pf-btn fail" onclick="setHoodYNN(this,'h${h}-verif-appl','N')">N</button>
              <button class="pf-btn na"   onclick="setHoodYNN(this,'h${h}-verif-appl','N/A')">N/A</button>
            </div>
            <input type="hidden" id="row-h${h}-verif-appl" data-val="">
          </div>
        </div>
        <input type="text" id="h${h}-verif-note" class="hood-ops-input" placeholder="Notes">
      </div>
    </div>
    <div class="hood-ops-row" style="align-items:flex-start;">
      <span class="hood-ops-label">REPLACE FUSIBLE LINKS<br><small>(SEMI-ANNUAL)</small></span>
      <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <span style="font-size:0.7rem;font-weight:600;color:var(--slate);white-space:nowrap;">COUNT:</span>
          <input type="text" id="h${h}-fusible-count1" class="hood-small-input" placeholder="#">
          <input type="text" id="h${h}-fusible-count2" class="hood-small-input" placeholder="#">
          <input type="text" id="h${h}-fusible-count3" class="hood-small-input" placeholder="#">
          <span style="font-size:0.7rem;font-weight:600;color:var(--slate);white-space:nowrap;margin-left:4px;">TEMP:</span>
          <input type="text" id="h${h}-fusible-temp1" class="hood-small-input" placeholder="°F">
          <input type="text" id="h${h}-fusible-temp2" class="hood-small-input" placeholder="°F">
          <input type="text" id="h${h}-fusible-temp3" class="hood-small-input" placeholder="°F">
        </div>
      </div>
    </div>

    <div class="hood-sec-hdr" style="margin-top:10px;">SYSTEM DIMENSIONS</div>
    <div class="hood-sys-grid">
      <div class="hood-sys-cell"><label>PLENUM SIZE</label><input type="text" id="h${h}-plenum-size"></div>
      <div class="hood-sys-cell"><label>DUCT SIZE</label><input type="text" id="h${h}-duct-size"></div>
      <div class="hood-sys-cell"><label>NOZZLE TYPE</label><input type="text" id="h${h}-nozzle-type"></div>
      <div class="hood-sys-cell"><label>NOZZLE #</label><input type="text" id="h${h}-nozzle-num"></div>
    </div>
    <div style="margin-top:8px;">
      <div class="hood-sec-hdr" style="margin-bottom:6px;">APPLIANCES</div>
      <div class="hood-appliance-hdr">
        <span>APPLIANCE TYPE</span><span>DIMENSIONS</span><span>NOZZLE #</span><span>NOZZLE HEIGHT</span><span></span>
      </div>
      <div id="h${h}-appliances"></div>
      <button class="add-row-btn" onclick="addHoodAppliance(${h})" style="margin-top:6px;">+ Add Appliance</button>
    </div>`;
}

function buildHoodPanel() {
  const div = document.createElement('div');
  div.id = 'hood-section';
  div.innerHTML = `
    <div style="font-size:0.82rem;font-weight:700;color:var(--navy);margin-bottom:12px;">🍳 Kitchen Hoods — add all hoods at this property</div>
    <div id="hood-cards-container"></div>
    <button class="add-row-btn" onclick="addHoodCard('',null,false)" style="white-space:nowrap;margin-top:10px;">+ Add Hood</button>`;
  return div;
}

function addHoodCard(identifier, prefill, excluded) {
  _hoodCardCount++;
  const id = _hoodCardCount;
  activeHoodList.push({ id, identifier: identifier || '', excluded: !!excluded });
  _hoodApplianceCounts[id] = 0;

  const container = document.getElementById('hood-cards-container');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'hood-card' + (excluded ? ' excluded' : '');
  card.id = `hood-card-${id}`;
  card.dataset.hoodId = id;

  const lastByHood = (_propertyProfile && _propertyProfile.lastInspByHood) || {};
  const prev = prefill || (identifier ? lastByHood[identifier] : null);
  const prevInfo = prev
    ? `<span class="hood-prev-badge">Last: ${prev.date || '—'} · ${prev.inspector || '—'}</span>`
    : '';

  card.innerHTML = `
    <div class="hood-card-header">
      <span style="font-size:0.7rem;font-weight:700;color:white;opacity:0.7;white-space:nowrap;margin-right:6px;">HOOD ID</span>
      <input type="text" id="hood-ident-${id}" class="hood-ident-input"
        value="${(identifier||'').replace(/"/g,'&quot;')}"
        placeholder="e.g. Main Hood, Line 1, Southwest Hood"
        oninput="updateHoodListEntry(${id})">
      ${prevInfo}
      <label class="hood-exclude-label">
        <input type="checkbox" id="hood-exclude-${id}" onchange="toggleHoodExclusion(${id})" ${excluded ? 'checked' : ''}>
        Exclude
      </label>
      <button class="hood-delete-btn" onclick="removeHoodCard(${id})" title="Delete this hood">✕</button>
      <button class="hood-collapse-btn" onclick="toggleHoodCardBody(${id})">▼</button>
    </div>
    <div class="hood-card-body" id="hood-card-body-${id}">
      ${_hoodCardBodyHTML(id)}
    </div>`;

  container.appendChild(card);

  // Pre-fill fields from previous inspection data
  if (prev && prev.fieldData) {
    _prefillHoodCard(id, prev.fieldData);
  }
  if (prev && prev.appliances && prev.appliances.length > 0) {
    _prefillHoodAppliances(id, prev.appliances);
  }
}

function removeHoodCard(id) {
  document.getElementById(`hood-card-${id}`)?.remove();
  const idx = activeHoodList.findIndex(h => h.id === id);
  if (idx !== -1) activeHoodList.splice(idx, 1);
  delete _hoodApplianceCounts[id];
}

function updateHoodListEntry(id) {
  const entry = activeHoodList.find(h => h.id === id);
  if (entry) entry.identifier = document.getElementById(`hood-ident-${id}`)?.value || '';
}

function toggleHoodExclusion(id) {
  const card = document.getElementById(`hood-card-${id}`);
  const checked = document.getElementById(`hood-exclude-${id}`)?.checked;
  if (card) card.classList.toggle('excluded', !!checked);
  const entry = activeHoodList.find(h => h.id === id);
  if (entry) entry.excluded = !!checked;
}

function toggleHoodCardBody(id) {
  const body = document.getElementById(`hood-card-body-${id}`);
  const btn  = document.querySelector(`#hood-card-${id} .hood-collapse-btn`);
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (btn) btn.textContent = isHidden ? '▼' : '▶';
}

function setHoodYNN(btn, rowId, val) {
  // For verif-alarm/elec/appl rows the input element IS the row (hidden input)
  const row = document.getElementById('row-' + rowId);
  if (row) {
    row.dataset.val = val;
    const group = btn.closest('.pf-group');
    if (group) group.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  } else {
    // May be a verif sub-row hidden input pattern
    const hiddenRow = document.getElementById('row-' + rowId);
    if (hiddenRow) hiddenRow.dataset.val = val;
    const group = btn.closest('.pf-group');
    if (group) group.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }
}

function toggleHoodNote(rowId) {
  const noteRow = document.getElementById('note-row-' + rowId);
  if (!noteRow) return;
  const isVisible = noteRow.classList.toggle('visible');
  if (isVisible) noteRow.querySelector('input')?.focus();
}

function setUL300(btn, hoodId, val) {
  const hidden = document.getElementById(`h${hoodId}-ul300`);
  const cls = 'selected-' + val.toLowerCase();
  const isSame = btn.classList.contains(cls);
  [`h${hoodId}-ul300-yes`, `h${hoodId}-ul300-no`].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = el.className.replace(/\bselected-\S+/g, '').trim();
  });
  if (!isSame) { btn.classList.add(cls); if (hidden) hidden.value = val; }
  else { if (hidden) hidden.value = ''; }
}

function setGrease(btn, hoodId, val) {
  const hidden = document.getElementById(`h${hoodId}-grease`);
  const cls = 'selected-' + val.toLowerCase();
  const isSame = btn.classList.contains(cls);
  [`h${hoodId}-grease-low`, `h${hoodId}-grease-moderate`, `h${hoodId}-grease-excessive`].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = el.className.replace(/\bselected-\S+/g, '').trim();
  });
  if (!isSame) { btn.classList.add(cls); if (hidden) hidden.value = val; }
  else { if (hidden) hidden.value = ''; }
}

function addHoodAppliance(hoodId) {
  _hoodApplianceCounts[hoodId] = (_hoodApplianceCounts[hoodId] || 0) + 1;
  const appId = _hoodApplianceCounts[hoodId];
  const container = document.getElementById(`h${hoodId}-appliances`);
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'hood-appliance-row';
  row.id = `h${hoodId}-app-row-${appId}`;
  row.dataset.hoodId = hoodId;
  row.dataset.hoodAppId = appId;
  row.innerHTML = `
    <input type="text" id="h${hoodId}-app-name-${appId}"   placeholder="Appliance" class="hood-app-input">
    <input type="text" id="h${hoodId}-app-dims-${appId}"   placeholder='Dims e.g. 60"x36"' class="hood-app-input">
    <input type="text" id="h${hoodId}-app-nozzle-${appId}" placeholder="Nozzle # e.g. Ansul 102-290" class="hood-app-input">
    <input type="text" id="h${hoodId}-app-height-${appId}" placeholder='Height e.g. 28.0"' class="hood-app-input">
    <button class="hood-delete-btn" onclick="removeHoodAppliance(${hoodId},${appId})" title="Remove">✕</button>`;
  container.appendChild(row);
}

function removeHoodAppliance(hoodId, appId) {
  document.getElementById(`h${hoodId}-app-row-${appId}`)?.remove();
}

function _prefillHoodCard(hoodId, fieldData) {
  const h = hoodId;
  // fieldData may have bare keys ('sys-type') from new saves or h${h}-* keys from legacy saves
  const get = (key) => fieldData[key] || fieldData[`h${h}-${key}`] || '';
  const fields = {
    [`h${h}-sys-type`]:    get('sys-type')    || get('hood-mfr')          || '',
    [`h${h}-mfr`]:         get('mfr')         || get('hood-mfr')          || '',
    [`h${h}-model`]:       get('model')       || get('hood-model')        || '',
    [`h${h}-test-date`]:   get('test-date')   || get('hood-last-service') || '',
    [`h${h}-cart-date`]:   get('cart-date')   || '',
    [`h${h}-cart-weight`]: get('cart-weight') || get('hood-cyl-wt-actual')|| '',
    [`h${h}-hydro-due`]:   get('hydro-due')   || get('hood-next-service') || '',
    [`h${h}-plenum-size`]: get('plenum-size') || '',
    [`h${h}-duct-size`]:   get('duct-size')   || '',
    [`h${h}-nozzle-type`]: get('nozzle-type') || '',
    [`h${h}-nozzle-num`]:  get('nozzle-num')  || get('hood-nozzle-count') || '',
    [`h${h}-shunt-loc`]:   get('shunt-loc')   || '',
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  });
}

function _prefillHoodAppliances(hoodId, appliances) {
  if (!appliances || !appliances.length) return;
  appliances.forEach(app => {
    addHoodAppliance(hoodId);
    const appId = _hoodApplianceCounts[hoodId];
    const set = (id, val) => { if (val) { const el = document.getElementById(id); if (el) el.value = val; } };
    set(`h${hoodId}-app-name-${appId}`,   app.name);
    set(`h${hoodId}-app-dims-${appId}`,   app.dims);
    set(`h${hoodId}-app-nozzle-${appId}`, app.nozzle);
    set(`h${hoodId}-app-height-${appId}`, app.height);
  });
}

const EXT_TYPES = ['ABC','CO2','K Class','Water Cannon','Water Mist','Halon','Halotron','FE36','Foam','BC','Class D','Other'];
const EXT_MOUNT_OPTS = [['','—'],['HK','HK – Hook'],['FK','FK – Fork'],['CAB','CAB – Cabinet'],['NM','NM – Not Mounted']];
const EXT_SVC_TYPES = ['ABC-2.5LB','ABC-5LB','ABC-10LB','ABC-20LB','CO2','K Class','Water Cannon','Water Mist','Halon','Halotron','FE36','Foam','BC','Class D','Other'];
const EXT_QA_QUESTIONS = [
  'Visual examination performed on all units?',
  'Monthly inspections or electronic monitoring is being conducted?',
  'If applicable, all pressure gauges were in the correct range?',
  'All units were the correct weight?',
  'All units are visible and/or have correct signage?',
  'All discharge hoses were inspected for blockage?',
  'All units are mounted and/or in the correct location?',
  'All internal maintenance and pressure testing is up to date on all units / or have been swapped out?',
  'Up-to-date certification tags have been attached to all units?',
];
let extUnitCount = 0, extDeficCount = 0, extNoteCount = 0;

function buildExtinguisherPanel() {
  const extTable = `
    <p style="font-size:0.78rem;color:var(--slate);margin-bottom:6px;">Log each extinguisher. Add rows for all units at this property.</p>
    <div id="ext-unit-count-bar" style="display:flex;gap:10px;margin-bottom:12px;">
      <div class="stat-box" style="flex:1;"><span class="stat-label">Total Units</span><span class="stat-val" id="ext-stat-total">0</span></div>
      <div class="stat-box" style="flex:1;background:var(--pass-bg);border-color:var(--pass-ring);"><span class="stat-label" style="color:var(--green);">Pass</span><span class="stat-val" style="color:var(--green);" id="ext-stat-pass">0</span></div>
      <div class="stat-box" style="flex:1;background:var(--fail-bg);border-color:var(--fail-ring);"><span class="stat-label" style="color:var(--red);">Fail</span><span class="stat-val" style="color:var(--red);" id="ext-stat-fail">0</span></div>
    </div>
    <table class="ext-table" id="ext-table" style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="width:38px;">FLR</th>
          <th>Location</th>
          <th style="width:100px;">Mount</th>
          <th style="width:90px;">Cabinet Missing?</th>
          <th style="width:62px;">MFG Yr</th>
          <th style="width:72px;">Size(lb)</th>
          <th style="width:100px;">Type</th>
          <th style="width:26px;"></th>
        </tr>
      </thead>
      <tbody id="ext-tbody"></tbody>
    </table>
    <button class="add-row-btn" onclick="addExtUnitRow()">+ Add Extinguisher</button>
    <div class="field-group" style="margin-top:8px;">
      <label>Extinguisher General Notes</label>
      <table class="dyn-table">
        <thead><tr><th style="width:32px;">#</th><th>Note</th><th style="width:32px;"></th></tr></thead>
        <tbody id="ext-notes-tbody"></tbody>
      </table>
      <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;">
        <button class="add-row-btn" onclick="addExtNoteRow()">+ Add Note</button>
        <button class="add-row-btn" onclick="addExtGenericNote()">+ Add Generic Note</button>
      </div>
    </div>`;
  const panel = makePanel('extinguisher', '🧯', 'Portable Fire Extinguishers (NFPA 10)', extTable);
  setTimeout(() => {
    const summaryTab = document.getElementById('step-nav-summary-tab');
    if (summaryTab) summaryTab.style.display = '';
    const nb = document.getElementById('step3-next-btn');
    if (nb) nb.textContent = 'Next: Services Due →';
  }, 20);
  return panel;
}

let extRowCount = 0;

function addExtUnitRow(prefill) {
  extUnitCount++;
  const n = extUnitCount;
  const p = prefill || {};
  const defMount = p.mount    !== undefined ? p.mount    : 'HK';
  const defType  = p.type     !== undefined ? p.type     : 'ABC';
  const defFlr   = p.flr      !== undefined ? p.flr      : '1';
  const defLoc   = p.loc      || p.location || '';
  const defMfg   = p.mfg      || p.mfgYear  || '';
  const defHydro = p.hydroDue || '';
  const mountSel = EXT_MOUNT_OPTS.map(([v,l]) => `<option value="${v}"${v===defMount?' selected':''}>${l}</option>`).join('');
  const typeSel  = ['', ...EXT_TYPES].map(t => `<option value="${t}"${t===defType?' selected':''}>${t||'—'}</option>`).join('');
  const tbody = document.getElementById('ext-tbody');
  if (!tbody) return;
  tbody.insertAdjacentHTML('beforeend', `
    <tr id="ext-unit-row-${n}" style="border-bottom:none;">
      <td><input type="text" id="u-flr-${n}" value="${defFlr}" style="width:30px;"></td>
      <td><input type="text" id="u-loc-${n}" value="${defLoc.replace(/"/g,'&quot;')}" placeholder="e.g. Lobby by entrance"></td>
      <td><select id="u-mount-${n}" onchange="extUpdateCabState(${n})">${mountSel}</select></td>
      <td title="Select what is missing from the cabinet: M = Mallet, S = Signage, G = Glass. Only available when Mount is set to CAB.">
        <div id="u-cab-wrap-${n}" style="display:flex;gap:3px;${defMount!=='CAB'?'opacity:.35;pointer-events:none;':''}">
          <button id="u-cab-m-btn-${n}" class="ext-yn-btn${p.cabM==='Y'?' active':''}" onclick="toggleExtCab(${n},'m')"  style="padding:3px 7px;">M</button>
          <button id="u-cab-g-btn-${n}" class="ext-yn-btn${p.cabG==='Y'?' active':''}" onclick="toggleExtCab(${n},'g')"  style="padding:3px 7px;">G</button>
          <button id="u-cab-s-btn-${n}" class="ext-yn-btn${p.cabS==='Y'?' active':''}" onclick="toggleExtCab(${n},'s')"  style="padding:3px 7px;">S</button>
        </div>
        <input type="hidden" id="u-cab-m-${n}" value="${p.cabM||''}">
        <input type="hidden" id="u-cab-g-${n}" value="${p.cabG||''}">
        <input type="hidden" id="u-cab-s-${n}" value="${p.cabS||''}">
      </td>
      <td><input type="text" inputmode="numeric" class="no-spin" id="u-mfg-${n}" value="${defMfg}" placeholder="Year" style="width:54px;"></td>
      <td><input type="text" id="u-size-${n}" value="${(p.size||'').replace(/"/g,'&quot;')}" placeholder="lbs"></td>
      <td><select id="u-type-${n}">${typeSel}</select></td>
      <td><button class="del-btn" onclick="removeExtUnit(${n})">✕</button></td>
    </tr>
    <tr id="ext-action-row-${n}" class="ext-action-row">
      <td colspan="8">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;">
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="font-size:.7rem;font-weight:700;color:var(--slate);white-space:nowrap;">Pass/Fail:</span>
            <div class="pf-group">
              <button class="pf-btn pass" onclick="setExtPF(this,${n},'PASS')">PASS</button>
              <button class="pf-btn fail" onclick="setExtPF(this,${n},'FAIL')">FAIL</button>
            </div>
            <input type="hidden" id="u-pf-${n}" value="${p.pf||''}">
          </div>
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="font-size:.7rem;font-weight:700;color:var(--slate);white-space:nowrap;">Hydro Due:</span>
            <input type="text" inputmode="numeric" class="no-spin" id="u-hydro-${n}" value="${defHydro}" placeholder="Year" style="width:52px;border:1px solid var(--border);border-radius:4px;padding:3px 6px;font-size:.8rem;font-family:inherit;">
          </div>
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="font-size:.7rem;font-weight:700;color:var(--slate);white-space:nowrap;">Recharge:</span>
            <button id="u-recharge-btn-${n}" class="ext-yn-btn${p.recharge==='Y'?' active':''}" onclick="toggleExtYN(${n},'recharge')">${p.recharge==='Y'?'Y':'—'}</button>
            <input type="hidden" id="u-recharge-${n}" value="${p.recharge||''}">
          </div>
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="font-size:.7rem;font-weight:700;color:var(--slate);white-space:nowrap;">New Unit:</span>
            <button id="u-newunit-btn-${n}" class="ext-yn-btn${p.newUnit==='Y'?' active':''}" onclick="toggleExtYN(${n},'newunit')">${p.newUnit==='Y'?'Y':'—'}</button>
            <input type="hidden" id="u-newunit-${n}" value="${p.newUnit||''}">
          </div>
          <button onclick="toggleExtNote(${n})" style="background:none;border:1px solid var(--border);border-radius:5px;padding:3px 9px;cursor:pointer;font-size:.8rem;font-family:inherit;color:var(--slate);">📝 Note</button>
        </div>
      </td>
    </tr>
    <tr id="ext-defic-row-${n}" style="display:none;">
      <td colspan="8" style="padding:4px 8px;background:var(--fail-bg);border-bottom:1px solid #fca5a5;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:.72rem;font-weight:700;color:var(--red);white-space:nowrap;">⚠ Deficiency:</span>
          <input type="text" id="u-defic-txt-${n}" value="${(p.deficTxt||'').replace(/"/g,'&quot;')}" placeholder="Describe deficiency…" style="flex:1;border:1px solid #fca5a5;border-radius:4px;padding:5px 8px;font-size:.8rem;font-family:inherit;background:white;">
        </div>
      </td>
    </tr>
    <tr id="ext-note-row-${n}" style="display:none;">
      <td colspan="8" style="padding:4px 8px;background:#fffbeb;border-bottom:2px solid var(--border);">
        <input type="text" id="u-note-txt-${n}" value="${(p.noteTxt||'').replace(/"/g,'&quot;')}" placeholder="Note for Unit #${n}…" style="width:100%;border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:.8rem;font-family:inherit;">
      </td>
    </tr>`);
  if (p.pf) _restoreExtBtns(n);
  if (p.noteTxt) document.getElementById('ext-note-row-' + n).style.display = '';
  updateExtStats();
}

function setPFTable(btn, id, val) {
  const input = document.getElementById(id);
  const group = btn.closest('.pf-group') || btn.parentElement;

  // If already selected, toggle it off
  if (btn.classList.contains('selected')) {
    btn.classList.remove('selected');
    if (input) input.value = '';
    val = '';
  } else {
    if (input) input.value = val;
    group.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  // Detection row deficiency + summary
  const detMatch = id.match(/^fa-det-(?:alarm|sup)-(\d+)$/);
  if (detMatch) { checkDetectionDefic(parseInt(detMatch[1])); syncDeviceSummary(); }
  // Flow switch deficiency + summary
  const flowMatch = id.match(/^fa-flow-sup-(\d+)$/);
  if (flowMatch) {
    const n = parseInt(flowMatch[1]);
    if (val === 'FAIL') showFlowDeficRow(n); else hideFlowDeficRow(n);
    syncDeviceSummary();
  }
  // Tamper switch deficiency + summary
  const tamperMatch = id.match(/^fa-tamper-sup-(\d+)$/);
  if (tamperMatch) {
    const n = parseInt(tamperMatch[1]);
    if (val === 'FAIL') showTamperDeficRow(n); else hideTamperDeficRow(n);
    syncDeviceSummary();
  }
}

function extUnitLabel(n) {
  const flr = document.getElementById('u-flr-' + n)?.value?.trim() || '';
  const loc = document.getElementById('u-loc-' + n)?.value?.trim() || '';
  const parts = [];
  if (loc) parts.push(loc);
  if (flr) parts.push('Fl.' + flr);
  parts.push('Unit #' + n);
  return parts.join(' – ');
}

function _restoreExtBtns(n) {
  const pfVal = document.getElementById('u-pf-'+n)?.value || '';
  if (pfVal) {
    document.querySelector(`#ext-action-row-${n} .pf-group`)?.querySelectorAll('.pf-btn').forEach(b => {
      b.classList.toggle('selected', b.textContent.trim() === pfVal);
    });
    const unitRow = document.getElementById('ext-unit-row-' + n);
    const actionRow = document.getElementById('ext-action-row-' + n);
    if (unitRow) unitRow.style.background = pfVal === 'FAIL' ? 'var(--fail-bg)' : pfVal === 'PASS' ? 'var(--pass-bg)' : '';
    if (actionRow) actionRow.style.background = pfVal === 'FAIL' ? 'var(--fail-bg)' : pfVal === 'PASS' ? 'var(--pass-bg)' : '';
    if (pfVal === 'FAIL') {
      const deficRow = document.getElementById('ext-defic-row-' + n);
      if (deficRow) deficRow.style.display = '';
    }
  }
  const rVal = document.getElementById('u-recharge-'+n)?.value || '';
  if (rVal === 'Y') {
    const btn = document.getElementById('u-recharge-btn-' + n);
    if (btn) { btn.classList.add('active'); btn.textContent = 'Y'; }
  }
  const nuVal = document.getElementById('u-newunit-'+n)?.value || '';
  if (nuVal === 'Y') {
    const btn = document.getElementById('u-newunit-btn-' + n);
    if (btn) { btn.classList.add('active'); btn.textContent = 'Y'; }
  }
  ['m','g','s'].forEach(item => {
    if (document.getElementById('u-cab-' + item + '-' + n)?.value === 'Y') {
      document.getElementById('u-cab-' + item + '-btn-' + n)?.classList.add('active');
    }
  });
}

function setExtPF(btn, n, val) {
  btn.closest('.pf-group').querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const inp = document.getElementById('u-pf-' + n);
  if (inp) inp.value = val;

  // Highlight both rows
  const row = document.getElementById('ext-unit-row-' + n);
  const actionRow = document.getElementById('ext-action-row-' + n);
  const bg = val === 'FAIL' ? 'var(--fail-bg)' : val === 'PASS' ? 'var(--pass-bg)' : '';
  if (row) row.style.background = bg;
  if (actionRow) actionRow.style.background = bg;

  // Show/hide inline deficiency row
  const deficRow = document.getElementById('ext-defic-row-' + n);

  if (val === 'FAIL') {
    if (deficRow) deficRow.style.display = '';
    // Also add to generic-defic-tbody if not already there
    const deficId = 'ext-unit-defic-' + n;
    if (!document.getElementById(deficId)) {
      extDeficCount++;
      const initDesc = extUnitLabel(n) + ': Failed inspection';
      const tbody = document.getElementById('generic-defic-tbody');
      if (tbody) {
        tbody.insertAdjacentHTML('beforeend', `
          <tr id="${deficId}">
            <td style="text-align:center;font-weight:700;color:var(--slate);">${extDeficCount}</td>
            <td><input type="text" id="${deficId}-desc" value="${escHtml(initDesc)}" placeholder="Describe deficiency…"></td>
            <td><button class="del-btn" onclick="removeExtUnitDefic('${deficId}',${n})">✕</button></td>
          </tr>`);
      }
      // Pre-fill inline defic text if empty
      const inlineTxt = document.getElementById('u-defic-txt-' + n);
      if (inlineTxt) {
        if (!inlineTxt.value) inlineTxt.value = initDesc;
        inlineTxt.addEventListener('input', function() {
          const syncEl = document.getElementById(deficId + '-desc');
          if (syncEl) syncEl.value = this.value;
        });
      }
    }
  } else {
    if (deficRow) deficRow.style.display = 'none';
    const deficId = 'ext-unit-defic-' + n;
    document.getElementById(deficId)?.remove();
  }

  updateExtStats();
}

function removeExtUnitDefic(deficId, n) {
  document.getElementById(deficId)?.remove();
  // Hide inline defic row
  const deficRow = document.getElementById('ext-defic-row-' + n);
  if (deficRow) deficRow.style.display = 'none';
  // Clear row highlights
  const row = document.getElementById('ext-unit-row-' + n);
  const actionRow = document.getElementById('ext-action-row-' + n);
  if (row) row.style.background = '';
  if (actionRow) actionRow.style.background = '';
  // Clear PASS/FAIL selection
  const hidden = document.getElementById('u-pf-' + n);
  if (hidden) hidden.value = '';
  document.querySelector(`#ext-action-row-${n} .pf-group`)?.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  updateExtStats();
}

function toggleExtYN(n, field) {
  const btn = document.getElementById('u-' + field + '-btn-' + n);
  const inp = document.getElementById('u-' + field + '-' + n);
  const deficId = 'ext-' + field + '-defic-' + n;
  const isActive = btn?.classList.contains('active');
  if (isActive) {
    // Deactivate
    if (btn) { btn.classList.remove('active'); btn.textContent = '—'; }
    if (inp) inp.value = '';
    document.getElementById(deficId)?.remove();
  } else {
    // Activate
    if (btn) { btn.classList.add('active'); btn.textContent = 'Y'; }
    if (inp) inp.value = 'Y';
    if (!document.getElementById(deficId)) {
      extDeficCount++;
      const label = field === 'recharge' ? 'Recharge required' : 'New unit required';
      const desc = extUnitLabel(n) + ': ' + label;
      const tbody = document.getElementById('generic-defic-tbody');
      if (tbody) {
        tbody.insertAdjacentHTML('beforeend', `
          <tr id="${deficId}">
            <td style="text-align:center;font-weight:700;color:var(--slate);">${extDeficCount}</td>
            <td><input type="text" id="${deficId}-desc" value="${escHtml(desc)}" placeholder="Describe deficiency…"></td>
            <td><button class="del-btn" onclick="removeExtYNDefic('${deficId}',${n},'${field}')">✕</button></td>
          </tr>`);
      }
    }
  }
}

function removeExtYNDefic(deficId, n, field) {
  document.getElementById(deficId)?.remove();
  const btn = document.getElementById('u-' + field + '-btn-' + n);
  const inp = document.getElementById('u-' + field + '-' + n);
  if (btn) { btn.classList.remove('active'); btn.textContent = '—'; }
  if (inp) inp.value = '';
}

function extUpdateCabState(n) {
  const mount = document.getElementById('u-mount-' + n)?.value;
  const wrap = document.getElementById('u-cab-wrap-' + n);
  if (!wrap) return;
  const isCAB = mount === 'CAB';
  wrap.style.opacity = isCAB ? '1' : '.35';
  wrap.style.pointerEvents = isCAB ? '' : 'none';
  // If switching away from CAB, clear any active missing items and their defics
  if (!isCAB) {
    ['m','g','s'].forEach(item => {
      const inp = document.getElementById('u-cab-' + item + '-' + n);
      if (inp && inp.value === 'Y') {
        toggleExtCab(n, item); // toggle off
      }
    });
  }
}

function toggleExtCab(n, item) {
  // Only allow toggling when mount is CAB (wrap is enabled)
  const wrap = document.getElementById('u-cab-wrap-' + n);
  if (wrap && wrap.style.pointerEvents === 'none') return;
  const labels = { m: 'Mallet', g: 'Glass', s: 'Sign' };
  const btn = document.getElementById('u-cab-' + item + '-btn-' + n);
  const inp = document.getElementById('u-cab-' + item + '-' + n);
  const deficId = 'ext-cab-' + item + '-defic-' + n;
  const isActive = btn?.classList.contains('active');
  if (isActive) {
    if (btn) btn.classList.remove('active');
    if (inp) inp.value = '';
    document.getElementById(deficId)?.remove();
  } else {
    if (btn) btn.classList.add('active');
    if (inp) inp.value = 'Y';
    if (!document.getElementById(deficId)) {
      extDeficCount++;
      const desc = extUnitLabel(n) + ': Cabinet missing ' + labels[item];
      const tbody = document.getElementById('generic-defic-tbody');
      if (tbody) {
        tbody.insertAdjacentHTML('beforeend', `
          <tr id="${deficId}">
            <td style="text-align:center;font-weight:700;color:var(--slate);">${extDeficCount}</td>
            <td><input type="text" id="${deficId}-desc" value="${escHtml(desc)}" placeholder="Describe deficiency…"></td>
            <td><button class="del-btn" onclick="removeExtCabDefic('${deficId}',${n},'${item}')">✕</button></td>
          </tr>`);
      }
    }
  }
}

function removeExtCabDefic(deficId, n, item) {
  document.getElementById(deficId)?.remove();
  const btn = document.getElementById('u-cab-' + item + '-btn-' + n);
  const inp = document.getElementById('u-cab-' + item + '-' + n);
  if (btn) btn.classList.remove('active');
  if (inp) inp.value = '';
}

function toggleExtNote(n) {
  const noteRow = document.getElementById('ext-note-row-' + n);
  if (!noteRow) return;
  const isVisible = noteRow.style.display !== 'none';
  noteRow.style.display = isVisible ? 'none' : '';
  if (!isVisible) document.getElementById('u-note-txt-' + n)?.focus();
}

function removeExtUnit(n) {
  // Remove associated deficiencies from generic-defic-tbody
  document.getElementById('ext-unit-defic-' + n)?.remove();
  document.getElementById('ext-recharge-defic-' + n)?.remove();
  document.getElementById('ext-newunit-defic-' + n)?.remove();
  document.getElementById('ext-cab-m-defic-' + n)?.remove();
  document.getElementById('ext-cab-g-defic-' + n)?.remove();
  document.getElementById('ext-cab-s-defic-' + n)?.remove();
  // Remove all rows for this unit
  document.getElementById('ext-unit-row-' + n)?.remove();
  document.getElementById('ext-action-row-' + n)?.remove();
  document.getElementById('ext-defic-row-' + n)?.remove();
  document.getElementById('ext-note-row-' + n)?.remove();
  updateExtStats();
}

function updateExtStats() {
  let total = 0, pass = 0, fail = 0;
  for (let i = 1; i <= extUnitCount; i++) {
    if (!document.getElementById('ext-unit-row-' + i)) continue;
    total++;
    const pf = document.getElementById('u-pf-' + i)?.value || '';
    if (pf === 'PASS') pass++;
    if (pf === 'FAIL') fail++;
  }
  const te = document.getElementById('ext-stat-total'); if (te) te.textContent = total;
  const pe = document.getElementById('ext-stat-pass');  if (pe) pe.textContent = pass;
  const fe = document.getElementById('ext-stat-fail');  if (fe) fe.textContent = fail;
  const st = document.getElementById('ext-sum-total');  if (st) st.textContent = total;
}

function goInspNextStep() {
  if (activeInspectionSystem === 'extinguisher') {
    goExtSummaryStep();
  } else {
    goGenericDeficStep();
  }
}

function goExtSummaryStep() {
  if (activeInspectionSystem !== 'extinguisher') return;
  saveDraft();
  updateExtStats();

  // Build svc table if not yet built
  if (!document.getElementById('ext-svc-tbody')?.children.length) {
    buildExtSvcTable();
    buildExtQATable();
  }

  // Always recompute auto-fill columns (hydro/recharge/newunit) from current unit data
  autoFillExtSvcFromUnits();

  document.getElementById('step-3').style.display = 'none';
  document.getElementById('step-generic-defic').style.display = 'none';
  document.getElementById('step-ext-summary').style.display = 'block';

  // Nav
  document.querySelectorAll('#step-nav .step-tab[data-step]').forEach(t => {
    const s = parseInt(t.dataset.step);
    t.classList.remove('active','done');
    if (s <= 3) t.classList.add('done');
  });
  const summaryTab = document.getElementById('step-nav-summary-tab');
  if (summaryTab) { summaryTab.classList.remove('done'); summaryTab.classList.add('active'); }
  const deficTab = document.getElementById('step-nav-defic-tab');
  if (deficTab) { deficTab.classList.remove('active','done'); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildExtSvcTable() {
  const tbody = document.getElementById('ext-svc-tbody');
  if (!tbody) return;
  EXT_SVC_TYPES.forEach((type, i) => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="row-label">${type}</td>
        <td><input type="number" id="ext-svc-6yr-${i}" min="0" placeholder="0" oninput="calcExtTotalSvc()"></td>
        <td><input type="number" id="ext-svc-hydro-${i}" min="0" placeholder="0" oninput="calcExtTotalSvc()"></td>
        <td><input type="number" id="ext-svc-recharge-${i}" min="0" placeholder="0" oninput="calcExtTotalSvc()"></td>
        <td><input type="number" id="ext-svc-newunit-${i}" min="0" placeholder="0" oninput="calcExtTotalSvc()"></td>
        <td><input type="text" id="ext-svc-notes-${i}" style="width:100%;" placeholder="Notes…"></td>
      </tr>`);
  });
}

function buildExtQATable() {
  const tbody = document.getElementById('ext-qa-tbody');
  if (!tbody) return;
  EXT_QA_QUESTIONS.forEach((q, i) => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr id="ext-qa-row-${i}">
        <td class="q-cell">
          <div>${q}</div>
          <input type="text" id="ext-qa-note-${i}" style="display:none;margin-top:5px;width:100%;border:1px solid #fca5a5;border-radius:4px;padding:4px 7px;font-size:.78rem;font-family:inherit;background:white;" placeholder="Deficiency note…">
        </td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="yna-btn y" onclick="setExtQA(this,${i},'Y')">Y</button>
            <button class="yna-btn n" onclick="setExtQA(this,${i},'N')">N</button>
            <button class="yna-btn na" onclick="setExtQA(this,${i},'NA')">NA</button>
          </div>
          <input type="hidden" id="ext-qa-ans-${i}" value="">
        </td>
      </tr>`);
  });
}

let extQADeficCount = 0;

function setExtQA(btn, i, val) {
  btn.closest('td').querySelectorAll('.yna-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const inp = document.getElementById('ext-qa-ans-' + i);
  if (inp) inp.value = val;
  const noteInp = document.getElementById('ext-qa-note-' + i);
  const deficId = 'ext-qa-defic-' + i;
  if (val === 'N') {
    if (noteInp) { noteInp.style.display = ''; noteInp.focus(); }
    if (!document.getElementById(deficId)) {
      extQADeficCount++;
      const q = EXT_QA_QUESTIONS[i] || 'QA item ' + (i + 1);
      const initDesc = 'QA Failed: ' + q;
      const tbody = document.getElementById('generic-defic-tbody');
      if (tbody) {
        tbody.insertAdjacentHTML('beforeend', `
          <tr id="${deficId}">
            <td style="text-align:center;font-weight:700;color:var(--slate);">${extQADeficCount}</td>
            <td><input type="text" id="${deficId}-desc" value="${escHtml(initDesc)}" placeholder="Describe deficiency…"></td>
            <td><button class="del-btn" onclick="removeExtQADefic('${deficId}',${i})">✕</button></td>
          </tr>`);
      }
      // Wire note input to sync deficiency description (always includes the question)
      if (noteInp) {
        noteInp.addEventListener('input', function() {
          const syncEl = document.getElementById(deficId + '-desc');
          if (syncEl) syncEl.value = this.value ? q + ': ' + this.value : initDesc;
        });
      }
    }
  } else {
    if (noteInp) { noteInp.style.display = 'none'; noteInp.value = ''; }
    document.getElementById(deficId)?.remove();
  }
}

function removeExtQADefic(deficId, i) {
  document.getElementById(deficId)?.remove();
  const inp = document.getElementById('ext-qa-ans-' + i);
  if (inp) inp.value = '';
  const noteInp = document.getElementById('ext-qa-note-' + i);
  if (noteInp) { noteInp.style.display = 'none'; noteInp.value = ''; }
  document.querySelector(`#ext-qa-row-${i} .yna-btn`)?.closest('td')?.querySelectorAll('.yna-btn').forEach(b => b.classList.remove('selected'));
}

function calcExtTotalSvc() {
  let total = 0;
  EXT_SVC_TYPES.forEach((_, i) => {
    ['6yr','hydro','recharge','newunit'].forEach(col => {
      const val = parseInt(document.getElementById(`ext-svc-${col}-${i}`)?.value || '0') || 0;
      total += val;
    });
  });
  const el = document.getElementById('ext-total-svc-due');
  if (el) el.value = total || '';
}

function matchExtSvcType(type, size) {
  const t = (type || '').trim().toUpperCase();
  const s = (size || '').toString().trim();
  if (t === 'ABC') {
    if (s.includes('2.5')) return 0;
    if (s.includes('20')) return 3;
    if (s.includes('10')) return 2;
    if (s.includes('5')) return 1;
    return 0; // default ABC to 2.5LB row
  }
  const typeMap = {'CO2':4,'K CLASS':5,'WATER CANNON':6,'WATER MIST':7,'HALON':8,'HALOTRON':9,'FE36':10,'FOAM':11,'BC':12,'CLASS D':13};
  const idx = typeMap[t];
  return idx !== undefined ? idx : 14; // 14 = Other
}

function autoFillExtSvcFromUnits() {
  const curYear = new Date().getFullYear();

  // Reset auto-computed columns (hydro/recharge/newunit) to 0 before refilling
  EXT_SVC_TYPES.forEach((_, i) => {
    ['hydro','recharge','newunit'].forEach(col => {
      const el = document.getElementById(`ext-svc-${col}-${i}`);
      if (el) el.value = '';
    });
  });
  const _malEl = document.getElementById('ext-nf-mallets'); if (_malEl) _malEl.value = '';
  const _sigEl = document.getElementById('ext-nf-signage'); if (_sigEl) _sigEl.value = '';

  let malletsCount = 0, glassCount = 0, signageCount = 0;
  for (let i = 1; i <= extUnitCount; i++) {
    if (!document.getElementById('ext-unit-row-' + i)) continue;
    const type = document.getElementById('u-type-' + i)?.value?.trim() || '';
    const size = document.getElementById('u-size-' + i)?.value?.trim() || '';
    const hydroDue = document.getElementById('u-hydro-' + i)?.value?.trim() || '';
    const recharge = document.getElementById('u-recharge-' + i)?.value || '';
    const newUnit = document.getElementById('u-newunit-' + i)?.value || '';
    const rowIdx = matchExtSvcType(type, size);

    if (recharge === 'Y') {
      const el = document.getElementById(`ext-svc-recharge-${rowIdx}`);
      if (el) el.value = (parseInt(el.value || '0') || 0) + 1;
    }
    if (newUnit === 'Y') {
      const el = document.getElementById(`ext-svc-newunit-${rowIdx}`);
      if (el) el.value = (parseInt(el.value || '0') || 0) + 1;
    }
    if (hydroDue) {
      const hyYear = parseInt(hydroDue);
      if (!isNaN(hyYear) && hyYear < curYear) {
        const el = document.getElementById(`ext-svc-hydro-${rowIdx}`);
        if (el) el.value = (parseInt(el.value || '0') || 0) + 1;
      }
    }
    if (document.getElementById('u-cab-m-' + i)?.value === 'Y') malletsCount++;
    if (document.getElementById('u-cab-g-' + i)?.value === 'Y') glassCount++;
    if (document.getElementById('u-cab-s-' + i)?.value === 'Y') signageCount++;
  }
  // Fill "Units Not Found" summary from cabinet missing toggles
  const malEl = document.getElementById('ext-nf-mallets');
  if (malEl && malletsCount) malEl.value = malletsCount;
  const sigEl = document.getElementById('ext-nf-signage');
  if (sigEl && signageCount) sigEl.value = signageCount;
  // Glass field is descriptive (size), leave as-is for manual entry — just set count if user hasn't typed anything
  const glEl = document.getElementById('ext-nf-glass');
  if (glEl && glassCount && !glEl.value) glEl.value = String(glassCount);
  calcExtTotalSvc();
}

function buildHydrantPanel() {
  const body = `
    ${sectionDiv('Hydrant Inventory')}
    ${dataRow(
      {id:'hy-count',   label:'# of Private Hydrants', type:'number'},
      {id:'hy-type',    label:'Hydrant Type', placeholder:'Wet barrel, Dry barrel'},
      {id:'hy-last-flow', label:'Last Flow Test Date', type:'date'}
    )}

    ${sectionDiv('Annual Inspection Items')}
    ${makeRow('hy-caps','Caps / Threads Condition','All outlets capped; no damage to threads')}
    ${makeRow('hy-drainage','Drainage','Drains freely after operation')}
    ${makeRow('hy-painted','Color Coding','Properly painted per NFPA/AWWA flow class')}
    ${makeRow('hy-clearance','Clearance Around Hydrant','3-ft min clearance; accessible')}
    ${makeRow('hy-operation','Operation Tested','Opens and closes smoothly; no leaks')}
    ${makeRow('hy-gate-valve','Control Valve / Gate Valve','Fully open; tamper supervised')}
    ${makeRow('hy-outlet-threads','Outlet Thread Compatibility','NST or local FD connection standard')}

    ${sectionDiv('Flow Test (Annual or Per AHJ)')}
    ${makeRow('hy-flow-test','Flow Test Performed','Documented GPM and residual pressure')}
    ${dataRow(
      {id:'hy-flow-static',   label:'Static Pressure (PSI)', type:'number'},
      {id:'hy-flow-residual', label:'Residual Pressure (PSI)', type:'number'},
      {id:'hy-flow-gpm',      label:'Flow Rate (GPM)', type:'number'}
    )}

    <div class="field-group" style="margin-top:8px;">
      <label>Hydrant Notes / Locations</label>
      <textarea id="hy-notes" rows="3" placeholder="Note each hydrant location and any specific conditions…"></textarea>
    </div>`;
  return makePanel('hydrant', '🔴', 'Private Fire Hydrants (NFPA 25 Ch. 7)', body);
}

function buildBDAPanel() {
  const body = `
    ${sectionDiv('System Information')}
    ${dataRow(
      {id:'bda-mfr',      label:'BDA Manufacturer'},
      {id:'bda-model',    label:'Model'},
      {id:'bda-install',  label:'Year Installed', type:'number'}
    )}
    ${dataRow(
      {id:'bda-freqs',    label:'Frequencies Covered', placeholder:'e.g. 800 MHz, 700 MHz'},
      {id:'bda-coverage-floors', label:'Floors / Areas Covered'},
      {id:'bda-ahj-cert', label:'AHJ-Approved Certificate / FCC License'}
    )}

    ${sectionDiv('Signal Strength Testing')}
    ${makeRow('bda-uplink','Uplink Signal Strength ≥ -95 dBm','Minimum inbound signal on all critical areas')}
    ${makeRow('bda-downlink','Downlink Signal Strength ≥ -95 dBm','Minimum outbound from BDA in critical areas')}
    ${makeRow('bda-coverage','Critical Area Coverage','All stairwells, elevators, garage levels covered')}
    ${dataRow(
      {id:'bda-min-signal', label:'Minimum Signal Strength Recorded (dBm)'},
      {id:'bda-worst-loc',  label:'Worst Coverage Location'}
    )}

    ${sectionDiv('Equipment Condition')}
    ${makeRow('bda-power','Primary Power','Connected to dedicated circuit or UPS')}
    ${makeRow('bda-backup-power','Backup Power (12-hr minimum)','Battery or generator backup tested')}
    ${makeRow('bda-donor-antenna','Donor Antenna Condition','Mounted correctly; no physical damage')}
    ${makeRow('bda-internal-antenna','Internal Antenna / Cabling','No damage; connections tight')}
    ${makeRow('bda-alarms','Trouble / Alarm Indicators','No active alarms on BDA head-end')}
    ${makeRow('bda-fa-interface','Fire Alarm Panel Interface','Trouble and alarm points connected per NFPA 72')}

    ${sectionDiv('Documentation')}
    ${makeRow('bda-permit','Active Permit / Registration','Current permit on file')}
    ${makeRow('bda-coverage-map','Coverage Map Available','Floor plan showing coverage zones on site')}
    ${dataRow({id:'bda-next-test', label:'Next Required Test Date', type:'date'})}

    <div class="field-group" style="margin-top:8px;">
      <label>BDA / Emergency Radio Notes</label>
      <textarea id="bda-notes" rows="3"></textarea>
    </div>`;
  return makePanel('bda', '📡', 'BDA / Emergency Radio Communication (NFPA 72 Ch. 24)', body);
}

function buildSmokeControlPanel() {
  const body = `
    ${sectionDiv('System Configuration')}
    <div class="data-row cols-3">
      <div class="data-field"><label>System Type</label>
        <select id="sc-type"><option>Pressurization</option><option>Exhaust Only</option><option>Combined Injection/Exhaust</option><option>Zoned Smoke Control</option><option>Atrium Smoke Exhaust</option></select>
      </div>
      <div class="data-field"><label># of Smoke Zones</label><input type="number" id="sc-zones"></div>
      <div class="data-field"><label>Year Installed</label><input type="number" id="sc-year"></div>
    </div>
    ${dataRow(
      {id:'sc-fans',   label:'# of Supply/Exhaust Fans', type:'number'},
      {id:'sc-dampers',label:'# of Smoke/Fire Dampers', type:'number'}
    )}

    ${sectionDiv('Fan & Equipment Testing')}
    ${makeRow('sc-fans-op','All Fans Operational','Start and run correctly per design')}
    ${makeRow('sc-cfm','Airflow CFM Verified','Measured airflow within 10% of design')}
    ${makeRow('sc-pressure','Pressure Differential','Meets design (typically 0.05 in. w.g. min)')}
    ${dataRow({id:'sc-pressure-val', label:'Measured Pressure Differential (in. w.g.)'})}

    ${sectionDiv('Dampers')}
    ${makeRow('sc-dampers-op','Smoke Dampers Operational','All zones tested — close/open verified')}
    ${makeRow('sc-fire-dampers','Fire Dampers Operational','Fusible links intact or actuators verified')}
    ${makeRow('sc-damper-access','Access Panels for Dampers','All accessible; labeled')}

    ${sectionDiv('Controls & Integration')}
    ${makeRow('sc-control-panel','Control Panel / FCC Operational','No active faults; correct mode displays')}
    ${makeRow('sc-fa-integration','Fire Alarm Integration','System activates upon FA signal')}
    ${makeRow('sc-override','Manual Override Stations','FCC manual controls tested in each zone')}
    ${makeRow('sc-detector-input','Smoke Detector Input','All input points trigger correct zones')}

    <div class="field-group" style="margin-top:8px;">
      <label>Smoke Control Notes</label>
      <textarea id="sc-notes" rows="3"></textarea>
    </div>`;
  return makePanel('smoke-control', '💨', 'Smoke Control System (NFPA 92)', body);
}

function buildGasDetectionPanel() {
  const body = `
    ${sectionDiv('System Information')}
    ${dataRow(
      {id:'gd-mfr',    label:'Manufacturer'},
      {id:'gd-model',  label:'Model'},
      {id:'gd-gas-type', label:'Gas Type Monitored', placeholder:'Natural Gas, CO, H2, etc.'}
    )}
    ${dataRow(
      {id:'gd-sensor-count', label:'# of Sensors', type:'number'},
      {id:'gd-zones',        label:'# of Zones'},
      {id:'gd-install-date', label:'Year Installed', type:'number'}
    )}

    ${sectionDiv('Sensor Testing')}
    ${makeRow('gd-sensor-test','Sensor Calibration / Bump Test','All sensors tested with calibration gas')}
    ${dataRow(
      {id:'gd-alarm-setpoint-lo', label:'Low Alarm Setpoint (%LEL or PPM)'},
      {id:'gd-alarm-setpoint-hi', label:'High Alarm Setpoint (%LEL or PPM)'}
    )}
    ${makeRow('gd-alarm-test','Alarm Activation Test','Audio/visual alarms activate at setpoints')}
    ${makeRow('gd-gas-shutoff','Gas Valve Shutoff Test','Main gas valve closes on high alarm signal')}
    ${makeRow('gd-ventilation','Ventilation Interlock','Ventilation fans activate on detection')}

    ${sectionDiv('Electronics & Power')}
    ${makeRow('gd-power','Primary Power','Connected and stable')}
    ${makeRow('gd-backup','Backup Power','Battery backup functional')}
    ${makeRow('gd-control-panel','Control Panel Condition','No faults; all zones showing normal')}
    ${makeRow('gd-fa-integration','FA Panel Integration','Gas alarm transmitted to fire alarm panel')}

    ${sectionDiv('Sensor Replacement')}
    ${dataRow(
      {id:'gd-sensor-age',  label:'Sensor Age / Last Replacement Date'},
      {id:'gd-sensor-due',  label:'Next Replacement Due Date', type:'date'}
    )}
    ${makeRow('gd-calibration-cert','Calibration Certification Current','Gas calibration cert on file and up to date')}

    <div class="field-group" style="margin-top:8px;">
      <label>Gas Detection Notes</label>
      <textarea id="gd-notes" rows="3"></textarea>
    </div>`;
  return makePanel('gas-detection', '⚗️', 'Gas Detection System', body);
}

function buildSpecialSuppressionPanel() {
  const body = `
    ${sectionDiv('System Information')}
    <div class="data-row cols-3">
      <div class="data-field"><label>System Type</label>
        <select id="ss-type"><option>Clean Agent (FM-200/Novec)</option><option>CO2</option><option>Dry Chemical</option><option>Foam (AFFF/AR-AFFF)</option><option>Water Mist</option><option>Halon 1301</option><option>Other</option></select>
      </div>
      <div class="data-field"><label>Manufacturer</label><input type="text" id="ss-mfr"></div>
      <div class="data-field"><label>Protected Hazard / Area</label><input type="text" id="ss-area" placeholder="e.g. Server Room, Paint Booth"></div>
    </div>
    ${dataRow(
      {id:'ss-agent',     label:'Agent Name / Chemical'},
      {id:'ss-cylinders', label:'# of Cylinders / Containers', type:'number'},
      {id:'ss-install',   label:'Year Installed', type:'number'}
    )}

    ${sectionDiv('Agent Quantity & Pressure')}
    ${makeRow('ss-agent-wt','Agent Weight / Pressure Check','Within manufacturer specified range')}
    ${dataRow(
      {id:'ss-actual-wt',  label:'Actual Agent Weight (lbs)'},
      {id:'ss-min-wt',     label:'Min. Required Weight (lbs)'},
      {id:'ss-pressure',   label:'Cylinder Pressure (PSI)', type:'number'}
    )}

    ${sectionDiv('Actuation & Detection')}
    ${makeRow('ss-detection','Detection Devices (Heat/UV/IR/Smoke)','All detectors tested per NFPA standard')}
    ${makeRow('ss-pull','Manual Pull Station','Accessible; guard/pin intact')}
    ${makeRow('ss-abort','Abort Switch (if present)','Functional; within design spec delay')}
    ${makeRow('ss-discharge-time','Discharge Time Delay','Correct delay programmed; horn/strobe pre-alarm')}

    ${sectionDiv('Nozzles & Distribution')}
    ${makeRow('ss-nozzles','Nozzle Condition','No damage, blockage, or improper orientation')}
    ${makeRow('ss-coverage','Coverage Integrity','Room/area unchanged; no new penetrations')}
    ${makeRow('ss-room-integrity','Room Integrity / Door Seals','Doors self-close; no major seal failures')}

    ${sectionDiv('Interlocks & Alarms')}
    ${makeRow('ss-hvac-shutoff','HVAC Shutdown on Discharge','Air handling stopped during release')}
    ${makeRow('ss-power-shutoff','Power Shutdown Interlock','Electrical disconnects activate (if required)')}
    ${makeRow('ss-fa-integration','Fire Alarm Notification','Pre-alarm and discharge signals to FA panel')}

    ${sectionDiv('Documentation')}
    ${makeRow('ss-recharge-cert','Agent Recharge / Service Certificate','Current certification on file')}
    ${dataRow(
      {id:'ss-last-service',label:'Last Full Service Date', type:'date'},
      {id:'ss-next-service',label:'Next Service Due Date', type:'date'}
    )}

    <div class="field-group" style="margin-top:8px;">
      <label>Special Suppression Notes</label>
      <textarea id="ss-notes" rows="3"></textarea>
    </div>`;
  return makePanel('special-suppression', '🧪', 'Special Suppression System (NFPA 2001 / 11 / 17)', body);
}

function buildBackflowPanel() {
  const body = `
    ${sectionDiv('Device Information')}
    ${dataRow(
      {id:'bf-mfr',    label:'Manufacturer'},
      {id:'bf-model',  label:'Model'},
      {id:'bf-serial', label:'Serial #'}
    )}
    <div class="data-row cols-3">
      <div class="data-field"><label>Device Type</label>
        <select id="bf-type"><option>Double Check (DC)</option><option>Reduced Pressure (RP/RPZ)</option><option>Pressure Vacuum Breaker (PVB)</option><option>DCDA</option><option>RPDA</option><option>Spill-Resistant PVB</option></select>
      </div>
      <div class="data-field"><label>Size (inches)</label><input type="text" id="bf-size" placeholder='e.g. 2"'></div>
      <div class="data-field"><label>Location</label><input type="text" id="bf-location"></div>
    </div>
    ${dataRow(
      {id:'bf-install',  label:'Year Installed', type:'number'},
      {id:'bf-purpose',  label:'Service (Fire / Irrigation / Domestic)'}
    )}

    ${sectionDiv('Test Results')}
    ${makeRow('bf-test','Backflow Prevention Test Performed','Annual test by certified tester')}
    ${dataRow(
      {id:'bf-check1-open',  label:'Check Valve 1 Opening PSI', type:'number'},
      {id:'bf-check1-close', label:'Check Valve 1 Closing PSI', type:'number'}
    )}
    ${dataRow(
      {id:'bf-check2-open',  label:'Check Valve 2 Opening PSI', type:'number'},
      {id:'bf-check2-close', label:'Check Valve 2 Closing PSI', type:'number'}
    )}
    ${dataRow(
      {id:'bf-rv-open',   label:'RV Opening Differential PSI', type:'number'},
      {id:'bf-test-date', label:'Test Date', type:'date'}
    )}
    ${makeRow('bf-passed','Device Passed Test','All checks within acceptable range')}

    ${sectionDiv('Physical Condition')}
    ${makeRow('bf-casing','Device Casing / Body','No cracks, corrosion, or leaks')}
    ${makeRow('bf-shutoffs','Shutoff Valves','Fully open; easily operable')}
    ${makeRow('bf-clearance','Required Clearance','Accessible for testing and maintenance')}
    ${makeRow('bf-freeze','Freeze Protection (if req\'d)','Insulated or in heated enclosure')}

    ${dataRow({id:'bf-cert-number', label:"Tester's Certification #"}, {id:'bf-cert-exp', label:'Cert. Expiration Date', type:'date'})}

    <div class="field-group" style="margin-top:8px;">
      <label>Backflow Preventer Notes</label>
      <textarea id="bf-notes" rows="3"></textarea>
    </div>`;
  return makePanel('backflow', '🔁', 'Backflow Prevention Device (AWWA / Local Code)', body);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXIT SIGN & EMERGENCY LIGHTING PANEL
// ─────────────────────────────────────────────────────────────────────────────
let elCount = 0, esCount = 0;

function buildExitSignLightingPanel() {
  elCount = 0;
  esCount = 0;
  const body = `
    ${sectionDiv('Emergency Lighting Units (NFPA 101 7.9)')}
    <p style="font-size:.78rem;color:var(--slate);margin-bottom:8px;">Test each unit. 30-sec: press test button and verify lamp illuminates. 90-min annual: full discharge test.</p>
    <div style="overflow-x:auto;">
      <table class="dyn-table" id="el-table">
        <thead><tr>
          <th style="width:24px;">#</th>
          <th>Location</th>
          <th style="width:90px;">Type</th>
          <th style="width:72px;">30-Sec</th>
          <th style="width:72px;">90-Min</th>
          <th style="width:72px;">Battery</th>
          <th style="width:72px;">Pass/Fail</th>
          <th>Comments</th>
          <th style="width:28px;"></th>
        </tr></thead>
        <tbody id="el-tbody"></tbody>
      </table>
    </div>
    <button class="add-row-btn" onclick="addELRow()">+ Add Emergency Lighting Unit</button>

    ${sectionDiv('Exit Signs (NFPA 101 7.10)')}
    <div style="overflow-x:auto;">
      <table class="dyn-table" id="es-table">
        <thead><tr>
          <th style="width:24px;">#</th>
          <th>Location</th>
          <th style="width:90px;">Type</th>
          <th style="width:72px;">Illuminated</th>
          <th style="width:72px;">Arrows</th>
          <th style="width:72px;">Batt. Backup</th>
          <th style="width:72px;">Pass/Fail</th>
          <th>Comments</th>
          <th style="width:28px;"></th>
        </tr></thead>
        <tbody id="es-tbody"></tbody>
      </table>
    </div>
    <button class="add-row-btn" onclick="addESRow()">+ Add Exit Sign</button>

    <div class="field-group" style="margin-top:12px;">
      <label>Exit Sign &amp; Lighting Notes</label>
      <textarea id="esl-notes" rows="3"></textarea>
    </div>`;
  return makePanel('exit-sign-lighting', '🚪', 'Exit Sign & Emergency Lighting (NFPA 101)', body);
}

function _eslYNA(prefix, n) {
  return `<div class="pf-group" style="gap:2px;">
    <button class="pf-btn pass" style="padding:2px 5px;min-width:26px;font-size:.65rem;" onclick="setESLSub(this,'${prefix}',${n},'PASS')">P</button>
    <button class="pf-btn fail" style="padding:2px 5px;min-width:26px;font-size:.65rem;" onclick="setESLSub(this,'${prefix}',${n},'FAIL')">F</button>
    <button class="pf-btn na"   style="padding:2px 5px;min-width:26px;font-size:.65rem;" onclick="setESLSub(this,'${prefix}',${n},'NA')">N/A</button>
    <input type="hidden" id="${prefix}-${n}" value="">
  </div>`;
}

function _eslPF(typeStr, n) {
  return `<div class="pf-group" style="gap:2px;">
    <button class="pf-btn pass" style="padding:2px 5px;min-width:26px;font-size:.65rem;" onclick="setESLPF(this,'${typeStr}',${n},'PASS')">P</button>
    <button class="pf-btn fail" style="padding:2px 5px;min-width:26px;font-size:.65rem;" onclick="setESLPF(this,'${typeStr}',${n},'FAIL')">F</button>
    <input type="hidden" id="${typeStr}-pf-${n}" value="">
  </div>`;
}

function addELRow(p) {
  elCount++;
  const n = elCount;
  p = p || {};
  const types = ['LED','Fluorescent','Incandescent','Other'];
  const typeSel = types.map(t => `<option${p.type===t?' selected':''}>${t}</option>`).join('');
  const tbody = document.getElementById('el-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.id = 'el-row-' + n;
  tr.innerHTML = `
    <td style="text-align:center;font-weight:700;color:var(--slate);">${n}</td>
    <td><input type="text" id="el-loc-${n}" value="${p.loc||''}" placeholder="Location / ID" style="width:100%;"></td>
    <td><select id="el-type-${n}" style="width:100%;">${typeSel}</select></td>
    <td>${_eslYNA('el-30s',n)}</td>
    <td>${_eslYNA('el-90m',n)}</td>
    <td>${_eslYNA('el-batt',n)}</td>
    <td>${_eslPF('el',n)}</td>
    <td><input type="text" id="el-comments-${n}" value="${p.comments||''}" placeholder="Comments" style="width:100%;"></td>
    <td><button class="del-btn" onclick="removeELRow(${n})">✕</button></td>`;
  tbody.appendChild(tr);
  if (p.pf30s)    setESLSubById('el-30s-' + n, p.pf30s);
  if (p.pf90m)    setESLSubById('el-90m-' + n, p.pf90m);
  if (p.pfBatt)   setESLSubById('el-batt-' + n, p.pfBatt);
  if (p.pf)       setESLPFById('el', n, p.pf);
  if (!p) saveDraft();
}

function addESRow(p) {
  esCount++;
  const n = esCount;
  p = p || {};
  const types = ['LED','Photoluminescent','Incandescent','Other'];
  const typeSel = types.map(t => `<option${p.type===t?' selected':''}>${t}</option>`).join('');
  const tbody = document.getElementById('es-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.id = 'es-row-' + n;
  tr.innerHTML = `
    <td style="text-align:center;font-weight:700;color:var(--slate);">${n}</td>
    <td><input type="text" id="es-loc-${n}" value="${p.loc||''}" placeholder="Location / ID" style="width:100%;"></td>
    <td><select id="es-type-${n}" style="width:100%;">${typeSel}</select></td>
    <td>${_eslYNA('es-illum',n)}</td>
    <td>${_eslYNA('es-arrows',n)}</td>
    <td>${_eslYNA('es-batt',n)}</td>
    <td>${_eslPF('es',n)}</td>
    <td><input type="text" id="es-comments-${n}" value="${p.comments||''}" placeholder="Comments" style="width:100%;"></td>
    <td><button class="del-btn" onclick="removeESRow(${n})">✕</button></td>`;
  tbody.appendChild(tr);
  if (p.pfIllum)  setESLSubById('es-illum-' + n, p.pfIllum);
  if (p.pfArrows) setESLSubById('es-arrows-' + n, p.pfArrows);
  if (p.pfBatt)   setESLSubById('es-batt-' + n, p.pfBatt);
  if (p.pf)       setESLPFById('es', n, p.pf);
  if (!p) saveDraft();
}

function setESLSub(btn, prefix, n, val) {
  btn.closest('.pf-group').querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const inp = document.getElementById(prefix + '-' + n);
  if (inp) inp.value = val;
}

function setESLSubById(id, val) {
  const inp = document.getElementById(id);
  if (!inp) return;
  const grp = inp.closest('.pf-group');
  if (!grp) return;
  grp.querySelectorAll('.pf-btn').forEach(b => {
    const bval = b.textContent.trim() === 'P' ? 'PASS' : b.textContent.trim() === 'F' ? 'FAIL' : 'NA';
    b.classList.toggle('selected', bval === val);
  });
  inp.value = val;
}

function setESLPF(btn, typeStr, n, val) {
  btn.closest('.pf-group').querySelectorAll('.pf-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const inp = document.getElementById(typeStr + '-pf-' + n);
  if (inp) inp.value = val;
  _eslManageDefic(typeStr, n, val);
  _eslAutoStatus();
}

function setESLPFById(typeStr, n, val) {
  const inp = document.getElementById(typeStr + '-pf-' + n);
  if (!inp) return;
  const grp = inp.closest('.pf-group');
  if (grp) {
    grp.querySelectorAll('.pf-btn').forEach(b => {
      const bval = b.textContent.trim() === 'P' ? 'PASS' : 'FAIL';
      b.classList.toggle('selected', bval === val);
    });
  }
  inp.value = val;
  _eslManageDefic(typeStr, n, val);
}

function _eslManageDefic(typeStr, n, val) {
  const deficId = typeStr + '-pf-defic-' + n;
  const locEl = document.getElementById(typeStr + '-loc-' + n);
  const loc = locEl?.value?.trim() || '';
  const unitLabel = (typeStr === 'el' ? 'Emergency Light' : 'Exit Sign') + (loc ? ' - ' + loc : '') + ' (Unit #' + n + ')';
  const tbody = document.getElementById('generic-defic-tbody');
  if (!tbody) return;
  const existing = document.getElementById(deficId);
  if (val === 'FAIL') {
    if (!existing) {
      const row = document.createElement('tr');
      row.id = deficId;
      row.innerHTML = `<td style="white-space:nowrap;font-size:.78rem;padding:4px 6px;">${unitLabel}</td>
        <td style="padding:4px 6px;"><input type="text" id="${deficId}-txt" placeholder="Deficiency note…" style="width:100%;border:1px solid var(--border);border-radius:4px;padding:3px 6px;font-size:.78rem;font-family:inherit;"></td>
        <td style="padding:4px 6px;"><button class="del-btn" onclick="document.getElementById('${deficId}').remove();_eslAutoStatus();">✕</button></td>`;
      tbody.appendChild(row);
    }
  } else {
    if (existing) existing.remove();
  }
}

function _eslAutoStatus() {
  if (!overallStatusUserSet) {
    const tbody = document.getElementById('generic-defic-tbody');
    const defics = tbody ? tbody.querySelectorAll('tr').length : 0;
    setOverallStatus(defics > 0 ? 'DEFICIENT' : 'COMPLIANT');
  }
}

function removeELRow(n) {
  document.getElementById('el-row-' + n)?.remove();
  const defic = document.getElementById('el-pf-defic-' + n);
  if (defic) defic.remove();
  _eslAutoStatus();
}

function removeESRow(n) {
  document.getElementById('es-row-' + n)?.remove();
  const defic = document.getElementById('es-pf-defic-' + n);
  if (defic) defic.remove();
  _eslAutoStatus();
}


// ─────────────────────────────────────────────────────────────────────────────
