/**
 * ════════════════════════════════════════════════════════════════
 *  Interview-AI — License Key Generator
 *  Chỉ chạy trên máy của NHÀ PHÁT TRIỂN. KHÔNG phân phối file này.
 * ════════════════════════════════════════════════════════════════
 *
 * Usage:
 *   node tools/generate-license.mjs <HWID> [days]
 *
 * Examples:
 *   node tools/generate-license.mjs HWID-99A8-11B2          # 365 ngày (default)
 *   node tools/generate-license.mjs HWID-99A8-11B2 90       # 3 tháng
 *   node tools/generate-license.mjs HWID-99A8-11B2 30       # 1 tháng dùng thử
 *   node tools/generate-license.mjs HWID-99A8-11B2 7        # 1 tuần demo
 */

import { createHmac } from 'node:crypto'

// ⚠️  PHẢI GIỐNG HỆT chuỗi SECRET_SALT trong backend/src/lib/license.ts
//     Đổi chuỗi này trước khi phát hành lần đầu.
const SECRET_SALT = 'iA_$3cur3_S@lt_Ch@ng3_Me_!_2024_xK9p'

function generateLicense(hwid, durationDays) {
  const issuedAt = new Date()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + durationDays)

  const payload = {
    hwid,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')

  const signature = createHmac('sha256', SECRET_SALT)
    .update(encodedPayload)
    .digest('hex')
    .slice(0, 32)

  const licenseKey = `${encodedPayload}.${signature}`

  const border = '═'.repeat(68)
  console.log('\n' + border)
  console.log(`  ✅  License Key cho: ${hwid}`)
  console.log(`  📅  Cấp ngày:   ${issuedAt.toLocaleDateString('vi-VN')}`)
  console.log(`  ⏳  Hết hạn sau ${durationDays} ngày: ${expiresAt.toLocaleDateString('vi-VN')}`)
  console.log(border)
  console.log()
  console.log(licenseKey)
  console.log()
  console.log(border)
  console.log('  👆  Gửi chuỗi KEY ở trên cho khách hàng.')
  console.log('      Bảo họ paste vào màn hình kích hoạt trong trình duyệt.')
  console.log(border + '\n')
}

// ─── Parse CLI args ───────────────────────────────────────────────────────────
const hwid = process.argv[2]
const daysArg = process.argv[3]
const days = daysArg ? parseInt(daysArg, 10) : 365

if (!hwid || !hwid.startsWith('HWID-')) {
  console.error('\n❌  Thiếu hoặc sai định dạng HWID.')
  console.error('    HWID phải bắt đầu bằng "HWID-", ví dụ: HWID-99A8-11B2\n')
  console.error('    Cách dùng:')
  console.error('      node tools/generate-license.mjs HWID-99A8-11B2')
  console.error('      node tools/generate-license.mjs HWID-99A8-11B2 90\n')
  process.exit(1)
}

if (isNaN(days) || days < 1 || days > 36500) {
  console.error('\n❌  Số ngày không hợp lệ (phải từ 1 đến 36500).\n')
  process.exit(1)
}

generateLicense(hwid, days)
