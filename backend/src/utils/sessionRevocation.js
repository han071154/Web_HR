import { query } from '../db.js';

// Access token (JWT) hết hạn sau JWT_EXPIRES_IN (mặc định 1 ngày) và không tra DB mỗi request. Khi Admin khóa tài
// khoản, đổi vai trò hoặc đặt lại mật khẩu (HR-007), các token đã cấp trước thời điểm đó phải mất hiệu lực ngay:
// ghi lại mốc thời gian theo từng tài khoản ở đây, requireAuth so với iat của token.
// Tài khoản bị khóa: Infinity (mọi token đều bị chặn, kể cả cấp sau – vì login/refresh đã chặn tài khoản khóa).
const revokedBefore = new Map();

export function revokeSessions(userId, at = Date.now()) {
  revokedBefore.set(userId, at);
}

export function blockUser(userId) {
  revokedBefore.set(userId, Number.POSITIVE_INFINITY);
}

export function unblockUser(userId, at = Date.now()) {
  revokedBefore.set(userId, at);
}

// iat của JWT tính bằng giây (làm tròn xuống).
export function isTokenRevoked(payload) {
  const at = revokedBefore.get(payload?.sub);
  return at !== undefined && payload.iat * 1000 < at;
}

// Bộ nhớ trên mất khi khởi động lại máy chủ: nạp lại từ DB các tài khoản đang khóa và các tài khoản vừa đổi /
// đặt lại mật khẩu, đổi vai trò (password_changed_at – refresh token cũng dựa vào cột này).
export async function loadRevokedSessions() {
  const result = await query(
    `SELECT id, is_active, password_changed_at
     FROM users
     WHERE is_active = FALSE OR password_changed_at > NOW() - INTERVAL '30 days'`
  );

  for (const row of result.rows) {
    if (!row.is_active) {
      blockUser(row.id);
    } else {
      revokeSessions(row.id, new Date(row.password_changed_at).getTime());
    }
  }

  return result.rows.length;
}

export function clearRevokedSessions() {
  revokedBefore.clear();
}
