import { dataOf, json, jsonBody, listOf, noContent, operation, pathParam, queryParam, ROLES, ref } from './helpers.js';

const TAG = 'Work Shifts';

export const tag = { name: TAG, description: 'Ca làm việc / Work shifts' };

export const paths = {
  '/work-shifts': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách ca làm việc / List work shifts',
      description: 'Sắp xếp theo giờ bắt đầu.',
      roles: 'any',
      parameters: [queryParam('active', { type: 'string', enum: ['true'] }, '`true` để chỉ lấy ca đang hoạt động')],
      responses: { 200: json('Danh sách ca', listOf(ref('WorkShift'))) }
    }),
    post: operation({
      tag: TAG,
      summary: 'Tạo ca làm việc / Create a work shift',
      roles: ROLES.HR,
      requestBody: jsonBody(ref('WorkShiftInput')),
      responses: { 201: json('Đã tạo / Created', dataOf(ref('WorkShift'))) },
      errors: { 409: ['Shift code already exists'] }
    })
  },
  '/work-shifts/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết ca làm việc / Get a work shift',
      roles: 'any',
      responses: { 200: json('Ca làm việc', dataOf(ref('WorkShift'))) },
      errors: { 404: ['Work shift not found'] }
    }),
    put: operation({
      tag: TAG,
      summary: 'Sửa ca làm việc / Update a work shift',
      roles: ROLES.HR,
      requestBody: jsonBody(ref('WorkShiftUpdate')),
      responses: { 200: json('Đã cập nhật / Updated', dataOf(ref('WorkShift'))) },
      errors: { 404: ['Work shift not found'], 409: ['Shift code already exists'] }
    }),
    delete: operation({
      tag: TAG,
      summary: 'Xóa ca làm việc / Delete a work shift',
      description: 'Ca đã dùng trong lịch phân ca thì không xóa được, đặt isActive = false thay vào đó.',
      roles: ROLES.HR,
      responses: { 204: noContent },
      errors: {
        404: ['Work shift not found'],
        409: ['This shift is already used in a schedule; deactivate it instead of deleting']
      }
    })
  }
};
