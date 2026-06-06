import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { platform, homedir } from 'os'

// .env resolution (priority order):
//   1. Persistent data dir / .env  → Production (ngoài .app, giữ qua các bản build)
//   2. cwd/.env                    → Production: Release_Package/.env
//   3. cwd/../.env                 → Dev fallback: Interview-AI/.env
//   4. dotenv default              → last resort
function getDataDir(): string {
  if (process.env.INTELLIVIEW_DATA_DIR) return process.env.INTELLIVIEW_DATA_DIR
  const appName = 'IntelliView'
  const home = homedir()
  if (platform() === 'darwin') return path.join(home, 'Library', 'Application Support', appName)
  if (platform() === 'win32') return path.join(process.env.APPDATA || home, appName)
  return path.join(home, '.config', appName)
}
const dataEnvPath = path.resolve(getDataDir(), '.env')
const currentEnvPath = path.resolve(process.cwd(), '.env')
const parentEnvPath  = path.resolve(process.cwd(), '../.env')

if (fs.existsSync(dataEnvPath)) {
  dotenv.config({ path: dataEnvPath })
} else if (fs.existsSync(currentEnvPath)) {
  dotenv.config({ path: currentEnvPath })
} else if (fs.existsSync(parentEnvPath)) {
  dotenv.config({ path: parentEnvPath })
}
