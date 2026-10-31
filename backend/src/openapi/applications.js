import {
  dataOf,
  fileResponse,
  json,
  jsonBody,
  listOf,
  noContent,
  operation,
  pathParam,
  queryParam,
  ROLES,
  ref
} from './helpers.js';

const TAG = 'Applications';

export const tag = {
  name: TAG,
  description:
    'Hồ sơ ứng viên (HR): NEW → REVIEWING → INTERVIEW → HIRED / REJECTED, chuyển thành nhân sự / Candidate applications and conversion to employees'
};

export const paths = {
  '/applications': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách hồ sơ ứng viên / List applications',
      roles: ROLES.MANAGERS,
      parameters: [
        queryParam('jobId', { type: 'string', format: 'uuid' }),
        queryParam('status', ref('ApplicationStatus')),
        queryParam('search', { type: 'string' }, 'Tên, email, số điện thoại hoặc mã hồ sơ (HS-000123 hoặc 123)')
      ],
      responses: { 200: json('Danh sách hồ sơ', listOf(ref('Application'))) }
    })
  },
  '/applications/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết hồ sơ kèm lịch sử / Application detail with history',
      description:
        'Lần mở đầu tiên đánh dấu viewedAt. history.action: SUBMITTED, STATUS_CHANGED, INTERVIEW_SCHEDULED, NOTE_UPDATED, CONVERTED.',
      roles: ROLES.MANAGERS,
      responses: { 200: json('Hồ sơ', dataOf(ref('ApplicationDetail'))) },
      errors: { 404: ['Application not found'] }
    }),
    patch: operation({
      tag: TAG,
      summary: 'Đổi trạng thái, lịch phỏng vấn, ghi chú / Update status, interview time, note',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('ApplicationUpdate')),
      responses: { 200: json('Đã cập nhật / Updated', dataOf(ref('Application'))) },
      errors: {
        400: ['Validation error', 'Interview time is required for interview status'],
        404: ['Application not found'],
        409: ['Converted application status cannot be changed']
      }
    }),
    delete: operation({
      tag: TAG,
      summary: 'Xóa hồ sơ (BUG-05) / Delete an application',
      description: 'Xóa hồ sơ, lịch sử và file CV. Hồ sơ đã chuyển thành nhân viên thì không xóa được.',
      roles: ROLES.MANAGERS,
      responses: { 204: noContent },
      errors: {
        404: ['Application not found'],
        409: ['Cannot delete an application that has already been converted to an employee']
      }
    })
  },
  '/applications/{id}/cv': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Tải file CV (PDF) / Download the CV',
      description: 'Mặc định tải về (attachment); thêm `?inline=1` để xem trực tiếp trong trình duyệt.',
      roles: ROLES.MANAGERS,
      parameters: [queryParam('inline', { type: 'string', example: '1' }, 'Có giá trị thì trả inline')],
      responses: { 200: fileResponse('File PDF', ['application/pdf']) },
      errors: { 404: ['Application not found', 'CV file not found'] }
    })
  },
  '/applications/{id}/convert': {
    parameters: [pathParam()],
    post: operation({
      tag: TAG,
      summary: 'Chuyển hồ sơ Đậu thành nhân sự (M-08e) / Convert a hired application into an employee',
      description:
        'Trong một transaction: tạo nhân viên (tên, email, SĐT từ hồ sơ), hợp đồng ACTIVE đầu tiên '
        + '(HDLD-<employeeCode>-<năm>) và liên kết hồ sơ với nhân viên.',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('ApplicationConvert')),
      responses: { 201: json('Đã chuyển / Converted', dataOf(ref('Application'))) },
      errors: {
        400: ['Validation error', 'Selected position does not exist'],
        404: ['Application not found'],
        409: [
          'Only passed applications can be converted',
          'Application has already been converted',
          'Employee code already exists',
          'Employee email already exists'
        ]
      }
    })
  }
};
