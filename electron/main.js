const { app, BrowserWindow, shell, ipcMain, globalShortcut, desktopCapturer, screen } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')

// ─── Chromium flags (must be set before app.whenReady) ────────────────────────
// Suppress GPU disk cache errors ("Unable to move cache: Access is denied")
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
// Disable Dawn (WebGPU) cache to prevent DawnGraphiteCache/DawnWebGPUCache locks
app.commandLine.appendSwitch('disable-dawn-features', 'use_dxc')
// Enable remote debugging so we can inspect the renderer from outside
app.commandLine.appendSwitch('remote-debugging-port', '9222')

// Set explicit userData path so cache is isolated per-project
// (prevents conflicts with system Electron cache in %APPDATA%)
const USER_DATA_PATH = path.join(__dirname, '..', '.electron-cache')
app.setPath('userData', USER_DATA_PATH)

// ─── Single Instance Lock ──────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  console.log('[Electron] Another instance is already running. Quitting.')
  app.quit()
  process.exit(0)
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ─── Paths ─────────────────────────────────────────────────────────────────────
const isDev = !app.isPackaged

// In dev:  ROOT = Interview-AI/  (project root)
// In prod: ROOT = resources/     (electron-builder extraResources target)
const ROOT = isDev
  ? path.join(__dirname, '..')
  : path.join(process.resourcesPath)

// Frontend to load
const DEV_VITE_URL  = 'http://localhost:5173'
const DEV_DIST      = path.join(__dirname, '..', 'frontend', 'dist', 'index.html')
const PROD_DIST     = path.join(ROOT, 'frontend-dist', 'index.html')

// Backend (production only — dev uses start.ps1)
const PROD_NODE     = path.join(ROOT, 'runtime', 'node.exe')
const PROD_BACKEND  = path.join(ROOT, 'app', 'index.js')

let backendProcess    = null
let mainWindow        = null
let overlayWindow     = null
let hoverInterval     = null   // cursor polling for click-through
let overlayReady      = false  // true once overlay did-finish-load
let pendingSessionData = null  // buffered session data if overlay wasn't ready yet
let dragInterval      = null   // IPC-based native drag polling


// ─── Helpers ───────────────────────────────────────────────────────────────────
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      res.destroy()
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(600, () => { req.destroy() })
  })
}

async function waitForPort(port, maxMs = 15000, interval = 500) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (await checkPort(port)) return true
    await new Promise(r => setTimeout(r, interval))
  }
  return false
}

// ─── Backend (production only) ────────────────────────────────────────────────
function startProdBackend() {
  if (!fs.existsSync(PROD_NODE) || !fs.existsSync(PROD_BACKEND)) return
  console.log('[Electron] Starting backend:', PROD_BACKEND)
  backendProcess = spawn(PROD_NODE, ['--use-system-ca', PROD_BACKEND], {
    cwd: path.join(ROOT, 'app'),
    stdio: 'pipe',
    windowsHide: true,
  })
  backendProcess.stdout?.on('data', d => console.log('[Backend]', d.toString().trim()))
  backendProcess.stderr?.on('data', d => console.error('[Backend]', d.toString().trim()))
}

// ─── Create Window ─────────────────────────────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 640,
    minWidth: 780,
    minHeight: 520,
    title: 'IntelliView',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0c0c14',
      symbolColor: '#475569',
      height: 36,
    },
    backgroundColor: '#0c0c14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    autoHideMenuBar: true,
  })

  // Show immediately — dark backgroundColor prevents white flash while Vite loads
  mainWindow.show()
  mainWindow.focus()

  // Focus again once content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.focus()
  })

  mainWindow.setMenuBarVisibility(false)

  // Open external links in real browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    // Since the main window is the primary UI window, closing it must terminate the entire application cleanly.
    // This destroys the hidden overlayWindow, kills the backendProcess, and exits the Electron process completely.
    if (overlayWindow) {
      overlayWindow.destroy()
      overlayWindow = null
    }
    app.quit()
  })

  // ── Pipe renderer console to file (dev only) ────────────────────────────────
  if (isDev) {
    const logPath = path.join(ROOT, 'renderer.log')
    const logStream = fs.createWriteStream(logPath, { flags: 'w' })
    const stamp = () => new Date().toISOString().slice(11, 23)
    mainWindow.webContents.on('console-message', (_e, level, msg, line, src) => {
      const lvl = ['verbose', 'info', 'warn', 'error'][level] ?? 'log'
      const shortSrc = src ? src.replace(/.*\//, '') : ''
      const entry = `[${stamp()}] [${lvl.toUpperCase()}] ${msg}  (${shortSrc}:${line})\n`
      logStream.write(entry)
      console.log('[Renderer]', entry.trim())
    })
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      const msg = `[${stamp()}] [FAIL-LOAD] code=${code} desc=${desc} url=${url}\n`
      logStream.write(msg)
      console.error('[Renderer]', msg.trim())
    })
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      const msg = `[${stamp()}] [CRASH] reason=${details.reason} exitCode=${details.exitCode}\n`
      logStream.write(msg)
      console.error('[Renderer]', msg.trim())
    })
    console.log('[Electron] Renderer logs → renderer.log | Remote debug → http://localhost:9222')
  }

  // DevTools: open manually with Ctrl+Shift+I if needed

  if (!isDev) {
    console.log('[Electron] Loading production build:', PROD_DIST)
    await mainWindow.loadFile(PROD_DIST)
  } else {
    // Wait up to 15s for Vite dev server — one-shot checkPort() misses it on slow starts
    const viteReady = await waitForPort(5173, 15000)
    if (viteReady) {
      console.log('[Electron] Loading Vite dev server:', DEV_VITE_URL)
      await mainWindow.loadURL(DEV_VITE_URL)
    } else if (fs.existsSync(DEV_DIST)) {
      console.log('[Electron] Vite timed out, loading built dist:', DEV_DIST)
      await mainWindow.loadFile(DEV_DIST)
    } else {
      console.error('[Electron] No frontend found! Run: npm run build in frontend/')
      mainWindow.loadURL('about:blank')
      mainWindow.show()
    }
  }
  setupDisplayMediaHandler(mainWindow)
}

/**
 * Intercept getDisplayMedia() calls and return WASAPI loopback audio.
 * audio: 'loopback' → Electron uses Windows WASAPI directly (no DXGI, no dialog).
 * thumbnailSize: 0×0 → skip frame capture → avoids DxgiDuplicatorController error.
 */
function setupDisplayMediaHandler(win) {
  win.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    // request.frame = the WebFrameMain of the renderer that called getDisplayMedia
    // → always valid, Chromium-internal compositing pipeline, ZERO DXGI
    // audio: 'loopback' = Windows WASAPI render endpoint (built into all Windows)
    // The renderer drops video tracks immediately — only audio matters
    callback({ video: request.frame, audio: 'loopback' })
    console.log('[DisplayMedia] WASAPI loopback granted (request.frame, no DXGI)')
  })
}

// ─── Create Overlay Window ─────────────────────────────────────────────────────
async function createOverlay() {
  const { width } = screen.getPrimaryDisplay().workAreaSize
  const W = 440

  overlayWindow = new BrowserWindow({
    width: W,
    height: 600,           // tall enough for history panel — CSS/max-height controls visible area
    x: Math.floor((width - W) / 2),
    y: 80,                 // top-center, just below webcam area
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,       // user can resize width
    movable: true,
    minimizable: false,
    maximizable: false,
    show: false,           // NEVER auto-show — only session:start IPC can show it
    backgroundColor: '#00000000',
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  // Overlay floats above everything (screen-saver level)
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  // Start click-through by default (ghost mode)
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  // Grant all media permissions automatically for overlay window
  // This is required because the overlay has no user gesture when audio starts
  overlayWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      // Auto-grant mic, camera, display-capture for overlay
      if (['media', 'mediaKeySystem', 'geolocation'].includes(permission)) {
        return callback(true)
      }
      callback(false)
    }
  )

  overlayWindow.on('closed', () => { overlayWindow = null; overlayReady = false })

  // When overlay finishes loading, flush any buffered session data
  overlayWindow.webContents.on('did-finish-load', () => {
    overlayReady = true
    console.log('[Overlay] did-finish-load — ready')
    if (pendingSessionData) {
      overlayWindow.webContents.send('session:init', pendingSessionData)
      console.log('[Overlay] Flushed buffered session:init data')
      pendingSessionData = null
    }
  })

  if (!isDev) {
    const overlayDist = path.join(ROOT, 'frontend-dist', 'overlay.html')
    await overlayWindow.loadFile(overlayDist)
  } else {
    // By the time createOverlay runs, Vite should be up (createWindow already waited)
    const viteReady = await checkPort(5173)
    if (viteReady) {
      await overlayWindow.loadURL('http://localhost:5173/overlay.html')
    } else {
      const overlayDist = path.join(__dirname, '..', 'frontend', 'dist', 'overlay.html')
      if (fs.existsSync(overlayDist)) await overlayWindow.loadFile(overlayDist)
    }
  }

  // Keep hidden until session starts (show:false in BrowserWindow options enforces this)
  setupDisplayMediaHandler(overlayWindow)
}

// ─── IPC: Get display media source for overlay ─────────────────────────────────
// The overlay window may not have a user gesture when audio starts.
// This IPC lets the overlay request main window to grab the display source ID,
// since main window always has a recent user gesture (user just clicked Start).
ipcMain.handle('audio:request-display-capture', async () => {
  try {
    // Trigger capture from the main window's webContents (has user gesture context)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      fetchWindowIcons: false,
      thumbnailSize: { width: 0, height: 0 },   // skip frame capture
    })
    const sourceId = sources[0]?.id ?? null
    console.log('[DisplayCapture] Source ID for overlay:', sourceId)
    return sourceId
  } catch (err) {
    console.error('[DisplayCapture] Failed to get source:', err)
    return null
  }
})

// ─── IPC: Direct file log (bypass network — for renderer debug when fetch fails) ─
ipcMain.on('log:file', (_, msg) => {
  try {
    fs.appendFileSync(
      path.join(ROOT, 'ipc-debug.log'),
      `[${new Date().toISOString().slice(11, 23)}] ${msg}\n`
    )
  } catch {}
})

// ─── Overlay UX IPC ───────────────────────────────────────────────────────────

// Resize overlay width — called by resize-handle drag in renderer
ipcMain.on('overlay:resize-width', (_, newWidth) => {
  if (!overlayWindow) return
  const clamped = Math.min(700, Math.max(280, Math.round(newWidth)))
  const [, h] = overlayWindow.getSize()
  overlayWindow.setSize(clamped, h)
})

// Native drag via polling — more robust than CSS -webkit-app-region: drag
// because it survives mouse leaving the window (which would kill setIgnoreMouseEvents)
ipcMain.on('overlay:drag-start', () => {
  if (!overlayWindow) return
  const [winX, winY] = overlayWindow.getPosition()
  const startCursor  = screen.getCursorScreenPoint()
  const offsetX = startCursor.x - winX
  const offsetY = startCursor.y - winY

  if (dragInterval) { clearInterval(dragInterval); dragInterval = null }
  dragInterval = setInterval(() => {
    if (!overlayWindow) { clearInterval(dragInterval); dragInterval = null; return }
    const cur = screen.getCursorScreenPoint()
    overlayWindow.setPosition(cur.x - offsetX, cur.y - offsetY)
  }, 16) // ~60 fps
})

ipcMain.on('overlay:drag-end', () => {
  if (dragInterval) { clearInterval(dragInterval); dragInterval = null }
})

// ─── IPC Handlers ──────────────────────────────────────────────────────────────
ipcMain.on('win:minimize',   () => mainWindow?.minimize())
ipcMain.on('win:toggle-aot', () => {
  if (!mainWindow) return
  const next = !mainWindow.isAlwaysOnTop()
  mainWindow.setAlwaysOnTop(next, 'floating')
  mainWindow.webContents.send('win:aot-changed', next)
})
ipcMain.on('win:opacity',    (_, v) => mainWindow?.setOpacity(Math.max(0.1, Math.min(1, v))))
ipcMain.handle('win:get-aot',() => mainWindow?.isAlwaysOnTop() ?? false)

// WASAPI loopback: silently get desktop audio source (no user dialog)
ipcMain.handle('audio:get-desktop-source-id', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      fetchWindowIcons: false,
    })
    return sources[0]?.id ?? null
  } catch (err) {
    console.error('[Electron] desktopCapturer error:', err)
    return null
  }
})

// ─── Session IPC ───────────────────────────────────────────────────────────────
ipcMain.on('session:start', (_, data) => {
  if (!overlayWindow) return
  // Hide main window, show overlay
  mainWindow?.hide()
  if (overlayReady) {
    // Overlay already loaded — send immediately
    overlayWindow.webContents.send('session:init', data)
  } else {
    // Overlay still loading — buffer data, will flush on did-finish-load
    pendingSessionData = data
    console.log('[Session] Overlay not ready yet — buffering session:init')
  }
  overlayWindow.show()
  overlayWindow.focus()
  console.log('[Session] Started — overlay visible')
})

ipcMain.on('session:stop', () => {
  // Stop cursor polling
  if (hoverInterval) { clearInterval(hoverInterval); hoverInterval = null }
  overlayWindow?.hide()
  mainWindow?.show()
  mainWindow?.focus()
  console.log('[Session] Stopped — main window restored')
})

// Hover-to-activate: renderer tells us when mouse enters/leaves overlay
ipcMain.on('overlay:interactive', (_, interactive) => {
  if (!overlayWindow) return
  overlayWindow.setIgnoreMouseEvents(!interactive, { forward: true })
})

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (!isDev) {
    // Production: spawn backend, then wait for it
    startProdBackend()
    console.log('[Electron] Waiting for backend on :3001...')
    await waitForPort(3001, 20000)
    console.log('[Electron] Backend ready')
  } else {
    // Dev: backend was started by start.ps1, just wait briefly
    const backendReady = await waitForPort(3001, 8000)
    if (!backendReady) {
      console.warn('[Electron] Backend not ready on :3001 — continuing anyway')
    } else {
      console.log('[Electron] Backend detected on :3001')
    }
  }

  await createWindow()
  await createOverlay()  // hidden until session starts

  // Ctrl+Shift+T → toggle AOT on main window
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (!mainWindow) return
    const next = !mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(next, 'floating')
    mainWindow.webContents.send('win:aot-changed', next)
  })

  // Ctrl+Shift+H → manually show/hide overlay during session
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (!overlayWindow) return
    if (overlayWindow.isVisible()) overlayWindow.hide()
    else overlayWindow.show()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (hoverInterval) { clearInterval(hoverInterval); hoverInterval = null }
  if (backendProcess) { backendProcess.kill(); backendProcess = null }
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  if (backendProcess) { backendProcess.kill(); backendProcess = null }
})
