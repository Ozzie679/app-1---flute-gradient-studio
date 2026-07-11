const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveWallpaper: (arrayBuffer, suggestedName) =>
    ipcRenderer.invoke('save-wallpaper', arrayBuffer, suggestedName),
});
