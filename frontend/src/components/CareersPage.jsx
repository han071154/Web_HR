import { Mail, MapPin, Phone, Users } from 'lucide-react';
import { useEffect } from 'react';
import CareersHome from './CareersHome.jsx';
import JobApplyPage from './JobApplyPage.jsx';
import JobDetailPage from './JobDetailPage.jsx';

// Trang tuyển dụng công khai (Figma M-07a/b/c): ai cũng xem tin và nộp hồ sơ, không cần đăng nhập.
// Đường dẫn: #/ · #/gioi-thieu · #/viec-lam · #/lien-he · #/viec-lam/<id> · #/viec-lam/<id>/ung-tuyen

const COMPANY = {
  email: 'tuyendung@webhr.vn',
  phone: '0123 456 789',
  address: '123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh'
};

const SECTIONS = { 'gioi-thieu': 'about', 'viec-lam': 'jobs', 'lien-he': 'contact' };

function parseRoute(hash) {
  const [first, jobId, action] = hash.replace(/^#\/?/, '').split('/');

  if (first === 'viec-lam' && jobId) {
    return { page: action === 'ung-tuyen' ? 'apply' : 'detail', jobId };
  }

  return { page: 'home', section: SECTIONS[first] || null };
}

export default function CareersPage({ hash, user }) {
  const route = parseRoute(hash);
  const activeNav = route.page === 'home' ? route.section : 'jobs';

  // Đổi trang thì lên đầu; bấm menu Giới thiệu / Việc làm / Liên hệ thì cuộn tới mục đó.
  useEffect(() => {
    const target = route.section && document.getElementById(`careers-${route.section}`);

    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash, route.section]);

  return (
    <div className="careers-shell">
      <header className="careers-header">
        <div className="careers-container careers-header-inner">
          <a href="#/" className="brand-row careers-brand">
            <span className="brand-mark small">
              <Users size={18} aria-hidden="true" />
            </span>
            <span className="brand-name">WebHR</span>
          </a>

          <nav className="careers-nav" aria-label="Trang tuyển dụng">
            <a href="#/gioi-thieu" className={activeNav === 'about' ? 'active' : ''}>
              Giới thiệu
            </a>
            <a href="#/viec-lam" className={activeNav === 'jobs' ? 'active' : ''}>
              Việc làm
            </a>
            <a href="#/lien-he" className={activeNav === 'contact' ? 'active' : ''}>
              Liên hệ
            </a>
          </nav>

          <a href={user ? '#employees' : '#login'} className="ghost-button careers-login">
            {user ? 'Vào trang quản lý' : 'Đăng nhập nhân viên'}
          </a>
        </div>
      </header>

      <main>
        {route.page === 'apply' ? (
          <JobApplyPage jobId={route.jobId} />
        ) : route.page === 'detail' ? (
          <JobDetailPage jobId={route.jobId} />
        ) : (
          <CareersHome />
        )}
      </main>

      <footer className="careers-footer" id="careers-contact">
        <div className="careers-container careers-footer-inner">
          <div className="brand-row">
            <span className="brand-mark small">
              <Users size={18} aria-hidden="true" />
            </span>
            <span className="brand-name">WebHR</span>
          </div>
          <ul className="careers-contact">
            <li>
              <Mail size={16} aria-hidden="true" />
              <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
            </li>
            <li>
              <Phone size={16} aria-hidden="true" />
              {COMPANY.phone}
            </li>
            <li>
              <MapPin size={16} aria-hidden="true" />
              {COMPANY.address}
            </li>
          </ul>
          <p>© 2026 WebHR · Nhóm 3, LV24-006</p>
        </div>
      </footer>
    </div>
  );
}
