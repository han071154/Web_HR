import {
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundPen,
  Users
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, clearSession, getStoredUser, getToken, setSession } from './api.js';

const emptyEmployee = {
  employeeCode: '',
  fullName: '',
  email: '',
  phone: '',
  gender: 'MALE',
  dateOfBirth: '',
  departmentId: '',
  position: '',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  hireDate: new Date().toISOString().slice(0, 10),
  baseSalary: 0,
  address: ''
};

const statusLabels = {
  ACTIVE: 'Đang làm',
  ON_LEAVE: 'Nghỉ phép',
  RESIGNED: 'Đã nghỉ',
  TERMINATED: 'Chấm dứt'
};

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@webhr.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const session = await api.login(email, password);
      setSession(session);
      onLogin(session.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-row">
          <div className="brand-mark">
            <Users size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">Web HR</p>
            <h1>Quản lý nhân sự</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Mật khẩu
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="primary-button" disabled={loading}>
            <ShieldCheck size={18} aria-hidden="true" />
            {loading ? 'Đang đăng nhập' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </main>
  );
}

function EmployeeForm({ departments, employee, onSubmit, onCancel }) {
  const [form, setForm] = useState(employee || emptyEmployee);

  useEffect(() => {
    setForm(employee || emptyEmployee);
  }, [employee]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === 'baseSalary' ? Number(value) : value
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      ...form,
      departmentId: form.departmentId || null,
      phone: form.phone || null,
      dateOfBirth: form.dateOfBirth || null,
      address: form.address || null
    });
  }

  return (
    <form className="employee-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Mã nhân viên
          <input value={form.employeeCode} onChange={(event) => updateField('employeeCode', event.target.value)} required />
        </label>
        <label>
          Họ tên
          <input value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} required />
        </label>
        <label>
          Email
          <input value={form.email} onChange={(event) => updateField('email', event.target.value)} type="email" required />
        </label>
        <label>
          Số điện thoại
          <input value={form.phone || ''} onChange={(event) => updateField('phone', event.target.value)} />
        </label>
        <label>
          Phòng ban
          <select value={form.departmentId || ''} onChange={(event) => updateField('departmentId', event.target.value)}>
            <option value="">Chưa phân phòng</option>
            {departments.map((department) => (
              <option value={department.id} key={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chức danh
          <input value={form.position} onChange={(event) => updateField('position', event.target.value)} required />
        </label>
        <label>
          Ngày vào làm
          <input value={form.hireDate?.slice(0, 10) || ''} onChange={(event) => updateField('hireDate', event.target.value)} type="date" required />
        </label>
        <label>
          Lương cơ bản
          <input value={form.baseSalary} onChange={(event) => updateField('baseSalary', event.target.value)} type="number" min="0" required />
        </label>
        <label>
          Giới tính
          <select value={form.gender || 'MALE'} onChange={(event) => updateField('gender', event.target.value)}>
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        <label>
          Trạng thái
          <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Loại hợp đồng
          <select value={form.employmentType} onChange={(event) => updateField('employmentType', event.target.value)}>
            <option value="FULL_TIME">Toàn thời gian</option>
            <option value="PART_TIME">Bán thời gian</option>
            <option value="CONTRACT">Hợp đồng</option>
            <option value="INTERN">Thực tập</option>
          </select>
        </label>
        <label>
          Ngày sinh
          <input value={form.dateOfBirth?.slice(0, 10) || ''} onChange={(event) => updateField('dateOfBirth', event.target.value)} type="date" />
        </label>
      </div>
      <label>
        Địa chỉ
        <textarea value={form.address || ''} onChange={(event) => updateField('address', event.target.value)} rows="3" />
      </label>
      <div className="form-actions">
        <button type="button" className="ghost-button" onClick={onCancel}>
          Hủy
        </button>
        <button type="submit" className="primary-button">
          <UserRoundPen size={18} aria-hidden="true" />
          {employee?.id ? 'Cập nhật' : 'Thêm nhân viên'}
        </button>
      </div>
    </form>
  );
}

function Dashboard({ user, onLogout }) {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const stats = useMemo(() => {
    const active = employees.filter((employee) => employee.status === 'ACTIVE').length;
    const payroll = employees.reduce((sum, employee) => sum + Number(employee.baseSalary || 0), 0);

    return {
      total: employees.length,
      active,
      departments: departments.length,
      payroll
    };
  }, [departments.length, employees]);

  const loadData = useCallback(async (nextFilters = { search, status }) => {
    setError('');
    setLoading(true);

    try {
      const [employeeResponse, departmentResponse] = await Promise.all([
        api.employees(nextFilters),
        api.departments()
      ]);
      setEmployees(employeeResponse.data);
      setDepartments(departmentResponse.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveEmployee(employee) {
    setError('');

    try {
      if (employee.id) {
        await api.updateEmployee(employee.id, employee);
      } else {
        await api.createEmployee(employee);
      }

      setShowForm(false);
      setEditingEmployee(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeEmployee(id) {
    setError('');

    try {
      await api.deleteEmployee(id);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  function beginCreate() {
    setEditingEmployee(null);
    setShowForm(true);
  }

  function beginEdit(employee) {
    setEditingEmployee(employee);
    setShowForm(true);
  }

  function handleLogout() {
    clearSession();
    onLogout();
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">
            <Users size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">Web HR</p>
            <strong>Nhân sự</strong>
          </div>
        </div>
        <nav>
          <a className="nav-item active" href="#employees">
            <Users size={18} aria-hidden="true" />
            Hồ sơ nhân sự
          </a>
          <a className="nav-item" href="#departments">
            <Building2 size={18} aria-hidden="true" />
            Phòng ban
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Xin chào, {user?.fullName || user?.email}</p>
            <h1>Dashboard nhân sự</h1>
          </div>
          <button type="button" className="icon-text-button" onClick={handleLogout} title="Đăng xuất">
            <LogOut size={18} aria-hidden="true" />
            Đăng xuất
          </button>
        </header>

        <section className="stats-grid">
          <article className="stat-card">
            <Users size={22} aria-hidden="true" />
            <span>Tổng nhân viên</span>
            <strong>{stats.total}</strong>
          </article>
          <article className="stat-card">
            <ShieldCheck size={22} aria-hidden="true" />
            <span>Đang làm</span>
            <strong>{stats.active}</strong>
          </article>
          <article className="stat-card">
            <BriefcaseBusiness size={22} aria-hidden="true" />
            <span>Phòng ban</span>
            <strong>{stats.departments}</strong>
          </article>
          <article className="stat-card">
            <CircleDollarSign size={22} aria-hidden="true" />
            <span>Quỹ lương</span>
            <strong>{formatMoney(stats.payroll)}</strong>
          </article>
        </section>

        <section className="content-panel" id="employees">
          <div className="section-header">
            <div>
              <p className="eyebrow">Employee records</p>
              <h2>Hồ sơ nhân sự</h2>
            </div>
            <button type="button" className="primary-button" onClick={beginCreate}>
              <Plus size={18} aria-hidden="true" />
              Thêm
            </button>
          </div>

          <div className="toolbar">
            <label className="search-field">
              <Search size={18} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên, mã, email"
              />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="button" className="icon-text-button" onClick={() => loadData({ search, status })}>
              <RefreshCw size={18} aria-hidden="true" />
              Lọc
            </button>
          </div>

          {error && <p className="form-error">{error}</p>}

          {showForm && (
            <EmployeeForm
              departments={departments}
              employee={editingEmployee}
              onSubmit={saveEmployee}
              onCancel={() => {
                setShowForm(false);
                setEditingEmployee(null);
              }}
            />
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Nhân viên</th>
                  <th>Phòng ban</th>
                  <th>Chức danh</th>
                  <th>Trạng thái</th>
                  <th>Lương</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7">Đang tải dữ liệu</td>
                  </tr>
                ) : employees.length ? (
                  employees.map((employee) => (
                    <tr key={employee.id}>
                      <td>{employee.employeeCode}</td>
                      <td>
                        <strong>{employee.fullName}</strong>
                        <span>{employee.email}</span>
                      </td>
                      <td>{employee.departmentName || 'Chưa phân phòng'}</td>
                      <td>{employee.position}</td>
                      <td>
                        <span className={`status-pill status-${employee.status.toLowerCase()}`}>
                          {statusLabels[employee.status] || employee.status}
                        </span>
                      </td>
                      <td>{formatMoney(employee.baseSalary)}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="icon-button" onClick={() => beginEdit(employee)} title="Sửa">
                            <UserRoundPen size={17} aria-hidden="true" />
                          </button>
                          <button type="button" className="icon-button danger" onClick={() => removeEmployee(employee.id)} title="Xóa">
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7">Chưa có nhân viên phù hợp</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
