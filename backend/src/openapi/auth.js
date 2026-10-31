import { json, jsonBody, operation, ref } from './helpers.js';

const TAG = 'Auth';

export const tag = {
  name: TAG,
  description: 'Xác thực: đăng nhập, làm mới token, đổi mật khẩu / Authentication: login, token refresh, change password'
};

const rateLimitNote = 'Giới hạn 20 lần / 15 phút / IP (chung cho login và refresh) / Rate-limited to 20 requests per 15 minutes per IP.';

export const paths = {
  '/auth/login': {
    post: operation({
      tag: TAG,
      summary: 'Đăng nhập bằng email và mật khẩu / Log in',
      description: rateLimitNote,
      roles: 'public',
      requestBody: jsonBody(ref('LoginRequest')),
      responses: { 200: json('Đăng nhập thành công / Logged in', ref('LoginResponse')) },
      errors: {
        401: ['Email or password is incorrect'],
        429: ['Too many login attempts, please try again later']
      }
    })
  },
  '/auth/refresh': {
    post: operation({
      tag: TAG,
      summary: 'Lấy access token mới bằng refresh token / Refresh the access token',
      description: `${rateLimitNote} Refresh token cấp trước lần đổi/đặt lại mật khẩu, khóa tài khoản hoặc đổi vai trò bị từ chối.`,
      roles: 'public',
      requestBody: jsonBody({
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } }
      }),
      responses: {
        200: json('Access token mới / New access token', { type: 'object', properties: { token: { type: 'string' } } })
      },
      errors: {
        401: ['Invalid or expired refresh token'],
        429: ['Too many login attempts, please try again later']
      }
    })
  },
  '/auth/me': {
    get: operation({
      tag: TAG,
      summary: 'Thông tin người dùng đang đăng nhập / Current user',
      description: 'Trả về nội dung access token / Returns the decoded access token payload.',
      roles: 'any',
      responses: {
        200: json('Người dùng hiện tại / Current user', { type: 'object', properties: { user: ref('TokenPayload') } })
      }
    })
  },
  '/auth/change-password': {
    post: operation({
      tag: TAG,
      summary: 'Đổi mật khẩu của chính mình (HR-027) / Change own password',
      description:
        'Trả token + refreshToken mới cho phiên hiện tại; các phiên khác bị đăng xuất. '
        + 'Giới hạn 10 lần / 15 phút / tài khoản / Limited to 10 attempts per 15 minutes per account.',
      roles: 'any',
      requestBody: jsonBody(ref('ChangePasswordRequest')),
      responses: {
        200: json('Đã đổi mật khẩu / Password changed', {
          type: 'object',
          properties: { token: { type: 'string' }, refreshToken: { type: 'string' } }
        })
      },
      errors: {
        400: ['Validation error', 'Current password is incorrect', 'New password must be different from the current password'],
        429: ['Too many password change attempts, please try again later']
      }
    })
  }
};
