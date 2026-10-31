import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import { pool } from './db.js';
import { requireAuth } from './middleware/auth.js';
import applicationRoutes from './routes/applications.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import authRoutes from './routes/auth.routes.js';
import contractRoutes from './routes/contracts.routes.js';
import departmentRoutes from './routes/departments.routes.js';
import employeeRoutes from './routes/employees.routes.js';
import jobPostingRoutes from './routes/jobPostings.routes.js';
import leaveRequestRoutes from './routes/leaveRequests.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import positionRoutes from './routes/positions.routes.js';
import publicJobRoutes from './routes/publicJobs.routes.js';
import reportRoutes from './routes/reports.routes.js';
import userRoutes from './routes/users.routes.js';
import workScheduleRoutes from './routes/workSchedules.routes.js';
import workShiftRoutes from './routes/workShifts.routes.js';
import { swaggerSpec } from './swagger.js';
import { logger, requestLogger } from './utils/logger.js';
import { loadRevokedSessions } from './utils/sessionRevocation.js';
import { startAbsenceMarker } from './utils/shiftTiming.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(requestLogger);
app.use(
  '/uploads',
  express.static(path.dirname(config.avatarUploadDir), {
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  })
);

// Health check cho Docker/giám sát: kiểm tra cả kết nối CSDL, mất kết nối thì trả 503.
app.get('/api/health', async (_req, res) => {
  const startedAt = Date.now();

  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'web-hr-api', database: 'ok', dbLatencyMs: Date.now() - startedAt, uptimeSeconds: Math.round(process.uptime()) });
  } catch (error) {
    logger.error('Health check: database unreachable', { error });
    res.status(503).json({ status: 'degraded', service: 'web-hr-api', database: 'unreachable' });
  }
});

// Tài liệu API dạng Swagger UI cho toàn bộ API (src/openapi/, xuất file bằng `npm run docs:openapi`).
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
// Trang tuyển dụng công khai: xem tin và nộp hồ sơ không cần đăng nhập.
app.use('/api/public/jobs', publicJobRoutes);
app.use('/api/departments', requireAuth, departmentRoutes);
app.use('/api/employees', requireAuth, employeeRoutes);
app.use('/api/positions', requireAuth, positionRoutes);
app.use('/api/contracts', requireAuth, contractRoutes);
app.use('/api/jobs', requireAuth, jobPostingRoutes);
app.use('/api/applications', requireAuth, applicationRoutes);
app.use('/api/work-shifts', requireAuth, workShiftRoutes);
app.use('/api/work-schedules', requireAuth, workScheduleRoutes);
app.use('/api/attendance-records', requireAuth, attendanceRoutes);
app.use('/api/leave-requests', requireAuth, leaveRequestRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, req, res, _next) => {
  const duplicateMessages = {
    departments_name_key: 'Department name already exists',
    employees_employee_code_key: 'Employee code already exists',
    employees_email_key: 'Employee email already exists',
    employees_id_number_key: 'ID number already exists',
    positions_code_key: 'Position code already exists',
    employment_contracts_contract_number_key: 'Contract number already exists',
    applications_active_email_job_key: 'You have already applied for this job',
    job_postings_code_key: 'Job posting code already exists',
    employment_contracts_one_active_key: 'Employee already has an active contract',
    work_shifts_code_key: 'Shift code already exists',
    work_schedules_employee_id_work_date_key: 'Employee already has a shift scheduled for this date',
    attendance_records_employee_id_work_date_key: 'Attendance already recorded for this date',
    users_employee_id_key: 'This employee already has a linked account',
    users_email_key: 'Account email already exists'
  };
  const isValidationError = error.name === 'ZodError';
  const isDuplicate = error.code === '23505';
  const isForeignKeyError = error.code === '23503';
  const isInvalidDatabaseValue = error.code === '22P02';
  // 22003 số vượt kiểu cột, 22007/22008 ngày giờ sai hoặc không tồn tại: lỗi dữ liệu gửi lên, không phải lỗi máy chủ.
  const isOutOfRange = ['22003', '22007', '22008'].includes(error.code);
  const isFileTooLarge = error.code === 'LIMIT_FILE_SIZE';
  const isUploadError = typeof error.code === 'string' && error.code.startsWith('LIMIT_');
  const status = error.status
    || (isValidationError || isInvalidDatabaseValue || isOutOfRange ? 400 : null)
    || (isFileTooLarge ? 413 : null)
    || (isUploadError ? 400 : null)
    || (isDuplicate || isForeignKeyError ? 409 : null)
    || 500;
  const message = isValidationError
    ? 'Validation error'
    : isDuplicate
      ? duplicateMessages[error.constraint] || 'Duplicate value'
      : isForeignKeyError
        ? 'Related record does not exist or is still in use'
        : isInvalidDatabaseValue
          ? 'Invalid identifier or database value'
          : isOutOfRange
            ? 'Date, time or number value is out of range'
            : isFileTooLarge
              ? {
                  cv: `CV must not exceed ${config.cvMaxSizeMb} MB`,
                  file: `Excel file must not exceed ${config.excelMaxSizeMb} MB`
                }[error.field] || `Avatar must not exceed ${config.avatarMaxSizeMb} MB`
              : status === 500
                ? 'Internal server error'
                : error.message || 'Internal server error';

  // Lỗi 500 không trả chi tiết (tên bảng, câu SQL) cho người gọi API, chỉ ghi ở log máy chủ.
  if (status === 500) {
    logger.error('Unhandled error', { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], error });
  }

  res.status(status).json({
    message,
    details: error.issues || undefined
  });
});

const server = app.listen(config.port, () => {
  logger.info(`Web HR API listening on http://localhost:${config.port}`, { port: config.port, logFormat: config.logFormat });
});

// Nạp lại danh sách tài khoản bị khóa / vừa đặt lại mật khẩu để token cấp trước đó không dùng tiếp được sau khi
// máy chủ khởi động lại (HR-007). Lỗi DB lúc khởi động chỉ ghi log, không làm sập API.
loadRevokedSessions().catch((error) => logger.error('Could not load revoked sessions', { error }));

// Tự ghi Vắng cho ca đã xếp hôm qua mà không chấm công (HR-035), bật bằng AUTO_MARK_ABSENT=true.
if (config.autoMarkAbsent) {
  startAbsenceMarker();
}

// Dừng êm khi Docker gửi SIGTERM (docker stop, deploy): ngừng nhận request mới, chờ request đang xử lý xong
// rồi đóng pool CSDL; quá 10 giây thì thoát luôn.
function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down`);
  setTimeout(() => process.exit(1), 10000).unref();
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
