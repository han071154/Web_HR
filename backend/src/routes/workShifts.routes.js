import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { httpError } from '../utils/httpError.js';

const router = express.Router();

const HR_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must use HH:mm');

// breakMinutes/isActive không dùng .default() ở đây: schema này còn được tái dùng ở PUT qua
// .partial(), mà zod áp default ngay cả khi field bị bỏ qua — sẽ ghi đè nhầm giá trị hiện có.
// Giá trị mặc định khi tạo mới được áp thủ công trong route POST.
const shiftFieldsSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  startTime: timeSchema,
  endTime: timeSchema,
  breakMinutes: z.coerce.number().int().min(0).max(480).optional(),
  isActive: z.boolean().optional()
});

const shiftSchema = shiftFieldsSchema.superRefine((shift, context) => {
  if (shift.endTime <= shift.startTime) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endTime'],
      message: 'End time must be after start time'
    });
  }
});

function mapShift(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    breakMinutes: row.break_minutes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

router.get('/', async (req, res, next) => {
  try {
    const activeOnly = req.query.active === 'true';
    const result = await query(
      `SELECT * FROM work_shifts ${activeOnly ? 'WHERE is_active = TRUE' : ''} ORDER BY start_time ASC`
    );

    res.json({ data: result.rows.map(mapShift) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM work_shifts WHERE id = $1', [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Work shift not found');
    }

    res.json({ data: mapShift(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const body = shiftSchema.parse(req.body);
    const breakMinutes = body.breakMinutes ?? 0;
    const isActive = body.isActive ?? true;
    const result = await query(
      `INSERT INTO work_shifts (code, name, start_time, end_time, break_minutes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [body.code, body.name, body.startTime, body.endTime, breakMinutes, isActive]
    );

    res.status(201).json({ data: mapShift(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const current = await query('SELECT * FROM work_shifts WHERE id = $1', [req.params.id]);
    const row = current.rows[0];

    if (!row) {
      throw httpError(404, 'Work shift not found');
    }

    const body = shiftFieldsSchema.partial().parse(req.body);
    const shift = shiftSchema.parse({
      code: Object.hasOwn(body, 'code') ? body.code : row.code,
      name: Object.hasOwn(body, 'name') ? body.name : row.name,
      startTime: Object.hasOwn(body, 'startTime') ? body.startTime : row.start_time,
      endTime: Object.hasOwn(body, 'endTime') ? body.endTime : row.end_time,
      breakMinutes: Object.hasOwn(body, 'breakMinutes') ? body.breakMinutes : row.break_minutes,
      isActive: Object.hasOwn(body, 'isActive') ? body.isActive : row.is_active
    });

    const updated = await query(
      `UPDATE work_shifts
       SET code = $1, name = $2, start_time = $3, end_time = $4, break_minutes = $5,
           is_active = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [shift.code, shift.name, shift.startTime, shift.endTime, shift.breakMinutes, shift.isActive, req.params.id]
    );

    res.json({ data: mapShift(updated.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// Ca đã được dùng trong lịch phân ca thì không xoá được — chỉ cho vô hiệu hoá (isActive = false).
router.delete('/:id', requireRole(...HR_ROLES), async (req, res, next) => {
  try {
    const inUse = await query('SELECT 1 FROM work_schedules WHERE shift_id = $1 LIMIT 1', [req.params.id]);

    if (inUse.rows[0]) {
      throw httpError(409, 'This shift is already used in a schedule; deactivate it instead of deleting');
    }

    const result = await query('DELETE FROM work_shifts WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      throw httpError(404, 'Work shift not found');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
