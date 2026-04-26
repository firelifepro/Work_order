// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const SHEET_ID  = '1_Koq_v0RjsFbQ_c2qZh-eQpGQT2-0IkOal-I4CjSJrI';

// Inspection pages append directly to the Inspection History tab (see js/flips-history.js)
// after the report PDF saves, so we need write scope on Sheets.
const SHEET_GID = '1899870347';
const SCOPES    = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive';

let accessToken = null;
let tokenClient = null;
let clientData  = {};
let currentStep = 1;
let currentFAStep = 'panel';
const FA_STEP_ORDER = ['panel', 'devices', 'aux', 'defic'];
const SP_STEP_ORDER = ['overview', 'inspection', 'drain', 'defic'];
let currentSPStep = 'overview';
let spDeficCount = 0;
let spNoteCount = 0;
let spDrainCount = 0;
let genericDeficCount = 0;
let activeSystems = new Set();
let activeInspectionSystem = null;
let _propertyProfile = null;
let _currentPropertyAcct = '';
let overallStatus = '';
let overallStatusUserSet = false;
let sigDrawing = false;
let sigCtx = null;
let sigHasData = false;
let activeHoodIdentifier = '';

const SYS_META = {
  'fire-alarm':          { label: 'Fire Alarm',              icon: '🔔' },
  'sprinkler':           { label: 'Sprinkler System',        icon: '💧' },
  'fire-pump':           { label: 'Fire Pump',               icon: '🔄' },
  'standpipe':           { label: 'Standpipe',              icon: '🚿' },
  'hood':                { label: 'Kitchen Hood Suppression',icon: '🍳' },
  'extinguisher':        { label: 'Extinguishers',          icon: '🧯' },
  'hydrant':             { label: 'Private Hydrants',       icon: '🔴' },
  'bda':                 { label: 'BDA / Emergency Radio',  icon: '📡' },
  'smoke-control':       { label: 'Smoke Control',          icon: '💨' },
  'gas-detection':       { label: 'Gas Detection',          icon: '⚗️' },
  'special-suppression': { label: 'Special Suppression',    icon: '🧪' },
  'backflow':            { label: 'Backflow Prevention',    icon: '🔁' },
  'exit-sign-lighting':  { label: 'Exit Sign & Lighting',   icon: '🚪' },
  'hospital':            { label: 'Hospital TJC/CMS',        icon: '🏥' }
};

// ─── HOSPITAL / TJC CONSTANTS ────────────────────────────────────────────────

const EOC_CHECKLIST = [
  // EC.02.03.05 — Fire Alarm Testing and Inspection
  {std:'EC.02.03.05 EP 1', item:'Supervisory Signals (except duct detectors)', freq:'Quarterly'},
  {std:'EC.02.03.05 EP 2', item:'Water flow devices', freq:'Quarterly'},
  {std:'EC.02.03.05 EP 2', item:'Tamper switches', freq:'Quarterly'},
  {std:'EC.02.03.05 EP 3', item:'Duct, heat, smoke detectors, pull boxes, elect. releasing devices', freq:'Annually'},
  {std:'EC.02.03.05 EP 4', item:'Notification devices (audible & visual)', freq:'Annually'},
  {std:'EC.02.03.05 EP 5', item:'Emergency services notification transmission equipment', freq:'Quarterly'},
  {std:'EC.02.03.05 EP 6', item:'Fire pump(s) tested under no-load conditions', freq:'Weekly'},
  {std:'EC.02.03.05 EP 7', item:'Water storage tank high & low level alarms', freq:'Semi-annually'},
  {std:'EC.02.03.05 EP 8', item:'Water storage tank low water temp alarms (cold weather only)', freq:'Monthly'},
  {std:'EC.02.03.05 EP 9', item:'Sprinkler systems main drain tests on all risers', freq:'Quarterly'},
  {std:'EC.02.03.05 EP 10', item:'Fire department connections inspected', freq:'Quarterly'},
  {std:'EC.02.03.05 EP 11', item:'Fire pump(s) tested annually underflow', freq:'Annually'},
  {std:'EC.02.03.05 EP 12', item:'Standpipe systems tested with water flow (NFPA 25)', freq:'Five years'},
  {std:'EC.02.03.05 EP 13', item:'Kitchen auto extinguishing systems inspected (no discharge reqd)', freq:'Semi-annually'},
  {std:'EC.02.03.05 EP 14', item:'Gaseous extinguishing systems inspected (no discharge reqd)', freq:'Annually'},
  {std:'EC.02.03.05 EP 15', item:'Portable fire extinguishers inspected monthly', freq:'Monthly'},
  {std:'EC.02.03.05 EP 16', item:'Portable fire extinguishers maintained annually', freq:'Annually'},
  {std:'EC.02.03.05 EP 17', item:'Fire hoses hydro tested 5 yrs after install, every 3 yrs after that', freq:'5 yrs / 3yrs'},
  {std:'EC.02.03.05 EP 18', item:'Smoke & fire dampers tested (fusible links removed when applicable)', freq:'Six years'},
  {std:'EC.02.03.05 EP 19', item:'Smoke detection shutdown devices for HVAC tested', freq:'Annually'},
  {std:'EC.02.03.05 EP 20', item:'All horizontal & vertical roller & slider doors tested', freq:'Annually'},
  {std:'EC.02.03.05',       item:'Visual inspection of Initiating and Indicating devices', freq:'Semi-annually'},
  // LS.01.02.01 — ILSM
  {std:'LS.01.02.01 EP 3', item:'ILSM policy developed and in place', freq:'N/A'},
  {std:'LS.01.02.01 EP 3', item:'Criteria for evaluating deficiencies & hazards to determine when ILSMs apply', freq:'N/A'},
  {std:'LS.01.02.01 EP 3', item:'The organization implements ILSMs as defined in its policy', freq:'As applicable'},
  // EC.02.05.07 — Emergency Power
  {std:'EC.02.05.07 EP 1', item:'Battery powered lights tested @ 30 days for 30 sec. and annually 1.5 hrs', freq:'Monthly'},
  {std:'EC.02.05.07 EP 2', item:'Annually for 1.5 hrs', freq:'Annually'},
  {std:'EC.02.05.07 EP 3', item:'Stored Emerg. Pow. Sup. Sys. (SEPSS) for Life Safety tested 5 min.', freq:'Quarterly'},
  {std:'EC.02.05.07 EP 3', item:'Annually @ full load for 60% of its class or rating for recharge', freq:'Annually'},
  {std:'EC.02.05.07 EP 4,5', item:'Generators tested 12x/yr cont. 30 min. under load ≥30% of nameplate rating', freq:'Monthly'},
  {std:'EC.02.05.07 EP 6', item:'Transfer switches 12x/yr', freq:'Monthly'},
  {std:'EC.02.05.07 EP 7', item:'Emergency generator test for a minimum of 4 continuous hours', freq:'3 years'},
  // EC.02.05.09 — Medical Gas
  {std:'EC.02.05.09 EP 1', item:'Review maintenance program and testing documentation', freq:'Set by policy'},
  {std:'EC.02.05.09 EP 2', item:'Review installation and modification of med gas test results for: cross-connection, purity & pressure', freq:'As applicable'},
  {std:'EC.02.05.09 EP 3', item:'Med gas supply and zone valves are accessible and clearly labeled', freq:'Ongoing'},
];

const HOSP_FA_KEY_DEVICES = [
  {device:'Supervisory Signal Devices',     key:'SPV', interval:'Quarterly',      code:'NFPA 72 (2010) 14.3.1/14.4.5', activity:'14.4.2', ep:'1'},
  {device:'Water Flow Devices',             key:'FS',  interval:'Semi-Annually',  code:'NFPA 25 (2011) 14.4.4',         activity:'14.4.2', ep:'2'},
  {device:'Pressure Switch Devices',        key:'PRS', interval:'Semi-Annually',  code:'NFPA 25 (2011) 14.4.5',         activity:'14.4.2', ep:'2'},
  {device:'Valve Tamper Switches',          key:'TS',  interval:'Semi-Annually',  code:'NFPA 25 (2011) 14.4.5',         activity:'14.4.2', ep:'2'},
  {device:'Low/High Air Devices',           key:'LA/HA',interval:'Quarterly',     code:'NFPA 25 (2011) 14.4.5',         activity:'14.4.2', ep:'2'},
  {device:'Beam Detectors',                 key:'BD',  interval:'Annually',       code:'NFPA 72 (2010) 14.4.5; 17.14',  activity:'14.4.2', ep:'3'},
  {device:'Smoke Detectors',                key:'SD',  interval:'Annually',       code:'NFPA 72 (2010) 14.4.5; 17.14',  activity:'14.4.2', ep:'3'},
  {device:'Smoke/CO2 Combo Detectors',      key:'CBO', interval:'Annually',       code:'NFPA 72 (2010) 14.4.5; 17.14',  activity:'14.4.2', ep:'3'},
  {device:'Heat Detectors',                 key:'HD',  interval:'Annually',       code:'NFPA 72 (2010) 14.4.5; 17.14',  activity:'14.4.2', ep:'3'},
  {device:'Manual Pull Stations',           key:'PS',  interval:'Annually',       code:'NFPA 72 (2010) 14.4.5; 17.14',  activity:'14.4.2', ep:'3'},
  {device:'Duct Detectors',                 key:'DD',  interval:'Annually',       code:'NFPA 72 (2010) 14.4.5; 17.14',  activity:'14.4.2', ep:'3'},
  {device:'CO2 Detectors',                  key:'CO2', interval:'Annually',       code:'NFPA 72 (2010) 14.4.5; 17.14',  activity:'14.4.2', ep:'3'},
  {device:'Bells',                          key:'BL',  interval:'Annually',       code:'NFPA 72 (2010) 14.3.1/14.4.5',  activity:'14.4.2', ep:'4'},
  {device:'Chimes',                         key:'CH',  interval:'Annually',       code:'NFPA 72 (2010) 14.3.1/14.4.5',  activity:'14.4.2', ep:'4'},
  {device:'Horns',                          key:'HN',  interval:'Annually',       code:'NFPA 72 (2010) 14.3.1/14.4.5',  activity:'14.4.2', ep:'4'},
  {device:'Strobes',                        key:'ST',  interval:'Annually',       code:'NFPA 72 (2010) 14.3.1/14.4.5',  activity:'14.4.2', ep:'4'},
  {device:'Speakers',                       key:'SP',  interval:'Annually',       code:'NFPA 72 (2010) 14.3.1/14.4.5',  activity:'14.4.2', ep:'4'},
  {device:'Horn/Strobe Combos',             key:'HSC', interval:'Annually',       code:'NFPA 72 (2010) 14.3.1/14.4.5',  activity:'14.4.2', ep:'4'},
  {device:'Speaker/Strobe Combos',          key:'SSC', interval:'Annually',       code:'NFPA 72 (2010) 14.3.1/14.4.5',  activity:'14.4.2', ep:'4'},
  {device:'Mag Door / Releasing Hardware',  key:'MAG', interval:'Annually',       code:'NFPA 72 (2010) 14.3.1/14.4.5',  activity:'14.4.2', ep:'4'},
  {device:'Off Premise Alarm Notification', key:'OPN', interval:'Quarterly',      code:'NFPA 72 (2010) 14.3.1/14.4.5',  activity:'14.4.2', ep:'5'},
  {device:'Elevator Recall Banks',          key:'ELV', interval:'Annually',       code:'NFPA 72 (2010) 14.3.1/14.4.5',  activity:'14.4.2', ep:'7'},
  {device:'Water Tank High & Low Level Alarm',key:'WTA',interval:'Semi-Annually', code:'NFPA 25 (2011) 9.2.4; 9.1.1.2', activity:'',       ep:'8'},
  {device:'CO2/Gaseous Systems',            key:'GAS', interval:'Semi-Annually',  code:'NFPA 13 (2010) 21.4.1.6(1)',    activity:'',       ep:'14'},
  {device:'Power Supplies',                 key:'PWR', interval:'Semi-Annually',  code:'NFPA 90A (2010) 6.4.1',         activity:'14.4.2', ep:'10'},
  {device:'Annunciators',                   key:'ANN', interval:'Annually',       code:'NFPA 90A (2010) 6.4.1',         activity:'14.4.2', ep:'10'},
  {device:'AHU Shutdown',                   key:'AHU', interval:'Annually',       code:'NFPA 90A (2010) 6.4.1',         activity:'14.4.2', ep:'19'},
  {device:'Roll Down Fire Doors',           key:'RFD', interval:'Annually',       code:'NFPA 80 (2010) 5.2.14.2',       activity:'14.4.3', ep:'20'},
  {device:'Sliding Fire Doors',             key:'SLD', interval:'Annually',       code:'NFPA 80 (2010) 5.2.14.2',       activity:'14.4.4', ep:'20'},
];

const HOSP_SP_KEY_DEVICES = [
  {device:'Backflow Preventers',            key:'BFP', interval:'Annually',       code:'NFPA 25 (2011) 13-6.2.1',       ep:'9'},
  {device:'Main Drains',                    key:'MD',  interval:'Annually',       code:'NFPA 25 (2011) 13.2.5',         ep:'9'},
  {device:'Fire Department Connections',    key:'FDC', interval:'Quarterly',      code:'NFPA 25 (2011) 13.7; 13.1.1.2', ep:'10'},
  {device:'Hose Valve Connections',         key:'HV',  interval:'Quarterly',      code:'NFPA 25 (2011) 13.7; 13.1.1.2', ep:'10'},
  {device:'Fire Pumps',                     key:'FP',  interval:'Annually',       code:'NFPA 25 (2011) 8-3.1,8.3.2,8.3.3', ep:'11'},
  {device:'Standpipes',                     key:'SDP', interval:'5 Years',        code:'NFPA 25 (2011) 6.3.1;6.3.2;6.1.1.2', ep:'12'},
  {device:'Sprinkler Head',                 key:'SH',  interval:'Annually',       code:'NFPA 25 (2011) 13.2.5',         ep:'14'},
  {device:'Spare Head Boxes',               key:'SHB', interval:'Annually',       code:'NFPA 25 (2011) 13.2.5',         ep:'14'},
  {device:'Sprinkler Control Valves',       key:'VLV', interval:'Annually',       code:'NFPA 25 (2011) 13.2.5',         ep:'14'},
  {device:'Hydraulic Nameplate',            key:'HC',  interval:'Quarterly',      code:'NFPA 25 (2011) 2-7.7',          ep:'14'},
  {device:'Gauges',                         key:'GA',  interval:'Quarterly',      code:'NFPA 25 (2011) 2-7.7',          ep:'14'},
  {device:'Antifreeze Systems',             key:'AF',  interval:'Annually',       code:'NFPA 25 (2011) 2-7.7',          ep:'14'},
  {device:'Dry Valve Systems',              key:'DV',  interval:'Annually',       code:'NFPA 25 (2011) 2-7.7',          ep:'14'},
  {device:'Deluge Valve Systems',           key:'DLG', interval:'Quarterly',      code:'NFPA 25 (2011) 2-7.7',          ep:'14'},
  {device:'Standpipe Hoses',               key:'SH',  interval:'3/5 Years',      code:'NFPA 25 (2011) 13.5.2.1',       ep:'17'},
  {device:'Piping Inspection',              key:'PI',  interval:'5 Years',        code:'NFPA 25 (2011) 14.3.2.1',       ep:''},
  {device:'Fire Hydrants',                  key:'HYD', interval:'Annually',       code:'NFPA 25 (2011) 7.4.2.1',        ep:''},
  {device:'Kitchen Extinguishing Systems',  key:'KES', interval:'Semi-Annually',  code:'NFPA 17A (2010) 7.3',           ep:'13'},
  {device:'Portable Fire Extinguishers (Annual)', key:'FE', interval:'Annually',  code:'NFPA 10 (2010) 7.1.2;7.2.2;7.2.4;7.3.1', ep:'16'},
  {device:'Portable Fire Extinguishers (Monthly)', key:'FEM', interval:'Monthly', code:'NFPA 10 (2010) 7.1.2;7.2.2;7.2.4;7.3.1', ep:'15'},
  {device:'Smoke Dampers',                  key:'SDM', interval:'6yr Hosp/4yr Other', code:'NFPA 105 (2010) 6.5.2',      ep:'18'},
  {device:'Fire Dampers',                   key:'FDM', interval:'6yr Hosp/4yr Other', code:'NFPA 80 (2010) 19.4.1.1',    ep:'18'},
  {device:'Fire Rated Doors',               key:'FRD', interval:'Annually',       code:'NFPA 80 (2010) 5.2.1',          ep:'20'},
  {device:'Smoke Rated Doors',              key:'SRD', interval:'Annually',       code:'NFPA 105 (2010) 5.2.1.1',       ep:'20'},
  {device:'Emergency Lights',               key:'EL',  interval:'Annually/Monthly', code:'NFPA 101 (2012) 7.9.3/7.10.9', ep:'2'},
  {device:'Exit Signs',                     key:'ES',  interval:'Annually/Monthly', code:'NFPA 101 (2012) 7.9.3/7.10.9', ep:'2'},
  {device:'Combo Signs/Lights',             key:'LS',  interval:'Annually/Monthly', code:'NFPA 101 (2012) 7.9.3/7.10.9', ep:'2'},
];

const HOSP_RECURRING_ROWS = [
  ['Fire Alarm Annual','','Fire Alarm Semi Annual',''],
  ['Wet Sprinkler Annual','','Dry Valve Annual',''],
  ['Emergency Light Annual','','Kitchen Hood',''],
  ['Pre-Action/Clean Agent','','Antifreeze Annual',''],
  ['Fire Alarm Quarterly','','Fire Pump Annual',''],
  ['Backflow Preventor Annual','','Portable Extinguisher Annual',''],
];
