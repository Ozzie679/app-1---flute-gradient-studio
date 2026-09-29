const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initUpdater } = require('./updater');

let mainWindow;
let store;

const appIcon = process.platform === 'darwin'
  ? path.join(__dirname, 'build', 'icon.icns')
  : process.platform === 'win32'
    ? path.join(__dirname, 'build', 'icon.ico')
    : path.join(__dirname, 'build', 'icon.png');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: '#0a0a0e',
    icon: appIcon,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    // Windows/Linux: hide the default File/Edit/View bar (Alt shows it).
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Uncomment while developing to open devtools automatically:
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  const { default: Store } = await import('electron-store');
  store = new Store();

  ipcMain.handle('get-settings', () => {
    return store.get('gradientSettings', {});
  });

  ipcMain.handle('save-settings', (_event, settings) => {
    store.set('gradientSettings', settings);
  });

  createWindow();
  initUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Handles the "Save PNG" button: shows a native Save dialog and writes the
// rendered wallpaper straight to disk.
ipcMain.handle('save-wallpaper', async (_event, arrayBuffer, suggestedName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save wallpaper',
    defaultPath: suggestedName,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });

  if (canceled || !filePath) return { success: false };

  try {
    await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));
    return { success: true, filePath };
  } catch (err) {
    // e.g. folder is read-only or the disk is full
    return { success: false, error: err.message };
  }
});
