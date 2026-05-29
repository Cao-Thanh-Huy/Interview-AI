// Preload script — runs in renderer context with Node access disabled
const { contextBridge, ipcRenderer, clipboard } = require('electron')

// App info
contextBridge.exposeInMainWorld('electronApp', {
  isElectron: true,
  platform: process.platform,
})

// Native clipboard — navigator.clipboard.writeText() is unreliable in Electron
// Use this instead: window.electronClipboard.write(text)
contextBridge.exposeInMainWorld('electronClipboard', {
  write: (text) => clipboard.writeText(text),
})

// Window control IPC — exposed to renderer safely
contextBridge.exposeInMainWorld('electronWindow', {
  minimize:          ()  => ipcRenderer.send('win:minimize'),
  toggleAlwaysOnTop: ()  => ipcRenderer.send('win:toggle-aot'),
  setOpacity:        (v) => ipcRenderer.send('win:opacity', v),
  getAlwaysOnTop:    ()  => ipcRenderer.invoke('win:get-aot'),
  onAotChanged:      (cb) => {
    ipcRenderer.on('win:aot-changed', (_, val) => cb(val))
    return () => ipcRenderer.removeAllListeners('win:aot-changed')
  },
})

// WASAPI loopback audio — silently capture system audio without user dialog
contextBridge.exposeInMainWorld('electronAudio', {
  getDesktopSourceId:      () => ipcRenderer.invoke('audio:get-desktop-source-id'),
  requestDisplayCapture:   () => ipcRenderer.invoke('audio:request-display-capture'),
  logToFile:               (msg) => ipcRenderer.send('log:file', msg),
})

// Session lifecycle — used by MAIN WINDOW to start/stop interview session
contextBridge.exposeInMainWorld('electronSession', {
  start: (data) => ipcRenderer.send('session:start', data),
})

// Overlay controls — used by OVERLAY WINDOW
contextBridge.exposeInMainWorld('electronOverlay', {
  // Receive session data from main process when session starts
  onInit: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('session:init', handler)
    return () => ipcRenderer.removeListener('session:init', handler)
  },
  // Tell main process to show main window + hide overlay
  stop: () => ipcRenderer.send('session:stop'),
  // Toggle click-through (hover-to-activate)
  setInteractive: (interactive) => ipcRenderer.send('overlay:interactive', interactive),
  // Resize overlay window width (clamped 280–700 in main process)
  resizeWidth: (w) => ipcRenderer.send('overlay:resize-width', w),
  // Native IPC drag — polling-based, survives mouse leaving window
  dragStart: () => ipcRenderer.send('overlay:drag-start'),
  dragEnd:   () => ipcRenderer.send('overlay:drag-end'),
})
