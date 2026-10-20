import { Eye, EyeOff, KeyRound, Lock, LockOpen, Pencil, Plus, RefreshCw, Search, UserCog } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { normalizeText, roleLabels } from '../format.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import EmployeeLink from './EmployeeLink.jsx';
import FormDialog from './FormDialog.jsx';
import Pagination from './Pagination.jsx';

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

  const unlinkedEmployees = employeeOptions.filter((item) => !item.linkedUserId && !['RESIGNED', 'TERMINATED'].includes(item.status)).length;

  return (
    <section className="content-panel" id="users">
      <div className="section-header">
        <div>
          <h2>Danh sách tài khoản</h2>
          {employeeOptions.length > 0 && (
            <p className="field-hint">{unlinkedEmployees} nhân viên đang làm chưa có tài khoản đăng nhập.</p>
          )}
        </div>
        <button type="button" className="primary-button" onClick={() => setEditing({})}>
          <Plus size={18} aria-hidden="true" />
          Cấp tài khoản
        </button>
      </div>

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
