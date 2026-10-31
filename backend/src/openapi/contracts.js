import { dataOf, json, jsonBody, listOf, noContent, operation, pathParam, queryParam, ROLES, ref } from './helpers.js';

const TAG = 'Contracts';

export const tag = { name: TAG, description: 'Hợp đồng lao động / Employment contracts' };

const conflicts = [
  'Employee already has an active contract',
  'Contract number already exists',
  'Related record does not exist or is still in use'
];

export const paths = {
  '/contracts': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách hợp đồng / List contracts',
      roles: ROLES.MANAGERS,
      parameters: [
        queryParam('employeeId', { type: 'string', format: 'uuid' }),
        queryParam('status', ref('ContractStatus')),
        queryParam('search', { type: 'string' }, 'Số hợp đồng, mã hoặc tên nhân viên')
      ],
      responses: { 200: json('Danh sách hợp đồng', listOf(ref('Contract'))) }
    }),
    post: operation({
      tag: TAG,
      summary: 'Tạo hợp đồng / Create a contract',
      description: 'Ghi lịch sử CONTRACT_ADDED vào hồ sơ nhân viên.',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('ContractInput')),
      responses: { 201: json('Đã tạo / Created', dataOf(ref('Contract'))) },
      errors: { 409: conflicts }
    })
  },
  '/contracts/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết hợp đồng / Get a contract',
      roles: ROLES.MANAGERS,
      responses: { 200: json('Hợp đồng', dataOf(ref('Contract'))) },
      errors: { 404: ['Employment contract not found'] }
    }),
    put: operation({
      tag: TAG,
      summary: 'Sửa hợp đồng / Update a contract',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('ContractUpdate')),
      responses: { 200: json('Đã cập nhật / Updated', dataOf(ref('Contract'))) },
      errors: { 404: ['Employment contract not found'], 409: conflicts }
    }),
    delete: operation({
      tag: TAG,
      summary: 'Xóa hợp đồng / Delete a contract',
      roles: ROLES.MANAGERS,
      responses: { 204: noContent },
      errors: { 404: ['Employment contract not found'] }
    })
  }
};
