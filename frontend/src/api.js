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

  // blob: true khi tải file (CV) cần gửi kèm token, không mở thẳng bằng link được.
  const { blob, ...fetchOptions } = options;
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers
    });
  } catch {
    throw new Error(networkErrorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  if (blob && response.ok) {
    return response.blob();
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
  // Danh sách rút gọn, không phân trang: ô chọn quản lý, gợi ý mã NV, danh sách chức vụ tự do.
  employeesLookup: () => request('/employees/lookup'),
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
  employeeHistory: (id) => request(`/employees/${id}/history`),
  // HR-009: xuất/nhập danh sách nhân sự bằng Excel.
  exportEmployees: (params = {}) => {
    const search = new URLSearchParams(params);
    return request(`/employees/export?${search.toString()}`, { blob: true });
  },
  importEmployees: (file) => {
    const body = new FormData();
    body.append('file', file);
    return request('/employees/import', { method: 'POST', body });
  },
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
  // Quản lý tuyển dụng phía HR.
  jobs: () => request('/jobs'),
  createJob: (job) =>
    request('/jobs', {
      method: 'POST',
      body: JSON.stringify(job)
    }),
  updateJob: (id, job) =>
    request(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(job)
    }),
  deleteJob: (id) =>
    request(`/jobs/${id}`, {
      method: 'DELETE'
    }),
  applications: (params = {}) => {
    const search = new URLSearchParams(params);
    return request(`/applications?${search.toString()}`);
  },
  updateApplication: (id, changes) =>
    request(`/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes)
    }),
  // Chi tiết hồ sơ kèm lịch sử; mở lần đầu thì backend đánh dấu đã xem.
  application: (id) => request(`/applications/${id}`),
  convertApplication: (id, employee) =>
    request(`/applications/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(employee)
    }),
  // BUG-05: xoá hồ sơ ứng viên (chỉ hồ sơ chưa chuyển thành nhân sự).
  deleteApplication: (id) =>
    request(`/applications/${id}`, {
      method: 'DELETE'
    }),
  // inline = true để xem trước trong trang, false để tải xuống.
  applicationCv: (id, inline = false) => request(`/applications/${id}/cv${inline ? '?inline=1' : ''}`, { blob: true }),
  contracts: (params = {}) => {
    const search = new URLSearchParams(params);
    return request(`/contracts?${search.toString()}`);
  },
  createContract: (contract) =>
    request('/contracts', {
      method: 'POST',
      body: JSON.stringify(contract)
    }),
  updateContract: (id, contract) =>
    request(`/contracts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(contract)
    }),
  deleteContract: (id) =>
    request(`/contracts/${id}`, {
      method: 'DELETE'
    })
};
