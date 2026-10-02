// Checks GitHub Releases for a newer version once per launch.
//
// Windows/Linux: electron-updater downloads the update in the background and
// installs it when the user clicks "Restart" (or on the next quit).
//
// macOS: automatic installs require a paid Apple code-signing certificate,
// so instead we just tell the user a new version exists and open the .dmg
// download; they drag the new app over the old one in Applications.
const { app, BrowserWindow, ipcMain, net, shell } = require('electron');
const semver = require('semver');

// Must match package.json "build.publish". It can't be read from there at
// runtime: electron-builder strips the "build" section from the packaged
// package.json. The repo must be public; installed copies check it without
// logging in.
const REPO = 'Ozzie679/app-1---flute-gradient-studio';
const CHECK_DELAY_MS = 5000;

let macDownloadUrl = null;
// Kept so a window that loads (or reloads) after the check can still ask.
let lastStatus = null;

function sendStatus(status) {
  lastStatus = status;
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update-status', status);
  }
}

function initWindowsLinux() {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus({ state: 'ready', version: info.version });
  });
  // No network, rate-limited, no release yet: nothing useful to tell the user.
  autoUpdater.on('error', (err) => console.warn('[updater]', err.message));

  ipcMain.handle('install-update', () => autoUpdater.quitAndInstall());

  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), CHECK_DELAY_MS);
}

async function checkMac() {
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return;
    const release = await res.json();
    const latest = semver.clean(release.tag_name || ''); // "v1.2.0" -> "1.2.0"
    if (!latest || !semver.gt(latest, app.getVersion())) return;

    const dmgs = (release.assets || []).filter((a) => a.name.endsWith('.dmg'));
    const forThisMac = dmgs.find((a) => a.name.includes(process.arch)) || dmgs[0];
    macDownloadUrl = forThisMac ? forThisMac.browser_download_url : release.html_url;
    sendStatus({ state: 'available', version: latest });
  } catch (err) {
    console.warn('[updater]', err.message);
  }
}

function initMac() {
  // The URL comes from GitHub's API response in this process, never from the
  // renderer, and is only ever opened on github.com.
  ipcMain.handle('download-update', () => {
    if (macDownloadUrl && new URL(macDownloadUrl).hostname.endsWith('github.com')) {
      shell.openExternal(macDownloadUrl);
    }
  });
  setTimeout(checkMac, CHECK_DELAY_MS);
}

// Call once, after the app is ready.
function initUpdater() {
  ipcMain.handle('get-update-status', () => lastStatus);
  // Running from source (npm start) there's nothing to update.
  if (!app.isPackaged) return;
  if (process.platform === 'darwin') initMac();
  else initWindowsLinux();
}

module.exports = { initUpdater };
