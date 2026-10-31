import {
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  Download,
  FileText,
  KeyRound,
  LayoutDashboard,
  Eye,
  LogOut,
  Pencil,
  Plane,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCog,
  UserRound,
  Users
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, clearSession, getStoredUser, getToken, setUnauthorizedHandler } from './api.js';
import AccountPanel from './components/AccountPanel.jsx';
import Avatar from './components/Avatar.jsx';
import BrandLogo from './components/BrandLogo.jsx';
import CareersPage from './components/CareersPage.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import AttendancePanel from './components/AttendancePanel.jsx';
import ContractsPanel from './components/ContractsPanel.jsx';
import DashboardPanel from './components/DashboardPanel.jsx';
import DepartmentsPanel from './components/DepartmentsPanel.jsx';
import EmployeeDetail from './components/EmployeeDetail.jsx';
import EmployeeForm from './components/EmployeeForm.jsx';
import LeavePanel from './components/LeavePanel.jsx';
import LoginPage from './components/LoginPage.jsx';
import MyAttendancePanel from './components/MyAttendancePanel.jsx';
import MyLeavePanel from './components/MyLeavePanel.jsx';
import MySchedulePanel from './components/MySchedulePanel.jsx';
import Pagination from './components/Pagination.jsx';
import PositionsPanel from './components/PositionsPanel.jsx';
import RecruitmentPanel from './components/RecruitmentPanel.jsx';
import ReportsPanel from './components/ReportsPanel.jsx';
import ShiftsPanel from './components/ShiftsPanel.jsx';
import UsersPanel from './components/UsersPanel.jsx';
import Toast from './components/Toast.jsx';
import { CONTRACT_DELETE_ROLES, CONTRACT_EDIT_ROLES } from './contracts.js';
import { roleLabels, statusLabels } from './format.js';

// Quyền khớp với backend: hồ sơ nhân sự do HR Manager/Admin quản lý (HR Staff không có mục Nhân sự).
const EDIT_ROLES = ['ADMIN', 'HR_MANAGER'];
const DELETE_ROLES = ['ADMIN', 'HR_MANAGER'];

const PAGE_SIZE = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Menu bên trái: Admin thấy mọi mục; HR Manager không thấy mục adminOnly (quản lý tài khoản, HR-007); HR Staff chỉ
// thấy các mục vận hành hằng ngày (managerOnly bị ẩn, backend cũng chặn); tài khoản nhân viên (EMPLOYEE) chỉ thấy
// các mục tự phục vụ.
const HR_MENU = [
  { view: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { view: 'employees', label: 'Nhân sự', icon: Users, managerOnly: true },
  { view: 'departments', label: 'Phòng ban', icon: Building2, managerOnly: true },
  { view: 'positions', label: 'Chức vụ', icon: BriefcaseBusiness, managerOnly: true },
  { view: 'contracts', label: 'Hợp đồng', icon: FileText, managerOnly: true },
  { view: 'recruitment', label: 'Tuyển dụng', icon: ClipboardList, managerOnly: true },
  { view: 'shifts', label: 'Ca làm việc', icon: CalendarDays },
  { view: 'attendance', label: 'Chấm công', icon: Clock },
  { view: 'leave', label: 'Nghỉ phép', icon: Plane },
  { view: 'reports', label: 'Báo cáo', icon: BarChart3, managerOnly: true },
  { view: 'users', label: 'Quản lý tài khoản', icon: UserCog, adminOnly: true },
  { view: 'account', label: 'Tài khoản', icon: KeyRound }
];

const HR_MANAGER_MENU = HR_MENU.filter((item) => !item.adminOnly);
const HR_STAFF_MENU = HR_MANAGER_MENU.filter((item) => !item.managerOnly);

const EMPLOYEE_MENU = [
  { view: 'my-attendance', label: 'Chấm công', icon: Clock },
  { view: 'my-schedule', label: 'Lịch làm việc', icon: CalendarDays },
  { view: 'my-leave', label: 'Nghỉ phép', icon: Plane },
  { view: 'my-profile', label: 'Hồ sơ của tôi', icon: UserRound }
];

const pageTitles = {
  dashboard: { title: 'Tổng quan', subtitle: 'Tình hình nhân sự và chấm công hôm nay' },
  employees: { title: 'Danh sách nhân sự', subtitle: 'Quản lý hồ sơ nhân viên của công ty' },
  departments: { title: 'Phòng ban', subtitle: 'Quản lý danh mục phòng ban' },
  positions: { title: 'Chức vụ', subtitle: 'Quản lý danh mục chức vụ' },
  contracts: { title: 'Hợp đồng', subtitle: 'Quản lý hợp đồng lao động của nhân viên' },
  recruitment: { title: 'Tuyển dụng', subtitle: 'Quản lý tin tuyển dụng và hồ sơ ứng viên' },
  shifts: { title: 'Ca làm việc', subtitle: 'Xếp lịch làm việc theo tuần và quản lý danh mục ca' },
  attendance: { title: 'Chấm công', subtitle: 'Theo dõi giờ vào/ra và bảng công của nhân viên' },
  leave: { title: 'Nghỉ phép', subtitle: 'Duyệt đơn xin nghỉ của nhân viên' },
  reports: { title: 'Báo cáo', subtitle: 'Thống kê nhân sự và giờ công' },
  'my-attendance': { title: 'Chấm công', subtitle: 'Chấm công vào/ra và xem bảng công của bạn' },
  'my-schedule': { title: 'Lịch làm việc', subtitle: 'Xem ca được xếp, đăng ký ca hoặc xin đổi ca' },
  'my-leave': { title: 'Nghỉ phép', subtitle: 'Gửi đơn xin nghỉ và theo dõi kết quả duyệt' },
  'my-profile': { title: 'Hồ sơ của tôi', subtitle: 'Xem hồ sơ, cập nhật thông tin liên hệ và đổi mật khẩu' },
  account: { title: 'Tài khoản', subtitle: 'Thông tin tài khoản đăng nhập và đổi mật khẩu' },
  users: { title: 'Quản lý tài khoản', subtitle: 'Cấp tài khoản, gán vai trò, liên kết hồ sơ, khóa và đặt lại mật khẩu' }
};

function menuFor(user) {
  if (user?.role === 'EMPLOYEE') {
    return EMPLOYEE_MENU;
  }

  if (user?.role === 'HR_STAFF') {
    return HR_STAFF_MENU;
  }

  return user?.role === 'ADMIN' ? HR_MENU : HR_MANAGER_MENU;
}

// Đường dẫn trong app: #<mục menu>, hoặc #employees/<id> để mở thẳng chi tiết một nhân viên (link từ
// Hợp đồng, Chấm công, Nghỉ phép...; tải lại trang hay bấm Back vẫn giữ đúng nhân viên).
// #employees/<id>/contracts/<contractId>: nút Sửa ở trang Hợp đồng → mở hồ sơ với form sửa hợp đồng đó.
function routeFromHash(menu) {
  const [view, employeeId, section, contractId] = window.location.hash.slice(1).split('/');

  if (!menu.some((item) => item.view === view)) {
    return { view: menu[0].view, employeeId: null, contractId: null };
  }

  const isDetail = view === 'employees' && Boolean(employeeId);

  return {
    view,
    employeeId: isDetail ? employeeId : null,
    contractId: isDetail && section === 'contracts' && contractId ? contractId : null
  };
}

function screenForRoute(route) {
  return route.employeeId ? { type: 'detail', employeeId: route.employeeId, employee: null } : { type: 'list' };
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
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);
  const menu = menuFor(user);
  const isEmployee = menu === EMPLOYEE_MENU;
  const [view, setView] = useState(() => routeFromHash(menu).view);
  // Màn hình con của mục Nhân sự: danh sách, chi tiết (employeeId; employee = null khi đang tải theo id)
  // hoặc form.
  const [screen, setScreen] = useState(() => screenForRoute(routeFromHash(menu)));
  const [detailError, setDetailError] = useState('');
  // Hợp đồng cần mở sẵn form sửa trong chi tiết nhân viên (từ nút Sửa ở trang Hợp đồng).
  const [openContractId, setOpenContractId] = useState(() => routeFromHash(menu).contractId);
  // Mục đã mở chi tiết nhân viên (vd 'contracts'): hiện nút "Quay lại" về đúng mục đó.
  const [returnTo, setReturnTo] = useState(null);
  const viewRef = useRef(view);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const canEdit = EDIT_ROLES.includes(user?.role);
  const canDelete = DELETE_ROLES.includes(user?.role);

  const showToast = useCallback((type, message) => {
    setToast({ id: Date.now(), type, message });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  // Đóng form hợp đồng mở từ URL: bỏ phần /contracts/<id> khỏi URL (không thêm lịch sử) để tải lại trang
  // không mở lại form.
  const handleContractFormClosed = useCallback(() => {
    setOpenContractId(null);
    const [base] = window.location.hash.split('/contracts/');

    if (base !== window.location.hash) {
      window.history.replaceState(null, '', base);
    }
  }, []);

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
      const employeeResponse = await api.employees({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        status: statusFilter,
        departmentId: departmentFilter,
        position: positionFilter
      });
      setEmployees(employeeResponse.data);
      setTotalEmployees(employeeResponse.pagination.total);

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

  // Danh sách tra cứu (toàn bộ nhân sự rút gọn), phòng ban, chức vụ không đổi theo trang/bộ lọc nên chỉ
  // tải khi mở mục menu và sau khi thêm/sửa/xóa. Trước đây tải lại cùng mỗi lần đổi trang hoặc gõ tìm kiếm:
  // 5.000 nhân viên là ~0,76 MB mỗi lần (load test tuần 7).
  // Danh sách tra cứu chỉ cần ở Nhân sự (gợi ý mã, chọn quản lý), Hợp đồng (chọn nhân viên) và Tuyển dụng
  // (gợi ý mã khi chuyển ứng viên thành nhân sự); các mục khác chỉ cần phòng ban, chức vụ.
  const needsLookup = ['employees', 'contracts', 'recruitment'].includes(view);
  const loadReferenceData = useCallback(async () => {
    setReferenceLoading(true);

    try {
      const [lookupResponse, departmentResponse, positionResponse] = await Promise.all([
        needsLookup ? api.employeesLookup() : null,
        api.departments(),
        api.positions()
      ]);
      if (lookupResponse) {
        setEmployeesLookup(lookupResponse.data);
      }
      setDepartments(departmentResponse.data);
      setPositions(positionResponse.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setReferenceLoading(false);
    }
  }, [needsLookup]);

  const reloadAll = useCallback(() => Promise.all([loadData(), loadReferenceData()]), [loadData, loadReferenceData]);

  // Tải lại trang nhân sự khi mở mục Nhân sự, đổi trang hoặc đổi bộ lọc (các mục khác không dùng).
  // Tài khoản nhân viên không dùng danh sách nhân sự/phòng ban nên không tải.
  useEffect(() => {
    if (!isEmployee && view === 'employees') {
      loadData();
    }
  }, [loadData, view, isEmployee]);

  useEffect(() => {
    if (!isEmployee) {
      loadReferenceData();
    }
  }, [loadReferenceData, view, isEmployee]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    // Menu bên trái đổi trang qua #employees / #departments / #positions trên URL; #employees/<id> mở
    // chi tiết. Giữ nguyên màn đang có nếu đã đúng nhân viên đó (vd vừa lưu xong rồi đổi URL).
    function handleHashChange() {
      const route = routeFromHash(menu);
      const from = viewRef.current;

      if (!route.employeeId) {
        setReturnTo(null);
      } else if (from !== 'employees') {
        setReturnTo(from);
      }

      setView(route.view);
      setOpenContractId(route.contractId);
      setScreen((previous) =>
        route.employeeId && previous.type === 'detail' && previous.employeeId === route.employeeId
          ? previous
          : screenForRoute(route)
      );
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [menu]);

  // Mở chi tiết theo id trên URL (chưa có sẵn dữ liệu nhân viên): tải từ API.
  const pendingEmployeeId = screen.type === 'detail' && !screen.employee ? screen.employeeId : null;

  useEffect(() => {
    if (!pendingEmployeeId) {
      return undefined;
    }

    let cancelled = false;
    setDetailError('');

    // Link gõ tay / dán sai (không phải UUID): báo không tìm thấy thay vì lỗi "dữ liệu không hợp lệ".
    if (!UUID_PATTERN.test(pendingEmployeeId)) {
      setDetailError('Không tìm thấy nhân viên.');
      return undefined;
    }

    api
      .employee(pendingEmployeeId)
      .then((response) => {
        if (!cancelled) {
          setScreen((previous) =>
            previous.type === 'detail' && previous.employeeId === pendingEmployeeId
              ? { ...previous, employee: response.data }
              : previous
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDetailError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pendingEmployeeId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen.type]);

  // Menu bị cuộn (ngang trên điện thoại, dọc khi màn hình thấp/phóng to): cuộn tới mục đang chọn
  // để không bị khuất.
  const navRef = useRef(null);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector('.nav-item.active');

    if (!nav || !active) {
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();

    if (nav.scrollWidth > nav.clientWidth) {
      const left = activeRect.left - navRect.left + nav.scrollLeft;
      nav.scrollLeft = left - (nav.clientWidth - active.offsetWidth) / 2;
    }

    if (nav.scrollHeight > nav.clientHeight) {
      const top = activeRect.top - navRect.top + nav.scrollTop;
      nav.scrollTop = top - (nav.clientHeight - active.offsetHeight) / 2;
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

  // Đổi URL theo màn đang xem để tải lại trang / nút Back của trình duyệt giữ đúng chỗ.
  function setHash(hash) {
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  }

  function showList() {
    setScreen({ type: 'list' });
    setHash('#employees');
  }

  function showDetail(employee) {
    setScreen({ type: 'detail', employeeId: employee.id, employee });
    setHash(`#employees/${employee.id}`);
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
      reloadAll();
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
      await reloadAll();
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

      await reloadAll();
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
        crumbs: [...listCrumbs, { label: screen.employee?.employeeCode || '…' }],
        // Mở từ mục khác (vd bấm tên nhân viên ở Hợp đồng): nút quay lại đúng mục đó.
        back: returnTo && pageTitles[returnTo] && {
          label: `Quay lại ${pageTitles[returnTo].title}`,
          onClick: () => setHash(`#${returnTo}`)
        }
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
    if (screen.type === 'detail' && !screen.employee) {
      return (
        <section className="content-panel">
          {detailError ? (
            <>
              <p className="form-error">Không mở được hồ sơ nhân viên: {detailError}</p>
              <button type="button" className="ghost-button" onClick={showList}>
                Về danh sách nhân sự
              </button>
            </>
          ) : (
            <p className="muted-text">Đang tải hồ sơ nhân viên…</p>
          )}
        </section>
      );
    }

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
          openContractId={openContractId}
          onContractFormClosed={handleContractFormClosed}
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
          <BrandLogo />
        </div>
        <p className="menu-label">Menu</p>
        <nav ref={navRef}>
          {menu.map((item) => {
            const Icon = item.icon;

            return (
              <a
                key={item.view}
                className={`nav-item${view === item.view ? ' active' : ''}`}
                href={`#${item.view}`}
                onClick={item.view === 'employees' ? showList : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </a>
            );
          })}
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
            {header.back && (
              <button type="button" className="back-link" onClick={header.back.onClick}>
                <ArrowLeft size={16} aria-hidden="true" />
                {header.back.label}
              </button>
            )}
            <h1>{header.title}</h1>
            {header.crumbs ? <Breadcrumb items={header.crumbs} /> : <p className="page-subtitle">{header.subtitle}</p>}
          </div>
        </header>

        {view === 'dashboard' ? (
          <DashboardPanel />
        ) : view === 'employees' ? (
          renderEmployees()
        ) : view === 'departments' ? (
          <DepartmentsPanel
            user={user}
            departments={departments}
            loading={referenceLoading}
            onChanged={reloadAll}
            showToast={showToast}
          />
        ) : view === 'positions' ? (
          <PositionsPanel user={user} departments={departments} showToast={showToast} />
        ) : view === 'contracts' ? (
          <ContractsPanel user={user} employees={employeesLookup} showToast={showToast} />
        ) : view === 'shifts' ? (
          <ShiftsPanel departments={departments} showToast={showToast} />
        ) : view === 'attendance' ? (
          <AttendancePanel departments={departments} showToast={showToast} />
        ) : view === 'leave' ? (
          <LeavePanel showToast={showToast} />
        ) : view === 'reports' ? (
          <ReportsPanel departments={departments} showToast={showToast} />
        ) : view === 'my-attendance' ? (
          <MyAttendancePanel showToast={showToast} />
        ) : view === 'my-schedule' ? (
          <MySchedulePanel showToast={showToast} />
        ) : view === 'my-leave' ? (
          <MyLeavePanel showToast={showToast} />
        ) : view === 'users' ? (
          <UsersPanel user={user} showToast={showToast} />
        ) : view === 'my-profile' || view === 'account' ? (
          <AccountPanel user={user} showToast={showToast} />
        ) : (
          <RecruitmentPanel
            user={user}
            departments={departments}
            positions={positions}
            suggestedCode={suggestedCode}
            onEmployeesChanged={reloadAll}
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
