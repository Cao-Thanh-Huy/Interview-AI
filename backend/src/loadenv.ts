import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// .env resolution (priority order):
//   1. cwd/.env        → Production: Release_Package/.env  (has real API keys + PORT)
//   2. cwd/../.env     → Dev fallback: Interview-AI/.env   (project root, when cwd=backend/)
//   3. dotenv default  → last resort
const currentEnvPath = path.resolve(process.cwd(), '.env')
const parentEnvPath  = path.resolve(process.cwd(), '../.env')

if (fs.existsSync(currentEnvPath)) {
  dotenv.config({ path: currentEnvPath })
} else if (fs.existsSync(parentEnvPath)) {
  dotenv.config({ path: parentEnvPath })
}
