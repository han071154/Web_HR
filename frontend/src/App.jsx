import {
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Download,
  FileText,
  Eye,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, clearSession, getStoredUser, getToken, setUnauthorizedHandler } from './api.js';
import Avatar from './components/Avatar.jsx';
import CareersPage from './components/CareersPage.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import ContractsPanel from './components/ContractsPanel.jsx';
import DepartmentsPanel from './components/DepartmentsPanel.jsx';
import EmployeeDetail from './components/EmployeeDetail.jsx';
import EmployeeForm from './components/EmployeeForm.jsx';
import LoginPage from './components/LoginPage.jsx';
import Pagination from './components/Pagination.jsx';
import PositionsPanel from './components/PositionsPanel.jsx';
import RecruitmentPanel from './components/RecruitmentPanel.jsx';
import Toast from './components/Toast.jsx';
import { CONTRACT_DELETE_ROLES, CONTRACT_EDIT_ROLES } from './contracts.js';
import { roleLabels, statusLabels } from './format.js';

// Quyền khớp với backend: ai cũng thêm/sửa được, chỉ Admin và HR Manager được xóa.
const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const DELETE_ROLES = ['ADMIN', 'HR_MANAGER'];

const PAGE_SIZE = 10;

const VIEWS = ['employees', 'departments', 'positions', 'contracts', 'recruitment'];

const pageTitles = {
  employees: { title: 'Danh sách nhân sự', subtitle: 'Quản lý hồ sơ nhân viên của công ty' },
  departments: { title: 'Phòng ban', subtitle: 'Quản lý danh mục phòng ban' },
  positions: { title: 'Chức vụ', subtitle: 'Quản lý danh mục chức vụ' },
  contracts: { title: 'Hợp đồng', subtitle: 'Quản lý hợp đồng lao động của nhân viên' },
  recruitment: { title: 'Tuyển dụng', subtitle: 'Quản lý tin tuyển dụng và hồ sơ ứng viên' }
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
  // Danh sách rút gọn TOÀN BỘ nhân sự (không phân trang) dùng cho ô chọn quản lý, gợi ý mã NV
  // và danh sách chức vụ tự do. Danh sách chính (employees) giờ chỉ chứa trang đang xem (BUG-06).
  const [employeesLookup, setEmployeesLookup] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);
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

  // Gõ tìm kiếm thì chờ 300ms mới gọi API, tránh gọi backend liên tục theo từng phím gõ.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // BUG-06: danh sách nhân sự giờ phân trang ở backend (page/limit) thay vì tải hết rồi cắt ở
  // frontend — tránh trả về toàn bộ bảng mỗi lần tải khi dữ liệu lớn.
  const loadData = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const [employeeResponse, lookupResponse, departmentResponse, positionResponse] = await Promise.all([
        api.employees({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch,
          status: statusFilter,
          departmentId: departmentFilter,
          position: positionFilter
        }),
        api.employeesLookup(),
        api.departments(),
        api.positions()
      ]);
      setEmployees(employeeResponse.data);
      setTotalEmployees(employeeResponse.pagination.total);
      setEmployeesLookup(lookupResponse.data);
      setDepartments(departmentResponse.data);
      setPositions(positionResponse.data);

      // Bộ lọc thu hẹp kết quả làm trang hiện tại vượt quá tổng số trang mới: quay về trang cuối.
      const totalPages = Math.max(1, Math.ceil(employeeResponse.pagination.total / PAGE_SIZE));

      if (page > totalPages) {
        setPage(totalPages);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, departmentFilter, positionFilter]);

  // Tải lại mỗi khi đổi mục menu, đổi trang hoặc đổi bộ lọc.
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

  // Điện thoại: menu là thanh cuộn ngang, cuộn tới mục đang chọn để không bị khuất.
  const navRef = useRef(null);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector('.nav-item.active');

    if (nav && active && nav.scrollWidth > nav.clientWidth) {
      const left = active.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
      nav.scrollLeft = left - (nav.clientWidth - active.offsetWidth) / 2;
    }
  }, [view]);

  // Đổi bộ lọc thì quay về trang 1 (search đã debounce ở effect phía trên).
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, departmentFilter, positionFilter, statusFilter]);

  // positionNames/suggestedCode cần dữ liệu TOÀN BỘ nhân sự nên lấy từ employeesLookup
  // (danh sách rút gọn), không phải từ "employees" (chỉ có trang đang xem).
  const positionNames = useMemo(() => {
    const names = [...positions.map((position) => position.name), ...employeesLookup.map((employee) => employee.position)];
    return [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [positions, employeesLookup]);

  const suggestedCode = useMemo(() => nextEmployeeCode(employeesLookup), [employeesLookup]);

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

  // HR-009: xuất danh sách đang xem (theo đúng bộ lọc hiện tại) ra file Excel.
  async function handleExportEmployees() {
    try {
      const blob = await api.exportEmployees({
        search: debouncedSearch,
        status: statusFilter,
        departmentId: departmentFilter,
        position: positionFilter
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `danh-sach-nhan-su-${Date.now()}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('error', err.message);
    }
  }

  // HR-009: nhập danh sách nhân sự từ file Excel (cùng định dạng cột với file xuất ra).
  async function handleImportFile(event) {
    const file = event.target.files[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setImporting(true);

    try {
      const response = await api.importEmployees(file);
      const { created, updated, skipped } = response.data;
      showToast(
        'success',
        `Đã nhập ${created} nhân viên mới, cập nhật ${updated} nhân viên, bỏ qua ${skipped} dòng lỗi.`
      );
      await loadData();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setImporting(false);
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
          canEditContracts={CONTRACT_EDIT_ROLES.includes(user?.role)}
          canDeleteContracts={CONTRACT_DELETE_ROLES.includes(user?.role)}
          onEdit={beginEdit}
          onDeactivate={(employee) => setConfirmAction({ type: 'deactivate', employee })}
          showToast={showToast}
        />
      );
    }

    if (screen.type === 'form') {
      return (
        <EmployeeForm
          employee={screen.employee}
          employees={employeesLookup}
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
            {/* HR-009: nhập/xuất Excel. Input file ẩn, bấm nút icon thì mở hộp chọn file. */}
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={handleImportFile}
            />
            <button
              type="button"
              className="icon-text-button square"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
              title="Nhập từ Excel"
              aria-label="Nhập từ Excel"
            >
              <Upload size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-text-button square"
              onClick={handleExportEmployees}
              title="Xuất Excel"
              aria-label="Xuất Excel"
            >
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
                ) : employees.length ? (
                  employees.map((employee) => (
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
            page={page}
            pageSize={PAGE_SIZE}
            total={totalEmployees}
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
        <nav ref={navRef}>
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
          <a className={`nav-item${view === 'contracts' ? ' active' : ''}`} href="#contracts">
            <FileText size={18} aria-hidden="true" />
            Hợp đồng
          </a>
          <a className={`nav-item${view === 'recruitment' ? ' active' : ''}`} href="#recruitment">
            <ClipboardList size={18} aria-hidden="true" />
            Tuyển dụng
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
        ) : view === 'positions' ? (
          <PositionsPanel user={user} departments={departments} showToast={showToast} />
        ) : view === 'contracts' ? (
          <ContractsPanel user={user} employees={employeesLookup} showToast={showToast} />
        ) : (
          <RecruitmentPanel
            user={user}
            departments={departments}
            positions={positions}
            suggestedCode={suggestedCode}
            onEmployeesChanged={loadData}
            showToast={showToast}
          />
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
