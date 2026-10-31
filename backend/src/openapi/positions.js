import { dataOf, json, jsonBody, listOf, noContent, operation, pathParam, queryParam, ROLES, ref } from './helpers.js';

const TAG = 'Positions';

export const tag = { name: TAG, description: 'Danh mục chức vụ / Position catalog' };

export const paths = {
  '/positions': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách chức vụ / List positions',
      roles: ROLES.HR,
      parameters: [
        queryParam('departmentId', { type: 'string', format: 'uuid' }, 'Lọc theo phòng ban'),
        queryParam('active', { type: 'string', enum: ['true', 'false'] }, 'Lọc theo trạng thái hoạt động')
      ],
      responses: { 200: json('Danh sách chức vụ', listOf(ref('Position'))) }
    }),
    post: operation({
      tag: TAG,
      summary: 'Tạo chức vụ / Create a position',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('PositionInput')),
      responses: { 201: json('Đã tạo / Created', dataOf(ref('Position'))) },
      errors: { 409: ['Position code already exists', 'Related record does not exist or is still in use'] }
    })
  },
  '/positions/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết chức vụ / Get a position',
      roles: ROLES.HR,
      responses: { 200: json('Chức vụ', dataOf(ref('Position'))) },
      errors: { 404: ['Position not found'] }
    }),
    put: operation({
      tag: TAG,
      summary: 'Sửa chức vụ / Update a position',
      description: 'Đổi tên chức vụ thì cập nhật luôn tên chức vụ trên hồ sơ các nhân viên đang giữ chức vụ này.',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('PositionUpdate')),
      responses: { 200: json('Đã cập nhật / Updated', dataOf(ref('Position'))) },
      errors: { 404: ['Position not found'], 409: ['Position code already exists'] }
    }),
    delete: operation({
      tag: TAG,
      summary: 'Xóa chức vụ / Delete a position',
      roles: ROLES.MANAGERS,
      responses: { 204: noContent },
      errors: { 404: ['Position not found'], 409: ['Position still has employees'] }
    })
  }
};
