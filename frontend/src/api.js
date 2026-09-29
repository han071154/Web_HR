import { networkErrorMessage, toVietnameseError } from './messages.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function getToken() {
  return localStorage.getItem('web_hr_token');
}

export function setSession(session) {
  localStorage.setItem('web_hr_token', session.token);
  localStorage.setItem('web_hr_user', JSON.stringify(session.user));
}

export function clearSession() {
  localStorage.removeItem('web_hr_token');
  localStorage.removeItem('web_hr_user');
}

export function getStoredUser() {
  const value = localStorage.getItem('web_hr_user');
  return value ? JSON.parse(value) : null;
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
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
    })
};
