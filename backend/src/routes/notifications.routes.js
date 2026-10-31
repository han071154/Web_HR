import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { httpError } from '../utils/httpError.js';

// Thông báo trong ứng dụng của người đang đăng nhập (HR-034). Mọi vai trò đều dùng được, mỗi người
// chỉ thấy và đánh dấu đã đọc thông báo của chính mình.
const router = express.Router();

const listQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

function mapNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    isRead: row.is_read,
    createdAt: row.created_at,
    readAt: row.read_at
  };
}

router.get('/me', async (req, res, next) => {
  try {
    const filters = listQuerySchema.parse(req.query);
    const unreadOnly = filters.unreadOnly === 'true';
    const [list, unread] = await Promise.all([
      query(
        `SELECT * FROM notifications
         WHERE user_id = $1 AND ($2::boolean = FALSE OR NOT is_read)
         ORDER BY created_at DESC
         LIMIT $3`,
        [req.user.sub, unreadOnly, filters.limit ?? 20]
      ),
      query('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND NOT is_read', [req.user.sub])
    ]);

    res.json({ data: list.rows.map(mapNotification), meta: { unreadCount: unread.rows[0].count } });
  } catch (error) {
    next(error);
  }
});

router.post('/me/read-all', async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND NOT is_read',
      [req.user.sub]
    );

    res.json({ data: { updated: result.rowCount } });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const result = await query(
      `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.sub]
    );

    if (!result.rows[0]) {
      throw httpError(404, 'Notification not found');
    }

    res.json({ data: mapNotification(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

export default router;
