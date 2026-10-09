const { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const LOCAL_DATA_DIR = path.join(__dirname, '..', '.appdata');
app.setPath('userData', LOCAL_DATA_DIR);
app.commandLine.appendSwitch('disk-cache-dir', path.join(LOCAL_DATA_DIR, 'Cache'));

const USAGE_URL = 'https://chatgpt.com/settings/usage?tab=overview';
const POLL_MS = 5 * 60 * 1000;
const DEBUG_PORT = 9223;
const CHROME_PROFILE = path.join(LOCAL_DATA_DIR, 'ChromeProfile');
let mainWindow;
let tray;
let chromeProcess;
let chromeVisible = false;
let loginPollTimer;
let lastData = { status: 'Đang khởi động…', updatedAt: null, limits: [] };
let notified = new Set();

function createTrayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <rect width="32" height="32" rx="8" fill="#111827"/>
    <path d="M8 22V11h4v11zm6 0V7h4v15zm6 0v-8h4v8z" fill="#7dd3fc"/>
  </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 410,
    minWidth: 380,
    minHeight: 350,
    show: false,
    autoHideMenuBar: true,
    title: 'Codex Usage Monitor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function chromePath() {
  const candidates = [
    path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];
  return candidates.find(file => fs.existsSync(file));
}

function launchChrome(visible) {
  const executable = chromePath();
  if (!executable) {
    updateData({ status: 'Không tìm thấy Google Chrome trên máy.', updatedAt: Date.now(), limits: [] });
    return;
  }
  chromeVisible = visible;
  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${CHROME_PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check'
  ];
  args.push(`--app=${USAGE_URL}`);
  if (!visible) args.push('--start-minimized');
  chromeProcess = spawn(executable, args, { detached: false, stdio: 'ignore' });
  chromeProcess.on('error', error => updateData({ status: `Không mở được Chrome: ${error.message}`, updatedAt: Date.now(), limits: [] }));
  setTimeout(readUsage, 3000);
  if (!loginPollTimer) loginPollTimer = setInterval(readUsage, 2000);
}

async function closeManagedChrome() {
  try {
    const version = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then(r => r.json());
    await cdpCall(version.webSocketDebuggerUrl, 'Browser.close');
  } catch (_) {
    if (chromeProcess && !chromeProcess.killed) chromeProcess.kill();
  }
}

function cdpCall(webSocketDebuggerUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketDebuggerUrl);
    const timer = setTimeout(() => { ws.close(); reject(new Error('Chrome không phản hồi')); }, 8000);
    ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method, params })));
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data.toString());
      if (message.id !== 1) return;
      clearTimeout(timer);
      ws.close();
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Không kết nối được Chrome')); });
  });
}

async function showLogin() {
  if (loginPollTimer) clearInterval(loginPollTimer);
  await closeManagedChrome();
  setTimeout(() => {
    launchChrome(true);
    loginPollTimer = setInterval(readUsage, 2000);
  }, 800);
  updateData({ status: 'Hãy đăng nhập trong Chrome; cửa sổ sẽ tự đóng khi kết nối xong.', updatedAt: Date.now(), limits: [] });
}

async function readUsage() {
  try {
    let tabs = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`).then(r => r.json());
    let tab = tabs.find(item => item.type === 'page' && item.url.includes('/settings/usage'));
    if (!tab) {
      await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(USAGE_URL)}`, { method: 'PUT' });
      setTimeout(readUsage, 2500);
      return;
    }
    const expression = `(() => {
      const text = document.body?.innerText || '';
      const lines = text.split(/\\n+/).map(x => x.trim()).filter(Boolean);
      const pct = [...text.matchAll(/(?:Còn lại|remaining)\\s*(\\d{1,3})%|(\\d{1,3})%\\s*(?:left|remaining)/gi)]
        .map(m => Number(m[1] || m[2]));
      const reset = lines.filter(x => /(?:Đặt lại sau|resets? in)/i.test(x)).slice(0, 4);
      const labels = lines.filter(x => /(?:5 giờ|5 hour|hàng tuần|weekly)/i.test(x)).slice(0, 4);
      return { url: location.href, title: document.title, pct, reset, labels, sample: text.slice(0, 500) };
    })()`;
    const evaluated = await cdpCall(tab.webSocketDebuggerUrl, 'Runtime.evaluate', { expression, returnByValue: true });
    const result = evaluated.result.value;

    // Percentages are the success signal. The settings URL can temporarily
    // differ during OAuth callbacks, so do not reject valid data by URL first.
    if (!result.pct.length) {
      if (!result.url.includes('/settings/usage')) {
        updateData({ status: 'Cần đăng nhập một lần để kết nối tài khoản.', updatedAt: Date.now(), limits: [] });
        return;
      }
      updateData({ status: 'Chưa đọc được dữ liệu. Hãy mở trang đăng nhập/Usage.', updatedAt: Date.now(), limits: [] });
      return;
    }

    const defaults = ['Giới hạn trong 5 giờ', 'Giới hạn hàng tuần'];
    const limits = result.pct.slice(0, 2).map((remaining, i) => ({
      name: result.labels[i] || defaults[i],
      remaining: Math.max(0, Math.min(100, remaining)),
      reset: result.reset[i] || ''
    }));
    updateData({ status: 'Đang theo dõi', updatedAt: Date.now(), limits });
    notifyLowLimits(limits);
    if (chromeVisible) {
      if (loginPollTimer) clearInterval(loginPollTimer);
      loginPollTimer = null;
      try {
        const windowInfo = await cdpCall(tab.webSocketDebuggerUrl, 'Browser.getWindowForTarget', { targetId: tab.id });
        await cdpCall(tab.webSocketDebuggerUrl, 'Browser.setWindowBounds', {
          windowId: windowInfo.windowId,
          bounds: { windowState: 'minimized' }
        });
      } catch (_) {}
      chromeVisible = false;
    }
  } catch (error) {
    console.error('readUsage failed:', error);
    updateData({ status: `Chưa đọc được dữ liệu: ${error.message}`, updatedAt: Date.now(), limits: [] });
  }
}

function updateData(data) {
  lastData = data;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('usage', data);
  const lowest = data.limits.length ? Math.min(...data.limits.map(x => x.remaining)) : null;
  tray.setToolTip(lowest === null ? 'Codex Usage Monitor' : `Codex còn tối thiểu ${lowest}%`);
  rebuildMenu();
}

function notifyLowLimits(limits) {
  for (const limit of limits) {
    for (const threshold of [20, 10, 5]) {
      const key = `${limit.name}:${threshold}`;
      if (limit.remaining <= threshold && !notified.has(key)) {
        notified.add(key);
        new Notification({
          title: 'Codex sắp hết hạn mức',
          body: `${limit.name}: còn ${limit.remaining}%. ${limit.reset}`
        }).show();
      }
    }
  }
}

function rebuildMenu() {
  const summary = lastData.limits.map(x => `${x.name}: ${x.remaining}%`).join(' | ') || lastData.status;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: summary, enabled: false },
    { type: 'separator' },
    { label: 'Mở bảng theo dõi', click: () => mainWindow.show() },
    { label: 'Kết nối lại tài khoản', click: showLogin },
    { label: 'Làm mới ngay', click: readUsage },
    { type: 'separator' },
    { label: 'Thoát', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
}

app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  createMainWindow();
  tray = new Tray(createTrayIcon());
  tray.on('click', () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show());
  rebuildMenu();
  launchChrome(false);
  setInterval(readUsage, POLL_MS);
});

ipcMain.handle('get-usage', () => lastData);
ipcMain.on('refresh', readUsage);
ipcMain.on('login', showLogin);

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  app.isQuitting = true;
  closeManagedChrome();
});
