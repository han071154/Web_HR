import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Chỉ quét annotation @openapi trong routes/auth.routes.js — task #68 là tài liệu API Auth.
// Các nhóm API khác đã có docs/API.md viết tay (xem docs/ARCHITECTURE.md).
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Web HR API - Auth',
      version: '0.1.0',
      description:
        'Tài liệu OpenAPI cho nhóm API xác thực (/api/auth). Các nhóm API còn lại xem docs/API.md.'
    },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  },
  apis: [path.join(__dirname, 'routes', 'auth.routes.js')]
});
