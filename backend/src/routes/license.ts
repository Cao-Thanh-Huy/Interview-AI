import { Hono } from 'hono'
import { getLicenseStatus, invalidateLicenseCache } from '../middleware/licenseGuard.js'
import { activateLicense } from '../lib/license.js'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const licenseRouter = new Hono()

/**
 * GET /api/license/status
 * Frontend poll endpoint — trả về trạng thái kích hoạt hiện tại.
 * Không yêu cầu license (luôn public).
 */
licenseRouter.get('/status', (c) => {
  const result = getLicenseStatus()
  return c.json({
    activated: result.valid,
    message: result.message,
    hwid: result.hwid,
    expiresAt: result.expiresAt?.toISOString() ?? null,
  })
})

/**
 * POST /api/license/activate
 * Body: { key: string }
 * Khách hàng paste License Key vào web UI → gọi endpoint này.
 */
licenseRouter.post('/activate', async (c) => {
  let body: { key?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, message: 'Request body không hợp lệ (phải là JSON)' }, 400)
  }

  const { key } = body
  if (!key || typeof key !== 'string' || !key.trim()) {
    return c.json({ success: false, message: 'Thiếu hoặc rỗng trường "key"' }, 400)
  }

  // Xóa cache cũ trước khi validate key mới
  invalidateLicenseCache()

  const result = activateLicense(key.trim())

  if (result.valid) {
    return c.json({
      success: true,
      message: `Kích hoạt thành công! Phần mềm có hiệu lực đến ${result.expiresAt?.toLocaleDateString('vi-VN')}`,
      expiresAt: result.expiresAt?.toISOString() ?? null,
    })
  }

  return c.json({ success: false, message: result.message }, 400)
})

/**
 * POST /api/license/deactivate
 * Xóa license.key → app quay về màn hình kích hoạt
 */
licenseRouter.post('/deactivate', (c) => {
  try {
    const keyPath = join(process.cwd(), 'license.key')
    if (existsSync(keyPath)) writeFileSync(keyPath, '', 'utf-8')
    invalidateLicenseCache()
    return c.json({ success: true, message: 'License đã được xóa. Vui lòng nhập key mới.' })
  } catch {
    return c.json({ success: false, message: 'Không thể xóa license' }, 500)
  }
})
