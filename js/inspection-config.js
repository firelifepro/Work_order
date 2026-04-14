// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const SHEET_ID  = '1_Koq_v0RjsFbQ_c2qZh-eQpGQT2-0IkOal-I4CjSJrI';

// ── Inspection Schedule Apps Script integration ──────────────────────────────
// After deploying the Apps Script as a Web App, paste the URL below.
// Apps Script → Deploy → New Deployment → Web App → Execute as Me → Anyone
// Also run setSecret() in the Apps Script once after pasting.
const APPS_SCRIPT_URL    = 'https://script.google.com/macros/s/AKfycbxUkTZq5Wpfet8Qbyt0S17VfHVkrevEfMpoCG3wlqNNtTS0QVgL1mJ68rWxqqlk2c_C7w/exec'; // ← PASTE WEB APP URL HERE
const APPS_SCRIPT_SECRET = 'flips-2026-secret'; // must match setSecret() in Apps Script
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
  'exit-sign-lighting':  { label: 'Exit Sign & Lighting',   icon: '🚪' }
};
