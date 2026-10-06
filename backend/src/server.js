import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import applicationRoutes from './routes/applications.routes.js';
import authRoutes from './routes/auth.routes.js';
import contractRoutes from './routes/contracts.routes.js';
import departmentRoutes from './routes/departments.routes.js';
import employeeRoutes from './routes/employees.routes.js';
import jobPostingRoutes from './routes/jobPostings.routes.js';
import positionRoutes from './routes/positions.routes.js';
import publicJobRoutes from './routes/publicJobs.routes.js';
import { swaggerSpec } from './swagger.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(morgan('dev'));
app.use(
  '/uploads',
  express.static(path.dirname(config.avatarUploadDir), {
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'web-hr-api' });
});

// Tài liệu API Auth dạng Swagger UI (task #68). Các nhóm API khác xem docs/API.md.
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

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  const duplicateMessages = {
    departments_name_key: 'Department name already exists',
    employees_employee_code_key: 'Employee code already exists',
    employees_email_key: 'Employee email already exists',
    employees_id_number_key: 'ID number already exists',
    positions_code_key: 'Position code already exists',
    employment_contracts_contract_number_key: 'Contract number already exists',
    applications_active_email_job_key: 'You have already applied for this job',
    job_postings_code_key: 'Job posting code already exists',
    employment_contracts_one_active_key: 'Employee already has an active contract'
  };
  const isValidationError = error.name === 'ZodError';
  const isDuplicate = error.code === '23505';
  const isForeignKeyError = error.code === '23503';
  const isInvalidDatabaseValue = error.code === '22P02';
  const isFileTooLarge = error.code === 'LIMIT_FILE_SIZE';
  const isUploadError = typeof error.code === 'string' && error.code.startsWith('LIMIT_');
  const status = error.status
    || (isValidationError || isInvalidDatabaseValue ? 400 : null)
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
          : isFileTooLarge
            ? {
                cv: `CV must not exceed ${config.cvMaxSizeMb} MB`,
                file: `Excel file must not exceed ${config.excelMaxSizeMb} MB`
              }[error.field] || `Avatar must not exceed ${config.avatarMaxSizeMb} MB`
            : error.message || 'Internal server error';

  res.status(status).json({
    message,
    details: error.issues || undefined
  });
});

app.listen(config.port, () => {
  console.log(`Web HR API listening on http://localhost:${config.port}`);
});
