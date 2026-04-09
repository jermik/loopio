const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto'); // used for deviceId generation

const POLAR_API_URL = 'https://api.polar.sh/v1/customer-portal/license-keys/validate';
const POLAR_ORGANIZATION_ID = '80044d27-df19-48a9-af9f-466d4df38207';
const POLAR_BENEFIT_ID = 'daf0d275-4dc2-4546-9767-ea8dd516a0c8';

function getLicenseFilePath() {
  return path.join(app.getPath('userData'), 'license.json');
}

function getDeviceFilePath() {
  return path.join(app.getPath('userData'), 'device.json');
}

function ensureAppDataDir() {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  ensureAppDataDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function getOrCreateDeviceId() {
  const saved = readJson(getDeviceFilePath());
  if (saved?.deviceId) return saved.deviceId;
  const deviceId = crypto.randomUUID();
  writeJson(getDeviceFilePath(), { deviceId, createdAt: new Date().toISOString() });
  return deviceId;
}

function saveActivatedLicense(licenseKey, meta = {}) {
  writeJson(getLicenseFilePath(), {
    licenseKey,
    activatedAt: new Date().toISOString(),
    ...meta,
  });
}

function readActivatedLicense() {
  return readJson(getLicenseFilePath());
}

function getStoredLicenseStatus() {
  const saved = readActivatedLicense();
  if (!saved?.licenseKey) return { valid: false, message: 'No license activated on this device.' };
  return {
    valid: true,
    licensee: saved.licensee || 'Licensed user',
    issuedAt: saved.issuedAt || saved.activatedAt || null,
    message: 'Activated on this device.',
  };
}

async function validateLicenseOnline(licenseKey) {
  const key = String(licenseKey || '').trim();
  if (!key) return { valid: false, message: 'License key is required.' };

  const deviceId = getOrCreateDeviceId();

  try {
    const response = await fetch(POLAR_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        organization_id: POLAR_ORGANIZATION_ID,
        benefit_id: POLAR_BENEFIT_ID,
        activation_label: deviceId,
      }),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.status === 'granted') {
      return {
        valid: true,
        licensee: data.customer?.email || 'Licensed user',
        issuedAt: data.created_at || null,
        message: 'License activated successfully.',
      };
    }

    const reason = data?.detail || data?.status || 'Invalid license key.';
    return { valid: false, message: String(reason) };
  } catch {
    return { valid: false, message: 'Could not reach the license server. Check your internet connection.' };
  }
}

let win = null;
let recording = false;
let playing = false;
let recordedActions = [];
let recordStartTime = 0;
let pollInterval = null;
let playbackTimeout = null;
let lastMouseButtons = 0;
let lastKeyStates = {};
let lastRecordedPos = { x: -1, y: -1 };
let playbackSpeed = 1;
let repeatCount = 0;
let currentRepeat = 0;
let humanize = true;
let startDelay = 0;
let hotkeyPollInterval = null;
let lastHotkeyStates = {};
let playbackAbortFlag = false; // hard abort for instant stop

// Configurable hotkeys (virtual key codes)
let hotkeyRecord = 0x75; // F6
let hotkeyPlayStop = 0x76; // F7

// Logging helper
function log(category, ...args) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}][${category}]`, ...args);
}

// VK name lookup
const VK_NAMES = {
  0x08: 'Backspace', 0x09: 'Tab', 0x0D: 'Enter', 0x10: 'Shift', 0x11: 'Ctrl', 0x12: 'Alt',
  0x14: 'CapsLock', 0x1B: 'Esc', 0x20: 'Space',
  0x21: 'PgUp', 0x22: 'PgDn', 0x23: 'End', 0x24: 'Home',
  0x25: '←', 0x26: '↑', 0x27: '→', 0x28: '↓',
  0x2D: 'Ins', 0x2E: 'Del',
};
for (let i = 0x70; i <= 0x87; i++) VK_NAMES[i] = 'F' + (i - 0x70 + 1);
for (let i = 0x30; i <= 0x39; i++) VK_NAMES[i] = String.fromCharCode(i);
for (let i = 0x41; i <= 0x5A; i++) VK_NAMES[i] = String.fromCharCode(i);

function vkToName(vk) { return VK_NAMES[vk] || `0x${vk.toString(16).toUpperCase()}`; }


function vkToAccelerator(vk) {
  if (vk >= 0x70 && vk <= 0x87) return `F${vk - 0x70 + 1}`;
  if (vk >= 0x30 && vk <= 0x39) return String.fromCharCode(vk);
  if (vk >= 0x41 && vk <= 0x5A) return String.fromCharCode(vk);
  const map = {
    0x08: 'Backspace', 0x09: 'Tab', 0x0D: 'Enter', 0x1B: 'Escape', 0x20: 'Space',
    0x21: 'PageUp', 0x22: 'PageDown', 0x23: 'End', 0x24: 'Home',
    0x25: 'Left', 0x26: 'Up', 0x27: 'Right', 0x28: 'Down',
    0x2D: 'Insert', 0x2E: 'Delete',
  };
  return map[vk] || null;
}

function handleRecordShortcut() {
  if (!recording && !playing) {
    log('HOTKEY', `${vkToName(hotkeyRecord)} → start recording`);
    startRecording();
  }
}

function handlePlayStopShortcut() {
  if (recording) {
    log('HOTKEY', `${vkToName(hotkeyPlayStop)} → stop recording + start playback`);
    stopRecording();
    startPlayback();
  } else if (playing) {
    log('HOTKEY', `${vkToName(hotkeyPlayStop)} → stop playback`);
    stopPlayback();
  } else if (recordedActions.length > 0) {
    log('HOTKEY', `${vkToName(hotkeyPlayStop)} → start playback`);
    startPlayback();
  }
}

function registerGlobalHotkeys() {
  try { globalShortcut.unregisterAll(); } catch {}
  const shortcuts = [
    [vkToAccelerator(hotkeyRecord), handleRecordShortcut],
    [vkToAccelerator(hotkeyPlayStop), handlePlayStopShortcut],
  ];
  for (const [accel, handler] of shortcuts) {
    if (!accel) continue;
    try {
      const ok = globalShortcut.register(accel, handler);
      log('HOTKEY', `${accel} registration ${ok ? 'ok' : 'failed'}`);
      if (!ok && win) win.webContents.send('notify', `Hotkey unavailable: ${accel}`);
    } catch (err) {
      log('HOTKEY', `Failed to register ${accel}:`, err.message);
    }
  }
}

function applyCompactWindowMode(expanded = false) {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  const bounds = win.getBounds();
  const h = expanded ? 250 : 50;
  win.setMinimumSize(280, 40);
  win.setMaximumSize(400, expanded ? 350 : 50);
  win.setResizable(false);
  win.setAlwaysOnTop(true);
  win.setBounds({ x: bounds.x, y: bounds.y, width: Math.max(bounds.width, 280), height: h });
}

// --- Script Library ---
function getLibraryPath() {
  return path.join(app.getPath('userData'), 'scripts');
}

function ensureLibraryDir() {
  const dir = getLibraryPath();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listScripts() {
  const dir = ensureLibraryDir();
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
          return { name: f.replace('.json', ''), actions: data.actions?.length || 0, date: fs.statSync(path.join(dir, f)).mtimeMs };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.date - a.date);
  } catch { return []; }
}

function saveScript(name) {
  if (recordedActions.length === 0 || !name) return;
  const dir = ensureLibraryDir();
  const safeName = name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
  if (!safeName) return;
  fs.writeFileSync(
    path.join(dir, safeName + '.json'),
    JSON.stringify({ actions: recordedActions, version: 2 }, null, 2), 'utf-8'
  );
  log('SCRIPT', 'Saved', safeName, recordedActions.length, 'actions');
  if (win) {
    win.webContents.send('notify', `Saved "${safeName}"`);
    win.webContents.send('scripts-updated', listScripts());
  }
}

function loadScript(name) {
  const dir = ensureLibraryDir();
  const filePath = path.join(dir, name + '.json');
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (data.actions && Array.isArray(data.actions)) {
      recordedActions = data.actions;
      log('SCRIPT', 'Loaded', name, recordedActions.length, 'actions');
      if (win) {
        win.webContents.send('action-count', recordedActions.length);
        win.webContents.send('notify', `Loaded "${name}"`);
      }
    }
  } catch { if (win) win.webContents.send('notify', 'Failed to load script'); }
}

function deleteScript(name) {
  const dir = ensureLibraryDir();
  try {
    fs.unlinkSync(path.join(dir, name + '.json'));
    if (win) {
      win.webContents.send('notify', `Deleted "${name}"`);
      win.webContents.send('scripts-updated', listScripts());
    }
  } catch { if (win) win.webContents.send('notify', 'Failed to delete'); }
}

function renameScript(oldName, newName) {
  const dir = ensureLibraryDir();
  const safeName = newName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
  if (!safeName || safeName === oldName) return;
  const oldPath = path.join(dir, oldName + '.json');
  const newPath = path.join(dir, safeName + '.json');
  try {
    if (fs.existsSync(newPath)) { if (win) win.webContents.send('notify', 'Name already exists'); return; }
    fs.renameSync(oldPath, newPath);
    if (win) {
      win.webContents.send('notify', `Renamed to "${safeName}"`);
      win.webContents.send('scripts-updated', listScripts());
    }
  } catch { if (win) win.webContents.send('notify', 'Failed to rename'); }
}

// --- Humanization helpers ---
function gaussRand() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clampedGauss(mean, stddev, minV, maxV) {
  return Math.max(minV, Math.min(maxV, mean + gaussRand() * stddev));
}

function humanizeMove(x, y) {
  if (!humanize) return { x, y };
  const jx = Math.round(gaussRand() * 0.7);
  const jy = Math.round(gaussRand() * 0.7);
  return { x: x + jx, y: y + jy };
}

function humanizeDelay() {
  if (!humanize) return 0;
  return Math.round(gaussRand() * 3);
}

function bezierPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
}

function generateCurvedPath(fromX, fromY, toX, toY, steps) {
  const dist = Math.sqrt((toX-fromX)**2 + (toY-fromY)**2);
  if (dist < 3 || steps < 2) return [{ x: toX, y: toY }];
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const perpX = -(toY - fromY) / dist;
  const perpY = (toX - fromX) / dist;
  const curvature = clampedGauss(0, dist * 0.08, -dist * 0.15, dist * 0.15);
  const cp1x = midX + perpX * curvature * 0.6 + gaussRand() * 2;
  const cp1y = midY + perpY * curvature * 0.6 + gaussRand() * 2;
  const cp2x = midX + perpX * curvature * 1.2 + gaussRand() * 2;
  const cp2y = midY + perpY * curvature * 1.2 + gaussRand() * 2;
  const points = [];
  for (let i = 1; i <= steps; i++) {
    let t = i / steps;
    t = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
    const x = Math.round(bezierPoint(t, fromX, cp1x, cp2x, toX));
    const y = Math.round(bezierPoint(t, fromY, cp1y, cp2y, toY));
    points.push({ x, y });
  }
  return points;
}

function generateIdleWander(fromX, fromY, toX, toY, availableMs) {
  if (!humanize) return [];
  if (availableMs < 500 || Math.random() > 0.35) return [];
  const moves = [];
  const numMoves = 1 + Math.floor(Math.random() * 3);
  const wanderRadius = 5 + Math.random() * 20;
  const wanderTime = availableMs * 0.7;
  let curX = fromX, curY = fromY;
  for (let i = 0; i < numMoves; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * wanderRadius;
    const wx = Math.round(curX + Math.cos(angle) * dist);
    const wy = Math.round(curY + Math.sin(angle) * dist);
    const stepsForDrift = 3 + Math.floor(Math.random() * 5);
    const curvedPath = generateCurvedPath(curX, curY, wx, wy, stepsForDrift);
    const stepDelay = Math.floor(wanderTime / (numMoves * stepsForDrift));
    for (const p of curvedPath) {
      moves.push({ x: p.x, y: p.y, delay: stepDelay + Math.round(gaussRand() * 5) });
    }
    if (Math.random() > 0.5) {
      const pauseMs = 50 + Math.floor(Math.random() * 150);
      moves.push({ x: wx, y: wy, delay: pauseMs });
    }
    curX = wx;
    curY = wy;
  }
  return moves;
}

// --- Windows API via koffi ---
let user32 = null;
let GetCursorPos = null;
let SetCursorPos = null;
let mouse_event_fn = null;
let GetAsyncKeyState = null;
let keybd_event_fn = null;
let POINT = null;
let SetWindowsHookExW = null;
let CallNextHookEx = null;
let UnhookWindowsHookEx = null;
let scrollHook = null;
let pendingScrollEvents = [];
let GetForegroundWindow = null;

function initWinAPI() {
  try {
    let koffi;
    try {
      koffi = require('koffi');
    } catch (e1) {
      const appRoot = path.resolve(__dirname, '..');
      const koffiPath = path.join(appRoot, 'node_modules', 'koffi');
      try {
        koffi = require(koffiPath);
      } catch (e2) {
        const resourcesPath = path.join(process.resourcesPath || appRoot, 'node_modules', 'koffi');
        koffi = require(resourcesPath);
      }
    }
    user32 = koffi.load('user32.dll');
    POINT = koffi.struct('POINT', { x: 'int32', y: 'int32' });
    const MSLLHOOKSTRUCT = koffi.struct('MSLLHOOKSTRUCT', {
      x: 'int32', y: 'int32', mouseData: 'uint32', flags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr_t'
    });
    GetCursorPos = user32.func('bool GetCursorPos(_Out_ POINT* lpPoint)');
    SetCursorPos = user32.func('bool SetCursorPos(int X, int Y)');
    mouse_event_fn = user32.func('void mouse_event(uint32 dwFlags, uint32 dx, uint32 dy, uint32 dwData, uintptr_t dwExtraInfo)');
    GetAsyncKeyState = user32.func('int16 GetAsyncKeyState(int vKey)');
    keybd_event_fn = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr_t dwExtraInfo)');
    GetForegroundWindow = user32.func('intptr_t GetForegroundWindow()');

    // Low-level mouse hook for scroll wheel capture
    const LowLevelMouseProc = koffi.proto('intptr_t LowLevelMouseProc(int nCode, uintptr_t wParam, MSLLHOOKSTRUCT* lParam)');
    SetWindowsHookExW = user32.func('intptr_t SetWindowsHookExW(int idHook, LowLevelMouseProc lpfn, intptr_t hMod, uint32 dwThreadId)');
    CallNextHookEx = user32.func('intptr_t CallNextHookEx(intptr_t hhk, int nCode, uintptr_t wParam, MSLLHOOKSTRUCT* lParam)');
    UnhookWindowsHookEx = user32.func('bool UnhookWindowsHookEx(intptr_t hhk)');

    const WM_MOUSEWHEEL = 0x020A;
    const WH_MOUSE_LL = 14;

    const hookCallback = koffi.register((nCode, wParam, lParam) => {
      if (nCode >= 0 && wParam === WM_MOUSEWHEEL && recording) {
        const raw = lParam.mouseData >>> 16;
        const delta = (raw > 32767) ? raw - 65536 : raw;
        const elapsed = Date.now() - recordStartTime;
        pendingScrollEvents.push({ type: 'scroll', timestamp: elapsed, x: lParam.x, y: lParam.y, delta });
      }
      return CallNextHookEx(scrollHook, nCode, wParam, lParam);
    }, koffi.pointer(LowLevelMouseProc));

    scrollHook = SetWindowsHookExW(WH_MOUSE_LL, hookCallback, 0, 0);

    log('INIT', 'Windows API loaded successfully');
    return true;
  } catch (err) {
    log('ERROR', 'Failed to load Windows API:', err.message);
    return false;
  }
}

function getMousePos() {
  if (!GetCursorPos) return { x: 0, y: 0 };
  const pt = { x: 0, y: 0 };
  GetCursorPos(pt);
  return { x: pt.x, y: pt.y };
}
function moveMouse(x, y) { if (SetCursorPos) SetCursorPos(x, y); }
function mouseDown(button) { if (mouse_event_fn) mouse_event_fn(button === 'right' ? 0x0008 : 0x0002, 0, 0, 0, 0); }
function mouseUp(button) { if (mouse_event_fn) mouse_event_fn(button === 'right' ? 0x0010 : 0x0004, 0, 0, 0, 0); }
function isKeyPressed(vk) { if (!GetAsyncKeyState) return false; return (GetAsyncKeyState(vk) & 0x8000) !== 0; }

function pressKey(vk) { if (keybd_event_fn) keybd_event_fn(vk, 0, 0, 0); }
function releaseKey(vk) { if (keybd_event_fn) keybd_event_fn(vk, 0, 0x0002, 0); }

// Check if the foreground window is our app window (to exclude app clicks from recording)
function isOurWindowFocused() {
  if (!GetForegroundWindow || !win) return false;
  try {
    const fgHwnd = GetForegroundWindow();
    const ourHwnd = win.getNativeWindowHandle().readInt32LE ? win.getNativeWindowHandle().readInt32LE(0) : 0;
    return fgHwnd === ourHwnd;
  } catch {
    return false;
  }
}

const VK_LBUTTON = 0x01, VK_RBUTTON = 0x02, VK_CONTROL = 0x11, VK_MENU = 0x12, VK_L = 0x4C;

const TRACKED_KEYS = [];
for (let i = 0x41; i <= 0x5A; i++) TRACKED_KEYS.push(i);
for (let i = 0x30; i <= 0x39; i++) TRACKED_KEYS.push(i);
for (let i = 0x70; i <= 0x7B; i++) TRACKED_KEYS.push(i);
const SPECIAL_KEYS = {
  0x08: 'Backspace', 0x09: 'Tab', 0x0D: 'Enter', 0x10: 'Shift', 0x11: 'Ctrl', 0x12: 'Alt',
  0x14: 'CapsLock', 0x1B: 'Escape', 0x20: 'Space',
  0x21: 'PageUp', 0x22: 'PageDown', 0x23: 'End', 0x24: 'Home',
  0x25: 'Left', 0x26: 'Up', 0x27: 'Right', 0x28: 'Down',
  0x2D: 'Insert', 0x2E: 'Delete',
  0x5B: 'LWin', 0x5C: 'RWin',
  0x60: 'Num0', 0x61: 'Num1', 0x62: 'Num2', 0x63: 'Num3', 0x64: 'Num4',
  0x65: 'Num5', 0x66: 'Num6', 0x67: 'Num7', 0x68: 'Num8', 0x69: 'Num9',
  0x6A: 'Num*', 0x6B: 'Num+', 0x6D: 'Num-', 0x6E: 'Num.', 0x6F: 'Num/',
  0xBA: ';', 0xBB: '=', 0xBC: ',', 0xBD: '-', 0xBE: '.', 0xBF: '/', 0xC0: '`',
  0xDB: '[', 0xDC: '\\', 0xDD: ']', 0xDE: "'",
};
for (const vk of Object.keys(SPECIAL_KEYS)) TRACKED_KEYS.push(parseInt(vk));

function getKeyName(vk) {
  if (vk >= 0x41 && vk <= 0x5A) return String.fromCharCode(vk);
  if (vk >= 0x30 && vk <= 0x39) return String.fromCharCode(vk);
  if (vk >= 0x70 && vk <= 0x7B) return 'F' + (vk - 0x70 + 1);
  return SPECIAL_KEYS[vk] || `VK_${vk.toString(16)}`;
}

function startRecording() {
  if (recording || playing) return;
  recordedActions = [];
  recording = true;
  recordStartTime = Date.now();
  lastMouseButtons = 0;
  lastKeyStates = {};
  lastRecordedPos = { x: -1, y: -1 };
  log('RECORD', 'Started recording');

  pollInterval = setInterval(() => {
    if (!recording) return;
    // Ctrl+Alt emergency stop
    if (isKeyPressed(VK_CONTROL) && isKeyPressed(VK_MENU)) {
      log('RECORD', 'Emergency stop (Ctrl+Alt)');
      stopRecording();
      if (win) win.webContents.send('state-changed', 'idle');
      return;
    }

    const elapsed = Date.now() - recordStartTime;
    const pos = getMousePos();

    // CRITICAL: Skip recording when our own window is focused (prevents loop-button-click bug)
    const appFocused = isOurWindowFocused();

    const dx = pos.x - lastRecordedPos.x, dy = pos.y - lastRecordedPos.y;
    if (dx * dx + dy * dy > 1) {
      recordedActions.push({ type: 'mousemove', timestamp: elapsed, x: pos.x, y: pos.y });
      lastRecordedPos = { x: pos.x, y: pos.y };
    }

    // Only record mouse clicks when NOT clicking on our app
    if (!appFocused) {
      const leftDown = isKeyPressed(VK_LBUTTON), wasLeftDown = (lastMouseButtons & 1) !== 0;
      if (leftDown && !wasLeftDown) recordedActions.push({ type: 'mousedown', timestamp: elapsed, x: pos.x, y: pos.y, button: 'left' });
      else if (!leftDown && wasLeftDown) recordedActions.push({ type: 'mouseup', timestamp: elapsed, x: pos.x, y: pos.y, button: 'left' });
      const rightDown = isKeyPressed(VK_RBUTTON), wasRightDown = (lastMouseButtons & 2) !== 0;
      if (rightDown && !wasRightDown) recordedActions.push({ type: 'mousedown', timestamp: elapsed, x: pos.x, y: pos.y, button: 'right' });
      else if (!rightDown && wasRightDown) recordedActions.push({ type: 'mouseup', timestamp: elapsed, x: pos.x, y: pos.y, button: 'right' });
      lastMouseButtons = (leftDown ? 1 : 0) | (rightDown ? 2 : 0);
    } else {
      // Track button state even when app focused, so we don't get phantom releases
      const leftDown = isKeyPressed(VK_LBUTTON);
      const rightDown = isKeyPressed(VK_RBUTTON);
      lastMouseButtons = (leftDown ? 1 : 0) | (rightDown ? 2 : 0);
    }

    for (const vk of TRACKED_KEYS) {
      if (vk === VK_CONTROL || vk === VK_MENU) continue;
      // Skip hotkey keys to avoid recording them
      if (vk === hotkeyRecord || vk === hotkeyPlayStop) continue;
      const down = isKeyPressed(vk);
      const wasDown = !!lastKeyStates[vk];
      if (down && !wasDown) {
        recordedActions.push({ type: 'keydown', timestamp: elapsed, vk: vk, key: getKeyName(vk) });
        lastKeyStates[vk] = true;
      } else if (!down && wasDown) {
        recordedActions.push({ type: 'keyup', timestamp: elapsed, vk: vk, key: getKeyName(vk) });
        lastKeyStates[vk] = false;
      }
    }

    // Consume scroll events captured by the low-level hook
    while (pendingScrollEvents.length > 0) {
      recordedActions.push(pendingScrollEvents.shift());
    }
  }, 10);

  if (win) { win.webContents.send('state-changed', 'recording'); win.webContents.send('action-count', 0); }
}

function stopRecording() {
  recording = false;
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  lastKeyStates = {};
  log('RECORD', 'Stopped recording,', recordedActions.length, 'actions captured');
  if (win) win.webContents.send('action-count', recordedActions.length);
}

function startPlayback() {
  if (recordedActions.length === 0) { log('PLAY', 'No actions to play'); return; }
  if (playing) return;
  playing = true;
  playbackAbortFlag = false;
  currentRepeat = 0;
  log('PLAY', 'Starting playback,', recordedActions.length, 'actions, speed:', playbackSpeed);
  if (win) win.webContents.send('state-changed', 'playing');
  if (startDelay > 0) {
    if (win) win.webContents.send('notify', `Starting in ${startDelay}s...`);
    let remaining = startDelay;
    const countdownInterval = setInterval(() => {
      remaining--;
      if (!playing || playbackAbortFlag) { clearInterval(countdownInterval); return; }
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        playLoop();
      } else if (win) {
        win.webContents.send('notify', `Starting in ${remaining}s...`);
      }
    }, 1000);
  } else {
    playLoop();
  }
}

function sendRepeatStatus() {
  if (!win) return;
  const total = repeatCount === 0 ? '∞' : repeatCount;
  win.webContents.send('repeat-status', { current: currentRepeat + 1, total });
}

function playLoop() {
  if (!playing || playbackAbortFlag) return;
  sendRepeatStatus();
  const startReal = Date.now();
  const timingOffset = humanizeDelay();
  let i = 0;

  const actionTimingOffsets = [];
  if (humanize) {
    let drift = 0;
    for (let j = 0; j < recordedActions.length; j++) {
      drift += clampedGauss(0, 1.5, -4, 4);
      drift = Math.max(-8, Math.min(8, drift));
      actionTimingOffsets.push(Math.round(drift));
    }
  } else {
    for (let j = 0; j < recordedActions.length; j++) actionTimingOffsets.push(0);
  }

  // Pre-compute idle wander
  let wanderQueue = [];
  if (humanize) {
    let lastPos = recordedActions.length > 0 ? { x: recordedActions[0].x || 0, y: recordedActions[0].y || 0 } : { x: 0, y: 0 };
    for (let j = 0; j < recordedActions.length; j++) {
      const a = recordedActions[j];
      if (a.x != null) lastPos = { x: a.x, y: a.y };
      if (a.type === 'mousedown' || a.type === 'mouseup') {
        let prevTime = 0;
        for (let k = j - 1; k >= 0; k--) {
          if (recordedActions[k].type !== 'mousemove') { prevTime = recordedActions[k].timestamp; break; }
        }
        const gap = a.timestamp - prevTime;
        if (gap > 500) {
          const wanders = generateIdleWander(lastPos.x, lastPos.y, a.x, a.y, gap / playbackSpeed);
          let t = prevTime + 80;
          for (const w of wanders) {
            wanderQueue.push({ executeAt: t + timingOffset, x: w.x, y: w.y });
            t += w.delay;
          }
        }
      }
    }
    wanderQueue.sort((a, b) => a.executeAt - b.executeAt);
  }
  let wi = 0;

  // Pre-compute curved mouse interpolation
  let interpQueue = [];
  if (humanize) {
    let lastMovePos = null;
    let lastMoveTime = 0;
    for (let j = 0; j < recordedActions.length; j++) {
      const a = recordedActions[j];
      if (a.type === 'mousemove') {
        if (lastMovePos) {
          const dist = Math.sqrt((a.x - lastMovePos.x)**2 + (a.y - lastMovePos.y)**2);
          if (dist > 15) {
            const steps = Math.min(8, Math.max(2, Math.floor(dist / 20)));
            const curved = generateCurvedPath(lastMovePos.x, lastMovePos.y, a.x, a.y, steps);
            const timeBetween = a.timestamp - lastMoveTime;
            for (let s = 0; s < curved.length - 1; s++) {
              const t = lastMoveTime + (timeBetween * (s + 1)) / (curved.length);
              interpQueue.push({ executeAt: t, x: curved[s].x, y: curved[s].y });
            }
          }
        }
        lastMovePos = { x: a.x, y: a.y };
        lastMoveTime = a.timestamp;
      }
    }
    interpQueue.sort((a, b) => a.executeAt - b.executeAt);
  }
  let ii = 0;

  function tick() {
    // CRITICAL: Check abort flag FIRST for instant stop
    if (!playing || playbackAbortFlag) {
      log('PLAY', 'Playback tick aborted');
      return;
    }
    if (isKeyPressed(VK_CONTROL) && isKeyPressed(VK_MENU)) { stopPlayback(); return; }

    const elapsed = (Date.now() - startReal) * playbackSpeed;

    // Execute interpolated curve points
    while (ii < interpQueue.length && interpQueue[ii].executeAt <= elapsed) {
      if (playbackAbortFlag) return;
      moveMouse(interpQueue[ii].x, interpQueue[ii].y);
      ii++;
    }

    // Execute idle wander movements
    while (wi < wanderQueue.length && wanderQueue[wi].executeAt <= elapsed) {
      if (playbackAbortFlag) return;
      moveMouse(wanderQueue[wi].x, wanderQueue[wi].y);
      wi++;
    }

    while (i < recordedActions.length && (recordedActions[i].timestamp + timingOffset + actionTimingOffsets[i]) <= elapsed) {
      if (playbackAbortFlag) return;
      const action = recordedActions[i];
      if (action.type === 'mousemove') {
        const h = humanizeMove(action.x, action.y);
        moveMouse(h.x, h.y);
      } else if (action.type === 'mousedown') {
        // CLICK FIX: Move to exact position, small settle, then press
        moveMouse(action.x, action.y);
        mouseDown(action.button === 'right' ? 'right' : 'left');
        log('PLAY', 'mousedown', action.button || 'left', 'at', action.x, action.y);
      } else if (action.type === 'mouseup') {
        // CLICK FIX: Ensure cursor is at exact same position before release
        moveMouse(action.x, action.y);
        mouseUp(action.button === 'right' ? 'right' : 'left');
        log('PLAY', 'mouseup', action.button || 'left', 'at', action.x, action.y);
      } else if (action.type === 'scroll' && mouse_event_fn) {
        moveMouse(action.x, action.y);
        mouse_event_fn(0x0800, 0, 0, action.delta, 0);
      } else if (action.type === 'keydown' && action.vk) {
        pressKey(action.vk);
        log('PLAY', 'keydown', getKeyName(action.vk));
      } else if (action.type === 'keyup' && action.vk) {
        releaseKey(action.vk);
      }
      i++;
    }

    if (i >= recordedActions.length) {
      currentRepeat++;
      log('PLAY', 'Loop iteration', currentRepeat, 'complete');
      if (repeatCount > 0 && currentRepeat >= repeatCount) {
        stopPlayback();
        if (win) win.webContents.send('notify', `Finished ${currentRepeat} repeat(s)`);
      } else if (playing && !playbackAbortFlag) {
        const loopGap = humanize ? (30 + Math.floor(Math.random() * 170)) : 50;
        playbackTimeout = setTimeout(playLoop, loopGap);
      }
      return;
    }

    playbackTimeout = setTimeout(tick, 2);
  }
  tick();
}

function stopPlayback() {
  log('PLAY', 'Stopping playback');
  playbackAbortFlag = true; // instant abort signal
  playing = false;
  if (playbackTimeout) { clearTimeout(playbackTimeout); playbackTimeout = null; }
  if (win) win.webContents.send('repeat-status', null);
  if (win) win.webContents.send('state-changed', 'idle');
}

function saveRecording() {
  if (recordedActions.length === 0) return;
  const result = dialog.showSaveDialogSync(win, {
    title: 'Save Recording', defaultPath: 'recording.json',
    filters: [{ name: 'MyLoopio Recording', extensions: ['json'] }],
  });
  if (result) {
    fs.writeFileSync(result, JSON.stringify({ actions: recordedActions, version: 2 }, null, 2), 'utf-8');
    if (win) win.webContents.send('notify', 'Recording saved');
  }
}

function loadRecording() {
  const result = dialog.showOpenDialogSync(win, {
    title: 'Load Recording',
    filters: [{ name: 'MyLoopio Recording', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result && result[0]) {
    try {
      const data = JSON.parse(fs.readFileSync(result[0], 'utf-8'));
      if (data.actions && Array.isArray(data.actions)) {
        recordedActions = data.actions;
        if (win) { win.webContents.send('action-count', recordedActions.length); win.webContents.send('notify', `Loaded ${recordedActions.length} actions`); }
      }
    } catch { if (win) win.webContents.send('notify', 'Failed to load file'); }
  }
}


function setWindowExpanded(expanded) {
  applyCompactWindowMode(expanded);
}

function createWindow() {
  const hasLicense = getStoredLicenseStatus().valid;
  win = new BrowserWindow({
    width: hasLicense ? 280 : 720,
    height: hasLicense ? 50 : 640,
    minWidth: hasLicense ? 280 : 520,
    minHeight: hasLicense ? 40 : 520,
    maxHeight: hasLicense ? 50 : undefined,
    title: 'MyLoopio',
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, webSecurity: false, preload: path.join(__dirname, 'preload.cjs') },
    backgroundColor: '#0f1318',
    autoHideMenuBar: true,
    resizable: !hasLicense,
    frame: !hasLicense ? true : false,
    skipTaskbar: false,
    alwaysOnTop: !!hasLicense,
  });

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  win.loadFile(indexPath, { hash: '/app' });
  if (hasLicense) {
    applyCompactWindowMode(false);
  }
  log('WINDOW', 'Created main window');
}

function showFirstRunDialog() {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch {}
  if (settings.firstRunDone) return;

  dialog.showMessageBoxSync({
    type: 'info',
    title: 'Welcome to MyLoopio',
    message: 'Welcome to MyLoopio!',
    detail:
`Thank you for trying MyLoopio!

⚠️ WINDOWS SMARTSCREEN
If Windows showed a "protected your PC" warning, that's normal for unsigned indie apps. The app is 100% safe.

🎮 HOTKEYS (default)
  F6 = Start/Stop Recording
  F7 = Play/Stop Playback
  Ctrl+Alt+L = Loop toggle
  Ctrl+Alt = Emergency Stop

Enjoy automating!`,
    buttons: ['Got it!'],
    defaultId: 0,
  });

  settings.firstRunDone = true;
  try { fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf-8'); } catch {}
}

app.whenReady().then(() => {
  const apiLoaded = initWinAPI();
  showFirstRunDialog();
  createWindow();
  registerGlobalHotkeys();
  if (!apiLoaded && win) {
    win.webContents.on('did-finish-load', () => { win.webContents.send('api-error', 'Windows API not available.'); });
  }

  // Global hotkey polling — debounced, reliable, system-wide
  if (apiLoaded) {
    let hotkeyDebounce = {}; // prevents double-triggering
    const DEBOUNCE_MS = 200;

    hotkeyPollInterval = setInterval(() => {
      const now = Date.now();
      const recKey = isKeyPressed(hotkeyRecord), wasRec = !!lastHotkeyStates['rec'];
      const playKey = isKeyPressed(hotkeyPlayStop), wasPlay = !!lastHotkeyStates['play'];
      const ctrlAltL = isKeyPressed(VK_CONTROL) && isKeyPressed(VK_MENU) && isKeyPressed(VK_L);
      const wasCtrlAltL = !!lastHotkeyStates['ctrlAltL'];
      lastHotkeyStates['rec'] = recKey;
      lastHotkeyStates['play'] = playKey;
      lastHotkeyStates['ctrlAltL'] = ctrlAltL;

      // F6: Record toggle (only when idle)
      if (recKey && !wasRec && (now - (hotkeyDebounce['rec'] || 0)) > DEBOUNCE_MS) {
        hotkeyDebounce['rec'] = now;
        if (!recording && !playing) {
          log('HOTKEY', 'F6 → start recording');
          startRecording();
        }
      }

      // F7: Play/Stop toggle
      if (playKey && !wasPlay && (now - (hotkeyDebounce['play'] || 0)) > DEBOUNCE_MS) {
        hotkeyDebounce['play'] = now;
        if (recording) {
          log('HOTKEY', 'F7 → stop recording + start playback');
          stopRecording();
          startPlayback();
        } else if (playing) {
          log('HOTKEY', 'F7 → stop playback');
          stopPlayback();
        } else if (recordedActions.length > 0) {
          log('HOTKEY', 'F7 → start playback');
          startPlayback();
        }
      }

      // Ctrl+Alt+L: Loop toggle (stop recording + start loop)
      if (ctrlAltL && !wasCtrlAltL && (now - (hotkeyDebounce['ctrlAltL'] || 0)) > DEBOUNCE_MS) {
        hotkeyDebounce['ctrlAltL'] = now;
        if (recording) {
          log('HOTKEY', 'Ctrl+Alt+L → stop recording + start loop');
          stopRecording();
          startPlayback();
        } else if (!playing && recordedActions.length > 0) {
          log('HOTKEY', 'Ctrl+Alt+L → start loop');
          startPlayback();
        }
      }
    }, 30);
  }

  ipcMain.on('record', () => { log('IPC', 'record'); startRecording(); });
  ipcMain.on('stop', () => {
    log('IPC', 'stop');
    if (recording) { stopRecording(); if (win) win.webContents.send('state-changed', 'idle'); }
    if (playing) stopPlayback();
  });
  ipcMain.on('loop', () => { log('IPC', 'loop'); stopRecording(); startPlayback(); });
  ipcMain.on('save', () => saveRecording());
  ipcMain.on('load', () => loadRecording());
  ipcMain.on('set-speed', (_e, speed) => { playbackSpeed = speed; });
  ipcMain.on('set-repeat', (_e, count) => { repeatCount = count; });
  ipcMain.on('set-humanize', (_e, val) => { humanize = val; });
  ipcMain.on('set-start-delay', (_e, val) => { startDelay = val; });
  ipcMain.on('set-expanded', (_e, expanded) => setWindowExpanded(expanded));
  ipcMain.on('minimize', () => { if (win) win.minimize(); });
  ipcMain.on('close-app', () => { if (win) win.close(); });
  ipcMain.handle('get-build-info', () => ({ variant: 'full' }));
  ipcMain.handle('license-status', () => getStoredLicenseStatus());
  ipcMain.handle('activate-license', async (_event, licenseKey) => {
    const result = await validateLicenseOnline(licenseKey);
    if (result.valid) {
      saveActivatedLicense(String(licenseKey || '').trim(), {
        licensee: result.licensee || 'Licensed user',
        issuedAt: result.issuedAt || null,
        deviceId: getOrCreateDeviceId(),
      });
    }
    return result;
  });
  ipcMain.on('license-activated-ui', () => {
    if (win) {
      win.close();
      win = null;
    }
    createWindow();
  });
  ipcMain.on('toggle-pin', () => {
    if (!win) return;
    const pinned = !win.isAlwaysOnTop();
    win.setAlwaysOnTop(pinned);
    win.webContents.send('pin-changed', pinned);
  });

  // Script library IPC
  ipcMain.on('get-scripts', () => { if (win) win.webContents.send('scripts-updated', listScripts()); });
  ipcMain.on('save-script', (_e, name) => saveScript(name));
  ipcMain.on('load-script', (_e, name) => loadScript(name));
  ipcMain.on('delete-script', (_e, name) => deleteScript(name));
  ipcMain.on('rename-script', (_e, oldName, newName) => renameScript(oldName, newName));

  // Hotkey config IPC
  ipcMain.on('get-hotkeys', () => {
    if (win) win.webContents.send('hotkeys-updated', {
      record: { vk: hotkeyRecord, name: vkToName(hotkeyRecord) },
      playStop: { vk: hotkeyPlayStop, name: vkToName(hotkeyPlayStop) },
    });
  });
  ipcMain.on('set-hotkey', (_e, which, vk) => {
    if (which === 'record') hotkeyRecord = vk;
    else if (which === 'playStop') hotkeyPlayStop = vk;
    registerGlobalHotkeys();
    if (win) win.webContents.send('hotkeys-updated', {
      record: { vk: hotkeyRecord, name: vkToName(hotkeyRecord) },
      playStop: { vk: hotkeyPlayStop, name: vkToName(hotkeyPlayStop) },
    });
  });

  // Capture next key press
  let captureInterval = null;
  ipcMain.on('capture-hotkey', (_e, which) => {
    if (captureInterval) clearInterval(captureInterval);
    captureInterval = setInterval(() => {
      for (let vk = 0x08; vk <= 0x87; vk++) {
        if (vk === 0x11 || vk === 0x12) continue;
        if (isKeyPressed(vk)) {
          clearInterval(captureInterval);
          captureInterval = null;
          if (which === 'record') hotkeyRecord = vk;
          else if (which === 'playStop') hotkeyPlayStop = vk;
          registerGlobalHotkeys();
          if (win) {
            win.webContents.send('hotkeys-updated', {
              record: { vk: hotkeyRecord, name: vkToName(hotkeyRecord) },
              playStop: { vk: hotkeyPlayStop, name: vkToName(hotkeyPlayStop) },
            });
            win.webContents.send('hotkey-captured', which);
          }
          return;
        }
      }
    }, 30);
    setTimeout(() => { if (captureInterval) { clearInterval(captureInterval); captureInterval = null; if (win) win.webContents.send('hotkey-captured', null); } }, 5000);
  });
  ipcMain.on('cancel-capture', () => { if (captureInterval) { clearInterval(captureInterval); captureInterval = null; } });
});

app.on('window-all-closed', () => {
  if (hotkeyPollInterval) clearInterval(hotkeyPollInterval);
  try { globalShortcut.unregisterAll(); } catch {}
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch {} });
