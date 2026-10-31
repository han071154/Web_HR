import { dataOf, json, listOf, multipartBody, operation, pathParam, queryParam, ref } from './helpers.js';

const TAG = 'Public Jobs';

export const tag = {
  name: TAG,
  description: 'Trang tuyển dụng công khai, không cần đăng nhập / Public careers page, no login required'
};

export const paths = {
  '/public/jobs': {
    get: operation({
      tag: TAG,
      summary: 'Tin tuyển dụng đang mở / Open job postings',
      description: 'Chỉ tin OPEN còn hạn nộp. salaryMin/salaryMax null nghĩa là lương thỏa thuận.',
      roles: 'public',
      parameters: [
        queryParam('search', { type: 'string' }, 'Tìm theo tiêu đề'),
        queryParam('departmentId', { type: 'string', format: 'uuid' }),
        queryParam('employmentType', ref('EmploymentType'))
      ],
      responses: { 200: json('Danh sách tin', listOf(ref('PublicJobSummary'))) }
    })
  },
  '/public/jobs/{id}': {
    parameters: [pathParam()],
    get: operation({
      tag: TAG,
      summary: 'Chi tiết tin tuyển dụng / Job posting detail',
      description: 'Tin đã đóng/hết hạn vẫn trả về với isOpen = false; tin nháp trả 404.',
      roles: 'public',
      responses: { 200: json('Chi tiết tin', dataOf(ref('PublicJobDetail'))) },
      errors: { 404: ['Job posting not found'] }
    })
  },
  '/public/jobs/{id}/applications': {
    parameters: [pathParam()],
    post: operation({
      tag: TAG,
      summary: 'Nộp hồ sơ ứng tuyển / Submit an application',
      description:
        'multipart/form-data. Một email chỉ nộp lại cùng tin khi hồ sơ trước đã REJECTED. Mỗi IP tối đa 10 hồ sơ / giờ.',
      roles: 'public',
      requestBody: multipartBody(ref('PublicApplicationForm')),
      responses: { 201: json('Đã nhận hồ sơ / Application received', dataOf(ref('PublicApplicationResult'))) },
      errors: {
        400: ['Validation error', 'CV file is required', 'CV must be a PDF file'],
        404: ['Job posting not found'],
        409: ['Job posting is closed', 'You have already applied for this job'],
        413: ['CV must not exceed 5 MB'],
        429: ['Too many applications, please try again later']
      }
    })
  }
};
