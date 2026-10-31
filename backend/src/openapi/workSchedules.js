import {
  dataOf,
  dateQuery,
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

const TAG = 'Work Schedules';

export const tag = {
  name: TAG,
  description: 'Lịch phân ca và yêu cầu đổi ca / Work schedules and shift change requests'
};

const scheduleConflicts = [
  'Employee already has a shift scheduled for this date',
  'Weekly work hour limit exceeded (max 48h/week)'
];
const weeklyLimitNote =
  'Mỗi nhân viên một ca / ngày; tổng giờ trong tuần ISO (T2–CN) không vượt MAX_WEEKLY_WORK_HOURS (mặc định 48).';

export const paths = {
  '/work-schedules': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách lịch phân ca / List schedules',
      roles: ROLES.HR,
      parameters: [
        queryParam('employeeId', { type: 'string', format: 'uuid' }),
        queryParam(
          'employeeIds',
          { type: 'string' },
          'Danh sách UUID cách nhau dấu phẩy (tối đa 200) — chỉ lấy lịch của các nhân viên này, kèm lịch của nhân viên không còn ACTIVE'
        ),
        queryParam('departmentId', { type: 'string', format: 'uuid' }),
        dateQuery('from'),
        dateQuery('to')
      ],
      responses: { 200: json('Danh sách lịch', listOf(ref('WorkSchedule'))) },
      validation: true
    }),
    post: operation({
      tag: TAG,
      summary: 'Xếp một ca / Create a schedule entry',
      description: weeklyLimitNote,
      roles: ROLES.HR,
      requestBody: jsonBody(ref('WorkScheduleInput')),
      responses: { 201: json('Đã tạo / Created', dataOf(ref('WorkSchedule'))) },
      errors: { 400: ['Validation error', 'Selected shift does not exist'], 409: scheduleConflicts }
    })
  },
  '/work-schedules/bulk': {
    post: operation({
      tag: TAG,
      summary: 'Xếp ca hàng loạt / Bulk assign shifts',
      description: `1–200 phần tử. Phần tử lỗi bị bỏ qua và báo trong errors, không chặn cả lô. ${weeklyLimitNote}`,
      roles: ROLES.HR,
      requestBody: jsonBody({
        type: 'object',
        required: ['assignments'],
        properties: {
          assignments: {
            type: 'array',
            minItems: 1,
            maxItems: 200,
            items: {
              type: 'object',
              required: ['employeeId', 'shiftId', 'workDate'],
              properties: {
                employeeId: { type: 'string', format: 'uuid' },
                shiftId: { type: 'string', format: 'uuid' },
                workDate: { type: 'string', format: 'date' },
                notes: { type: 'string', maxLength: 2000, nullable: true }
              }
            }
          }
        }
      }),
      responses: { 201: json('Kết quả / Result', dataOf(ref('ScheduleBatchResult'))) }
    })
  },
  '/work-schedules/copy-previous-week': {
    post: operation({
      tag: TAG,
      summary: 'Sao chép lịch tuần trước / Copy the previous week',
      description:
        'Chép mọi lịch SCHEDULED của 7 ngày trước weekStartDate sang ngày tương ứng tuần sau; xung đột bị bỏ qua như /bulk.',
      roles: ROLES.HR,
      requestBody: jsonBody({
        type: 'object',
        required: ['weekStartDate'],
        properties: {
          weekStartDate: { type: 'string', format: 'date', example: '2026-10-19' },
          departmentId: { type: 'string', format: 'uuid', nullable: true }
        }
      }),
      responses: { 201: json('Kết quả / Result', dataOf(ref('ScheduleBatchResult'))) }
    })
  },
  '/work-schedules/me': {
    get: operation({
      tag: TAG,
      summary: 'Lịch làm việc của tôi / My schedule',
      roles: 'self',
      parameters: [dateQuery('from'), dateQuery('to')],
      responses: { 200: json('Lịch của tôi', listOf(ref('WorkSchedule'))) }
    })
  },
  '/work-schedules/me/register': {
    post: operation({
      tag: TAG,
      summary: 'Tự đăng ký ca trống / Register myself for a shift',
      description: weeklyLimitNote,
      roles: 'self',
      requestBody: jsonBody({
        type: 'object',
        required: ['shiftId', 'workDate'],
        properties: { shiftId: { type: 'string', format: 'uuid' }, workDate: { type: 'string', format: 'date' } }
      }),
      responses: { 201: json('Đã đăng ký / Registered', dataOf(ref('WorkSchedule'))) },
      errors: { 400: ['Validation error', 'Selected shift does not exist'], 409: scheduleConflicts }
    })
  },
  '/work-schedules/me/change-requests': {
    get: operation({
      tag: TAG,
      summary: 'Yêu cầu đổi ca của tôi / My shift change requests',
      description: 'Mới nhất trước; from/to lọc theo ngày làm của lịch.',
      roles: 'self',
      parameters: [dateQuery('from'), dateQuery('to'), queryParam('status', ref('RequestStatus'))],
      responses: { 200: json('Danh sách yêu cầu', listOf(ref('ShiftChangeRequest'))) },
      validation: true
    })
  },
  '/work-schedules/{scheduleId}/change-requests': {
    parameters: [pathParam('scheduleId', 'UUID lịch phân ca của chính mình')],
    post: operation({
      tag: TAG,
      summary: 'Gửi yêu cầu đổi ca / Request a shift change',
      roles: 'self',
      requestBody: jsonBody({
        type: 'object',
        properties: {
          requestedShiftId: { type: 'string', format: 'uuid', nullable: true },
          reason: { type: 'string', maxLength: 2000, nullable: true }
        }
      }),
      responses: {
        201: json('Đã gửi / Created', dataOf({
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: ['PENDING'] } }
        }))
      },
      errors: {
        403: ['You can only request a change for your own schedule'],
        404: ['Schedule not found'],
        409: ['A change request for this shift is already pending']
      }
    })
  },
  '/work-schedules/change-requests': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách yêu cầu đổi ca / List shift change requests',
      roles: ROLES.HR,
      parameters: [queryParam('status', ref('RequestStatus'))],
      responses: { 200: json('Danh sách yêu cầu', listOf(ref('ShiftChangeRequest'))) }
    })
  },
  '/work-schedules/change-requests/{id}': {
    parameters: [pathParam()],
    patch: operation({
      tag: TAG,
      summary: 'Duyệt / từ chối yêu cầu đổi ca / Review a shift change request',
      description:
        'Duyệt kèm requestedShiftId thì đổi ca của lịch gốc (kiểm tra lại giới hạn giờ/tuần). '
        + 'Nhân viên nhận thông báo SHIFT_CHANGE_APPROVED / SHIFT_CHANGE_REJECTED (xem tag Notifications).',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('ReviewDecision')),
      responses: { 200: json('Đã duyệt / Reviewed', dataOf(ref('ShiftChangeRequest'))) },
      errors: {
        404: ['Shift change request not found'],
        409: ['This request has already been reviewed', 'Weekly work hour limit exceeded (max 48h/week)']
      }
    })
  },
  '/work-schedules/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết lịch phân ca / Get a schedule entry',
      roles: ROLES.HR,
      responses: { 200: json('Lịch phân ca', dataOf(ref('WorkSchedule'))) },
      errors: { 404: ['Schedule not found'] }
    }),
    put: operation({
      tag: TAG,
      summary: 'Sửa lịch phân ca / Update a schedule entry',
      description: weeklyLimitNote,
      roles: ROLES.HR,
      requestBody: jsonBody(ref('WorkScheduleUpdate')),
      responses: { 200: json('Đã cập nhật / Updated', dataOf(ref('WorkSchedule'))) },
      errors: {
        400: ['Validation error', 'Selected shift does not exist'],
        404: ['Schedule not found'],
        409: scheduleConflicts
      }
    }),
    delete: operation({
      tag: TAG,
      summary: 'Xóa lịch phân ca / Delete a schedule entry',
      roles: ROLES.HR,
      responses: { 204: noContent },
      errors: { 404: ['Schedule not found'], 409: ['Related record does not exist or is still in use'] }
    })
  }
};
