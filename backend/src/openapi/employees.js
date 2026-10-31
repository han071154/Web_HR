import {
  dataOf,
  fileResponse,
  json,
  jsonBody,
  listOf,
  multipartBody,
  noContent,
  operation,
  pathParam,
  queryParam,
  ROLES,
  ref
} from './helpers.js';

const TAG = 'Employees';

export const tag = {
  name: TAG,
  description: 'Hồ sơ nhân sự, ảnh đại diện, nhập/xuất Excel, hồ sơ cá nhân / Employee records, avatars, Excel import/export, self profile'
};

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const filterParams = [
  queryParam('search', { type: 'string' }, 'Họ tên (không phân biệt dấu), mã nhân viên hoặc email'),
  queryParam('status', ref('EmployeeStatus')),
  queryParam('departmentId', { type: 'string', format: 'uuid' }),
  queryParam('position', { type: 'string' }, 'Tên chức vụ (khớp chính xác)')
];

const duplicateErrors = [
  'Employee code already exists',
  'Employee email already exists',
  'ID number already exists',
  'Related record does not exist or is still in use'
];

export const paths = {
  '/employees': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách nhân viên (phân trang) / List employees (paginated)',
      description:
        'HR_STAFF nhận bản rút gọn EmployeeForStaff (không có baseSalary, idNumber, dateOfBirth, address) để xếp ca.',
      roles: ROLES.HR,
      parameters: [
        ...filterParams,
        queryParam('page', { type: 'integer', minimum: 1, default: 1 }),
        queryParam('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 })
      ],
      responses: {
        200: json('Một trang nhân viên / One page of employees', {
          type: 'object',
          properties: {
            data: { type: 'array', items: { oneOf: [ref('Employee'), ref('EmployeeForStaff')] } },
            pagination: ref('Pagination')
          }
        })
      }
    }),
    post: operation({
      tag: TAG,
      summary: 'Tạo nhân viên / Create an employee',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('EmployeeInput')),
      responses: { 201: json('Đã tạo / Created', dataOf(ref('Employee'))) },
      errors: { 400: ['Validation error', 'Selected position does not exist'], 409: duplicateErrors }
    })
  },
  '/employees/me': {
    get: operation({
      tag: TAG,
      summary: 'Hồ sơ của chính mình (HR-011) / Own employee profile',
      roles: 'self',
      responses: { 200: json('Hồ sơ nhân viên', dataOf(ref('Employee'))) },
      errors: { 404: ['Employee not found'] }
    }),
    put: operation({
      tag: TAG,
      summary: 'Tự sửa số điện thoại, địa chỉ (HR-011) / Update own phone and address',
      description: 'Ghi lịch sử SELF_UPDATED. Gửi trường khác ngoài phone/address bị từ chối 400.',
      roles: 'self',
      requestBody: jsonBody(ref('SelfProfileUpdate')),
      responses: { 200: json('Đã cập nhật / Updated', dataOf(ref('Employee'))) },
      errors: { 404: ['Employee not found'] }
    })
  },
  '/employees/lookup': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách rút gọn mọi nhân viên / Lightweight lookup of all employees',
      description: 'Dùng cho ô chọn quản lý, gợi ý mã NV kế tiếp và lọc chức vụ; không phân trang.',
      roles: ROLES.MANAGERS,
      responses: { 200: json('Danh sách rút gọn', listOf(ref('EmployeeLookup'))) }
    })
  },
  '/employees/export': {
    get: operation({
      tag: TAG,
      summary: 'Xuất danh sách nhân sự ra Excel (HR-009) / Export employees to Excel',
      description:
        'Cùng bộ lọc với danh sách. Cột: Mã nhân viên, Họ tên, Email, Điện thoại, Giới tính, Ngày sinh, CCCD, '
        + 'Phòng ban, Chức vụ, Hình thức làm việc, Trạng thái, Ngày vào làm, Lương cơ bản, Địa chỉ.',
      roles: ROLES.MANAGERS,
      parameters: filterParams,
      responses: { 200: fileResponse('File .xlsx', [XLSX]) }
    })
  },
  '/employees/import': {
    post: operation({
      tag: TAG,
      summary: 'Nhập nhân sự từ Excel (HR-009) / Import employees from Excel',
      description:
        'Cùng cột với file xuất (cần dòng tiêu đề, thứ tự cột tùy ý). Mã NV đã có thì cập nhật, chưa có thì tạo mới; '
        + 'phòng ban/chức vụ khớp theo tên. Dòng lỗi được bỏ qua và báo trong errors (số dòng tính từ 1).',
      roles: ROLES.MANAGERS,
      requestBody: multipartBody({
        type: 'object',
        required: ['file'],
        properties: { file: { type: 'string', format: 'binary', description: 'File .xlsx, tối đa 10 MB' } }
      }),
      responses: { 200: json('Kết quả nhập / Import result', dataOf(ref('EmployeeImportResult'))) },
      errors: {
        400: ['Excel file is required in the file field', 'File must be an Excel .xlsx file', 'Excel file has no worksheet'],
        413: ['Excel file must not exceed 10 MB']
      }
    })
  },
  '/employees/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết nhân viên / Get an employee',
      roles: ROLES.MANAGERS,
      responses: { 200: json('Nhân viên', dataOf(ref('Employee'))) },
      errors: { 404: ['Employee not found'] }
    }),
    put: operation({
      tag: TAG,
      summary: 'Sửa nhân viên / Update an employee',
      description:
        'Gửi positionId để lấy chức vụ từ danh mục; chỉ gửi position (tên khác) thì bỏ liên kết danh mục. Ghi lịch sử UPDATED.',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('EmployeeUpdate')),
      responses: { 200: json('Đã cập nhật / Updated', dataOf(ref('Employee'))) },
      errors: {
        400: ['Validation error', 'An employee cannot be their own manager', 'Selected position does not exist'],
        404: ['Employee not found'],
        409: duplicateErrors
      }
    }),
    delete: operation({
      tag: TAG,
      summary: 'Xóa nhân viên / Delete an employee',
      description: 'Xóa luôn lịch sử thay đổi và ảnh đại diện.',
      roles: ROLES.MANAGERS,
      responses: { 204: noContent },
      errors: { 404: ['Employee not found'], 409: ['Related record does not exist or is still in use'] }
    })
  },
  '/employees/{id}/history': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Lịch sử thay đổi hồ sơ (mới nhất trước, tối đa 50) / Employee change history',
      description:
        'action: CREATED, UPDATED, SELF_UPDATED, AVATAR_UPDATED, AVATAR_REMOVED, CONTRACT_ADDED, CONTRACT_UPDATED, CONTRACT_DELETED.',
      roles: ROLES.MANAGERS,
      responses: { 200: json('Lịch sử', listOf(ref('AuditEntry'))) },
      errors: { 404: ['Employee not found'] }
    })
  },
  '/employees/{id}/avatar': {
    parameters: [pathParam()],
    post: operation({
      tag: TAG,
      summary: 'Tải ảnh đại diện / Upload avatar',
      description: 'multipart/form-data, field `avatar`: JPEG, PNG hoặc WebP, tối đa 5 MB. Trả nhân viên kèm avatarUrl tuyệt đối.',
      roles: ROLES.MANAGERS,
      requestBody: multipartBody({
        type: 'object',
        required: ['avatar'],
        properties: { avatar: { type: 'string', format: 'binary' } }
      }),
      responses: { 200: json('Đã cập nhật ảnh / Avatar updated', dataOf(ref('Employee'))) },
      errors: {
        400: ['Avatar file is required in the avatar field', 'Avatar must be a JPEG, PNG, or WebP image'],
        404: ['Employee not found'],
        413: ['Avatar must not exceed 5 MB']
      }
    }),
    delete: operation({
      tag: TAG,
      summary: 'Xóa ảnh đại diện / Remove avatar',
      roles: ROLES.MANAGERS,
      responses: { 204: noContent },
      errors: { 404: ['Employee not found'] }
    })
  }
};
