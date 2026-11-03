import express from 'express';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config.js';

// CV của ứng viên được lưu thẳng vào CSDL (applications.cv_data) thay vì đĩa cục bộ: file ghi ra đĩa bị
// mất khi backend chạy trên môi trường không có đĩa bền vững giữa các lần gọi (serverless, nhiều instance,
// redeploy) — nguyên nhân lỗi "Không tìm thấy file CV trên máy chủ" dù hồ sơ vẫn còn trong CSDL.
vi.mock('../../db.js', () => ({ query: vi.fn(), pool: {} }));

const { query } = await import('../../db.js');
const { requireAuth } = await import('../../middleware/auth.js');
const { isPdfBuffer } = await import('../../middleware/cvUpload.js');
const { default: publicJobsRouter } = await import('../publicJobs.routes.js');
const { default: applicationsRouter } = await import('../applications.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/jobs', publicJobsRouter);
  app.use('/api/applications', requireAuth, applicationsRouter);
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ZodError' ? 400 : 500);
    res.status(status).json({ message: error.name === 'ZodError' ? 'Validation error' : error.message });
  });
  return app;
}

const app = createApp();
const hrToken = `Bearer ${jwt.sign({ sub: 'user-1', email: 'hr@webhr.local', fullName: 'HR', role: 'HR_MANAGER' }, config.jwtSecret)}`;
const PDF_BYTES = Buffer.from('%PDF-1.4\n% nội dung CV giả lập cho test\n');

function mockJobAndApplicationQueries() {
  query.mockImplementation(async (sql) => {
    if (sql.includes('FROM job_postings j')) {
      return { rows: [{ id: 'job-1', title: 'Backend Developer', is_open: true }] };
    }

    if (sql.includes('FROM applications') && sql.includes('status <> ')) {
      return { rows: [] }; // chưa có hồ sơ trùng
    }

    if (sql.startsWith('INSERT INTO applications')) {
      return { rows: [{ id: 'app-1', application_no: 42, status: 'NEW', created_at: '2026-11-03T00:00:00.000Z' }] };
    }

    if (sql.startsWith('INSERT INTO audit_logs')) {
      return { rows: [] };
    }

    return { rows: [] };
  });
}

describe('isPdfBuffer', () => {
  it('accepts a buffer that starts with the PDF signature', () => {
    expect(isPdfBuffer(PDF_BYTES)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isPdfBuffer(Buffer.from('not a pdf'))).toBe(false);
    expect(isPdfBuffer(Buffer.alloc(0))).toBe(false);
    expect(isPdfBuffer(null)).toBe(false);
  });
});

describe('POST /api/public/jobs/:id/applications stores the CV content in the database', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('saves the uploaded PDF bytes as cv_data, not a path to a local file', async () => {
    mockJobAndApplicationQueries();

    const response = await request(app)
      .post('/api/public/jobs/job-1/applications')
      .field('fullName', 'Nguyễn Văn Test')
      .field('email', 'cv-test@example.com')
      .field('phone', '0912345678')
      .field('consent', 'true')
      .attach('cv', PDF_BYTES, 'cv.pdf');

    expect(response.status).toBe(201);
    const insertCall = query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO applications'));
    expect(insertCall).toBeDefined();
    const [, values] = insertCall;
    const cvData = values[5];
    expect(Buffer.isBuffer(cvData)).toBe(true);
    expect(cvData.equals(PDF_BYTES)).toBe(true);
  });

  it('rejects a file that is not really a PDF, even with a .pdf name and mimetype', async () => {
    mockJobAndApplicationQueries();

    const response = await request(app)
      .post('/api/public/jobs/job-1/applications')
      .field('fullName', 'Nguyễn Văn Test')
      .field('email', 'fake-pdf@example.com')
      .field('phone', '0912345678')
      .field('consent', 'true')
      .attach('cv', Buffer.from('plain text pretending to be a pdf'), { filename: 'cv.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('CV must be a PDF file');
    expect(query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO applications'))).toBe(false);
  });
});

describe('GET /api/applications/:id/cv serves the CV from the database', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('streams cv_data with the right content type and a safe download name', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('FROM applications a')) {
        return {
          rows: [
            {
              id: 'app-1',
              application_no: 42,
              cv_original_name: 'CV ứng viên.pdf',
              viewed_at: '2026-11-01T00:00:00.000Z'
            }
          ]
        };
      }

      if (sql === 'SELECT cv_data FROM applications WHERE id = $1') {
        return { rows: [{ cv_data: PDF_BYTES }] };
      }

      return { rows: [] };
    });

    const response = await request(app).get('/api/applications/app-1/cv').set('Authorization', hrToken).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/pdf/);
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain(encodeURIComponent('CV ứng viên.pdf'));
    expect(response.body.equals(PDF_BYTES)).toBe(true);
  });

  // Hồ sơ nộp trước khi CV được lưu vào CSDL (chỉ có cv_path, không có cv_data): vẫn đọc được nếu file
  // trên đĩa còn nguyên (vd Docker Compose có volume bền vững).
  describe('legacy applications without cv_data', () => {
    const legacyFileName = 'legacy-test-cv.pdf';
    const legacyFilePath = `${config.cvUploadDir}/${legacyFileName}`;

    afterAll(() => {
      fs.rmSync(legacyFilePath, { force: true });
    });

    it('falls back to the file on disk when it still exists', async () => {
      fs.mkdirSync(config.cvUploadDir, { recursive: true });
      fs.writeFileSync(legacyFilePath, PDF_BYTES);

      query.mockImplementation(async (sql) => {
        if (sql.includes('FROM applications a')) {
          return { rows: [{ id: 'app-legacy', application_no: 7, cv_path: legacyFileName, cv_original_name: null, viewed_at: '2026-11-01T00:00:00.000Z' }] };
        }

        if (sql === 'SELECT cv_data FROM applications WHERE id = $1') {
          return { rows: [{ cv_data: null }] };
        }

        return { rows: [] };
      });

      const response = await request(app).get('/api/applications/app-legacy/cv').set('Authorization', hrToken);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/pdf/);
    });

    it('returns 404 when there is neither cv_data nor a file on disk', async () => {
      query.mockImplementation(async (sql) => {
        if (sql.includes('FROM applications a')) {
          return { rows: [{ id: 'app-gone', application_no: 8, cv_path: 'does-not-exist.pdf', cv_original_name: null, viewed_at: '2026-11-01T00:00:00.000Z' }] };
        }

        if (sql === 'SELECT cv_data FROM applications WHERE id = $1') {
          return { rows: [{ cv_data: null }] };
        }

        return { rows: [] };
      });

      const response = await request(app).get('/api/applications/app-gone/cv').set('Authorization', hrToken);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('CV file not found');
    });
  });
});
