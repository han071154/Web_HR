import ExcelJS from 'exceljs';
import express from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { computeWorkHourStats } from '../utils/workHourStats.js';

const router = express.Router();

const HR_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');

const workHoursQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional()
});

// Mọi route báo cáo đều cần đăng nhập với vai trò HR trở lên.
router.use(requireRole(...HR_ROLES));

router.get('/by-department', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         d.id,
         d.name,
         COUNT(e.id) FILTER (WHERE e.status = 'ACTIVE')::int AS employee_count
       FROM departments d
       LEFT JOIN employees e ON e.department_id = d.id
       GROUP BY d.id, d.name
       ORDER BY d.name ASC`
    );

    res.json({
      data: result.rows.map((row) => ({
        departmentId: row.id,
        departmentName: row.name,
        employeeCount: row.employee_count
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/work-hours', async (req, res, next) => {
  try {
    const filters = workHoursQuerySchema.parse(req.query);
    const data = await computeWorkHourStats(filters);

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

const EXPORT_COLUMNS = [
  { header: 'Mã nhân viên', key: 'employeeCode', width: 14 },
  { header: 'Họ tên', key: 'employeeName', width: 24 },
  { header: 'Số ngày công', key: 'workDays', width: 14 },
  { header: 'Số ngày trễ', key: 'lateCount', width: 14 },
  { header: 'Số ngày vắng', key: 'absentCount', width: 14 },
  { header: 'Tổng giờ công', key: 'totalHours', width: 16 },
  { header: 'Giờ tăng ca (OT)', key: 'otHours', width: 16 }
];

// Xuất báo cáo giờ công ra Excel (HR-022/023). Chỉ xuất Excel theo quyết định của dự án —
// không có thư viện PDF trong phạm vi hiện tại, xem docs/API.md.
router.get('/export', async (req, res, next) => {
  try {
    const filters = workHoursQuerySchema.parse(req.query);
    const data = await computeWorkHourStats(filters);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo giờ công');
    sheet.columns = EXPORT_COLUMNS;
    sheet.getRow(1).font = { bold: true };

    for (const row of data) {
      sheet.addRow(row);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bao-cao-gio-cong-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

export default router;
