const {app, BrowserWindow, ipcMain, screen} = require('electron');
const {taskbarBounds, TaskbarController} = require('../src/taskbar-layout');
const path = require('path'), fs = require('fs');
const assert = require('node:assert/strict');
const now = Date.now();
const state = {connection: 'online', updatedAt: now, limits: [
  {kind: 'fiveHour', remaining: 100, resetAt: now + 7200000},
  {kind: 'weekly', remaining: 100, resetAt: now + 345600000}
]};
const actions = [];
let refreshes = 0;
let controller = null, cursor = {x: 300, y: 700}, saves = 0;
ipcMain.handle('get-state', () => state);
ipcMain.on('taskbar-gesture', (_, action) => {
  actions.push(action);
  if (!controller) return;
  if (action === 'move-start') controller.begin('move');
  else if (action === 'resize-start') controller.begin('resize');
  else if (action === 'update') controller.update();
  else if (action === 'end') controller.end();
});
ipcMain.on('refresh', () => refreshes++);
const waitFor = async predicate => {
  const deadline = Date.now() + 5000;
  while (!await predicate()) {
    if (Date.now() > deadline) throw Error('Timed out waiting for taskbar interaction');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};
const timeout = setTimeout(() => {console.error('Taskbar smoke timeout'); app.exit(1)}, 40000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({width: 260, height: 44, frame: false, show: false, skipTaskbar: true, transparent: false, backgroundColor: '#0f172a', resizable: false, webPreferences: {preload: path.join(__dirname, '../src/preload-v2.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false}});
  const errors = [];
  win.webContents.on('console-message', (_, ...args) => {if (args[0] === 3) errors.push(args[1])});
  await win.loadFile(path.join(__dirname, '../src/taskbar.html'));
  win.show(); win.focus();
  await waitFor(() => win.webContents.executeJavaScript("document.querySelector('#five').textContent==='100%'"));
  const out = path.join(__dirname, '../.test-artifacts'); fs.mkdirSync(out, {recursive: true});
  for (const [width, height] of [[220, 40], [260, 44], [360, 48], [480, 48], [480, 64], [220, 40]]) {
    win.setBounds({...win.getBounds(), width, height});
    await waitFor(() => win.webContents.executeJavaScript(`Math.abs(innerWidth-${width})<=1 && Math.abs(innerHeight-${height})<=1`)).catch(async error => {
      throw Error(`${error.message}: ${JSON.stringify({requested: {width, height}, bounds: win.getBounds(), viewport: await win.webContents.executeJavaScript('({width:innerWidth,height:innerHeight})')})}`);
    });
    const checks = await win.webContents.executeJavaScript(`({five:document.querySelector('#five').textContent,week:document.querySelector('#week').textContent,resets:[...document.querySelectorAll('.reset')].map(x=>x.textContent),updated:document.querySelector('#updated').textContent,overflow:[...document.querySelectorAll('.quota,.value,.reset,#updated,#refresh')].some(x=>{const r=x.getBoundingClientRect();return r.top<0||r.bottom>innerHeight||r.right>innerWidth||x.scrollWidth>x.clientWidth+1}),nativeDrag:getComputedStyle(document.querySelector('main')).webkitAppRegion})`);
    assert.equal(checks.five, '100%'); assert.equal(checks.week, '100%'); assert.match(checks.updated, /^C\u1eadp nh\u1eadt \d{2}:\d{2}$/);
    assert.match(checks.resets[0], /^↻ \d{2}:\d{2}$/);
    assert.match(checks.resets[1], /^↻ \d{2}:\d{2} \d{2}\/\d{2}$/);
    assert.equal(checks.overflow, false, JSON.stringify({width, height, checks}));
    assert.equal(checks.nativeDrag, 'no-drag');
    fs.writeFileSync(path.join(out, `taskbar-${width}x${height}.png`), (await win.webContents.capturePage()).toPNG());
  }
  win.setBounds({...win.getBounds(), width: 260, height: 44});
  await waitFor(() => win.webContents.executeJavaScript('Math.abs(innerWidth-260)<=1')).catch(async error => {
    throw Error(`${error.message}: ${JSON.stringify({bounds: win.getBounds(), viewport: await win.webContents.executeJavaScript('({width:innerWidth,height:innerHeight})')})}`);
  });
  const settings = {taskbarX: screen.getPrimaryDisplay().bounds.x + 100, taskbarWidth: 260, taskbarHeight: 44};
  win.setBounds(taskbarBounds(screen.getPrimaryDisplay(), settings));
  controller = new TaskbarController(win, {display: () => screen.getPrimaryDisplay(), cursor: () => cursor, settings: () => settings, save: () => saves++});
  win.setAlwaysOnTop(true, 'screen-saver');
  win.focus();
  const mouse = (type, x, y, extra = {}) => win.webContents.sendInputEvent({type, x, y, button: 'left', clickCount: 1, ...extra});
  const beforeMove = win.getBounds();
  mouse('mouseDown', 30, 14);
  await waitFor(() => actions.includes('move-start'));
  cursor = {x: cursor.x + 50, y: cursor.y - 200};
  mouse('mouseMove', 80, 14, {modifiers: ['leftButtonDown']});
  await waitFor(() => actions.includes('update'));
  assert.equal(win.getBounds().x, beforeMove.x + 50);
  assert.equal(win.getBounds().y, beforeMove.y);
  mouse('mouseUp', 30, 14);
  await waitFor(() => actions.at(-1) === 'end');
  assert.equal(actions[0], 'move-start');
  actions.length = 0;
  const beforeResize = win.getBounds();
  mouse('mouseDown', 253, 6);
  await waitFor(() => actions.includes('resize-start'));
  cursor = {x: cursor.x + 40, y: cursor.y - 4};
  mouse('mouseMove', 230, 12, {modifiers: ['leftButtonDown']});
  await waitFor(() => actions.includes('update'));
  mouse('mouseUp', 230, 12);
  await waitFor(() => actions.at(-1) === 'end');
  assert.equal(actions[0], 'resize-start');
  assert.equal(settings.taskbarWidth, 300);
  assert.equal(settings.taskbarHeight, taskbarBounds(screen.getPrimaryDisplay(), {taskbarWidth: 300, taskbarHeight: beforeResize.height + 4}).height);
  assert.equal(win.getBounds().y + win.getBounds().height, screen.getPrimaryDisplay().bounds.y + screen.getPrimaryDisplay().bounds.height);
  assert.equal(saves, 2);
  actions.length = 0;
  const button = await win.webContents.executeJavaScript("(()=>{const r=document.querySelector('#refresh').getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()");
  mouse('mouseDown', button.x, button.y); mouse('mouseUp', button.x, button.y);
  await waitFor(() => refreshes === 1);
  assert.deepEqual(actions, []);
  win.webContents.send('usage', {...state, connection: 'loading'});
  await waitFor(() => win.webContents.executeJavaScript("document.querySelector('#refresh').disabled"));
  win.webContents.send('usage', {...state, limits: [{kind: 'fiveHour', remaining: 5, resetAt: now - 1}, {kind: 'weekly', remaining: 10, resetAt: null}]});
  await waitFor(() => win.webContents.executeJavaScript("document.querySelector('#five-reset').textContent==='↻ Chờ cập nhật' && document.querySelector('#week-reset').textContent==='↻ --:--' && !document.querySelector('#refresh').disabled"));
  const beforeRecovery = win.getBounds();
  const cover = new BrowserWindow({...beforeRecovery, frame: false, show: false, skipTaskbar: true});
  await cover.loadURL('data:text/html,<body style="background:gray">Topmost test window</body>');
  cover.setAlwaysOnTop(true, 'screen-saver'); cover.show(); cover.focus();
  await waitFor(() => cover.isFocused());
  assert.equal(win.isAlwaysOnTop(), true);
  assert.equal(win.isVisible(), true);
  controller.ensureVisible();
  assert.equal(cover.isFocused(), true, 'Raising the quota must not steal keyboard focus');
  assert.deepEqual(win.getBounds(), beforeRecovery, 'Visibility recovery must not move or resize the quota');
  win.hide();
  controller.ensureVisible();
  assert.equal(win.isVisible(), true);
  assert.equal(cover.isFocused(), true, 'Restoring a hidden quota must not steal keyboard focus');
  assert.deepEqual(win.getBounds(), beforeRecovery);
  cover.destroy();
  assert.deepEqual(errors, []);
  console.log('TASKBAR_SMOKE_OK: reset times, 5 sizes, real move/resize, persistence, refresh, hidden/occluded recovery without focus or geometry changes');
  clearTimeout(timeout); app.quit();
}).catch(error => {console.error(error); clearTimeout(timeout); app.exit(1)});
