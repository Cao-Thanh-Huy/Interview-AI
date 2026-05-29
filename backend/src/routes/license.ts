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
    return c.json({ success: false, message: 'Invalid request body (must be JSON)' }, 400)
  }

  const { key } = body
  if (!key || typeof key !== 'string' || !key.trim()) {
    return c.json({ success: false, message: 'Missing or empty "key" field' }, 400)
  }

  // Xóa cache cũ trước khi validate key mới
  invalidateLicenseCache()

  const result = activateLicense(key.trim())

  if (result.valid) {
    return c.json({
      success: true,
      message: `Activation successful! License valid until ${result.expiresAt?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
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
    return c.json({ success: true, message: 'License removed. Please enter a new key.' })
  } catch {
    return c.json({ success: false, message: 'Failed to remove license' }, 500)
  }
})
