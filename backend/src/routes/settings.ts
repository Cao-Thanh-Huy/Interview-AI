import { Hono } from 'hono'
import fs from 'node:fs'
import path from 'node:path'
import { platform, homedir } from 'node:os'

export const settingsRouter = new Hono()

// Thư mục dữ liệu persistent — tự động detect OS, không cần Electron
function getDataDir(): string {
  if (process.env.INTELLIVIEW_DATA_DIR) return process.env.INTELLIVIEW_DATA_DIR
  const appName = 'IntelliView'
  const home = homedir()
  if (platform() === 'darwin') return path.join(home, 'Library', 'Application Support', appName)
  if (platform() === 'win32') return path.join(process.env.APPDATA || home, appName)
  return path.join(home, '.config', appName)
}
const DATA_DIR = getDataDir()

// Tìm file .env: ưu tiên DATA_DIR (persistent, ngoài .app), fallback cwd
function getEnvFilePath(): string {
  const dataDir = path.resolve(DATA_DIR, '.env')
  const cwd = process.cwd()
  const current = path.resolve(cwd, '.env')
  const parent = path.resolve(cwd, '../.env')
  if (fs.existsSync(dataDir)) return dataDir
  if (fs.existsSync(current)) return current
  if (fs.existsSync(parent)) return parent
  return dataDir // fallback: tạo mới ở DATA_DIR
}

/**
 * GET /api/settings/api-keys
 * Trả về trạng thái API keys (có set hay chưa) — KHÔNG trả về giá trị thật
 */
settingsRouter.get('/api-keys', (c) => {
  return c.json({
    groqKeySet: !!process.env.GROQ_API_KEY?.trim(),
    deepgramKeySet: !!process.env.DEEPGRAM_API_KEY?.trim(),
  })
})

/**
 * POST /api/settings/api-keys
 * Body: { groqKey?: string, deepgramKey?: string }
 * Lưu API keys vào .env file và cập nhật process.env ngay lập tức
 */
settingsRouter.post('/api-keys', async (c) => {
  let body: { groqKey?: string; deepgramKey?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Request body không hợp lệ' }, 400)
  }

  const { groqKey, deepgramKey } = body

  if (!groqKey?.trim() && !deepgramKey?.trim()) {
    return c.json({ success: false, message: 'Cần ít nhất một API key' }, 400)
  }

  try {
    const envPath = getEnvFilePath()
    // Tạo thư mục DATA_DIR nếu chưa tồn tại
    try { fs.mkdirSync(path.dirname(envPath), { recursive: true }) } catch {}
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''

    // Hàm helper: set hoặc update một dòng trong .env
    function setEnvVar(content: string, key: string, value: string): string {
      const regex = new RegExp(`^${key}=.*$`, 'm')
      const line = `${key}=${value}`
      if (regex.test(content)) {
        return content.replace(regex, line)
      }
      // Thêm dòng mới
      return content.endsWith('\n') ? content + line + '\n' : content + '\n' + line + '\n'
    }

    if (groqKey?.trim()) {
      envContent = setEnvVar(envContent, 'GROQ_API_KEY', groqKey.trim())
      process.env.GROQ_API_KEY = groqKey.trim()
    }
    if (deepgramKey?.trim()) {
      envContent = setEnvVar(envContent, 'DEEPGRAM_API_KEY', deepgramKey.trim())
      process.env.DEEPGRAM_API_KEY = deepgramKey.trim()
    }

    fs.writeFileSync(envPath, envContent, 'utf-8')

    return c.json({
      success: true,
      message: 'API keys đã được lưu thành công!',
      groqKeySet: !!process.env.GROQ_API_KEY?.trim(),
      deepgramKeySet: !!process.env.DEEPGRAM_API_KEY?.trim(),
    })
  } catch (err) {
    console.error('Settings save error:', err)
    return c.json({ success: false, message: 'Không thể lưu file cấu hình' }, 500)
  }
})
