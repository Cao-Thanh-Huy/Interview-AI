import type { Context, Next } from 'hono'
import { validateLicense, getHWID } from '../lib/license.js'
import type { LicenseResult } from '../lib/license.js'

// ─────────────────────────────────────────────────────────────────────────────
// Cache kết quả validate để không đọc file + tính HMAC mỗi request
// ─────────────────────────────────────────────────────────────────────────────
let _cached: LicenseResult | null = null
let _cachedAt = 0
const CACHE_TTL_MS = 60_000 // Re-validate mỗi 60 giây

export function getLicenseStatus(): LicenseResult {
  const now = Date.now()
  if (!_cached || now - _cachedAt > CACHE_TTL_MS) {
    _cached = validateLicense()
    _cachedAt = now
  }
  return _cached
}

/** Xóa cache — gọi sau khi khách nhập key mới để force re-validate ngay */
export function invalidateLicenseCache(): void {
  _cached = null
  _cachedAt = 0
}

/**
 * Hono middleware — chặn tất cả /api/* nếu chưa kích hoạt.
 *
 * Các route luôn được phép (không cần license):
 *   - /api/license/*  → UI kích hoạt cần gọi
 *   - /health         → health check
 *   - Tất cả non-/api routes → frontend static files
 */
export async function licenseGuard(c: Context, next: Next) {
  const path = c.req.path

  // Whitelist: không cần license
  if (
    path === '/health' ||
    path.startsWith('/api/license') ||
    path.startsWith('/api/debug')     // dev debug endpoint — always open
  ) {
    return next()
  }

  // Chỉ chặn các route API
  if (path.startsWith('/api/')) {
    const result = getLicenseStatus()
    if (!result.valid) {
      return c.json(
        {
          error: 'LICENSE_INVALID',
          message: result.message,
          hwid: result.hwid,
        },
        403
      )
    }
  }

  return next()
}
