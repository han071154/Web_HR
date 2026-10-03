import { query } from '../db.js';

// Ghi một dòng nhật ký thay đổi. db mặc định là pool; trong transaction thì truyền client vào.
// user là req.user (từ JWT); không có user thì actorName dùng cho người ngoài, ví dụ ứng viên.
export async function logAudit({ entityType, entityId, action, details = {}, user = null, actorName = null }, db = { query }) {
  await db.query(
    `INSERT INTO audit_logs (entity_type, entity_id, action, details, actor_id, actor_name)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entityType, entityId, action, JSON.stringify(details), user?.sub || null, user?.fullName || user?.email || actorName]
  );
}

// So sánh hai bản ghi, trả về { field: { from, to } } cho các trường đã đổi.
export function diffFields(before, after, fields) {
  const changes = {};

  for (const field of fields) {
    const from = before[field] ?? null;
    const to = after[field] ?? null;

    if (String(from) !== String(to)) {
      changes[field] = { from, to };
    }
  }

  return changes;
}

export async function listAudit(entityType, entityId) {
  const result = await query(
    `SELECT id, action, details, actor_name, created_at
     FROM audit_logs
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC
     LIMIT 50`,
    [entityType, entityId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    details: row.details,
    actorName: row.actor_name,
    createdAt: row.created_at
  }));
}
