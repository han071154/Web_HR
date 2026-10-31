import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { diffFields, listAudit, logAudit } from '../utils/audit.js';
import { httpError } from '../utils/httpError.js';
import { blockUser, revokeSessions, unblockUser } from '../utils/sessionRevocation.js';
import { passwordSchema } from '../utils/validation.js';

// HR-007: Admin quản lý tài khoản đăng nhập – cấp tài khoản cho nhân viên (thay cho tự đăng ký đã bỏ, HR-025),
// gán vai trò, liên kết hồ sơ nhân viên (HR-028), khóa / mở khóa và đặt lại mật khẩu khi quên (HR-027).
// Không có API xóa: tài khoản nghỉ việc thì khóa, để giữ lịch sử ai đã duyệt đơn, chấm công...
const router = express.Router();

const USER_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF', 'EMPLOYEE'];

router.use(requireRole('ADMIN'));

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  fullName: z.string().trim().min(2).max(160).optional(),
  role: z.enum(USER_ROLES),
  password: passwordSchema,
  employeeId: z.string().uuid().nullable().optional()
});

const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160).optional(),
    role: z.enum(USER_ROLES).optional(),
    employeeId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional()
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

const resetPasswordSchema = z.object({ newPassword: passwordSchema });

// Cấp hàng loạt: mỗi lần tối đa 100 hồ sơ (băm bcrypt ~0,2 s / tài khoản).
const bulkCreateSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(100)
});

const INACTIVE_EMPLOYEE_STATUSES = ['RESIGNED', 'TERMINATED'];

// Mật khẩu tạm 10 ký tự có cả chữ và số, bỏ ký tự dễ nhầm (0/O, 1/l/I).
function generateTemporaryPassword() {
  const letters = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const chars = Array.from({ length: 10 }, () => all[crypto.randomInt(all.length)]);
  chars[0] = letters[crypto.randomInt(letters.length)];
  chars[9] = digits[crypto.randomInt(digits.length)];
  return chars.join('');
}

const selectUserSql = `
  SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.employee_id, u.created_at, u.updated_at,
         u.password_changed_at, e.employee_code, e.full_name AS employee_name, d.name AS department_name
  FROM users u
  LEFT JOIN employees e ON e.id = u.employee_id
  LEFT JOIN departments d ON d.id = e.department_id`;

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    employeeId: row.employee_id,
    employeeCode: row.employee_code ?? null,
    employeeName: row.employee_name ?? null,
    departmentName: row.department_name ?? null,
    passwordChangedAt: row.password_changed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findUser(id) {
  const result = await query(`${selectUserSql} WHERE u.id = $1`, [id]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

async function findEmployeeForLink(employeeId, exceptUserId = null) {
  const result = await query(
    `SELECT e.id, e.full_name, e.email, u.id AS linked_user_id
     FROM employees e
     LEFT JOIN users u ON u.employee_id = e.id
     WHERE e.id = $1`,
    [employeeId]
  );
  const employee = result.rows[0];

  if (!employee) {
    throw httpError(404, 'Employee not found');
  }

  // Kiểm tra trước để báo lỗi rõ ràng; unique index users_employee_id_key vẫn chặn khi gửi trùng cùng lúc.
  if (employee.linked_user_id && employee.linked_user_id !== exceptUserId) {
    throw httpError(409, 'This employee already has a linked account');
  }

  return employee;
}

// Luôn phải còn ít nhất một Admin đang hoạt động, nếu không sẽ không ai quản lý được tài khoản nữa.
async function ensureAnotherActiveAdmin(userId) {
  const result = await query(
    "SELECT COUNT(*)::int AS count FROM users WHERE role = 'ADMIN' AND is_active = TRUE AND id <> $1",
    [userId]
  );

  if (result.rows[0].count === 0) {
    throw httpError(409, 'At least one active admin account is required');
  }
}

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || '').trim();
    const status = String(req.query.status || '').trim();
    const linked = String(req.query.linked || '').trim();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const values = [];
    const where = [];

    if (search) {
      values.push(`%${search}%`);
      where.push(
        `(unaccent(u.full_name) ILIKE unaccent($${values.length})
          OR u.email ILIKE $${values.length}
          OR e.employee_code ILIKE $${values.length})`
      );
    }

    if (USER_ROLES.includes(role)) {
      values.push(role);
      where.push(`u.role = $${values.length}`);
    }

    if (status === 'active' || status === 'locked') {
      where.push(status === 'active' ? 'u.is_active = TRUE' : 'u.is_active = FALSE');
    }

    if (linked === 'yes' || linked === 'no') {
      where.push(linked === 'yes' ? 'u.employee_id IS NOT NULL' : 'u.employee_id IS NULL');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countResult = await query(
      `SELECT COUNT(*)::int AS count FROM users u LEFT JOIN employees e ON e.id = u.employee_id ${whereSql}`,
      values
    );
    const total = countResult.rows[0].count;
    const listValues = [...values, limit, (page - 1) * limit];
    const result = await query(
      `${selectUserSql}
       ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues
    );

    res.json({
      data: result.rows.map(mapUser),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/employee-options', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT e.id, e.employee_code, e.full_name, e.email, e.status, e.position, d.name AS department_name,
              u.id AS linked_user_id, u.email AS linked_user_email
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN users u ON u.employee_id = e.id
       ORDER BY e.full_name`
    );

    res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        employeeCode: row.employee_code,
        fullName: row.full_name,
        email: row.email,
        status: row.status,
        position: row.position ?? null,
        departmentName: row.department_name ?? null,
        linkedUserId: row.linked_user_id ?? null,
        linkedUserEmail: row.linked_user_email ?? null
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const user = await findUser(id);

    if (!user) {
      throw httpError(404, 'User not found');
    }

    res.json({ data: { ...user, history: await listAudit('USER', id) } });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body);
    let fullName = body.fullName;

    // Tài khoản Nhân viên chỉ dùng các mục tự phục vụ (chấm công, lịch, nghỉ phép) nên bắt buộc gắn hồ sơ.
    if (body.role === 'EMPLOYEE' && !body.employeeId) {
      throw httpError(400, 'Employee accounts must be linked to an employee profile');
    }

    if (body.employeeId) {
      const employee = await findEmployeeForLink(body.employeeId);
      fullName = fullName || employee.full_name;
    }

    if (!fullName) {
      throw httpError(400, 'Full name is required');
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [body.email]);

    if (existing.rows[0]) {
      throw httpError(409, 'Account email already exists');
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const inserted = await query(
      `INSERT INTO users (email, password_hash, full_name, role, employee_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [body.email, passwordHash, fullName, body.role, body.employeeId || null]
    );
    const id = inserted.rows[0].id;

    await logAudit({
      entityType: 'USER',
      entityId: id,
      action: 'USER_CREATED',
      details: { email: body.email, role: body.role, employeeId: body.employeeId || null },
      user: req.user
    });

    res.status(201).json({ data: await findUser(id) });
  } catch (error) {
    next(error);
  }
});

router.post('/bulk', async (req, res, next) => {
  try {
    const { employeeIds } = bulkCreateSchema.parse(req.body);
    const uniqueIds = [...new Set(employeeIds)];
    const result = await query(
      `SELECT e.id, e.employee_code, e.full_name, e.email, e.status,
              u.id AS linked_user_id, eu.id AS email_user_id
       FROM employees e
       LEFT JOIN users u ON u.employee_id = e.id
       LEFT JOIN users eu ON eu.email = LOWER(e.email)
       WHERE e.id = ANY($1::uuid[])`,
      [uniqueIds]
    );
    const found = new Map(result.rows.map((row) => [row.id, row]));
    const created = [];
    const skipped = [];

    for (const id of uniqueIds) {
      const employee = found.get(id);
      const base = { employeeId: id, employeeCode: employee?.employee_code ?? null, fullName: employee?.full_name ?? null };
      let reason = null;

      if (!employee) {
        reason = 'EMPLOYEE_NOT_FOUND';
      } else if (employee.linked_user_id) {
        reason = 'ALREADY_LINKED';
      } else if (INACTIVE_EMPLOYEE_STATUSES.includes(employee.status)) {
        reason = 'EMPLOYEE_NOT_WORKING';
      } else if (!employee.email) {
        reason = 'NO_EMAIL';
      } else if (employee.email_user_id) {
        reason = 'EMAIL_TAKEN';
      }

      if (reason) {
        skipped.push({ ...base, reason });
        continue;
      }

      const email = employee.email.trim().toLowerCase();
      const password = generateTemporaryPassword();

      try {
        const inserted = await query(
          `INSERT INTO users (email, password_hash, full_name, role, employee_id)
           VALUES ($1, $2, $3, 'EMPLOYEE', $4)
           RETURNING id`,
          [email, await bcrypt.hash(password, 12), employee.full_name, id]
        );
        const userId = inserted.rows[0].id;
        await logAudit({
          entityType: 'USER',
          entityId: userId,
          action: 'USER_CREATED',
          details: { email, role: 'EMPLOYEE', employeeId: id, bulk: true },
          user: req.user
        });
        created.push({ id: userId, email, fullName: employee.full_name, employeeCode: employee.employee_code, password });
      } catch (error) {
        // Có người vừa tạo trùng (email / hồ sơ) cùng lúc: bỏ qua hồ sơ này, các hồ sơ khác vẫn tiếp tục.
        if (error.code !== '23505') {
          throw error;
        }

        skipped.push({ ...base, reason: error.constraint === 'users_employee_id_key' ? 'ALREADY_LINKED' : 'EMAIL_TAKEN' });
      }
    }

    res.json({ data: { created, skipped } });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = updateUserSchema.parse(req.body);
    const current = await findUser(id);

    if (!current) {
      throw httpError(404, 'User not found');
    }

    const updated = {
      fullName: body.fullName ?? current.fullName,
      role: body.role ?? current.role,
      employeeId: body.employeeId === undefined ? current.employeeId : body.employeeId,
      isActive: body.isActive ?? current.isActive
    };
    const isSelf = id === req.user.sub;

    if (isSelf && (updated.role !== current.role || !updated.isActive)) {
      throw httpError(409, 'You cannot lock or change the role of your own account');
    }

    if (current.role === 'ADMIN' && current.isActive && (updated.role !== 'ADMIN' || !updated.isActive)) {
      await ensureAnotherActiveAdmin(id);
    }

    if (updated.role === 'EMPLOYEE' && !updated.employeeId) {
      throw httpError(400, 'Employee accounts must be linked to an employee profile');
    }

    if (updated.employeeId && updated.employeeId !== current.employeeId) {
      await findEmployeeForLink(updated.employeeId, id);
    }

    const roleChanged = updated.role !== current.role;
    const linkChanged = updated.employeeId !== current.employeeId;

    // Đổi vai trò / hồ sơ liên kết thì quyền trong token cũ không còn đúng: bắt đăng nhập lại
    // (password_changed_at chặn refresh token cũ, revokeSessions chặn access token cũ).
    await query(
      `UPDATE users
       SET full_name = $1, role = $2, employee_id = $3, is_active = $4, updated_at = NOW()
           ${roleChanged || linkChanged ? ", password_changed_at = NOW() - INTERVAL '1 second'" : ''}
       WHERE id = $5`,
      [updated.fullName, updated.role, updated.employeeId, updated.isActive, id]
    );

    if (!updated.isActive) {
      blockUser(id);
    } else if (!current.isActive) {
      unblockUser(id);
    } else if (roleChanged || linkChanged) {
      revokeSessions(id);
    }

    const changes = diffFields(current, updated, ['fullName', 'role', 'employeeId', 'isActive']);
    let action = 'USER_UPDATED';

    if (current.isActive !== updated.isActive) {
      action = updated.isActive ? 'USER_UNLOCKED' : 'USER_LOCKED';
    }

    if (Object.keys(changes).length) {
      await logAudit({ entityType: 'USER', entityId: id, action, details: changes, user: req.user });
    }

    res.json({ data: await findUser(id) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = resetPasswordSchema.parse(req.body);

    if (id === req.user.sub) {
      throw httpError(409, 'Use change password for your own account');
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    const result = await query(
      `UPDATE users SET password_hash = $1, password_changed_at = NOW() - INTERVAL '1 second', updated_at = NOW()
       WHERE id = $2
       RETURNING id, is_active`,
      [passwordHash, id]
    );

    if (!result.rows[0]) {
      throw httpError(404, 'User not found');
    }

    if (result.rows[0].is_active) {
      revokeSessions(id);
    }

    await logAudit({ entityType: 'USER', entityId: id, action: 'PASSWORD_RESET', user: req.user });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
