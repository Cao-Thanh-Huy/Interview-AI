import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load .env from parent directory (root) or current directory
const parentEnvPath = path.resolve(process.cwd(), '../.env')
const currentEnvPath = path.resolve(process.cwd(), '.env')

if (fs.existsSync(parentEnvPath)) {
  dotenv.config({ path: parentEnvPath })
} else {
  dotenv.config({ path: currentEnvPath })
}
