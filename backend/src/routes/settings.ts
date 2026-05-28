import { Hono } from 'hono'
import fs from 'node:fs'
import path from 'node:path'

export const settingsRouter = new Hono()

// Tìm file .env đang được dùng (cwd/.env ưu tiên, sau đó cwd/../.env)
function getEnvFilePath(): string {
  const cwd = process.cwd()
  const current = path.resolve(cwd, '.env')
  const parent = path.resolve(cwd, '../.env')
  if (fs.existsSync(current)) return current
  if (fs.existsSync(parent)) return parent
  return current // fallback: tạo mới ở cwd
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
