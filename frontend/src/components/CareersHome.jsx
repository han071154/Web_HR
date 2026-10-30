import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  Eye,
  GraduationCap,
  HeartHandshake,
  Plane,
  Search,
  ShieldCheck,
  Target,
  UsersRound,
  Wallet
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import starLogo from '../assets/star-logo.png';
import {
  ABOUT_FIGURES,
  ABOUT_POINTS,
  BENEFITS,
  CORE_VALUES,
  HERO_POINTS,
  HIRING_STEPS,
  LIFE_POINTS,
  MILESTONES,
  MISSION,
  VISION
} from '../companyProfile.js';
import { employmentTypeLabels, formatDate, formatSalaryRange, normalizeText } from '../format.js';
import { COMPANY_NAME } from './BrandLogo.jsx';

const TONES = ['purple', 'blue', 'green', 'red'];

const BENEFIT_ICONS = {
  wallet: Wallet,
  shield: ShieldCheck,
  calendar: CalendarDays,
  graduation: GraduationCap,
  plane: Plane,
  heart: HeartHandshake
};

// Mục lục dưới phần đầu trang. Cuộn bằng JS vì hash (#/...) đang dùng để định tuyến trang.
const QUICK_LINKS = [
  { id: 'careers-about', label: 'Về chúng tôi' },
  { id: 'careers-journey', label: 'Hành trình phát triển' },
  { id: 'careers-values', label: 'Giá trị cốt lõi' },
  { id: 'careers-life', label: 'Đời sống & phúc lợi' },
  { id: 'careers-jobs', label: 'Việc làm đang tuyển' }
];

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function CheckList({ items }) {
  return (
    <ul className="home-checks">
      {items.map((item) => (
        <li key={item}>
          <span aria-hidden="true">
            <Check size={15} strokeWidth={3} />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function SectionHead({ index, kicker, title, children }) {
  return (
    <div className="home-head">
      <span className="home-kicker">
        {index} / {kicker}
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

function JobCard({ job, index }) {
  return (
    <article className="job-card">
      <div className="job-card-head">
        <span className={`careers-icon ${TONES[index % TONES.length]}`}>
          <BriefcaseBusiness size={20} aria-hidden="true" />
        </span>
        <div>
          <h3>
            <a href={`#/viec-lam/${job.id}`}>{job.title}</a>
          </h3>
          <p>{job.departmentName || 'Chưa phân phòng ban'}</p>
        </div>
      </div>
      <div className="job-tags">
        <span className="job-tag">{employmentTypeLabels[job.employmentType] || job.employmentType}</span>
        <span className="job-tag salary">{formatSalaryRange(job.salaryMin, job.salaryMax)}</span>
      </div>
      <p className="job-deadline">
        <CalendarDays size={15} aria-hidden="true" />
        Hạn nộp: {job.deadline ? formatDate(job.deadline) : 'Không giới hạn'}
      </p>
      <div className="job-card-actions">
        <a href={`#/viec-lam/${job.id}`} className="ghost-button">
          Xem chi tiết
        </a>
        <a href={`#/viec-lam/${job.id}/ung-tuyen`} className="primary-button">
          Ứng tuyển
        </a>
      </div>
    </article>
  );
}

export default function CareersHome() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    let cancelled = false;

    api
      .publicJobs()
      .then((response) => {
        if (!cancelled) {
          setJobs(response.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Lựa chọn trong bộ lọc lấy từ chính các tin đang mở.
  const departments = useMemo(() => {
    const map = new Map();
    jobs.forEach((job) => job.departmentId && map.set(job.departmentId, job.departmentName));
    return [...map].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  }, [jobs]);
  const jobTypes = useMemo(() => Object.keys(employmentTypeLabels).filter((type) => jobs.some((job) => job.employmentType === type)), [jobs]);

  // Lọc ngay khi gõ / chọn, giống các màn danh sách khác.
  const filteredJobs = useMemo(() => {
    const keyword = normalizeText(search.trim());

    return jobs.filter(
      (job) =>
        (!keyword || normalizeText(job.title).includes(keyword)) &&
        (!departmentFilter || job.departmentId === departmentFilter) &&
        (!typeFilter || job.employmentType === typeFilter)
    );
  }, [jobs, search, departmentFilter, typeFilter]);

  const openings = jobs.reduce((total, job) => total + job.quantity, 0);
  const isFiltering = Boolean(search.trim() || departmentFilter || typeFilter);
  const stat = (value) => (loading || error ? '–' : value);

  function clearFilters() {
    setSearch('');
    setDepartmentFilter('');
    setTypeFilter('');
  }

  return (
    <>
      {/* ---------- Phần đầu trang ---------- */}
      <section className="home-hero">
        <div className="careers-container home-hero-inner">
          <div className="home-hero-copy">
            <span className="home-pill">{COMPANY_NAME} · Tuyển dụng 2026</span>
            <h1>
              Nơi mỗi người là một ngôi sao. <span>Cùng {COMPANY_NAME} vươn xa.</span>
            </h1>
            <p>
              Hơn 350 con người đang cùng nhau đưa sản phẩm chất lượng đến khách hàng trên khắp Việt Nam. Tìm vị trí
              phù hợp với bạn và ứng tuyển chỉ trong vài phút.
            </p>
            <div className="home-actions">
              <button type="button" className="home-btn gold" onClick={() => scrollToSection('careers-jobs')}>
                Xem việc làm đang tuyển
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <button type="button" className="home-btn outline" onClick={() => scrollToSection('careers-about')}>
                Tìm hiểu về chúng tôi
              </button>
            </div>
            <ul className="home-hero-points">
              {HERO_POINTS.map((point) => (
                <li key={point}>
                  <Check size={16} strokeWidth={3} aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="home-hero-visual" aria-hidden="true">
            <div className="home-orbit">
              <div className="home-orbit-core">
                <img src={starLogo} alt="" />
              </div>
            </div>
            <div className="home-float home-float-top">
              <BriefcaseBusiness size={18} />
              <b>{stat(jobs.length)}</b> vị trí đang mở
            </div>
            <div className="home-float home-float-bottom">
              <span className="careers-icon green">
                <UsersRound size={20} />
              </span>
              <span>
                <b>{stat(openings)} người cần tuyển</b>
                <small>tại {stat(departments.length)} phòng ban</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Mục lục nhanh ---------- */}
      <nav className="home-strip" aria-label="Nội dung trang">
        <div className="careers-container home-strip-inner">
          {QUICK_LINKS.map((link, index) => (
            <button key={link.id} type="button" onClick={() => scrollToSection(link.id)}>
              <span>0{index + 1}</span>
              {link.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ---------- 01 Về chúng tôi ---------- */}
      <section className="home-section" id="careers-about">
        <div className="careers-container home-split">
          <div>
            <SectionHead index="01" kicker="Về chúng tôi" title={`${COMPANY_NAME} – vững vàng từ con người`}>
              Thành lập năm 2016, {COMPANY_NAME} là doanh nghiệp thương mại – phân phối ứng dụng công nghệ. Chúng tôi tin
              rằng một đội ngũ được tôn trọng và phát triển đúng hướng sẽ tạo ra dịch vụ tốt nhất cho khách hàng.
            </SectionHead>
            <CheckList items={ABOUT_POINTS} />
          </div>

          <div className="home-about-card">
            <div className="home-figures">
              {ABOUT_FIGURES.map((figure) => (
                <div key={figure.label}>
                  <b>{figure.value}</b>
                  <span>{figure.label}</span>
                </div>
              ))}
            </div>
            <div className="home-mv">
              <Target size={20} aria-hidden="true" />
              <div>
                <strong>Sứ mệnh</strong>
                <p>{MISSION}</p>
              </div>
            </div>
            <div className="home-mv">
              <Eye size={20} aria-hidden="true" />
              <div>
                <strong>Tầm nhìn</strong>
                <p>{VISION}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 02 Hành trình ---------- */}
      <section className="home-section white" id="careers-journey">
        <div className="careers-container">
          <SectionHead index="02" kicker="Hành trình phát triển" title="10 năm lớn lên cùng khách hàng" />
          <ol className="home-timeline">
            {MILESTONES.map((milestone) => (
              <li key={milestone.year}>
                <span className="home-timeline-dot" aria-hidden="true" />
                <b>{milestone.year}</b>
                <strong>{milestone.title}</strong>
                <p>{milestone.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- 03 Giá trị cốt lõi ---------- */}
      <section className="home-section dark" id="careers-values">
        <div className="careers-container">
          <SectionHead index="03" kicker="Giá trị cốt lõi" title="Bốn giá trị làm nên chữ STAR">
            Đây là cách chúng tôi làm việc mỗi ngày, cũng là điều chúng tôi tìm kiếm ở mỗi thành viên mới.
          </SectionHead>
          <div className="home-values">
            {CORE_VALUES.map((value) => (
              <article key={value.letter} className="home-value">
                <span className="home-value-letter">{value.letter}</span>
                <span className="home-value-name">{value.name}</span>
                <h3>{value.title}</h3>
                <p>{value.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 04 Đời sống & phúc lợi ---------- */}
      <section className="home-section white" id="careers-life">
        <div className="careers-container home-split">
          <div>
            <SectionHead index="04" kicker="Đời sống tại Star" title="Làm việc hết mình, được chăm lo xứng đáng">
              Chúng tôi đầu tư cho con người trước tiên: thu nhập rõ ràng, cơ hội học hỏi và một tập thể luôn sẵn sàng
              hỗ trợ nhau.
            </SectionHead>
            <CheckList items={LIFE_POINTS} />
          </div>

          <div className="home-benefits">
            {BENEFITS.map((benefit, index) => {
              const Icon = BENEFIT_ICONS[benefit.icon];

              return (
                <article key={benefit.title} className="home-benefit">
                  <span className={`careers-icon ${TONES[index % TONES.length]}`}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- 05 Việc làm đang tuyển ---------- */}
      <section className="home-section" id="careers-jobs">
        <div className="careers-container">
          <SectionHead
            index="05"
            kicker="Cơ hội nghề nghiệp"
            title={
              <>
                Việc làm đang tuyển
                {!loading && !error && <span className="count-pill">{jobs.length} vị trí</span>}
              </>
            }
          >
            Tìm vị trí phù hợp theo tên, phòng ban hoặc hình thức làm việc.
          </SectionHead>

          <div className="careers-filters">
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên vị trí..."
                aria-label="Tìm theo tên vị trí"
              />
            </label>
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              aria-label="Lọc theo phòng ban"
            >
              <option value="">Tất cả phòng ban</option>
              {departments.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Lọc theo hình thức">
              <option value="">Tất cả hình thức</option>
              {jobTypes.map((type) => (
                <option key={type} value={type}>
                  {employmentTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="form-error">{error}</p>}

          {loading ? (
            <p className="careers-empty">Đang tải danh sách việc làm...</p>
          ) : !error && !jobs.length ? (
            <p className="careers-empty">Hiện chưa có vị trí đang tuyển. Vui lòng quay lại sau.</p>
          ) : !error && !filteredJobs.length ? (
            <p className="careers-empty">
              Không có vị trí phù hợp với bộ lọc.{' '}
              <button type="button" className="text-button" onClick={clearFilters}>
                Xóa bộ lọc
              </button>
            </p>
          ) : (
            <div className="job-grid">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} index={jobs.indexOf(job)} />
              ))}
            </div>
          )}
          {isFiltering && filteredJobs.length > 0 && (
            <p className="field-hint careers-result-count">
              Tìm thấy {filteredJobs.length}/{jobs.length} vị trí.
            </p>
          )}

          <div className="home-steps">
            <h3>
              <Building2 size={20} aria-hidden="true" />
              Quy trình ứng tuyển
            </h3>
            <ol>
              {HIRING_STEPS.map((step, index) => (
                <li key={step.title}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------- Kêu gọi ứng tuyển ---------- */}
      <section className="home-cta-wrap">
        <div className="careers-container home-cta">
          <div>
            <h2>Sẵn sàng trở thành ngôi sao tiếp theo?</h2>
            <p>Gửi hồ sơ ngay hôm nay, bộ phận Nhân sự sẽ phản hồi bạn trong 3–5 ngày làm việc.</p>
          </div>
          <button type="button" className="home-btn navy" onClick={() => scrollToSection('careers-jobs')}>
            Ứng tuyển ngay
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    </>
  );
}
