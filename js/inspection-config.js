// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const SHEET_ID  = '1_Koq_v0RjsFbQ_c2qZh-eQpGQT2-0IkOal-I4CjSJrI';
const SHEET_GID = '1899870347';
const SCOPES    = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive';

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
  'exit-sign-lighting':  { label: 'Exit Sign & Lighting',   icon: '🚪' }
};
