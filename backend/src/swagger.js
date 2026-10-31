import * as applications from './openapi/applications.js';
import * as attendance from './openapi/attendance.js';
import * as auth from './openapi/auth.js';
import { components } from './openapi/components.js';
import * as contracts from './openapi/contracts.js';
import * as departments from './openapi/departments.js';
import * as employees from './openapi/employees.js';
import * as jobPostings from './openapi/jobPostings.js';
import * as leaveRequests from './openapi/leaveRequests.js';
import * as notifications from './openapi/notifications.js';
import * as positions from './openapi/positions.js';
import * as publicJobs from './openapi/publicJobs.js';
import * as reports from './openapi/reports.js';
import * as users from './openapi/users.js';
import * as workSchedules from './openapi/workSchedules.js';
import * as workShifts from './openapi/workShifts.js';

// Tài liệu OpenAPI cho toàn bộ API, viết tay trong thư mục openapi/ (mỗi nhóm API một file, schema dùng chung
// ở openapi/components.js). Không cần kết nối DB: chỉ là object thuần, được Swagger UI (/api/docs) và
// script `npm run docs:openapi` (xuất ra docs/openapi.json) dùng chung.
const modules = [
  auth,
  publicJobs,
  departments,
  positions,
  employees,
  contracts,
  jobPostings,
  applications,
  workShifts,
  workSchedules,
  attendance,
  leaveRequests,
  reports,
  users,
  notifications
];

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Web HR API',
    version: '0.1.0',
    description: [
      'Tài liệu API tổng hợp của Web HR / Complete Web HR API reference.',
      '',
      '- Mọi route trừ `/auth/login`, `/auth/refresh`, `/health` và `/public/*` cần header '
        + '`Authorization: Bearer <token>` / All routes except login, refresh, health and `/public/*` require a bearer token.',
      '- Response thành công dạng `{ "data": ... }`; lỗi dạng `{ "message": "...", "details"?: [...] }` '
        + '/ Success responses use `{ data }`, errors use `{ message, details? }`.',
      '- Trường DATE trả về `YYYY-MM-DD`; id sai định dạng UUID trả `400 Invalid identifier or database value`.',
      '- Vai trò / Roles: ADMIN, HR_MANAGER, HR_STAFF, EMPLOYEE. Vai trò được phép ghi ở đầu mô tả mỗi endpoint.'
    ].join('\n')
  },
  servers: [{ url: '/api', description: 'Cùng máy chủ backend / Same origin as the backend' }],
  tags: [{ name: 'Health', description: 'Kiểm tra máy chủ / Health check' }, ...modules.map((module) => module.tag)],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Kiểm tra máy chủ và CSDL / Health check (server + database)',
        description: 'Công khai, không cần đăng nhập. Docker healthcheck và scripts/deploy.sh dùng route này. '
          + '/ Public, no authentication; used by the Docker healthcheck and the deploy script.',
        security: [],
        responses: {
          200: {
            description: 'Máy chủ và CSDL hoạt động / Server and database are up',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string', example: 'web-hr-api' },
                    database: { type: 'string', example: 'ok' },
                    dbLatencyMs: { type: 'integer', example: 2 },
                    uptimeSeconds: { type: 'integer', example: 3600 }
                  }
                }
              }
            }
          },
          503: {
            description: 'Không kết nối được CSDL / Database unreachable',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'degraded' },
                    service: { type: 'string', example: 'web-hr-api' },
                    database: { type: 'string', example: 'unreachable' }
                  }
                }
              }
            }
          }
        }
      }
    },
    ...Object.assign({}, ...modules.map((module) => module.paths))
  },
  components
};
