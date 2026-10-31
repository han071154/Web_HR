import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

// Tài liệu OpenAPI (src/openapi/*) viết tay nên dễ lệch khỏi code: test này đi qua router.stack của từng file
// routes và bắt buộc mỗi route (method + path) phải có trong swaggerSpec. Spec được phép có thêm endpoint.
vi.mock('../db.js', () => ({ query: vi.fn(), pool: {} }));

const { swaggerSpec } = await import('../swagger.js');

// Tiền tố mount trong server.js (servers[0].url của spec là /api nên bỏ /api khi so sánh).
const ROUTE_PREFIXES = {
  'auth.routes.js': '/api/auth',
  'publicJobs.routes.js': '/api/public/jobs',
  'departments.routes.js': '/api/departments',
  'employees.routes.js': '/api/employees',
  'positions.routes.js': '/api/positions',
  'contracts.routes.js': '/api/contracts',
  'jobPostings.routes.js': '/api/jobs',
  'applications.routes.js': '/api/applications',
  'workShifts.routes.js': '/api/work-shifts',
  'workSchedules.routes.js': '/api/work-schedules',
  'attendance.routes.js': '/api/attendance-records',
  'leaveRequests.routes.js': '/api/leave-requests',
  'reports.routes.js': '/api/reports',
  'users.routes.js': '/api/users',
  'notifications.routes.js': '/api/notifications'
};

const routesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'routes');
const SERVER_BASE = swaggerSpec.servers[0].url;

function toSpecPath(prefix, routePath) {
  const full = `${prefix}${routePath === '/' ? '' : routePath}`.replace(/:(\w+)/g, '{$1}');
  return full.startsWith(SERVER_BASE) ? full.slice(SERVER_BASE.length) : full;
}

async function collectRoutes() {
  const routes = [];

  for (const [file, prefix] of Object.entries(ROUTE_PREFIXES)) {
    const filePath = path.join(routesDir, file);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    const { default: router } = await import(pathToFileURL(filePath).href);

    for (const layer of router.stack) {
      if (!layer.route) {
        continue;
      }

      for (const method of Object.keys(layer.route.methods)) {
        routes.push({ file, method, path: toSpecPath(prefix, layer.route.path) });
      }
    }
  }

  return routes;
}

// Import các file routes ở top-level (giai đoạn collect của vitest) vì exceljs/pdf nạp chậm, vượt timeout 5s của it().
const registeredRoutes = await collectRoutes();

describe('OpenAPI spec (swaggerSpec)', () => {
  it('has a mount prefix for every routes file', () => {
    const files = fs.readdirSync(routesDir).filter((file) => file.endsWith('.routes.js'));

    expect(files.filter((file) => !ROUTE_PREFIXES[file])).toEqual([]);
  });

  it('documents every route registered in src/routes', () => {
    const missing = registeredRoutes
      .filter((route) => !swaggerSpec.paths[route.path]?.[route.method])
      .map((route) => `${route.method.toUpperCase()} ${route.path} (${route.file})`);

    expect(registeredRoutes.length).toBeGreaterThan(80);
    expect(missing).toEqual([]);
  });

  it('only references schemas that exist in components', () => {
    const refs = JSON.stringify(swaggerSpec).match(/#\/components\/schemas\/[A-Za-z]+/g) || [];
    const unknown = [...new Set(refs)]
      .map((value) => value.split('/').pop())
      .filter((name) => !swaggerSpec.components.schemas[name]);

    expect(unknown).toEqual([]);
  });

  it('secures every non-public operation with bearerAuth and lists roles', () => {
    const problems = [];

    for (const [specPath, item] of Object.entries(swaggerSpec.paths)) {
      for (const [method, operation] of Object.entries(item)) {
        if (method === 'parameters') {
          continue;
        }

        const isPublic = specPath === '/health' || specPath.startsWith('/public/')
          || specPath === '/auth/login' || specPath === '/auth/refresh';
        const secured = operation.security?.some((requirement) => 'bearerAuth' in requirement);

        if (isPublic === Boolean(secured) || !operation.tags?.length || !operation.responses) {
          problems.push(`${method.toUpperCase()} ${specPath}`);
        }

        if (!isPublic && !/Roles:/.test(operation.description)) {
          problems.push(`${method.toUpperCase()} ${specPath} (roles)`);
        }

        // Mỗi {param} trong path phải được khai báo là path parameter.
        const declared = [...(item.parameters || []), ...(operation.parameters || [])]
          .filter((parameter) => parameter.in === 'path')
          .map((parameter) => parameter.name);

        for (const [, name] of specPath.matchAll(/\{(\w+)\}/g)) {
          if (!declared.includes(name)) {
            problems.push(`${method.toUpperCase()} ${specPath} (path param ${name})`);
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
