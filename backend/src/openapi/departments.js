import { dataOf, json, jsonBody, listOf, noContent, operation, pathParam, ROLES, ref } from './helpers.js';

const TAG = 'Departments';

export const tag = { name: TAG, description: 'Phòng ban / Departments' };

export const paths = {
  '/departments': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách phòng ban / List departments',
      description: 'Sắp xếp theo tên, kèm employeeCount.',
      roles: ROLES.HR,
      responses: { 200: json('Danh sách phòng ban', listOf(ref('Department'))) }
    }),
    post: operation({
      tag: TAG,
      summary: 'Tạo phòng ban / Create a department',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('DepartmentInput')),
      responses: { 201: json('Đã tạo / Created', dataOf(ref('Department'))) },
      errors: { 409: ['Department name already exists'] }
    })
  },
  '/departments/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết phòng ban / Get a department',
      roles: ROLES.HR,
      responses: { 200: json('Phòng ban', dataOf(ref('Department'))) },
      errors: { 404: ['Department not found'] }
    }),
    put: operation({
      tag: TAG,
      summary: 'Sửa phòng ban / Update a department',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('DepartmentUpdate')),
      responses: { 200: json('Đã cập nhật / Updated', dataOf(ref('Department'))) },
      errors: { 404: ['Department not found'], 409: ['Department name already exists'] }
    }),
    delete: operation({
      tag: TAG,
      summary: 'Xóa phòng ban / Delete a department',
      description: 'Phòng còn nhân viên thì không xóa được; chuyển nhân viên sang phòng khác trước.',
      roles: ROLES.MANAGERS,
      responses: { 204: noContent },
      errors: { 404: ['Department not found'], 409: ['Department still has employees'] }
    })
  }
};
