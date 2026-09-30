import { networkErrorMessage, toVietnameseError } from './messages.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

const TOKEN_KEY = 'web_hr_token';
const USER_KEY = 'web_hr_user';

// "Ghi nhớ đăng nhập": lưu phiên vào localStorage (giữ sau khi tắt trình duyệt),
// không ghi nhớ thì lưu vào sessionStorage (mất khi đóng tab).
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setSession(session, remember = true) {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, session.token);
  storage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
  }
}

export function getStoredUser() {
  const value = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  return value ? JSON.parse(value) : null;
}

async function request(path, options = {}) {
  // Gửi file (FormData) thì để trình duyệt tự đặt Content-Type kèm boundary.
  const headers = options.body instanceof FormData
    ? { ...options.headers }
    : { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error(networkErrorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // Token hết hạn khi đang dùng: xóa phiên và đưa người dùng về trang đăng nhập.
    if (response.status === 401 && path !== '/auth/login') {
      clearSession();
      unauthorizedHandler?.();
    }

    const error = new Error(toVietnameseError(response.status, payload));
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  departments: () => request('/departments'),
  createDepartment: (department) =>
    request('/departments', {
      method: 'POST',
      body: JSON.stringify(department)
    }),
  updateDepartment: (id, department) =>
    request(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(department)
    }),
  deleteDepartment: (id) =>
    request(`/departments/${id}`, {
      method: 'DELETE'
    }),
  positions: () => request('/positions'),
  createPosition: (position) =>
    request('/positions', {
      method: 'POST',
      body: JSON.stringify(position)
    }),
  updatePosition: (id, position) =>
    request(`/positions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(position)
    }),
  deletePosition: (id) =>
    request(`/positions/${id}`, {
      method: 'DELETE'
    }),
  employees: (params = {}) => {
    const search = new URLSearchParams(params);
    return request(`/employees?${search.toString()}`);
  },
  createEmployee: (employee) =>
    request('/employees', {
      method: 'POST',
      body: JSON.stringify(employee)
    }),
  updateEmployee: (id, employee) =>
    request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employee)
    }),
  deleteEmployee: (id) =>
    request(`/employees/${id}`, {
      method: 'DELETE'
    }),
  uploadEmployeeAvatar: (id, file) => {
    const body = new FormData();
    body.append('avatar', file);
    return request(`/employees/${id}/avatar`, {
      method: 'POST',
      body
    });
  },
  // Trang tuyển dụng công khai (không cần đăng nhập).
  publicJobs: () => request('/public/jobs'),
  publicJob: (id) => request(`/public/jobs/${id}`),
  applyJob: (id, application, cvFile) => {
    const body = new FormData();

    for (const [key, value] of Object.entries(application)) {
      body.append(key, value);
    }

    body.append('cv', cvFile);
    return request(`/public/jobs/${id}/applications`, {
      method: 'POST',
      body
    });
  },
  contracts: (params = {}) => {
    const search = new URLSearchParams(params);
    return request(`/contracts?${search.toString()}`);
  }
};
