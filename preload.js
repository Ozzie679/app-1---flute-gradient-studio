const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  saveWallpaper: (arrayBuffer, suggestedName) =>
    ipcRenderer.invoke('save-wallpaper', arrayBuffer, suggestedName),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
});
