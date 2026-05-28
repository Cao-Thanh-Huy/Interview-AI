import nodeMachineId from 'node-machine-id'
const { machineIdSync } = nodeMachineId
import { createHmac } from 'node:crypto'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  ĐỔI CHUỖI NÀY TRƯỚC KHI PHÁT HÀNH — GIỮ BÍ MẬT TUYỆT ĐỐI
//     Chuỗi này phải GIỐNG HỆT trong file tools/generate-license.mjs
// ─────────────────────────────────────────────────────────────────────────────
const SECRET_SALT = 'iA_$3cur3_S@lt_Ch@ng3_Me_!_2024_xK9p'

export interface LicenseResult {
  valid: boolean
  message: string
  hwid: string
  expiresAt?: Date
}

/**
 * Lấy Hardware ID của máy hiện tại.
 * Định dạng: HWID-XXXX-YYYY (8 ký tự hex viết hoa, dễ đọc)
 */
export function getHWID(): string {
  try {
    const raw = machineIdSync()
    const clean = raw.replace(/-/g, '').toUpperCase()
    return `HWID-${clean.slice(0, 4)}-${clean.slice(4, 8)}`
  } catch {
    return 'HWID-UNKN-0000'
  }
}

/**
 * Đọc và xác thực license.key trong thư mục làm việc hiện tại.
 * Kiểm tra: định dạng → chữ ký HMAC → HWID khớp máy → còn hạn
 */
export function validateLicense(): LicenseResult {
  const hwid = getHWID()

  // Tìm license.key tại thư mục chạy exe (process.cwd()) hoặc thư mục cha
  const candidatePaths = [
    join(process.cwd(), 'license.key'),
    join(process.cwd(), '..', 'license.key'),
  ]
  const licensePath = candidatePaths.find(existsSync)

  if (!licensePath) {
    return { valid: false, message: 'Chưa có file license.key', hwid }
  }

  let content: string
  try {
    content = readFileSync(licensePath, 'utf-8').trim()
  } catch {
    return { valid: false, message: 'Không đọc được file license.key', hwid }
  }

  if (!content) {
    return { valid: false, message: 'File license.key trống — chưa nhập key', hwid }
  }

  const dotIndex = content.lastIndexOf('.')
  if (dotIndex === -1) {
    return { valid: false, message: 'Định dạng License Key không đúng', hwid }
  }

  const encodedPayload = content.slice(0, dotIndex)
  const signature = content.slice(dotIndex + 1)

  // Xác thực chữ ký HMAC-SHA256
  const expectedSig = createHmac('sha256', SECRET_SALT)
    .update(encodedPayload)
    .digest('hex')
    .slice(0, 32)

  if (signature !== expectedSig) {
    return { valid: false, message: 'License Key không hợp lệ hoặc đã bị chỉnh sửa', hwid }
  }

  // Decode payload JSON
  let payload: { hwid: string; expiresAt: string; issuedAt?: string }
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf-8'))
  } catch {
    return { valid: false, message: 'Nội dung License Key bị hỏng', hwid }
  }

  // Kiểm tra HWID khớp máy hiện tại
  if (payload.hwid !== hwid) {
    return {
      valid: false,
      message: `License này không thuộc máy hiện tại (HWID máy bạn: ${hwid})`,
      hwid,
    }
  }

  // Kiểm tra hạn dùng
  const expiresAt = new Date(payload.expiresAt)
  if (isNaN(expiresAt.getTime())) {
    return { valid: false, message: 'Ngày hết hạn trong License không hợp lệ', hwid }
  }

  if (new Date() > expiresAt) {
    return {
      valid: false,
      message: `License đã hết hạn ngày ${expiresAt.toLocaleDateString('vi-VN')}`,
      hwid,
      expiresAt,
    }
  }

  return { valid: true, message: 'License hợp lệ', hwid, expiresAt }
}

/**
 * Ghi License Key mới vào file license.key rồi validate lại.
 * Được gọi từ route /api/license/activate khi khách hàng nhập key qua UI.
 */
export function activateLicense(keyContent: string): LicenseResult {
  const targetPath = join(process.cwd(), 'license.key')
  try {
    writeFileSync(targetPath, keyContent.trim(), 'utf-8')
  } catch {
    const hwid = getHWID()
    return { valid: false, message: 'Không ghi được file license.key — kiểm tra quyền thư mục', hwid }
  }
  return validateLicense()
}
