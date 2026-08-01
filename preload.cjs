const electron = require('electron');
const { contextBridge, ipcRenderer, webUtils } = electron;

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  refreshStatus: () => ipcRenderer.invoke('refresh-status'),
  listSkins: () => ipcRenderer.invoke('list-skins'),
  deleteSkin: (id) => ipcRenderer.invoke('delete-skin', id),
  importSkin: () => ipcRenderer.invoke('import-skin'),
  importSkinPath: (filePath) => ipcRenderer.invoke('import-skin-path', filePath),
  exportSkin: (id) => ipcRenderer.invoke('export-skin', id),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  applySkin: (id) => ipcRenderer.invoke('apply-skin', id),
  restoreDefault: () => ipcRenderer.invoke('restore-default'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
