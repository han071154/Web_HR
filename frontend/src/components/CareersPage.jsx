import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { useEffect } from 'react';
import { COMPANY_CONTACT, COMPANY_TAGLINE } from '../companyProfile.js';
import BrandLogo, { COMPANY_NAME } from './BrandLogo.jsx';
import CareersHome from './CareersHome.jsx';
import JobApplyPage from './JobApplyPage.jsx';
import JobDetailPage from './JobDetailPage.jsx';

// Trang tuyển dụng công khai (Figma M-07a/b/c): ai cũng xem tin và nộp hồ sơ, không cần đăng nhập.
// Đường dẫn: #/ · #/gioi-thieu · #/viec-lam · #/lien-he · #/viec-lam/<id> · #/viec-lam/<id>/ung-tuyen

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
            <BrandLogo small />
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
        <div className="careers-container careers-footer-grid">
          <div className="careers-footer-about">
            <div className="brand-row">
              <BrandLogo small />
            </div>
            <p>{COMPANY_TAGLINE}</p>
          </div>

          <div>
            <h3>Liên hệ tuyển dụng</h3>
            <ul className="careers-contact">
              <li>
                <MapPin size={16} aria-hidden="true" />
                {COMPANY_CONTACT.address}
              </li>
              <li>
                <Phone size={16} aria-hidden="true" />
                Hotline: {COMPANY_CONTACT.phone}
              </li>
              <li>
                <Mail size={16} aria-hidden="true" />
                <a href={`mailto:${COMPANY_CONTACT.email}`}>{COMPANY_CONTACT.email}</a>
              </li>
              <li>
                <Clock size={16} aria-hidden="true" />
                {COMPANY_CONTACT.hours}
              </li>
            </ul>
          </div>

          <div>
            <h3>Khám phá</h3>
            <ul className="careers-footer-links">
              <li>
                <a href="#/gioi-thieu">Giới thiệu công ty</a>
              </li>
              <li>
                <a href="#/viec-lam">Việc làm đang tuyển</a>
              </li>
              <li>
                <a href="#/lien-he">Liên hệ</a>
              </li>
            </ul>
          </div>

          <div>
            <h3>Dành cho nhân viên</h3>
            <ul className="careers-footer-links">
              <li>
                <a href={user ? '#employees' : '#login'}>{user ? 'Vào trang quản lý' : 'Đăng nhập hệ thống'}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="careers-container careers-footer-bottom">
          <p>© 2026 {COMPANY_NAME}. Bảo lưu mọi quyền.</p>
          <p>Nhóm 3 · LV24-006</p>
        </div>
      </footer>
    </div>
  );
}
