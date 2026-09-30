import {
  BriefcaseBusiness,
  Building2,
  Download,
  Eye,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, clearSession, getStoredUser, getToken, setUnauthorizedHandler } from './api.js';
import Avatar from './components/Avatar.jsx';
import CareersPage from './components/CareersPage.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import DepartmentsPanel from './components/DepartmentsPanel.jsx';
import EmployeeDetail from './components/EmployeeDetail.jsx';
import EmployeeForm from './components/EmployeeForm.jsx';
import LoginPage from './components/LoginPage.jsx';
import Pagination from './components/Pagination.jsx';
import PositionsPanel from './components/PositionsPanel.jsx';
import Toast from './components/Toast.jsx';
import { normalizeText, roleLabels, statusLabels } from './format.js';

// Quyền khớp với backend: ai cũng thêm/sửa được, chỉ Admin và HR Manager được xóa.
const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const DELETE_ROLES = ['ADMIN', 'HR_MANAGER'];

const PAGE_SIZE = 10;

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

// Gợi ý mã nhân viên kế tiếp: NV007 → NV008 (giữ tiền tố và số chữ số của mã lớn nhất).
function nextEmployeeCode(employees) {
  let prefix = 'NV';
  let width = 3;
  let max = 0;

  for (const employee of employees) {
    const match = /^([A-Za-z]+)(\d+)$/.exec(employee.employeeCode || '');

    if (match && Number(match[2]) > max) {
      [, prefix] = match;
      width = match[2].length;
      max = Number(match[2]);
    }
  }

  return `${prefix}${String(max + 1).padStart(width, '0')}`;
}

function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb" aria-label="Đường dẫn">
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 && <span className="breadcrumb-sep">/</span>}
          {item.onClick ? (
            <button type="button" onClick={item.onClick}>
              {item.label}
            </button>
          ) : (
            item.label
          )}
        </span>
      ))}
    </nav>
  );
}

function Dashboard({ user, onLogout }) {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // Màn hình con của mục Nhân sự: danh sách, chi tiết hoặc form.
  const [screen, setScreen] = useState({ type: 'list' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [view, setView] = useState(viewFromHash);
  const canEdit = EDIT_ROLES.includes(user?.role);
  const canDelete = DELETE_ROLES.includes(user?.role);

  const showToast = useCallback((type, message) => {
    setToast({ id: Date.now(), type, message });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  const loadData = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const [employeeResponse, departmentResponse, positionResponse] = await Promise.all([
        api.employees(),
        api.departments(),
        api.positions()
      ]);
      setEmployees(employeeResponse.data);
      setDepartments(departmentResponse.data);
      setPositions(positionResponse.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Tải lại mỗi khi đổi mục menu để thấy phòng ban / chức vụ mới sửa.
  useEffect(() => {
    loadData();
  }, [loadData, view]);

  useEffect(() => {
    // Menu bên trái đổi trang qua #employees / #departments / #positions trên URL.
    function handleHashChange() {
      setView(viewFromHash());
      setScreen({ type: 'list' });
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen.type]);

  // Lọc ngay khi gõ / chọn, không cần bấm nút "Lọc".
  const filteredEmployees = useMemo(() => {
    const keyword = normalizeText(search.trim());

    return employees.filter((employee) => {
      const matchesSearch =
        !keyword ||
        [employee.fullName, employee.employeeCode, employee.email].some((value) =>
          normalizeText(value).includes(keyword)
        );

      return (
        matchesSearch &&
        (!departmentFilter || employee.departmentId === departmentFilter) &&
        (!positionFilter || employee.position === positionFilter) &&
        (!statusFilter || employee.status === statusFilter)
      );
    });
  }, [employees, search, departmentFilter, positionFilter, statusFilter]);

  // Đổi bộ lọc thì quay về trang 1.
  useEffect(() => {
    setPage(1);
  }, [search, departmentFilter, positionFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageEmployees = filteredEmployees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const positionNames = useMemo(() => {
    const names = [...positions.map((position) => position.name), ...employees.map((employee) => employee.position)];
    return [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [positions, employees]);

  const suggestedCode = useMemo(() => nextEmployeeCode(employees), [employees]);

  function showList() {
    setScreen({ type: 'list' });
  }

  function showDetail(employee) {
    setScreen({ type: 'detail', employee });
  }

  function beginCreate() {
    setFormError('');
    setScreen({ type: 'form', employee: null });
  }

  function beginEdit(employee) {
    setFormError('');
    setScreen({ type: 'form', employee });
  }

  function cancelForm() {
    if (screen.employee) {
      showDetail(screen.employee);
    } else {
      showList();
    }
  }

  async function saveEmployee(data, avatarFile) {
    setSaving(true);
    setFormError('');

    try {
      const payload = {
        ...data,
        departmentId: data.departmentId || null,
        dateOfBirth: data.dateOfBirth || null
      };
      const response = data.id ? await api.updateEmployee(data.id, payload) : await api.createEmployee(payload);
      let saved = response.data;
      let avatarError = '';

      if (avatarFile) {
        try {
          saved = (await api.uploadEmployeeAvatar(saved.id, avatarFile)).data;
        } catch (err) {
          avatarError = err.message;
        }
      }

      if (avatarError) {
        showToast('error', `Đã lưu hồ sơ nhưng chưa tải được ảnh: ${avatarError}`);
      } else {
        showToast('success', data.id ? `Đã cập nhật hồ sơ ${saved.fullName}.` : `Đã thêm nhân viên ${saved.fullName}.`);
      }

      showDetail(saved);
      loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function runConfirmAction() {
    const { type, employee } = confirmAction;
    setConfirmBusy(true);

    try {
      if (type === 'delete') {
        await api.deleteEmployee(employee.id);
        showToast('success', `Đã xóa nhân viên ${employee.fullName}.`);
        showList();
      } else {
        const response = await api.updateEmployee(employee.id, { status: 'RESIGNED' });
        showToast('success', `Đã vô hiệu hóa hồ sơ ${employee.fullName}.`);
        showDetail(response.data);
      }

      await loadData();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setConfirmBusy(false);
      setConfirmAction(null);
    }
  }

  const cancelConfirm = useCallback(() => {
    if (!confirmBusy) {
      setConfirmAction(null);
    }
  }, [confirmBusy]);

  function handleLogout() {
    clearSession();
    onLogout();
  }

  const header = (() => {
    if (view !== 'employees' || screen.type === 'list') {
      return { title: pageTitles[view].title, subtitle: pageTitles[view].subtitle };
    }

    const listCrumbs = [{ label: 'Nhân sự', onClick: showList }, { label: 'Danh sách', onClick: showList }];

    if (screen.type === 'detail') {
      return {
        title: 'Chi tiết nhân sự',
        crumbs: [...listCrumbs, { label: screen.employee.employeeCode }]
      };
    }

    if (screen.employee) {
      return {
        title: 'Sửa nhân sự',
        crumbs: [
          ...listCrumbs,
          { label: screen.employee.employeeCode, onClick: () => showDetail(screen.employee) },
          { label: 'Sửa' }
        ]
      };
    }

    return { title: 'Thêm nhân sự', crumbs: [...listCrumbs, { label: 'Thêm nhân sự' }] };
  })();

  function renderEmployees() {
    if (screen.type === 'detail') {
      return (
        <EmployeeDetail
          employee={screen.employee}
          canDeactivate={canEdit}
          onEdit={beginEdit}
          onDeactivate={(employee) => setConfirmAction({ type: 'deactivate', employee })}
        />
      );
    }

    if (screen.type === 'form') {
      return (
        <EmployeeForm
          employee={screen.employee}
          departments={departments}
          positions={positions}
          suggestedCode={screen.employee ? '' : suggestedCode}
          saving={saving}
          error={formError}
          onSubmit={saveEmployee}
          onCancel={cancelForm}
        />
      );
    }

    return (
      <>
        <section className="content-panel toolbar-card">
          <label className="search-field">
            <Search size={18} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo mã, họ tên, email..."
              aria-label="Tìm nhân sự"
            />
          </label>
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Lọc theo phòng ban">
            <option value="">Phòng ban</option>
            {departments.map((department) => (
              <option value={department.id} key={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} aria-label="Lọc theo chức vụ">
            <option value="">Chức vụ</option>
            {positionNames.map((name) => (
              <option value={name} key={name}>
                {name}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc theo trạng thái">
            <option value="">Trạng thái</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="toolbar-actions">
            {/* Import / Export Excel thuộc task HR-009, chưa có API nên tạm khóa. */}
            <button type="button" className="icon-text-button square" disabled title="Nhập từ Excel (sắp có)" aria-label="Nhập từ Excel">
              <Upload size={18} aria-hidden="true" />
            </button>
            <button type="button" className="icon-text-button square" disabled title="Xuất Excel (sắp có)" aria-label="Xuất Excel">
              <Download size={18} aria-hidden="true" />
            </button>
            {canEdit && (
              <button type="button" className="primary-button" onClick={beginCreate}>
                <Plus size={18} aria-hidden="true" />
                Thêm nhân sự
              </button>
            )}
          </div>
        </section>

        <section className="content-panel table-card" id="employees">
          {error && <p className="form-error">{error}</p>}

          <div className="table-wrap">
            <table className="responsive-table employees-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Mã NV</th>
                  <th>Phòng ban</th>
                  <th>Chức vụ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && !employees.length ? (
                  <tr>
                    <td colSpan="6">Đang tải dữ liệu</td>
                  </tr>
                ) : pageEmployees.length ? (
                  pageEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="cell-main">
                        <div className="person-cell">
                          <Avatar name={employee.fullName} src={employee.avatarUrl} size="small" />
                          <div>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => showDetail(employee)}
                              title="Xem chi tiết"
                            >
                              {employee.fullName}
                            </button>
                            <span>{employee.email}</span>
                          </div>
                        </div>
                      </td>
                      <td data-label="Mã NV">{employee.employeeCode}</td>
                      <td data-label="Phòng ban">{employee.departmentName || 'Chưa phân phòng'}</td>
                      <td data-label="Chức vụ">{employee.position}</td>
                      <td data-label="Trạng thái">
                        <span className={`status-pill status-${employee.status.toLowerCase()}`}>
                          {statusLabels[employee.status] || employee.status}
                        </span>
                      </td>
                      <td className="cell-actions">
                        <div className="row-actions">
                          <button type="button" className="icon-button" onClick={() => showDetail(employee)} title="Xem" aria-label="Xem">
                            <Eye size={17} aria-hidden="true" />
                          </button>
                          {canEdit && (
                            <button type="button" className="icon-button success" onClick={() => beginEdit(employee)} title="Sửa" aria-label="Sửa">
                              <Pencil size={17} aria-hidden="true" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() => setConfirmAction({ type: 'delete', employee })}
                              title="Xóa"
                              aria-label="Xóa"
                            >
                              <Trash2 size={17} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6">Chưa có nhân viên phù hợp</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            total={filteredEmployees.length}
            unit="nhân sự"
            onChange={setPage}
          />
        </section>
      </>
    );
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
          <a className={`nav-item${view === 'employees' ? ' active' : ''}`} href="#employees" onClick={showList}>
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
          <Avatar name={user?.fullName || user?.email} size="small" />
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
            <h1>{header.title}</h1>
            {header.crumbs ? <Breadcrumb items={header.crumbs} /> : <p className="page-subtitle">{header.subtitle}</p>}
          </div>
        </header>

        {view === 'employees' ? (
          renderEmployees()
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

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.type === 'delete' ? 'Xóa nhân viên?' : 'Vô hiệu hóa hồ sơ?'}
          message={
            confirmAction.type === 'delete'
              ? `Hồ sơ của ${confirmAction.employee.fullName} (${confirmAction.employee.employeeCode}) sẽ bị xóa vĩnh viễn và không thể khôi phục.`
              : `${confirmAction.employee.fullName} (${confirmAction.employee.employeeCode}) sẽ chuyển sang trạng thái "Đã nghỉ". Có thể sửa lại trạng thái sau.`
          }
          confirmLabel={confirmAction.type === 'delete' ? 'Xóa nhân viên' : 'Vô hiệu hóa'}
          busy={confirmBusy}
          onConfirm={runConfirmAction}
          onCancel={cancelConfirm}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </main>
  );
}

// Trang tuyển dụng công khai: #/..., hoặc trang trống khi chưa đăng nhập.
function isCareersHash(hash, user) {
  return hash.startsWith('#/') || (!user && (hash === '' || hash === '#'));
}

export default function App() {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    // Khi API báo token hết hạn thì quay về màn hình đăng nhập.
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    function handleHashChange() {
      setHash(window.location.hash);
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isCareersHash(hash, user)) {
    return <CareersPage hash={hash} user={user} />;
  }

  // Chưa đăng nhập mà mở #login, #employees... (hoặc vừa hết phiên) thì hiện màn đăng nhập.
  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
