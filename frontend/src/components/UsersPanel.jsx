import { Download, Eye, EyeOff, KeyRound, Lock, LockOpen, Pencil, Plus, RefreshCw, Search, UserCog, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { normalizeText, roleLabels, statusLabels } from '../format.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import EmployeeLink from './EmployeeLink.jsx';
import FormDialog from './FormDialog.jsx';
import Pagination from './Pagination.jsx';
import TabBar from './TabBar.jsx';

const PAGE_SIZE = 10;
const ROLES = ['EMPLOYEE', 'HR_STAFF', 'HR_MANAGER', 'ADMIN'];
const roleHints = {
  EMPLOYEE: 'Chấm công, xem lịch, đăng ký / đổi ca, xin nghỉ phép, xem hồ sơ của mình.',
  HR_STAFF: 'Vận hành hằng ngày: ca làm việc, chấm công, xem đơn nghỉ và yêu cầu đổi ca.',
  HR_MANAGER: 'Quản lý nhân sự, hợp đồng, tuyển dụng, báo cáo; duyệt đơn nghỉ và đổi ca.',
  ADMIN: 'Toàn quyền, gồm cả quản lý tài khoản.'
};

// Mật khẩu tạm 10 ký tự, có cả chữ và số (đúng quy tắc của backend), bỏ các ký tự dễ nhầm như 0/O, 1/l.
function generatePassword() {
  const letters = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const values = crypto.getRandomValues(new Uint32Array(10));
  const chars = [...values].map((value) => all[value % all.length]);
  chars[0] = letters[values[0] % letters.length];
  chars[9] = digits[values[9] % digits.length];
  return chars.join('');
}

function passwordProblem(password) {
  if (password.length < 8 || password.length > 72) {
    return 'Mật khẩu phải từ 8 đến 72 ký tự.';
  }

  return /[A-Za-z]/.test(password) && /\d/.test(password) ? '' : 'Mật khẩu phải có cả chữ và số.';
}

function PasswordField({ label, value, onChange, autoFocus = false }) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {label}
      <span className="password-input">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          autoFocus={autoFocus}
        />
        <button
          type="button"
          className="icon-button"
          onClick={() => setVisible((current) => !current)}
          title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            setVisible(true);
            onChange(generatePassword());
          }}
          title="Tạo mật khẩu ngẫu nhiên"
          aria-label="Tạo mật khẩu ngẫu nhiên"
        >
          <RefreshCw size={17} aria-hidden="true" />
        </button>
      </span>
      <small className="field-hint">Từ 8 ký tự, có cả chữ và số. Gửi mật khẩu này cho người dùng; họ nên tự đổi sau khi đăng nhập.</small>
    </label>
  );
}

// Thêm / sửa tài khoản. Chọn hồ sơ nhân viên thì tự điền họ tên và email theo hồ sơ (vẫn sửa được).
function AccountDialog({ account, employeeOptions, onSubmit, onClose }) {
  const isNew = !account.id;
  const [form, setForm] = useState(() => ({
    employeeId: account.employeeId || '',
    email: account.email || '',
    fullName: account.fullName || '',
    role: account.role || 'EMPLOYEE',
    password: isNew ? generatePassword() : ''
  }));
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Hồ sơ đã có tài khoản khác thì không chọn được (mỗi hồ sơ chỉ một tài khoản).
  const options = useMemo(() => {
    const keyword = normalizeText(employeeSearch.trim());
    const list = employeeOptions.filter(
      (item) =>
        item.id === form.employeeId ||
        !keyword ||
        normalizeText(`${item.fullName} ${item.employeeCode} ${item.email || ''}`).includes(keyword)
    );
    return list.slice(0, 200);
  }, [employeeOptions, employeeSearch, form.employeeId]);

  function update(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'employeeId') {
        const employee = employeeOptions.find((item) => item.id === value);

        if (employee && isNew) {
          next.fullName = employee.fullName;
          next.email = employee.email || current.email;
        }
      }

      return next;
    });
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.role === 'EMPLOYEE' && !form.employeeId) {
      setError('Tài khoản Nhân viên phải liên kết với một hồ sơ nhân viên.');
      return;
    }

    const problem = isNew ? passwordProblem(form.password) : '';

    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);

    try {
      const values = {
        fullName: form.fullName.trim(),
        role: form.role,
        employeeId: form.employeeId || null
      };
      await onSubmit(isNew ? { ...values, email: form.email.trim(), password: form.password } : values, form.password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title={isNew ? 'Cấp tài khoản' : 'Sửa tài khoản'}
      subtitle={isNew ? 'Tạo tài khoản đăng nhập cho nhân viên hoặc cán bộ nhân sự' : account.email}
      wide
      busy={busy}
      onClose={onClose}
    >
      <form className="dialog-form" onSubmit={handleSubmit}>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <label>
          Hồ sơ nhân viên {form.role === 'EMPLOYEE' ? '' : '(không bắt buộc)'}
          <input
            type="search"
            value={employeeSearch}
            onChange={(event) => setEmployeeSearch(event.target.value)}
            placeholder="Tìm theo tên, mã hoặc email nhân viên"
            aria-label="Tìm hồ sơ nhân viên"
          />
          <select
            value={form.employeeId}
            onChange={(event) => update('employeeId', event.target.value)}
            aria-label="Chọn hồ sơ nhân viên"
          >
            <option value="">{form.role === 'EMPLOYEE' ? 'Chọn hồ sơ nhân viên' : 'Không liên kết hồ sơ'}</option>
            {options.map((item) => {
              const takenByOther = item.linkedUserId && item.linkedUserId !== account.id;
              return (
                <option value={item.id} key={item.id} disabled={Boolean(takenByOther)}>
                  {item.fullName} ({item.employeeCode}){item.departmentName ? ` · ${item.departmentName}` : ''}
                  {takenByOther ? ` – đã có tài khoản ${item.linkedUserEmail}` : ''}
                </option>
              );
            })}
          </select>
          <small className="field-hint">
            Liên kết để người dùng xem được lịch làm việc, chấm công, nghỉ phép và hồ sơ của chính mình.
          </small>
        </label>
        <div className="form-grid">
          <label>
            Email đăng nhập
            <input
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              maxLength={160}
              required
              disabled={!isNew}
            />
          </label>
          <label>
            Họ tên
            <input
              value={form.fullName}
              onChange={(event) => update('fullName', event.target.value)}
              minLength={2}
              maxLength={160}
              required
            />
          </label>
          <label>
            Vai trò
            <select value={form.role} onChange={(event) => update('role', event.target.value)}>
              {ROLES.map((role) => (
                <option value={role} key={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
            <small className="field-hint">{roleHints[form.role]}</small>
          </label>
          {isNew && (
            <PasswordField label="Mật khẩu ban đầu" value={form.password} onChange={(value) => update('password', value)} />
          )}
        </div>
        {!isNew && (form.role !== account.role || (form.employeeId || null) !== (account.employeeId || null)) && (
          <p className="field-hint">Đổi vai trò hoặc hồ sơ liên kết: người dùng sẽ phải đăng nhập lại.</p>
        )}
        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            <UserCog size={18} aria-hidden="true" />
            {busy ? 'Đang lưu' : isNew ? 'Cấp tài khoản' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

function ResetPasswordDialog({ account, onSubmit, onClose }) {
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = passwordProblem(password);

    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);

    try {
      await onSubmit(password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <FormDialog title="Đặt lại mật khẩu" subtitle={`${account.fullName} · ${account.email}`} busy={busy} onClose={onClose}>
      <form className="dialog-form" onSubmit={handleSubmit}>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <PasswordField label="Mật khẩu mới" value={password} onChange={setPassword} autoFocus />
        <p className="field-hint">Người dùng bị đăng xuất khỏi mọi thiết bị và phải đăng nhập bằng mật khẩu mới.</p>
        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            <KeyRound size={18} aria-hidden="true" />
            {busy ? 'Đang lưu' : 'Đặt lại mật khẩu'}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

const INACTIVE_STATUSES = ['RESIGNED', 'TERMINATED'];

const skipReasons = {
  ALREADY_LINKED: 'Đã có tài khoản',
  EMPLOYEE_NOT_WORKING: 'Đã nghỉ việc',
  NO_EMAIL: 'Hồ sơ chưa có email',
  EMAIL_TAKEN: 'Email đã được tài khoản khác dùng',
  EMPLOYEE_NOT_FOUND: 'Không tìm thấy hồ sơ'
};

function cannotGrantReason(employee, takenEmails) {
  if (INACTIVE_STATUSES.includes(employee.status)) {
    return skipReasons.EMPLOYEE_NOT_WORKING;
  }

  if (!employee.email) {
    return skipReasons.NO_EMAIL;
  }

  return takenEmails.has(employee.email.toLowerCase()) ? skipReasons.EMAIL_TAKEN : '';
}

// File CSV có BOM UTF-8 để Excel mở đúng tiếng Việt; ô có dấu phẩy / ngoặc kép được bọc trong "".
function downloadCredentials(created) {
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['Mã NV', 'Họ tên', 'Email đăng nhập', 'Mật khẩu ban đầu', 'Ghi chú'],
    ...created.map((item) => [item.employeeCode, item.fullName, item.email, item.password, 'Đổi mật khẩu sau lần đăng nhập đầu'])
  ].map((row) => row.map(cell).join(','));
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  // Giờ máy người dùng (không dùng toISOString vì đó là giờ UTC).
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `tai-khoan-moi-${stamp}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Tab "Chưa có tài khoản": hồ sơ nhân viên chưa liên kết tài khoản nào; cấp từng người hoặc chọn nhiều người để cấp hàng loạt.
function PendingEmployees({ employeeOptions, onGrant, onBulk }) {
  const [keyword, setKeyword] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const takenEmails = useMemo(
    () => new Set(employeeOptions.filter((item) => item.linkedUserEmail).map((item) => item.linkedUserEmail.toLowerCase())),
    [employeeOptions]
  );

  const pending = useMemo(() => {
    const text = normalizeText(keyword.trim());
    return employeeOptions.filter(
      (item) =>
        !item.linkedUserId &&
        (showInactive || !INACTIVE_STATUSES.includes(item.status)) &&
        (!text || normalizeText(`${item.fullName} ${item.employeeCode} ${item.email || ''} ${item.departmentName || ''}`).includes(text))
    );
  }, [employeeOptions, keyword, showInactive]);

  const grantable = pending.filter((item) => !cannotGrantReason(item, takenEmails));
  const selectedIds = grantable.filter((item) => selected.has(item.id)).map((item) => item.id);
  const allSelected = grantable.length > 0 && selectedIds.length === grantable.length;

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  return (
    <>
      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo họ tên, mã, email, phòng ban"
            aria-label="Tìm nhân viên chưa có tài khoản"
          />
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
          Hiện cả người đã nghỉ việc
        </label>
        <button
          type="button"
          className="primary-button"
          disabled={!selectedIds.length}
          onClick={() => onBulk(selectedIds, () => setSelected(new Set()))}
        >
          <UsersRound size={18} aria-hidden="true" />
          {selectedIds.length ? `Cấp tài khoản cho ${selectedIds.length} người` : 'Chọn người để cấp hàng loạt'}
        </button>
      </div>

      <div className="table-wrap">
        <table className="users-table responsive-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={!grantable.length}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(grantable.map((item) => item.id)))}
                  aria-label="Chọn tất cả người cấp được"
                />
              </th>
              <th>Nhân viên</th>
              <th>Phòng ban / Chức vụ</th>
              <th>Email (sẽ là email đăng nhập)</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pending.length ? (
              pending.map((item) => {
                const reason = cannotGrantReason(item, takenEmails);
                return (
                  <tr key={item.id}>
                    <td data-label="Chọn">
                      <input
                        type="checkbox"
                        checked={!reason && selected.has(item.id)}
                        disabled={Boolean(reason)}
                        onChange={() => toggle(item.id)}
                        aria-label={`Chọn ${item.fullName}`}
                      />
                    </td>
                    <td className="cell-main">
                      <EmployeeLink id={item.id}>{item.fullName}</EmployeeLink>
                      <small className="muted-text block">{item.employeeCode}</small>
                    </td>
                    <td data-label="Phòng ban / Chức vụ" className={item.departmentName ? '' : 'muted-cell'}>
                      {[item.departmentName, item.position].filter(Boolean).join(' · ') || 'Chưa có'}
                    </td>
                    <td data-label="Email" className={reason && reason !== skipReasons.EMPLOYEE_NOT_WORKING ? 'muted-cell' : ''}>
                      {item.email || 'Chưa có email'}
                      {reason && <small className="muted-text block">{reason}</small>}
                    </td>
                    <td data-label="Trạng thái">{statusLabels[item.status] || item.status}</td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={INACTIVE_STATUSES.includes(item.status)}
                        onClick={() => onGrant(item)}
                        aria-label={`Cấp tài khoản cho ${item.fullName}`}
                      >
                        <Plus size={16} aria-hidden="true" />
                        Cấp tài khoản
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6}>{keyword ? 'Không có nhân viên phù hợp' : 'Mọi nhân viên đang làm đều đã có tài khoản.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        Cấp hàng loạt: mỗi người được tài khoản vai trò Nhân viên, email đăng nhập là email trong hồ sơ, mật khẩu ngẫu nhiên. Người
        chưa có email hoặc email đã được dùng thì cấp từng người bằng nút “Cấp tài khoản” để nhập email khác.
      </p>
    </>
  );
}

function BulkResultDialog({ result, onClose }) {
  const [downloaded, setDownloaded] = useState(false);
  const { created, skipped } = result;

  function download() {
    downloadCredentials(created);
    setDownloaded(true);
  }

  return (
    <FormDialog
      title="Kết quả cấp tài khoản hàng loạt"
      subtitle={`Đã cấp ${created.length} tài khoản${skipped.length ? `, bỏ qua ${skipped.length} người` : ''}`}
      wide
      onClose={onClose}
    >
      <div className="dialog-form">
        {created.length > 0 && (
          <>
            <p className="form-error" role="alert">
              Mật khẩu chỉ hiện MỘT LẦN ở đây. Hãy tải file trước khi đóng để gửi cho từng nhân viên.
            </p>
            <div className="table-wrap">
              <table className="users-table responsive-table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Email đăng nhập</th>
                    <th>Mật khẩu ban đầu</th>
                  </tr>
                </thead>
                <tbody>
                  {created.map((item) => (
                    <tr key={item.id}>
                      <td className="cell-main">
                        <strong>{item.fullName}</strong>
                        <small className="muted-text block">{item.employeeCode}</small>
                      </td>
                      <td data-label="Email">{item.email}</td>
                      <td data-label="Mật khẩu">
                        <code className="code-tag">{item.password}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {skipped.length > 0 && (
          <div>
            <strong>Bỏ qua</strong>
            <ul>
              {skipped.map((item) => (
                <li key={item.employeeId}>
                  {item.fullName || item.employeeId} {item.employeeCode ? `(${item.employeeCode})` : ''}: {skipReasons[item.reason] || item.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="form-actions">
          {created.length > 0 && (
            <button type="button" className="primary-button" onClick={download}>
              <Download size={18} aria-hidden="true" />
              Tải file mật khẩu (Excel)
            </button>
          )}
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              if (created.length && !downloaded && !window.confirm('Chưa tải file mật khẩu. Đóng thì sẽ không xem lại được mật khẩu nữa. Vẫn đóng?')) {
                return;
              }

              onClose();
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </FormDialog>
  );
}

// HR-007: Admin quản lý tài khoản đăng nhập (thay cho tự đăng ký đã bỏ).
export default function UsersPanel({ user, showToast }) {
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [tab, setTab] = useState('accounts');
  const [bulk, setBulk] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Gõ xong 300 ms mới tìm, không gọi API theo từng phím.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(keyword.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.users({ search, role: roleFilter, status: statusFilter, page, limit: PAGE_SIZE });
      setAccounts(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page]);

  const loadEmployeeOptions = useCallback(async () => {
    try {
      const response = await api.userEmployeeOptions();
      setEmployeeOptions(response.data);
    } catch (err) {
      showToast('error', err.message);
    }
  }, [showToast]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadEmployeeOptions();
  }, [loadEmployeeOptions]);

  async function saveAccount(values, password) {
    if (editing.id) {
      await api.updateUser(editing.id, values);
      showToast('success', `Đã cập nhật tài khoản ${editing.email}.`);
    } else {
      await api.createUser(values);
      showToast('success', `Đã cấp tài khoản ${values.email}. Mật khẩu ban đầu: ${password}`);
    }

    setEditing(null);
    await Promise.all([loadAccounts(), loadEmployeeOptions()]);
  }

  async function resetPassword(password) {
    await api.resetUserPassword(resetting.id, password);
    showToast('success', `Đã đặt lại mật khẩu cho ${resetting.email}. Mật khẩu mới: ${password}`);
    setResetting(null);
  }

  async function confirmToggle() {
    const account = toggling;
    setToggleBusy(true);

    try {
      await api.updateUser(account.id, { isActive: !account.isActive });
      showToast('success', account.isActive ? `Đã khóa tài khoản ${account.email}.` : `Đã mở khóa tài khoản ${account.email}.`);
      await loadAccounts();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setToggleBusy(false);
      setToggling(null);
    }
  }

  const cancelToggle = useCallback(() => {
    if (!toggleBusy) {
      setToggling(null);
    }
  }, [toggleBusy]);

  async function confirmBulk() {
    setBulkBusy(true);

    try {
      const response = await api.bulkCreateUsers(bulk.ids);
      bulk.onDone();
      setBulkResult(response.data);
      await Promise.all([loadAccounts(), loadEmployeeOptions()]);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBulkBusy(false);
      setBulk(null);
    }
  }

  const unlinkedEmployees = employeeOptions.filter((item) => !item.linkedUserId && !INACTIVE_STATUSES.includes(item.status)).length;

  return (
    <section className="content-panel" id="users">
      <div className="section-header">
        <div>
          <h2>{tab === 'accounts' ? 'Danh sách tài khoản' : 'Nhân viên chưa có tài khoản'}</h2>
          {employeeOptions.length > 0 && (
            <p className="field-hint">{unlinkedEmployees} nhân viên đang làm chưa có tài khoản đăng nhập.</p>
          )}
        </div>
        <button type="button" className="primary-button" onClick={() => setEditing({})}>
          <Plus size={18} aria-hidden="true" />
          Cấp tài khoản
        </button>
      </div>

      <TabBar
        label="Quản lý tài khoản"
        tabs={[
          { id: 'accounts', label: 'Tài khoản', count: total },
          { id: 'pending', label: 'Chưa có tài khoản', count: unlinkedEmployees }
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'pending' ? (
        <PendingEmployees
          employeeOptions={employeeOptions}
          onGrant={(employee) => setEditing({ employeeId: employee.id, email: employee.email || '', fullName: employee.fullName })}
          onBulk={(ids, onDone) => setBulk({ ids, onDone })}
        />
      ) : (
      <>
      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo họ tên, email, mã nhân viên"
            aria-label="Tìm tài khoản"
          />
        </label>
        <select
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(event.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo vai trò"
        >
          <option value="">Tất cả vai trò</option>
          {ROLES.map((role) => (
            <option value={role} key={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo trạng thái"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="locked">Đã khóa</option>
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="users-table responsive-table">
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Vai trò</th>
              <th>Hồ sơ liên kết</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Đang tải dữ liệu</td>
              </tr>
            ) : accounts.length ? (
              accounts.map((account) => {
                const isSelf = account.id === user?.id;
                return (
                  <tr key={account.id}>
                    <td className="cell-main">
                      <strong>
                        {account.fullName}
                        {isSelf ? ' (bạn)' : ''}
                      </strong>
                      <small className="muted-text block">{account.email}</small>
                    </td>
                    <td data-label="Vai trò">{roleLabels[account.role] || account.role}</td>
                    <td data-label="Hồ sơ liên kết" className={account.employeeId ? '' : 'muted-cell'}>
                      {account.employeeId ? (
                        <EmployeeLink id={account.employeeId}>
                          {account.employeeName} ({account.employeeCode})
                        </EmployeeLink>
                      ) : (
                        'Chưa liên kết'
                      )}
                    </td>
                    <td data-label="Trạng thái">
                      <span className={`status-pill ${account.isActive ? 'status-active' : 'status-inactive'}`}>
                        {account.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-button success"
                          onClick={() => setEditing(account)}
                          title="Sửa tài khoản"
                          aria-label={`Sửa tài khoản ${account.email}`}
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        {!isSelf && (
                          <>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => setResetting(account)}
                              title="Đặt lại mật khẩu"
                              aria-label={`Đặt lại mật khẩu ${account.email}`}
                            >
                              <KeyRound size={17} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={`icon-button ${account.isActive ? 'danger' : 'success'}`}
                              onClick={() => setToggling(account)}
                              title={account.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                              aria-label={`${account.isActive ? 'Khóa' : 'Mở khóa'} tài khoản ${account.email}`}
                            >
                              {account.isActive ? (
                                <Lock size={17} aria-hidden="true" />
                              ) : (
                                <LockOpen size={17} aria-hidden="true" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>{search || roleFilter || statusFilter ? 'Không có tài khoản phù hợp' : 'Chưa có tài khoản nào'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} unit="tài khoản" onChange={setPage} />
      </>
      )}

      {bulk && (
        <FormDialog title="Cấp tài khoản hàng loạt?" busy={bulkBusy} onClose={() => !bulkBusy && setBulk(null)}>
          <div className="dialog-form">
            <p>
              Tạo {bulk.ids.length} tài khoản vai trò Nhân viên, email đăng nhập là email trong hồ sơ, mỗi người một mật khẩu ngẫu
              nhiên. Sau khi tạo sẽ hiện danh sách mật khẩu để tải về (chỉ hiện một lần).
            </p>
            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={() => setBulk(null)} disabled={bulkBusy}>
                Hủy
              </button>
              <button type="button" className="primary-button" onClick={confirmBulk} disabled={bulkBusy}>
                <UsersRound size={18} aria-hidden="true" />
                {bulkBusy ? 'Đang tạo tài khoản' : `Cấp ${bulk.ids.length} tài khoản`}
              </button>
            </div>
          </div>
        </FormDialog>
      )}

      {bulkResult && <BulkResultDialog result={bulkResult} onClose={() => setBulkResult(null)} />}

      {editing && (
        <AccountDialog
          key={editing.id || 'new'}
          account={editing}
          employeeOptions={employeeOptions}
          onSubmit={saveAccount}
          onClose={() => setEditing(null)}
        />
      )}

      {resetting && <ResetPasswordDialog account={resetting} onSubmit={resetPassword} onClose={() => setResetting(null)} />}

      {toggling && (
        <ConfirmDialog
          title={toggling.isActive ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?'}
          message={
            toggling.isActive
              ? `${toggling.fullName} (${toggling.email}) sẽ bị đăng xuất ngay và không đăng nhập được nữa. Dữ liệu chấm công, đơn từ vẫn được giữ.`
              : `${toggling.fullName} (${toggling.email}) sẽ đăng nhập lại được bằng mật khẩu hiện tại.`
          }
          confirmLabel={toggling.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
          busy={toggleBusy}
          onConfirm={confirmToggle}
          onCancel={cancelToggle}
        />
      )}
    </section>
  );
}
