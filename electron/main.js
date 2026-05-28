const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')

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

let backendProcess = null
let mainWindow = null

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
    minHeight: 560,
    title: 'IntelliView',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,   // Allow file:// to call localhost API
    },
    autoHideMenuBar: true,
    backgroundColor: '#f6f8fb',
  })

  mainWindow.setMenuBarVisibility(false)

  // Open external links in real browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })

  // ── Load content ──────────────────────────────────────────────────────────
  if (!isDev) {
    // Production: load built files
    console.log('[Electron] Loading production build:', PROD_DIST)
    await mainWindow.loadFile(PROD_DIST)
  } else {
    // Dev: try Vite first (hot reload), fallback to built dist
    const viteReady = await checkPort(5173)
    if (viteReady) {
      console.log('[Electron] Loading Vite dev server:', DEV_VITE_URL)
      await mainWindow.loadURL(DEV_VITE_URL)
    } else if (fs.existsSync(DEV_DIST)) {
      console.log('[Electron] Vite not running, loading built dist:', DEV_DIST)
      await mainWindow.loadFile(DEV_DIST)
    } else {
      console.error('[Electron] No frontend found! Run: npm run build in frontend/')
      mainWindow.loadURL('about:blank')
      mainWindow.show()
    }
  }
}

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (backendProcess) { backendProcess.kill(); backendProcess = null }
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (backendProcess) { backendProcess.kill(); backendProcess = null }
})
