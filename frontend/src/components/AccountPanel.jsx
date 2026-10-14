import { Hash, KeyRound, Mail, Phone, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, replaceToken } from '../api.js';
import { employmentTypeLabels, formatDate, formatMoney, genderLabels, roleLabels, statusLabels } from '../format.js';
import { isNotLinkedError } from '../messages.js';
import Avatar from './Avatar.jsx';

const EMPTY = 'Chưa cập nhật';
const PHONE_PATTERN = /^[0-9+().\s-]{8,20}$/;

function InfoGrid({ rows }) {
  return (
    <dl className="detail-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={value ? '' : 'muted'}>{value || EMPTY}</dd>
        </div>
      ))}
    </dl>
  );
}

// Nhân viên tự sửa thông tin liên hệ (HR-011). Các trường khác do phòng nhân sự quản lý.
function ContactForm({ profile, onSaved, showToast }) {
  const [form, setForm] = useState({ phone: profile.phone || '', address: profile.address || '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const changed = form.phone.trim() !== (profile.phone || '') || form.address.trim() !== (profile.address || '');

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.phone.trim() && !PHONE_PATTERN.test(form.phone.trim())) {
      setError('Số điện thoại không hợp lệ.');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const response = await api.updateMyProfile({ phone: form.phone.trim() || null, address: form.address.trim() || null });
      onSaved(response.data);
      showToast('success', 'Đã cập nhật thông tin liên hệ.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content-panel">
      <div className="section-header">
        <h2>Cập nhật thông tin liên hệ</h2>
      </div>
      <form className="inline-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Số điện thoại
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              maxLength={20}
              placeholder="0901 234 567"
            />
          </label>
          <label>
            Địa chỉ
            <input
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              maxLength={500}
              placeholder="Số nhà, đường, phường/xã, tỉnh/thành"
            />
          </label>
        </div>
        <p className="field-hint">Họ tên, ngày sinh, email, phòng ban, chức vụ, lương… do phòng nhân sự cập nhật. Cần sửa hãy liên hệ phòng nhân sự.</p>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={saving || !changed}>
            <Save size={18} aria-hidden="true" />
            {saving ? 'Đang lưu' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </section>
  );
}

const emptyPasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

// Đổi mật khẩu cho mọi tài khoản (HR-027). Sau khi đổi, các phiên đăng nhập cũ không làm mới được nữa.
function PasswordForm({ showToast }) {
  const [form, setForm] = useState(emptyPasswordForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function validate() {
    if (form.newPassword.length < 8 || form.newPassword.length > 72) {
      return 'Mật khẩu mới phải từ 8 đến 72 ký tự.';
    }

    if (!/[A-Za-z]/.test(form.newPassword) || !/\d/.test(form.newPassword)) {
      return 'Mật khẩu mới phải có cả chữ và số.';
    }

    if (form.newPassword === form.currentPassword) {
      return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
    }

    return form.newPassword === form.confirmPassword ? '' : 'Nhập lại mật khẩu mới chưa khớp.';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const message = validate();

    if (message) {
      setError(message);
      return;
    }

    setError('');
    setSaving(true);

    try {
      const response = await api.changePassword(form.currentPassword, form.newPassword);
      replaceToken(response.token);
      setForm(emptyPasswordForm);
      showToast('success', 'Đã đổi mật khẩu. Lần đăng nhập sau hãy dùng mật khẩu mới.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const field = (name, label, autoComplete) => (
    <label>
      {label}
      <input
        type="password"
        value={form[name]}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        autoComplete={autoComplete}
        maxLength={72}
        required
      />
    </label>
  );

  return (
    <section className="content-panel">
      <div className="section-header">
        <h2>Đổi mật khẩu</h2>
      </div>
      <form className="inline-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          {field('currentPassword', 'Mật khẩu hiện tại', 'current-password')}
          <span />
          {field('newPassword', 'Mật khẩu mới', 'new-password')}
          {field('confirmPassword', 'Nhập lại mật khẩu mới', 'new-password')}
        </div>
        <p className="field-hint">Từ 8 ký tự, có cả chữ và số. Quên mật khẩu hiện tại thì liên hệ quản trị viên để được cấp lại.</p>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={saving}>
            <KeyRound size={18} aria-hidden="true" />
            {saving ? 'Đang đổi' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </section>
  );
}

// Mục "Hồ sơ của tôi" (nhân viên) / "Tài khoản" (HR): xem hồ sơ, sửa liên hệ, đổi mật khẩu.
export default function AccountPanel({ user, showToast }) {
  const isEmployee = user.role === 'EMPLOYEE';
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isEmployee);
  const [error, setError] = useState('');
  const [notLinked, setNotLinked] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);

    try {
      setProfile((await api.myProfile()).data);
      setError('');
    } catch (err) {
      setNotLinked(isNotLinkedError(err));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isEmployee) {
      loadProfile();
    }
  }, [isEmployee, loadProfile]);

  if (!isEmployee || notLinked) {
    return (
      <>
        <section className="content-panel info-card">
          <h2>Tài khoản đăng nhập</h2>
          <InfoGrid
            rows={[
              ['Họ tên', user.fullName],
              ['Email đăng nhập', user.email],
              ['Vai trò', roleLabels[user.role] || user.role]
            ]}
          />
          {notLinked && (
            <p className="field-hint">Tài khoản chưa được liên kết với hồ sơ nhân viên nên chưa xem được hồ sơ. Hãy liên hệ phòng nhân sự.</p>
          )}
        </section>
        <PasswordForm showToast={showToast} />
      </>
    );
  }

  if (loading) {
    return <section className="content-panel">Đang tải hồ sơ…</section>;
  }

  if (!profile) {
    return (
      <>
        <section className="content-panel">
          <p className="form-error">{error}</p>
        </section>
        <PasswordForm showToast={showToast} />
      </>
    );
  }

  const jobLine = [profile.position, profile.departmentName].filter(Boolean).join(' · ');

  return (
    <div className="detail-page">
      <div className="detail-top">
        <section className="content-panel profile-card">
          <Avatar name={profile.fullName} src={profile.avatarUrl} size="large" />
          <h2>{profile.fullName}</h2>
          {jobLine && <p className="profile-job">{jobLine}</p>}
          <span className={`status-pill status-${profile.status.toLowerCase()}`}>{statusLabels[profile.status] || profile.status}</span>
          <ul className="profile-facts">
            <li>
              <Hash size={16} aria-hidden="true" />
              <span>Mã nhân viên</span>
              <strong>{profile.employeeCode}</strong>
            </li>
            <li>
              <Mail size={16} aria-hidden="true" />
              <span>Email</span>
              <strong>{profile.email}</strong>
            </li>
            <li>
              <Phone size={16} aria-hidden="true" />
              <span>Điện thoại</span>
              <strong className={profile.phone ? '' : 'muted'}>{profile.phone || EMPTY}</strong>
            </li>
          </ul>
        </section>

        <section className="content-panel info-card">
          <h2>Thông tin cá nhân</h2>
          <InfoGrid
            rows={[
              ['Họ tên', profile.fullName],
              ['Ngày sinh', formatDate(profile.dateOfBirth)],
              ['Giới tính', genderLabels[profile.gender]],
              ['Số điện thoại', profile.phone],
              ['Email', profile.email],
              ['CCCD', profile.idNumber],
              ['Địa chỉ', profile.address]
            ]}
          />
          <h2 className="info-divider">Thông tin công việc</h2>
          <InfoGrid
            rows={[
              ['Phòng ban', profile.departmentName],
              ['Chức vụ', profile.position],
              ['Quản lý trực tiếp', profile.managerName],
              ['Ngày vào làm', formatDate(profile.hireDate)],
              ['Hình thức làm việc', employmentTypeLabels[profile.employmentType]],
              ['Lương cơ bản', formatMoney(profile.baseSalary)]
            ]}
          />
        </section>
      </div>

      <ContactForm key={profile.updatedAt} profile={profile} onSaved={setProfile} showToast={showToast} />
      <PasswordForm showToast={showToast} />
    </div>
  );
}
