# Flute Gradient Studio

A desktop app that generates original fluted-glass gradient wallpapers for
Mac, iPad, and iPhone. Built with Electron so it opens like any other app,
and saves files straight to disk via a native Save dialog.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (includes npm)

## Run it in development

```bash
npm install
npm start
```

This opens the app in a window. Edit files under `renderer/` (HTML/CSS/JS)
or `main.js`/`preload.js`, then quit and re-run `npm start` to see changes.
Tip: uncomment the `openDevTools()` line in `main.js` if you want Chrome
DevTools inside the app while you work on it.

## Build a standalone app you can double-click

```bash
npm install
npm run dist
```

`npm install` is needed once (and after pulling new code); without it you get
"'electron-builder' is not recognized". This uses `electron-builder` to produce a real installer/app in the `dist/`
folder:

- macOS &rarr; `.dmg`
- Windows &rarr; installer `.exe`
- Linux &rarr; `.AppImage`

electron-builder auto-detects your current OS and builds for that platform.
The first run downloads some extra tooling and can take a minute or two.

## Presets

The **Presets** row holds complete looks (colours, shape and glass) matched to
reference wallpapers. **+ Save** under *My presets* keeps the current look;
hover a saved preset and click × to delete it. Saved presets live in the same
settings file as everything else, so they survive updates.

## Releasing a new version

1. Bump `"version"` in `package.json` (e.g. `1.0.0-beta.3` → `1.0.0-beta.4`)
   and merge that to `master`.
2. Tag that commit with the same version and push the tag:

   ```bash
   git tag v1.0.0-beta.4
   git push origin v1.0.0-beta.4
   ```

GitHub Actions then builds the Mac `.dmg` and Windows `.exe` and attaches
them to a GitHub Release for that tag. The build stops with an error if the
tag and `package.json` version don't match.

## Updates

Installed copies check GitHub Releases a few seconds after launch:

- **Windows:** the update downloads in the background, then a
  "Restart to update" button appears (it also installs on the next quit).
- **macOS:** a "Version X is available · Download" button appears and opens
  the new `.dmg`. Drag the app into Applications and choose **Replace**.
  Settings are kept either way.

## Installing (for friends)

The app isn't code-signed (that costs money), so the first launch shows a
warning:

- **Windows:** "Windows protected your PC" → **More info** → **Run anyway**.
  If instead you see "**Smart App Control** blocked an app that may be unsafe",
  there is no Run anyway button: Smart App Control blocks every unsigned app.
  The only workaround is turning it off (Windows Security → App & browser
  control → Smart App Control), which can be hard to turn back on. It's
  your call; signing the app would avoid this but isn't free.
- **macOS:** "can't be opened" → open **System Settings → Privacy &
  Security**, scroll down and click **Open Anyway**. You may need to do this
  again after installing each new version.

## Project structure

```
flute-gradient-studio/
├── main.js             Electron main process (window, Save dialog, saved settings)
├── preload.js          Secure bridge between renderer and main process
├── updater.js          Update checks against GitHub Releases
├── package.json        Scripts + electron-builder config
├── build/              App icons (icon.icns / icon.ico / icon.png)
├── .github/workflows/  CI builds for macOS (.dmg) and Windows (.exe)
└── renderer/
    ├── index.html      App UI
    ├── style.css       App styling
    └── app.js          Gradient generator logic + controls
```

Your last-used settings are remembered between launches via `electron-store`.

## Ideas for next iterations

- Lock-screen preview for iPad (widgets row) and a home-screen preview
- "Arc" colour layer for thin curved bands of light (Peach Flare tops out at ~85%)
