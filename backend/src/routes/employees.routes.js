import ExcelJS from 'exceljs';
import express from 'express';
import { z } from 'zod';
import { EMPLOYMENT_TYPES } from '../constants.js';
import { query } from '../db.js';
import {
  avatarUpload,
  getAvatarPath,
  getAvatarUrl,
  removeAvatarFile
} from '../middleware/avatarUpload.js';
import { requireRole } from '../middleware/auth.js';
import { excelUpload } from '../middleware/excelUpload.js';
import { diffFields, listAudit, logAudit } from '../utils/audit.js';
import { httpError } from '../utils/httpError.js';

const router = express.Router();

const employeeSchema = z.object({
  employeeCode: z.string().min(2).max(40),
  fullName: z.string().min(2).max(160),
  email: z.string().email().max(160),
  phone: z.string().max(40).optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  // CMND 9 số hoặc CCCD 12 số.
  idNumber: z.string().trim().regex(/^(\d{9}|\d{12})$/, 'ID number must have 9 or 12 digits').optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  // Chọn chức vụ từ danh mục (positionId) hoặc gõ tên tự do (position) — cần ít nhất một.
  positionId: z.string().uuid().optional().nullable(),
  position: z.string().min(2).max(120).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED']),
  hireDate: z.string().min(10),
  baseSalary: z.coerce.number().min(0),
  address: z.string().optional().nullable()
});

const createEmployeeSchema = employeeSchema.refine((employee) => employee.positionId || employee.position, {
  path: ['position'],
  message: 'Position is required'
});
const updateEmployeeSchema = employeeSchema.partial();

// Các trường được ghi vào lịch sử khi sửa hồ sơ (phòng ban, quản lý ghi theo tên cho dễ đọc).
const HISTORY_FIELDS = [
  'employeeCode',
  'fullName',
  'email',
  'phone',
  'gender',
  'dateOfBirth',
  'idNumber',
  'departmentName',
  'managerName',
  'position',
  'employmentType',
  'status',
  'hireDate',
  'baseSalary',
  'address'
];

// Tên chức vụ lấy từ danh mục để employees.position luôn khớp với positions.name.
async function getPositionName(positionId) {
  const result = await query('SELECT name FROM positions WHERE id = $1', [positionId]);

  if (!result.rows[0]) {
    throw httpError(400, 'Selected position does not exist');
  }

  return result.rows[0].name;
}

function mapEmployee(row, req) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    idNumber: row.id_number,
    departmentId: row.department_id,
    departmentName: row.department_name,
    managerId: row.manager_id,
    managerName: row.manager_name,
    positionId: row.position_id,
    position: row.position,
    employmentType: row.employment_type,
    status: row.status,
    hireDate: row.hire_date,
    baseSalary: Number(row.base_salary),
    address: row.address,
    avatarUrl: getAvatarUrl(req, row.avatar_url),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const selectEmployeeSql = `
  SELECT
    e.*,
    d.name AS department_name,
    m.full_name AS manager_name
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees m ON m.id = e.manager_id
`;

async function findEmployee(id, req) {
  const result = await query(`${selectEmployeeSql} WHERE e.id = $1`, [id]);
  return result.rows[0] ? mapEmployee(result.rows[0], req) : null;
}

// BUG-06: lọc dùng chung cho danh sách (phân trang) và xuất Excel (lấy hết theo cùng bộ lọc).
function buildEmployeeFilters(req) {
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const departmentId = String(req.query.departmentId || '').trim();
  const position = String(req.query.position || '').trim();
  const values = [];
  const where = [];

  if (search) {
    values.push(`%${search}%`);
    // unaccent() để tìm không phân biệt dấu tiếng Việt, giống hành vi lọc phía frontend trước đây.
    where.push(
      `(unaccent(e.full_name) ILIKE unaccent($${values.length})
        OR e.employee_code ILIKE $${values.length}
        OR e.email ILIKE $${values.length})`
    );
  }

  if (status) {
    values.push(status);
    where.push(`e.status = $${values.length}`);
  }

  if (departmentId) {
    values.push(departmentId);
    where.push(`e.department_id = $${values.length}`);
  }

  if (position) {
    values.push(position);
    where.push(`e.position = $${values.length}`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

function parsePagination(req) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

router.get('/', async (req, res, next) => {
  try {
    const { whereSql, values } = buildEmployeeFilters(req);
    const { page, limit, offset } = parsePagination(req);

    const countResult = await query(`SELECT COUNT(*)::int AS count FROM employees e ${whereSql}`, values);
    const total = countResult.rows[0].count;

    const listValues = [...values, limit, offset];
    const result = await query(
      `${selectEmployeeSql}
       ${whereSql}
       ORDER BY e.created_at DESC
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues
    );

    res.json({
      data: result.rows.map((row) => mapEmployee(row, req)),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
    });
  } catch (error) {
    next(error);
  }
});

// Danh sách rút gọn (không JOIN phòng ban/quản lý) cho ô chọn quản lý trực tiếp, gợi ý mã NV
// kế tiếp và danh sách chức vụ tự do — nhẹ hơn nhiều so với GET / nên không cần phân trang.
router.get('/lookup', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, employee_code, full_name, position, status
       FROM employees
       ORDER BY full_name ASC`
    );

    res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        employeeCode: row.employee_code,
        fullName: row.full_name,
        position: row.position,
        status: row.status
      }))
    });
  } catch (error) {
    next(error);
  }
});

const EXPORT_COLUMNS = [
  { header: 'Mã nhân viên', key: 'employeeCode', width: 14 },
  { header: 'Họ tên', key: 'fullName', width: 24 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Điện thoại', key: 'phone', width: 16 },
  { header: 'Giới tính', key: 'gender', width: 12 },
  { header: 'Ngày sinh', key: 'dateOfBirth', width: 14 },
  { header: 'CCCD', key: 'idNumber', width: 16 },
  { header: 'Phòng ban', key: 'departmentName', width: 20 },
  { header: 'Chức vụ', key: 'position', width: 20 },
  { header: 'Hình thức làm việc', key: 'employmentType', width: 18 },
  { header: 'Trạng thái', key: 'status', width: 14 },
  { header: 'Ngày vào làm', key: 'hireDate', width: 14 },
  { header: 'Lương cơ bản', key: 'baseSalary', width: 16 },
  { header: 'Địa chỉ', key: 'address', width: 30 }
];

// HR-009: xuất danh sách nhân sự ra Excel theo cùng bộ lọc đang xem trên danh sách.
router.get('/export', requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'), async (req, res, next) => {
  try {
    const { whereSql, values } = buildEmployeeFilters(req);
    const result = await query(`${selectEmployeeSql} ${whereSql} ORDER BY e.employee_code ASC`, values);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Nhân sự');
    sheet.columns = EXPORT_COLUMNS;
    sheet.getRow(1).font = { bold: true };

    for (const row of result.rows) {
      sheet.addRow(mapEmployee(row, req));
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="danh-sach-nhan-su-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

const IMPORT_HEADERS = {
  'Mã nhân viên': 'employeeCode',
  'Họ tên': 'fullName',
  Email: 'email',
  'Điện thoại': 'phone',
  'Giới tính': 'gender',
  'Ngày sinh': 'dateOfBirth',
  CCCD: 'idNumber',
  'Phòng ban': 'departmentName',
  'Chức vụ': 'position',
  'Hình thức làm việc': 'employmentType',
  'Trạng thái': 'status',
  'Ngày vào làm': 'hireDate',
  'Lương cơ bản': 'baseSalary',
  'Địa chỉ': 'address'
};

// Excel lưu ô ngày dưới dạng Date; ô text thì giữ nguyên chuỗi người dùng nhập (yyyy-mm-dd).
function formatExcelDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).trim();
}

function excelCell(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

// HR-009: nhập danh sách nhân sự từ Excel (cùng định dạng cột với file xuất ra).
// Mã NV đã tồn tại thì cập nhật, chưa có thì tạo mới; dòng lỗi được bỏ qua và báo lại trong "errors".
router.post('/import', requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'), excelUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      throw httpError(400, 'Excel file is required in the file field');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      throw httpError(400, 'Excel file has no worksheet');
    }

    const columnFields = [];
    sheet.getRow(1).eachCell((cell, colNumber) => {
      columnFields[colNumber] = IMPORT_HEADERS[String(cell.value ?? '').trim()];
    });

    const [departmentRows, positionRows] = await Promise.all([
      query('SELECT id, name FROM departments'),
      query('SELECT id, name FROM positions')
    ]);
    const departmentIdByName = new Map(departmentRows.rows.map((row) => [row.name.toLowerCase(), row.id]));
    const positionIdByName = new Map(positionRows.rows.map((row) => [row.name.toLowerCase(), row.id]));
    const positionNameById = new Map(positionRows.rows.map((row) => [row.id, row.name]));

    let created = 0;
    let updated = 0;
    const errors = [];

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const raw = {};
      row.eachCell((cell, colNumber) => {
        const field = columnFields[colNumber];

        if (field) {
          raw[field] = cell.value;
        }
      });

      if (!Object.keys(raw).length) {
        continue;
      }

      try {
        const departmentName = excelCell(raw.departmentName);
        const positionName = excelCell(raw.position);
        const body = createEmployeeSchema.parse({
          employeeCode: excelCell(raw.employeeCode),
          fullName: excelCell(raw.fullName),
          email: excelCell(raw.email),
          phone: excelCell(raw.phone) || null,
          gender: excelCell(raw.gender).toUpperCase() || null,
          dateOfBirth: formatExcelDate(raw.dateOfBirth),
          idNumber: excelCell(raw.idNumber) || null,
          departmentId: departmentName ? departmentIdByName.get(departmentName.toLowerCase()) || null : null,
          positionId: positionName ? positionIdByName.get(positionName.toLowerCase()) || null : null,
          position: positionName || undefined,
          employmentType: excelCell(raw.employmentType),
          status: excelCell(raw.status),
          hireDate: formatExcelDate(raw.hireDate),
          baseSalary: raw.baseSalary,
          address: excelCell(raw.address) || null
        });
        const resolvedPosition = body.positionId ? positionNameById.get(body.positionId) : body.position;
        const existing = await query('SELECT id FROM employees WHERE employee_code = $1', [body.employeeCode]);

        if (existing.rows[0]) {
          await query(
            `UPDATE employees
             SET full_name = $1, email = $2, phone = $3, gender = $4, date_of_birth = $5,
                 department_id = $6, position_id = $7, position = $8, employment_type = $9,
                 status = $10, hire_date = $11, base_salary = $12, address = $13, id_number = $14,
                 updated_at = NOW()
             WHERE id = $15`,
            [
              body.fullName,
              body.email.toLowerCase(),
              body.phone || null,
              body.gender || null,
              body.dateOfBirth || null,
              body.departmentId || null,
              body.positionId || null,
              resolvedPosition,
              body.employmentType,
              body.status,
              body.hireDate,
              body.baseSalary,
              body.address || null,
              body.idNumber || null,
              existing.rows[0].id
            ]
          );
          updated += 1;
        } else {
          await query(
            `INSERT INTO employees (
              employee_code, full_name, email, phone, gender, date_of_birth,
              department_id, position_id, position, employment_type, status, hire_date,
              base_salary, address, id_number
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              body.employeeCode,
              body.fullName,
              body.email.toLowerCase(),
              body.phone || null,
              body.gender || null,
              body.dateOfBirth || null,
              body.departmentId || null,
              body.positionId || null,
              resolvedPosition,
              body.employmentType,
              body.status,
              body.hireDate,
              body.baseSalary,
              body.address || null,
              body.idNumber || null
            ]
          );
          created += 1;
        }
      } catch (rowError) {
        errors.push({
          row: rowNumber,
          message: rowError.issues?.[0]?.message || rowError.message || 'Dữ liệu không hợp lệ'
        });
      }
    }

    res.json({ data: { created, updated, skipped: errors.length, errors } });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const employee = await findEmployee(req.params.id, req);

    if (!employee) {
      throw httpError(404, 'Employee not found');
    }

    res.json({ data: employee });
  } catch (error) {
    next(error);
  }
});

// Lịch sử thay đổi của một nhân viên (mới nhất trước).
router.get('/:id/history', async (req, res, next) => {
  try {
    const exists = await query('SELECT 1 FROM employees WHERE id = $1', [req.params.id]);

    if (!exists.rows[0]) {
      throw httpError(404, 'Employee not found');
    }

    res.json({ data: await listAudit('EMPLOYEE', req.params.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'), async (req, res, next) => {
  try {
    const body = createEmployeeSchema.parse(req.body);
    const positionName = body.positionId ? await getPositionName(body.positionId) : body.position;
    const result = await query(
      `INSERT INTO employees (
        employee_code, full_name, email, phone, gender, date_of_birth,
        department_id, position_id, position, employment_type, status, hire_date,
        base_salary, address, id_number, manager_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id`,
      [
        body.employeeCode,
        body.fullName,
        body.email.toLowerCase(),
        body.phone || null,
        body.gender || null,
        body.dateOfBirth || null,
        body.departmentId || null,
        body.positionId || null,
        positionName,
        body.employmentType,
        body.status,
        body.hireDate,
        body.baseSalary,
        body.address || null,
        body.idNumber || null,
        body.managerId || null
      ]
    );
    const employeeId = result.rows[0].id;
    await logAudit({ entityType: 'EMPLOYEE', entityId: employeeId, action: 'CREATED', user: req.user });

    res.status(201).json({ data: await findEmployee(employeeId, req) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'), async (req, res, next) => {
  try {
    const body = updateEmployeeSchema.parse(req.body);
    const current = await query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    const row = current.rows[0];

    if (!row) {
      throw httpError(404, 'Employee not found');
    }

    const before = await findEmployee(req.params.id, req);
    const pick = (field, column) => (Object.hasOwn(body, field) ? body[field] : row[column]);
    const merged = {
      employeeCode: pick('employeeCode', 'employee_code'),
      fullName: pick('fullName', 'full_name'),
      email: pick('email', 'email'),
      phone: pick('phone', 'phone'),
      gender: pick('gender', 'gender'),
      dateOfBirth: pick('dateOfBirth', 'date_of_birth'),
      idNumber: pick('idNumber', 'id_number'),
      departmentId: pick('departmentId', 'department_id'),
      managerId: pick('managerId', 'manager_id'),
      positionId: row.position_id,
      position: row.position,
      employmentType: pick('employmentType', 'employment_type'),
      status: pick('status', 'status'),
      hireDate: pick('hireDate', 'hire_date'),
      baseSalary: pick('baseSalary', 'base_salary'),
      address: pick('address', 'address')
    };

    if (merged.managerId === req.params.id) {
      throw httpError(400, 'An employee cannot be their own manager');
    }

    // Có positionId thì lấy tên từ danh mục; chỉ gửi tên mới (khác tên cũ) thì bỏ liên kết.
    if (Object.hasOwn(body, 'positionId') && body.positionId) {
      merged.positionId = body.positionId;
      merged.position = await getPositionName(body.positionId);
    } else if (Object.hasOwn(body, 'positionId') || Object.hasOwn(body, 'position')) {
      const position = body.position ?? merged.position;

      if (Object.hasOwn(body, 'positionId') || position !== merged.position) {
        merged.positionId = null;
      }

      merged.position = position;
    }

    await query(
      `UPDATE employees
       SET employee_code = $1,
           full_name = $2,
           email = $3,
           phone = $4,
           gender = $5,
           date_of_birth = $6,
           department_id = $7,
           position = $8,
           employment_type = $9,
           status = $10,
           hire_date = $11,
           base_salary = $12,
           address = $13,
           position_id = $14,
           id_number = $15,
           manager_id = $16,
           updated_at = NOW()
       WHERE id = $17`,
      [
        merged.employeeCode,
        merged.fullName,
        merged.email.toLowerCase(),
        merged.phone,
        merged.gender,
        merged.dateOfBirth,
        merged.departmentId,
        merged.position,
        merged.employmentType,
        merged.status,
        merged.hireDate,
        merged.baseSalary,
        merged.address,
        merged.positionId,
        merged.idNumber || null,
        merged.managerId || null,
        req.params.id
      ]
    );

    const updated = await findEmployee(req.params.id, req);
    const changes = diffFields(before, updated, HISTORY_FIELDS);

    if (Object.keys(changes).length) {
      await logAudit({
        entityType: 'EMPLOYEE',
        entityId: req.params.id,
        action: 'UPDATED',
        details: { fields: changes },
        user: req.user
      });
    }

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/avatar',
  requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'),
  async (req, _res, next) => {
    try {
      const current = await query('SELECT id, avatar_url FROM employees WHERE id = $1', [req.params.id]);

      if (!current.rows[0]) {
        throw httpError(404, 'Employee not found');
      }

      req.currentAvatarPath = current.rows[0].avatar_url;
      next();
    } catch (error) {
      next(error);
    }
  },
  avatarUpload,
  async (req, res, next) => {
    if (!req.file) {
      return next(httpError(400, 'Avatar file is required in the avatar field'));
    }

    const avatarPath = getAvatarPath(req.file.filename);

    try {
      await query(
        'UPDATE employees SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
        [avatarPath, req.params.id]
      );
      await removeAvatarFile(req.currentAvatarPath);
      await logAudit({ entityType: 'EMPLOYEE', entityId: req.params.id, action: 'AVATAR_UPDATED', user: req.user });

      return res.json({ data: await findEmployee(req.params.id, req) });
    } catch (error) {
      await removeAvatarFile(avatarPath);
      return next(error);
    }
  }
);

router.delete(
  '/:id/avatar',
  requireRole('ADMIN', 'HR_MANAGER', 'HR_STAFF'),
  async (req, res, next) => {
    try {
      const current = await query('SELECT avatar_url FROM employees WHERE id = $1', [req.params.id]);

      if (!current.rows[0]) {
        throw httpError(404, 'Employee not found');
      }

      await query(
        'UPDATE employees SET avatar_url = NULL, updated_at = NOW() WHERE id = $1',
        [req.params.id]
      );
      await removeAvatarFile(current.rows[0].avatar_url);
      await logAudit({ entityType: 'EMPLOYEE', entityId: req.params.id, action: 'AVATAR_REMOVED', user: req.user });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id', requireRole('ADMIN', 'HR_MANAGER'), async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM employees WHERE id = $1 RETURNING id, avatar_url',
      [req.params.id]
    );

    if (!result.rows[0]) {
      throw httpError(404, 'Employee not found');
    }

    // Hồ sơ đã xóa thì lịch sử của nó cũng không còn ai xem được.
    await query("DELETE FROM audit_logs WHERE entity_type = 'EMPLOYEE' AND entity_id = $1", [req.params.id]);
    await removeAvatarFile(result.rows[0].avatar_url);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
