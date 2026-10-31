import ExcelJS from 'exceljs';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.js';

// Ngày sinh và giới tính bắt buộc khi tạo hồ sơ nhân viên, khớp form ở frontend: tạo nhân viên, nhập Excel,
// chuyển ứng viên thành nhân viên (API chuyển còn lưu thêm ngày sinh, giới tính, CCCD).
const client = { query: vi.fn(), release: vi.fn() };
vi.mock('../../db.js', () => ({ query: vi.fn(), pool: { connect: vi.fn(async () => client) } }));

const { query } = await import('../../db.js');
const { requireAuth } = await import('../../middleware/auth.js');
const { default: employeesRouter } = await import('../employees.routes.js');
const { default: applicationsRouter } = await import('../applications.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/employees', requireAuth, employeesRouter);
  app.use('/api/applications', requireAuth, applicationsRouter);
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ZodError' ? 400 : 500);
    res.status(status).json({
      message: error.name === 'ZodError' ? 'Validation error' : error.message,
      details: error.issues
    });
  });
  return app;
}

const token = `Bearer ${jwt.sign({ sub: 'user-1', email: 'u@webhr.local', fullName: 'HR', role: 'HR_MANAGER' }, config.jwtSecret)}`;
const app = createApp();

const validEmployee = {
  employeeCode: 'EMP900',
  fullName: 'Nguyễn Thị Test',
  email: 'test900@webhr.local',
  gender: 'FEMALE',
  dateOfBirth: '2000-05-20',
  position: 'QA Tester',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  hireDate: '2026-09-29',
  baseSalary: 12000000
};

function issuePaths(response) {
  return (response.body.details || []).map((issue) => issue.path.join('.'));
}

describe('POST /api/employees requires date of birth and gender', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it.each([
    ['gender', { gender: undefined }],
    ['dateOfBirth', { dateOfBirth: undefined }],
    ['gender', { gender: null }],
    ['dateOfBirth', { dateOfBirth: '' }]
  ])('rejects a missing %s', async (field, override) => {
    const response = await request(app)
      .post('/api/employees')
      .set('Authorization', token)
      .send({ ...validEmployee, ...override });

    expect(response.status).toBe(400);
    expect(issuePaths(response)).toContain(field);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects an employee younger than 15 on the hire date', async () => {
    const response = await request(app)
      .post('/api/employees')
      .set('Authorization', token)
      .send({ ...validEmployee, dateOfBirth: '2011-09-30' });

    expect(response.status).toBe(400);
    expect(response.body.details[0]).toMatchObject({
      path: ['dateOfBirth'],
      message: 'Employee must be at least 15 years old on the hire date'
    });
  });

  it('stores gender and date of birth', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'emp-new' }] }) // insert
      .mockResolvedValue({ rows: [] }); // audit log + reload

    await request(app).post('/api/employees').set('Authorization', token).send({ ...validEmployee, dateOfBirth: '2011-09-29' });

    const values = query.mock.calls[0][1];
    expect(values[4]).toBe('FEMALE');
    expect(values[5]).toBe('2011-09-29'); // tròn 15 tuổi đúng ngày vào làm
  });
});

describe('PUT /api/employees/:id keeps the required fields', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('does not allow clearing gender or date of birth', async () => {
    for (const body of [{ gender: null }, { dateOfBirth: null }]) {
      const response = await request(app).put('/api/employees/emp-1').set('Authorization', token).send(body);

      expect(response.status).toBe(400);
    }
  });

  it('rejects a hire date that makes the employee younger than 15', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'emp-1', date_of_birth: '2011-09-30', hire_date: '2027-01-01', gender: 'MALE', status: 'ACTIVE' }]
    });
    query.mockResolvedValue({ rows: [] });

    const response = await request(app)
      .put('/api/employees/emp-1')
      .set('Authorization', token)
      .send({ hireDate: '2026-09-29' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Employee must be at least 15 years old on the hire date');
  });
});

describe('POST /api/employees/import requires date of birth and gender', () => {
  beforeEach(() => {
    query.mockReset();
  });

  async function workbookBuffer(rows) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Nhân sự');
    sheet.addRow(['Mã nhân viên', 'Họ tên', 'Email', 'Giới tính', 'Ngày sinh', 'Chức vụ', 'Hình thức làm việc', 'Trạng thái', 'Ngày vào làm', 'Lương cơ bản']);
    rows.forEach((row) => sheet.addRow(row));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  it('skips rows without gender or date of birth and accepts Vietnamese gender labels', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO employees')) {
        return { rows: [{ id: 'emp-new' }] };
      }

      return { rows: [] };
    });

    const file = await workbookBuffer([
      ['IMP001', 'Thiếu Giới Tính', 'imp1@webhr.local', '', '1995-01-01', 'Dev', 'FULL_TIME', 'ACTIVE', '2026-01-01', 1000],
      ['IMP002', 'Thiếu Ngày Sinh', 'imp2@webhr.local', 'MALE', '', 'Dev', 'FULL_TIME', 'ACTIVE', '2026-01-01', 1000],
      ['IMP003', 'Đủ Thông Tin', 'imp3@webhr.local', 'Nữ', '1995-01-01', 'Dev', 'FULL_TIME', 'ACTIVE', '2026-01-01', 1000]
    ]);

    const response = await request(app)
      .post('/api/employees/import')
      .set('Authorization', token)
      .attach('file', file, 'nhan-su.xlsx');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ created: 1, skipped: 2 });
    expect(response.body.data.errors).toEqual([
      { row: 2, field: 'gender', message: 'Gender is required (MALE, FEMALE or OTHER)' },
      { row: 3, field: 'dateOfBirth', message: 'Date of birth is required' }
    ]);

    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO employees'));
    expect(insert[1]).toContain('FEMALE');
    expect(insert[1]).toContain('1995-01-01');
  });
});

describe('POST /api/applications/:id/convert stores date of birth, gender and ID number', () => {
  const convertBody = {
    employeeCode: 'HIRE900',
    hireDate: '2026-11-01',
    baseSalary: 9000000,
    contractType: 'PROBATION',
    contractEndDate: '2026-12-31',
    dateOfBirth: '1999-03-15',
    gender: 'MALE',
    idNumber: '012345678901'
  };

  beforeEach(() => {
    query.mockReset();
    client.query.mockReset();
    client.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM applications a')) {
        return { rows: [{ id: 'app-1', status: 'HIRED', employee_id: null, full_name: 'Ứng Viên', email: 'uv@webhr.local', phone: null, job_title: 'Dev', application_no: 7 }] };
      }

      if (sql.includes('INSERT INTO employees')) {
        return { rows: [{ id: 'emp-new' }] };
      }

      return { rows: [] };
    });
    query.mockResolvedValue({ rows: [{ id: 'app-1', application_no: 7, employee_id: 'emp-new', employee_code: 'HIRE900' }] });
  });

  it.each(['dateOfBirth', 'gender'])('rejects a conversion without %s', async (field) => {
    const response = await request(app)
      .post('/api/applications/app-1/convert')
      .set('Authorization', token)
      .send({ ...convertBody, [field]: undefined });

    expect(response.status).toBe(400);
    expect(issuePaths(response)).toContain(field);
    expect(client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO employees'))).toBe(false);
  });

  it('rejects an applicant younger than 15 on the hire date and a malformed ID number', async () => {
    for (const override of [{ dateOfBirth: '2012-01-01' }, { idNumber: '12345' }]) {
      const response = await request(app)
        .post('/api/applications/app-1/convert')
        .set('Authorization', token)
        .send({ ...convertBody, ...override });

      expect(response.status).toBe(400);
    }
  });

  it('saves the personal fields on the new employee', async () => {
    const response = await request(app)
      .post('/api/applications/app-1/convert')
      .set('Authorization', token)
      .send(convertBody);

    expect(response.status).toBe(201);
    const [sql, values] = client.query.mock.calls.find(([text]) => text.includes('INSERT INTO employees'));
    expect(sql).toMatch(/date_of_birth, gender, id_number/);
    expect(values.slice(-3)).toEqual(['1999-03-15', 'MALE', '012345678901']);
  });
});
