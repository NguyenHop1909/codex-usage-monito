const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('usageApi', {
  get: () => ipcRenderer.invoke('get-usage'),
  refresh: () => ipcRenderer.send('refresh'),
  login: () => ipcRenderer.send('login'),
  onUpdate: (callback) => ipcRenderer.on('usage', (_event, data) => callback(data))
});
