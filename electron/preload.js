// Preload script — runs in renderer context with Node access disabled
// Currently minimal; can expose IPC APIs here if needed
const { contextBridge } = require('electron')

// Expose app info to renderer
contextBridge.exposeInMainWorld('electronApp', {
  isElectron: true,
  platform: process.platform,
})
