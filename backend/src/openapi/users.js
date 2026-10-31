import { dataOf, json, jsonBody, listOf, noContent, operation, pathParam, queryParam, ROLES, ref } from './helpers.js';

const TAG = 'Users';

export const tag = {
  name: TAG,
  description:
    'Quản lý tài khoản đăng nhập (HR-007, chỉ Admin): cấp, gán vai trò, liên kết hồ sơ, khóa, đặt lại mật khẩu / User account management (admin only)'
};

const sessionNote =
  'Khóa, đổi vai trò, đổi hồ sơ liên kết hoặc đặt lại mật khẩu sẽ đăng xuất người dùng ở mọi nơi. Mọi thay đổi ghi audit_logs (USER).';

export const paths = {
  '/users': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách tài khoản / List user accounts',
      roles: ROLES.ADMIN,
      parameters: [
        queryParam('search', { type: 'string' }, 'Họ tên (không dấu), email, mã nhân viên'),
        queryParam('role', ref('Role')),
        queryParam('status', { type: 'string', enum: ['active', 'locked'] }),
        queryParam('linked', { type: 'string', enum: ['yes', 'no'] }, 'Đã / chưa liên kết hồ sơ nhân viên'),
        queryParam('page', { type: 'integer', minimum: 1, default: 1 }),
        queryParam('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 })
      ],
      responses: {
        200: json('Một trang tài khoản', {
          type: 'object',
          properties: { data: { type: 'array', items: ref('UserAccount') }, pagination: ref('Pagination') }
        })
      }
    }),
    post: operation({
      tag: TAG,
      summary: 'Cấp tài khoản / Create a user account',
      description: 'Tài khoản EMPLOYEE phải liên kết hồ sơ nhân viên; mỗi hồ sơ / email chỉ một tài khoản.',
      roles: ROLES.ADMIN,
      requestBody: jsonBody(ref('UserCreate')),
      responses: { 201: json('Đã tạo / Created', dataOf(ref('UserAccount'))) },
      errors: {
        400: ['Validation error', 'Employee accounts must be linked to an employee profile', 'Full name is required'],
        404: ['Employee not found'],
        409: ['Account email already exists', 'This employee already has a linked account']
      }
    })
  },
  '/users/employee-options': {
    get: operation({
      tag: TAG,
      summary: 'Nhân viên để liên kết tài khoản / Employees for the link picker',
      description: 'Mọi nhân viên kèm linkedUserId / linkedUserEmail nếu đã có tài khoản.',
      roles: ROLES.ADMIN,
      responses: { 200: json('Danh sách nhân viên', listOf(ref('EmployeeOption'))) }
    })
  },
  '/users/bulk': {
    post: operation({
      tag: TAG,
      summary: 'Cấp tài khoản EMPLOYEE hàng loạt / Bulk-create employee accounts',
      description:
        'Email = email hồ sơ (chữ thường), mật khẩu tạm ngẫu nhiên 10 ký tự chỉ trả về một lần trong created[].password. '
        + 'Hồ sơ không cấp được nằm trong skipped kèm reason.',
      roles: ROLES.ADMIN,
      requestBody: jsonBody({
        type: 'object',
        required: ['employeeIds'],
        properties: {
          employeeIds: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'string', format: 'uuid' } }
        }
      }),
      responses: { 200: json('Kết quả / Result', dataOf(ref('BulkUserResult'))) }
    })
  },
  '/users/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết tài khoản kèm lịch sử / Get a user account with history',
      roles: ROLES.ADMIN,
      responses: { 200: json('Tài khoản', dataOf(ref('UserAccountDetail'))) },
      errors: { 400: ['Validation error'], 404: ['User not found'] }
    }),
    patch: operation({
      tag: TAG,
      summary: 'Sửa / khóa / mở khóa tài khoản / Update, lock or unlock an account',
      description: sessionNote,
      roles: ROLES.ADMIN,
      requestBody: jsonBody(ref('UserUpdate')),
      responses: { 200: json('Đã cập nhật / Updated', dataOf(ref('UserAccount'))) },
      errors: {
        400: ['Validation error', 'Nothing to update', 'Employee accounts must be linked to an employee profile'],
        404: ['User not found', 'Employee not found'],
        409: [
          'You cannot lock or change the role of your own account',
          'At least one active admin account is required',
          'This employee already has a linked account'
        ]
      }
    })
  },
  '/users/{id}/reset-password': {
    parameters: [pathParam()],
    post: operation({
      tag: TAG,
      summary: 'Đặt lại mật khẩu / Reset a password',
      description: sessionNote,
      roles: ROLES.ADMIN,
      requestBody: jsonBody({
        type: 'object',
        required: ['newPassword'],
        properties: {
          newPassword: { type: 'string', minLength: 8, maxLength: 72, description: 'Có cả chữ và số' }
        }
      }),
      responses: { 204: noContent },
      errors: { 404: ['User not found'], 409: ['Use change password for your own account'] }
    })
  }
};
