import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swaggerSpec } from '../src/swagger.js';

// Xuất tài liệu OpenAPI (cùng nội dung với Swagger UI ở /api/docs) ra docs/openapi.json để import vào
// Postman, Insomnia hoặc công cụ sinh client. Không cần DB. Chạy: npm run docs:openapi --workspace backend
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, '..', '..', 'docs', 'openapi.json');

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(swaggerSpec, null, 2)}\n`, 'utf8');

const operationCount = Object.values(swaggerSpec.paths).reduce(
  (count, item) => count + Object.keys(item).filter((key) => key !== 'parameters').length,
  0
);
console.log(`Wrote ${operationCount} operations (${Object.keys(swaggerSpec.paths).length} paths) to ${outputPath}`);
