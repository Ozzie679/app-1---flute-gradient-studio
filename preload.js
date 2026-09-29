const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  saveWallpaper: (arrayBuffer, suggestedName) =>
    ipcRenderer.invoke('save-wallpaper', arrayBuffer, suggestedName),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, status) => callback(status)),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
});
