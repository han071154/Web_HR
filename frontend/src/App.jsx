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
import { api, clearSession, getStoredUser, getToken, setSession, setUnauthorizedHandler } from './api.js';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import DepartmentsPanel from './components/DepartmentsPanel.jsx';
import PositionsPanel from './components/PositionsPanel.jsx';
import EmployeeDetail from './components/EmployeeDetail.jsx';
import Toast from './components/Toast.jsx';
import { formatMoney, initials, roleLabels, statusLabels, toDateInputValue } from './format.js';

// Chỉ các vai trò này được xóa nhân viên (khớp với backend).
const DELETE_ROLES = ['ADMIN', 'HR_MANAGER'];

const VIEWS = ['employees', 'departments', 'positions'];

const pageTitles = {
  employees: { title: 'Danh sách nhân sự', subtitle: 'Quản lý hồ sơ nhân viên của công ty' },
  departments: { title: 'Phòng ban', subtitle: 'Quản lý danh mục phòng ban' },
  positions: { title: 'Chức vụ', subtitle: 'Quản lý danh mục chức vụ' }
};

function viewFromHash() {
  const view = window.location.hash.slice(1);
  return VIEWS.includes(view) ? view : 'employees';
}

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
            <Users size={22} aria-hidden="true" />
          </div>
          <span className="brand-name">WebHR</span>
        </div>
        <h1 style={{ marginTop: 28 }}>Đăng nhập</h1>
        <p className="page-subtitle">Dùng tài khoản được cấp để quản lý nhân sự và ca làm.</p>

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

function toFormState(employee) {
  if (!employee) {
    return emptyEmployee;
  }

  return {
    ...employee,
    dateOfBirth: toDateInputValue(employee.dateOfBirth),
    hireDate: toDateInputValue(employee.hireDate)
  };
}

function EmployeeForm({ departments, employee, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => toFormState(employee));

  useEffect(() => {
    setForm(toFormState(employee));
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
          <input value={form.hireDate || ''} onChange={(event) => updateField('hireDate', event.target.value)} type="date" required />
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
          <input value={form.dateOfBirth || ''} onChange={(event) => updateField('dateOfBirth', event.target.value)} type="date" />
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
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [deletingEmployee, setDeletingEmployee] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [view, setView] = useState(viewFromHash);
  const canDelete = DELETE_ROLES.includes(user?.role);

  const showToast = useCallback((type, message) => {
    setToast({ id: Date.now(), type, message });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

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

  useEffect(() => {
    // Menu bên trái đổi trang qua #employees / #departments / #positions trên URL.
    function handleHashChange() {
      setView(viewFromHash());
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  async function saveEmployee(employee) {
    setError('');

    try {
      if (employee.id) {
        await api.updateEmployee(employee.id, employee);
        showToast('success', `Đã cập nhật hồ sơ ${employee.fullName}.`);
      } else {
        await api.createEmployee(employee);
        showToast('success', `Đã thêm nhân viên ${employee.fullName}.`);
      }

      setShowForm(false);
      setEditingEmployee(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete() {
    const employee = deletingEmployee;
    setDeleting(true);

    try {
      await api.deleteEmployee(employee.id);
      showToast('success', `Đã xóa nhân viên ${employee.fullName}.`);
      await loadData();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setDeleting(false);
      setDeletingEmployee(null);
    }
  }

  const cancelDelete = useCallback(() => {
    if (!deleting) {
      setDeletingEmployee(null);
    }
  }, [deleting]);
  const closeDetail = useCallback(() => setViewingEmployee(null), []);

  function beginCreate() {
    setEditingEmployee(null);
    setShowForm(true);
  }

  function beginEdit(employee) {
    setViewingEmployee(null);
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
            <Users size={20} aria-hidden="true" />
          </div>
          <span className="brand-name">WebHR</span>
        </div>
        <p className="menu-label">Menu</p>
        <nav>
          <a className={`nav-item${view === 'employees' ? ' active' : ''}`} href="#employees">
            <Users size={18} aria-hidden="true" />
            Nhân sự
          </a>
          <a className={`nav-item${view === 'departments' ? ' active' : ''}`} href="#departments">
            <Building2 size={18} aria-hidden="true" />
            Phòng ban
          </a>
          <a className={`nav-item${view === 'positions' ? ' active' : ''}`} href="#positions">
            <BriefcaseBusiness size={18} aria-hidden="true" />
            Chức vụ
          </a>
        </nav>
        <div className="sidebar-footer">
          <div className="avatar small" aria-hidden="true">
            {initials(user?.fullName || user?.email)}
          </div>
          <div className="sidebar-user">
            <strong>{user?.fullName || user?.email}</strong>
            <span>{roleLabels[user?.role] || user?.role}</span>
          </div>
          <button type="button" className="logout-button" onClick={handleLogout} title="Đăng xuất" aria-label="Đăng xuất">
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{pageTitles[view].title}</h1>
            <p className="page-subtitle">{pageTitles[view].subtitle}</p>
          </div>
        </header>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-icon">
              <Users size={22} aria-hidden="true" />
            </div>
            <div>
              <span>Tổng nhân viên</span>
              <strong>{stats.total}</strong>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-icon green">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <div>
              <span>Đang làm</span>
              <strong>{stats.active}</strong>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-icon blue">
              <Building2 size={22} aria-hidden="true" />
            </div>
            <div>
              <span>Phòng ban</span>
              <strong>{stats.departments}</strong>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-icon red">
              <CircleDollarSign size={22} aria-hidden="true" />
            </div>
            <div>
              <span>Quỹ lương</span>
              <strong>{formatMoney(stats.payroll)}</strong>
            </div>
          </article>
        </section>

        {view === 'employees' ? (
          <section className="content-panel" id="employees">
            <div className="section-header">
              <h2>Hồ sơ nhân sự</h2>
              <button type="button" className="primary-button" onClick={beginCreate}>
                <Plus size={18} aria-hidden="true" />
                Thêm nhân sự
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
              <table className="responsive-table">
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
                        <td data-label="Mã">{employee.employeeCode}</td>
                        <td className="cell-main">
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => setViewingEmployee(employee)}
                            title="Xem chi tiết"
                          >
                            {employee.fullName}
                          </button>
                          <span>{employee.email}</span>
                        </td>
                        <td data-label="Phòng ban">{employee.departmentName || 'Chưa phân phòng'}</td>
                        <td data-label="Chức danh">{employee.position}</td>
                        <td data-label="Trạng thái">
                          <span className={`status-pill status-${employee.status.toLowerCase()}`}>
                            {statusLabels[employee.status] || employee.status}
                          </span>
                        </td>
                        <td data-label="Lương">{formatMoney(employee.baseSalary)}</td>
                        <td className="cell-actions">
                          <div className="row-actions">
                            <button type="button" className="icon-button success" onClick={() => beginEdit(employee)} title="Sửa">
                              <UserRoundPen size={17} aria-hidden="true" />
                            </button>
                            {canDelete && (
                              <button type="button" className="icon-button danger" onClick={() => setDeletingEmployee(employee)} title="Xóa">
                                <Trash2 size={17} aria-hidden="true" />
                              </button>
                            )}
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
        ) : view === 'departments' ? (
          <DepartmentsPanel
            user={user}
            departments={departments}
            loading={loading}
            onChanged={loadData}
            showToast={showToast}
          />
        ) : (
          <PositionsPanel user={user} departments={departments} showToast={showToast} />
        )}
      </section>

      {viewingEmployee && (
        <EmployeeDetail employee={viewingEmployee} onEdit={beginEdit} onClose={closeDetail} />
      )}

      {deletingEmployee && (
        <ConfirmDialog
          title="Xóa nhân viên?"
          message={`Hồ sơ của ${deletingEmployee.fullName} (${deletingEmployee.employeeCode}) sẽ bị xóa vĩnh viễn và không thể khôi phục.`}
          confirmLabel="Xóa nhân viên"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));

  useEffect(() => {
    // Khi API báo token hết hạn thì quay về màn hình đăng nhập.
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
