import { Lock, Mail, Users } from 'lucide-react';
import { useState } from 'react';
import { api, setSession } from '../api.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email, password) {
  const errors = {};

  if (!email.trim()) {
    errors.email = 'Vui lòng nhập email';
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = 'Email không hợp lệ';
  }

  if (!password) {
    errors.password = 'Vui lòng nhập mật khẩu';
  }

  return errors;
}

// Màn hình đăng nhập theo mockup M-01: form bên trái, ảnh minh hoạ bên phải.
export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotHint, setShowForgotHint] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const errors = validate(email, password);
    setFieldErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    setLoading(true);

    try {
      const session = await api.login(email.trim(), password);
      setSession(session, remember);
      onLogin(session.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-main">
        <div className="login-panel">
          <div className="brand-row">
            <div className="brand-mark small">
              <Users size={18} aria-hidden="true" />
            </div>
            <span className="brand-name">WebHR</span>
          </div>

          <h1>Đăng nhập</h1>
          <p className="page-subtitle">Dùng tài khoản được cấp để quản lý nhân sự và ca làm.</p>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {error && <p className="form-error" role="alert">{error}</p>}

            <label>
              Email
              <span className={`input-icon${fieldErrors.email ? ' invalid' : ''}`}>
                <Mail size={16} aria-hidden="true" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="username"
                  placeholder="an.nv@example.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                />
              </span>
              {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
            </label>

            <label>
              Mật khẩu
              <span className={`input-icon${fieldErrors.password ? ' invalid' : ''}`}>
                <Lock size={16} aria-hidden="true" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={Boolean(fieldErrors.password)}
                />
              </span>
              {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
            </label>

            <label className="checkbox-field">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              Ghi nhớ đăng nhập
            </label>

            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>

            <button type="button" className="text-button" onClick={() => setShowForgotHint((value) => !value)}>
              Quên mật khẩu?
            </button>
            {showForgotHint && (
              <p className="login-hint">Vui lòng liên hệ quản trị viên để được cấp lại mật khẩu.</p>
            )}
          </form>

          <p className="login-careers">
            Chưa phải nhân viên? <a href="#/viec-lam">Xem việc làm đang tuyển</a>
          </p>
        </div>

        <p className="login-footer">© 2026 WebHR · Nhóm 3, LV24-006</p>
      </section>

      <aside className="login-hero" aria-hidden="true">
        <div className="login-hero-content">
          <h2>
            Quản lý nhân sự
            <br />
            và ca làm việc
          </h2>
          <p>Xếp ca, chấm công, nghỉ phép và báo cáo trên một nền tảng, gắn với tuyển dụng.</p>
          <div className="shift-preview">
            <div className="shift-chips">
              <span className="shift-chip morning">Sáng</span>
              <span className="shift-chip afternoon">Chiều</span>
              <span className="shift-chip night">Đêm</span>
            </div>
            <strong>Lịch ca tuần này</strong>
            <span>Xếp ca và phát hiện trùng ca tự động</span>
          </div>
        </div>
      </aside>
    </main>
  );
}
