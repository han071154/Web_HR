const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

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

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
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
