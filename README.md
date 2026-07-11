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
npm run dist
```

This uses `electron-builder` to produce a real installer/app in the `dist/`
folder:

- macOS &rarr; `.dmg`
- Windows &rarr; installer `.exe`
- Linux &rarr; `.AppImage`

electron-builder auto-detects your current OS and builds for that platform.
The first run downloads some extra tooling and can take a minute or two.

## Project structure

```
flute-gradient-studio/
├── main.js            Electron main process (creates the window, handles Save dialog)
├── preload.js          Secure bridge between renderer and main process
├── package.json        Scripts + electron-builder config
└── renderer/
    ├── index.html       App UI
    ├── style.css         App styling
    └── app.js            Gradient generator logic + controls
```

## Ideas for next iterations

- Custom app icon (drop `icon.icns` / `icon.ico` / `icon.png` in the project
  root and point to them under `build` in `package.json`)
- A "Save all 6 variations at once" button
- Remember last-used settings between launches (`electron-store`)
- Auto-update support via `electron-builder`'s publish config
