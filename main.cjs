const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog, shell } = electron;
const path = require('path');

// 仅在 CI / 无显示环境验证时通过环境变量开启，默认（真实桌面）不启用
if (process.env.WB_SKIN_DEV_NO_SANDBOX) {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'WorkBuddy 皮肤管理器',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

  // 开发时打开 DevTools
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  console.log('[main] app ready, creating window');
  createWindow();
  console.log('[main] window created');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 动态加载 ESM 模块
async function loadModules() {
  const config = await import('./lib/config.mjs');
  const skins = await import('./lib/skins.mjs');
  const { ensureWorkBuddy, status: wbStatus } = await import('./lib/launcher.mjs');
  const { injectCss, removeCss } = await import('./lib/cdp.mjs');
  return { config, skins, ensureWorkBuddy, wbStatus, injectCss, removeCss };
}

let modulesPromise = loadModules();

function dataUrlToBuffer(dataUrl) {
  const m = /^data:(.+?);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  return Buffer.from(m[2], 'base64');
}

function slugify(name) {
  return (name || 'skin')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'skin';
}

// IPC handlers
ipcMain.handle('get-config', async () => {
  console.log('[IPC] get-config called');
  const { config, wbStatus } = await modulesPromise;
  const cfg = config.loadConfig();
  return { ...cfg, status: await wbStatus(cfg) };
});

ipcMain.handle('refresh-status', async () => {
  const { config, wbStatus } = await modulesPromise;
  return wbStatus(config.loadConfig());
});

ipcMain.handle('list-skins', async () => {
  const { skins } = await modulesPromise;
  return skins.listSkins();
});

// 旧版「生成皮肤」功能已迁移到 workbuddy-skin-generator Skill，App 只负责导入 .wbskin

ipcMain.handle('delete-skin', async (event, id) => {
  const { skins } = await modulesPromise;
  return skins.deleteSkin(id);
});

ipcMain.handle('import-skin', async () => {
  const { skins } = await modulesPromise;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: '导入 WorkBuddy 皮肤包',
    filters: [
      { name: 'WorkBuddy 皮肤包', extensions: ['wbskin'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  return skins.importWbskin(result.filePaths[0]);
});

ipcMain.handle('import-skin-path', async (event, filePath) => {
  const { skins } = await modulesPromise;
  return skins.importWbskin(filePath);
});

ipcMain.handle('export-skin', async (event, id) => {
  const { skins } = await modulesPromise;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出 WorkBuddy 皮肤包',
    defaultPath: `${id}.wbskin`,
    filters: [
      { name: 'WorkBuddy 皮肤包', extensions: ['wbskin'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled) return { canceled: true };
  skins.exportWbskin(id, result.filePath);
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle('apply-skin', async (event, id) => {
  const { config, skins, ensureWorkBuddy, injectCss, removeCss } = await modulesPromise;
  const cfg = config.loadConfig();
  const skin = skins.getSkin(id);
  if (!skin) throw new Error('皮肤不存在');

  const launch = await ensureWorkBuddy(cfg);
  if (!launch.ok) throw new Error('启动 WorkBuddy 失败，请检查路径');

  await removeCss(cfg.workbuddyDebugPort);
  await injectCss(cfg.workbuddyDebugPort, skin.css);

  const next = { ...cfg, lastTheme: id };
  config.saveConfig(next);
  return { ok: true, relaunched: launch.relaunched, theme: id };
});

ipcMain.handle('restore-default', async () => {
  const { config, ensureWorkBuddy, removeCss } = await modulesPromise;
  const cfg = config.loadConfig();
  const launch = await ensureWorkBuddy(cfg);
  if (!launch.ok) throw new Error('启动 WorkBuddy 失败，请检查路径');

  await removeCss(cfg.workbuddyDebugPort);
  const next = { ...cfg, lastTheme: null };
  config.saveConfig(next);
  return { ok: true, relaunched: launch.relaunched };
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});
