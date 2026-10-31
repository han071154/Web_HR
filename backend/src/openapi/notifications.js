import { dataOf, json, operation, pathParam, queryParam, ref } from './helpers.js';

const TAG = 'Notifications';

export const tag = {
  name: TAG,
  description:
    'Thông báo trong ứng dụng (HR-034): kết quả duyệt đổi ca, nghỉ phép; mỗi người chỉ thấy thông báo của mình / In-app notifications for the current user'
};

export const paths = {
  '/notifications/me': {
    get: operation({
      tag: TAG,
      summary: 'Thông báo của tôi / My notifications',
      description: 'Mới nhất trước. meta.unreadCount là tổng số chưa đọc (không phụ thuộc limit).',
      roles: 'any',
      parameters: [
        queryParam('unreadOnly', { type: 'string', enum: ['true', 'false'], default: 'false' }, 'Chỉ lấy thông báo chưa đọc'),
        queryParam('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 })
      ],
      responses: {
        200: json('Danh sách thông báo', {
          type: 'object',
          required: ['data', 'meta'],
          properties: {
            data: { type: 'array', items: ref('Notification') },
            meta: { type: 'object', properties: { unreadCount: { type: 'integer' } } }
          }
        })
      },
      validation: true
    })
  },
  '/notifications/me/read-all': {
    post: operation({
      tag: TAG,
      summary: 'Đánh dấu tất cả đã đọc / Mark all as read',
      roles: 'any',
      responses: {
        200: json('Số thông báo vừa được đánh dấu', dataOf({
          type: 'object',
          properties: { updated: { type: 'integer' } }
        }))
      }
    })
  },
  '/notifications/{id}/read': {
    parameters: [pathParam()],
    patch: operation({
      tag: TAG,
      summary: 'Đánh dấu một thông báo đã đọc / Mark one notification as read',
      description: 'Thông báo không thuộc về người gọi cũng trả 404.',
      roles: 'any',
      responses: { 200: json('Thông báo', dataOf(ref('Notification'))) },
      errors: { 400: ['Validation error'], 404: ['Notification not found'] }
    })
  }
};
