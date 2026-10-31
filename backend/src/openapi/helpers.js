// Hàm dựng sẵn cho tài liệu OpenAPI viết tay (thay cho quét JSDoc @openapi của swagger-jsdoc):
// mỗi file trong thư mục này export `paths` của một nhóm API, dùng chung các helper bên dưới.

export const ROLES = {
  ADMIN: ['ADMIN'],
  MANAGERS: ['ADMIN', 'HR_MANAGER'],
  HR: ['ADMIN', 'HR_MANAGER', 'HR_STAFF']
};

export function ref(name) {
  return { $ref: `#/components/schemas/${name}` };
}

export function dataOf(schema) {
  return { type: 'object', required: ['data'], properties: { data: schema } };
}

export function listOf(schema) {
  return dataOf({ type: 'array', items: schema });
}

export function json(description, schema) {
  return { description, content: { 'application/json': { schema } } };
}

export function jsonBody(schema, required = true) {
  return { required, content: { 'application/json': { schema } } };
}

export function multipartBody(schema) {
  return { required: true, content: { 'multipart/form-data': { schema } } };
}

export function fileResponse(description, mimeTypes) {
  return {
    description,
    headers: {
      'Content-Disposition': { schema: { type: 'string' }, description: 'attachment; filename="..."' }
    },
    content: Object.fromEntries(mimeTypes.map((mime) => [mime, { schema: { type: 'string', format: 'binary' } }]))
  };
}

export const noContent = { description: 'Thành công, không có nội dung / Success, no content' };

export function pathParam(name = 'id', description = 'UUID') {
  return { in: 'path', name, required: true, schema: { type: 'string', format: 'uuid' }, description };
}

export function queryParam(name, schema, description, required = false) {
  return { in: 'query', name, required, schema, ...(description ? { description } : {}) };
}

export const dateQuery = (name, description, required = false) =>
  queryParam(name, { type: 'string', format: 'date', example: '2026-10-12' }, description, required);

const STATUS_TEXT = {
  400: 'Dữ liệu không hợp lệ / Bad request',
  401: 'Chưa đăng nhập hoặc token không hợp lệ / Unauthorized',
  403: 'Không đủ quyền / Forbidden',
  404: 'Không tìm thấy / Not found',
  409: 'Xung đột dữ liệu / Conflict',
  413: 'File quá lớn / Payload too large',
  429: 'Gọi quá nhiều lần / Too many requests'
};

const DEFAULT_MESSAGES = {
  400: ['Validation error'],
  401: ['Missing authorization token', 'Invalid or expired token'],
  403: ['You do not have permission to perform this action']
};

// Một response lỗi { message, details? }; messages là các message cụ thể route có thể trả.
export function errorResponse(status, messages = DEFAULT_MESSAGES[status] || []) {
  const list = messages.map((message) => `\`${message}\``).join(', ');
  const response = {
    description: list ? `${STATUS_TEXT[status]}: ${list}` : STATUS_TEXT[status],
    content: { 'application/json': { schema: ref('Error') } }
  };

  if (messages.length) {
    response.content['application/json'].example = { message: messages[0] };
  }

  return response;
}

function rolesText(roles) {
  if (roles === 'public') {
    return 'Công khai, không cần đăng nhập / Public, no authentication.';
  }

  if (roles === 'any') {
    return 'Vai trò / Roles: mọi tài khoản đã đăng nhập / any authenticated role.';
  }

  if (roles === 'self') {
    return 'Vai trò / Roles: mọi tài khoản đã đăng nhập có liên kết hồ sơ nhân viên / '
      + 'any authenticated role linked to an employee profile (`409 This account is not linked to an employee profile` otherwise).';
  }

  return `Vai trò / Roles: ${roles.join(', ')}.`;
}

// Dựng một operation: tự thêm bearerAuth, dòng vai trò vào description và các lỗi 400/401/403 thường gặp.
// errors: { 404: ['Department not found'], 409: [...] }; validation: false nếu route không kiểm tra body/query.
export function operation({
  tag,
  summary,
  description,
  roles,
  parameters,
  requestBody,
  responses,
  errors = {},
  validation = Boolean(requestBody)
}) {
  const isPublic = roles === 'public';
  const allErrors = { ...errors };

  if (validation && !allErrors[400]) {
    allErrors[400] = DEFAULT_MESSAGES[400];
  }

  if (!isPublic && !allErrors[401]) {
    allErrors[401] = DEFAULT_MESSAGES[401];
  }

  if (Array.isArray(roles) && !allErrors[403]) {
    allErrors[403] = DEFAULT_MESSAGES[403];
  }

  if (roles === 'self') {
    allErrors[409] = [...(allErrors[409] || []), 'This account is not linked to an employee profile'];
  }

  const result = {
    tags: [tag],
    summary,
    description: [rolesText(roles), description].filter(Boolean).join('\n\n'),
    security: isPublic ? [] : [{ bearerAuth: [] }]
  };

  if (parameters?.length) {
    result.parameters = parameters;
  }

  if (requestBody) {
    result.requestBody = requestBody;
  }

  result.responses = { ...responses };

  for (const status of Object.keys(allErrors).sort()) {
    result.responses[status] = errorResponse(Number(status), allErrors[status]);
  }

  return result;
}
