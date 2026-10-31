import { dataOf, dateQuery, json, jsonBody, listOf, operation, pathParam, queryParam, ROLES, ref } from './helpers.js';

const TAG = 'Attendance';

export const tag = { name: TAG, description: 'Chấm công / Attendance' };

const workHoursNote =
  'Giờ công = (checkOut − checkIn) − giờ nghỉ giữa ca (breakMinutes của ca, hoặc DEFAULT_BREAK_MINUTES khi không có lịch); '
  + 'chỉ trừ khi có mặt quá nửa khung giờ ca. OT = phần vượt giờ chuẩn của ca (hoặc DEFAULT_STANDARD_WORK_HOURS).';

export const paths = {
  '/attendance-records/check-in': {
    post: operation({
      tag: TAG,
      summary: 'Chấm công vào / Check in',
      description:
        'Tra lịch phân ca hôm nay (múi giờ APP_TIMEZONE): không có lịch → PRESENT; vào trễ hơn giờ bắt đầu ca quá '
        + 'LATE_THRESHOLD_MINUTES (mặc định 15) → LATE. Trả 201 khi tạo bản ghi mới, 200 khi cập nhật bản ghi có sẵn của hôm nay.',
      roles: 'self',
      responses: {
        200: json('Đã cập nhật bản ghi có sẵn / Existing record updated', dataOf(ref('AttendanceRecord'))),
        201: json('Đã chấm công vào / Checked in', dataOf(ref('AttendanceRecord')))
      },
      errors: { 409: ['Already checked in today'] }
    })
  },
  '/attendance-records/check-out': {
    post: operation({
      tag: TAG,
      summary: 'Chấm công ra / Check out',
      roles: 'self',
      responses: { 200: json('Đã chấm công ra / Checked out', dataOf(ref('AttendanceRecord'))) },
      errors: { 409: ['You have not checked in today', 'Already checked out today'] }
    })
  },
  '/attendance-records/me': {
    get: operation({
      tag: TAG,
      summary: 'Lịch sử chấm công của tôi / My attendance records',
      roles: 'self',
      parameters: [dateQuery('from'), dateQuery('to')],
      responses: { 200: json('Bản ghi chấm công, mới nhất trước', listOf(ref('AttendanceRecord'))) }
    })
  },
  '/attendance-records/monthly-summary': {
    get: operation({
      tag: TAG,
      summary: 'Tổng hợp công theo tháng / Monthly work-hour summary',
      description: workHoursNote,
      roles: ROLES.HR,
      parameters: [
        queryParam('month', { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', example: '2026-10' }, 'YYYY-MM', true),
        queryParam('employeeId', { type: 'string', format: 'uuid' }),
        queryParam('departmentId', { type: 'string', format: 'uuid' })
      ],
      responses: {
        200: json('Tổng hợp theo nhân viên', {
          type: 'object',
          properties: {
            data: { type: 'array', items: ref('WorkHourStat') },
            meta: {
              type: 'object',
              properties: {
                month: { type: 'string', example: '2026-10' },
                from: { type: 'string', format: 'date' },
                to: { type: 'string', format: 'date' }
              }
            }
          }
        })
      },
      validation: true
    })
  },
  '/attendance-records/mark-absent': {
    post: operation({
      tag: TAG,
      summary: 'Chốt vắng cho một ngày đã qua / Mark absences for a past date',
      description:
        'Tạo bản ghi ABSENT cho mọi lịch phân ca SCHEDULED của ngày đó mà chưa có bản ghi chấm công. '
        + 'date phải trước hôm nay.',
      roles: ROLES.HR,
      requestBody: jsonBody(ref('MarkAbsentRequest')),
      responses: { 200: json('Kết quả / Result', dataOf(ref('MarkAbsentResult'))) }
    })
  },
  '/attendance-records': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách chấm công / List attendance records',
      description:
        'Có page hoặc limit thì phân trang ở máy chủ và trả thêm pagination { page, limit, total }; không có thì trả hết.',
      roles: ROLES.HR,
      parameters: [
        queryParam('employeeId', { type: 'string', format: 'uuid' }),
        queryParam('departmentId', { type: 'string', format: 'uuid' }),
        queryParam('status', ref('AttendanceStatus')),
        dateQuery('from'),
        dateQuery('to'),
        queryParam('page', { type: 'integer', minimum: 1, default: 1 }),
        queryParam('limit', { type: 'integer', minimum: 1, maximum: 200, default: 50 })
      ],
      responses: {
        200: json('Danh sách bản ghi', {
          type: 'object',
          properties: {
            data: { type: 'array', items: ref('AttendanceRecord') },
            pagination: {
              type: 'object',
              description: 'Chỉ có khi gửi page/limit',
              properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' } }
            }
          }
        })
      }
    })
  },
  '/attendance-records/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết bản ghi chấm công / Get an attendance record',
      roles: ROLES.HR,
      responses: { 200: json('Bản ghi', dataOf(ref('AttendanceRecord'))) },
      errors: { 404: ['Attendance record not found'] }
    }),
    put: operation({
      tag: TAG,
      summary: 'Sửa chấm công thủ công / Correct an attendance record',
      description: 'Dùng khi quên chấm công vào/ra hoặc sai trạng thái. Ghi nhật ký CORRECTED.',
      roles: ROLES.HR,
      requestBody: jsonBody(ref('AttendanceCorrection')),
      responses: { 200: json('Đã cập nhật / Updated', dataOf(ref('AttendanceRecord'))) },
      errors: {
        400: ['Validation error', 'Check-in and check-out must be on the attendance date', 'Check-out must be after check-in'],
        404: ['Attendance record not found']
      }
    })
  }
};
