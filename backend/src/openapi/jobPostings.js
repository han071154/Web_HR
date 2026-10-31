import { dataOf, json, jsonBody, listOf, noContent, operation, pathParam, queryParam, ROLES, ref } from './helpers.js';

const TAG = 'Job Postings';

export const tag = { name: TAG, description: 'Quản lý tin tuyển dụng (HR) / Job posting management (HR)' };

const statusSchema = { type: 'string', enum: ['DRAFT', 'OPEN', 'CLOSED'] };
const saveErrors = {
  400: ['Validation error', 'Deadline must be today or later to open a job posting'],
  409: ['Job posting code already exists', 'Related record does not exist or is still in use']
};

export const paths = {
  '/jobs': {
    get: operation({
      tag: TAG,
      summary: 'Danh sách tin tuyển dụng / List job postings',
      roles: ROLES.MANAGERS,
      parameters: [
        queryParam('search', { type: 'string' }, 'Tiêu đề hoặc mã tin'),
        queryParam('status', statusSchema),
        queryParam('departmentId', { type: 'string', format: 'uuid' })
      ],
      responses: { 200: json('Danh sách tin', listOf(ref('JobPosting'))) }
    }),
    post: operation({
      tag: TAG,
      summary: 'Tạo tin tuyển dụng / Create a job posting',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('JobPostingInput')),
      responses: { 201: json('Đã tạo / Created', dataOf(ref('JobPosting'))) },
      errors: saveErrors
    })
  },
  '/jobs/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết tin tuyển dụng / Get a job posting',
      roles: ROLES.MANAGERS,
      responses: { 200: json('Tin tuyển dụng', dataOf(ref('JobPosting'))) },
      errors: { 404: ['Job posting not found'] }
    }),
    put: operation({
      tag: TAG,
      summary: 'Sửa tin tuyển dụng / Update a job posting',
      roles: ROLES.MANAGERS,
      requestBody: jsonBody(ref('JobPostingUpdate')),
      responses: { 200: json('Đã cập nhật / Updated', dataOf(ref('JobPosting'))) },
      errors: { ...saveErrors, 404: ['Job posting not found'] }
    }),
    delete: operation({
      tag: TAG,
      summary: 'Xóa tin tuyển dụng / Delete a job posting',
      description: 'Tin đã có hồ sơ thì không xóa được, đặt status = CLOSED thay vào đó.',
      roles: ROLES.MANAGERS,
      responses: { 204: noContent },
      errors: { 404: ['Job posting not found'], 409: ['Job posting still has applications'] }
    })
  }
};
