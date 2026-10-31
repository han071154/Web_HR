import { dataOf, json, jsonBody, listOf, operation, pathParam, queryParam, ROLES, ref } from './helpers.js';

const TAG = 'Leave Requests';

export const tag = { name: TAG, description: 'Đơn nghỉ phép / Leave requests' };

export const paths = {
  '/leave-requests/me': {
    get: operation({
      tag: TAG,
      summary: 'Đơn nghỉ phép của tôi / My leave requests',
      roles: 'self',
      responses: { 200: json('Danh sách đơn', listOf(ref('LeaveRequest'))) }
    })
  },
  '/leave-requests': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách đơn nghỉ phép / List leave requests',
      roles: ROLES.HR,
      parameters: [
        queryParam('employeeId', { type: 'string', format: 'uuid' }),
        queryParam('status', ref('RequestStatus'))
      ],
      responses: { 200: json('Danh sách đơn', listOf(ref('LeaveRequest'))) }
    }),
    post: operation({
      tag: TAG,
      summary: 'Gửi đơn nghỉ phép / Submit a leave request',
      description:
        'Ngày nghỉ = T2–T6 cộng T7/CN mà nhân viên có ca SCHEDULED. Khoảng ngày không có ngày nghỉ nào bị từ chối. Đơn mới ở trạng thái PENDING.',
      roles: 'self',
      requestBody: jsonBody(ref('LeaveRequestInput')),
      responses: { 201: json('Đã gửi / Created', dataOf(ref('LeaveRequest'))) },
      errors: { 400: ['Validation error', 'The selected dates have no working days'] }
    })
  },
  '/leave-requests/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết đơn nghỉ phép / Get a leave request',
      roles: ROLES.HR,
      responses: { 200: json('Đơn nghỉ phép', dataOf(ref('LeaveRequest'))) },
      errors: { 404: ['Leave request not found'] }
    }),
    patch: operation({
      tag: TAG,
      summary: 'Duyệt / từ chối đơn nghỉ phép / Review a leave request',
      description:
        'Duyệt thì ghi mỗi ngày nghỉ là ON_LEAVE trong attendance-records (ngày ABSENT chưa có giờ vào/ra cũng chuyển thành ON_LEAVE). '
        + 'Nhân viên nhận thông báo LEAVE_APPROVED / LEAVE_REJECTED (xem tag Notifications).',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('ReviewDecision')),
      responses: { 200: json('Đã duyệt / Reviewed', dataOf(ref('LeaveRequest'))) },
      errors: { 404: ['Leave request not found'], 409: ['This leave request has already been reviewed'] }
    })
  }
};
