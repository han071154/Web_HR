import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Gift,
  HeartHandshake,
  Search,
  Target,
  UsersRound
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatDate, formatSalaryRange, jobTypeLabels, normalizeText } from '../format.js';

const ABOUT = [
  {
    icon: Target,
    tone: 'purple',
    title: 'Sứ mệnh',
    text: 'Giúp doanh nghiệp quản lý con người dễ dàng, chính xác và công bằng.'
  },
  {
    icon: HeartHandshake,
    tone: 'blue',
    title: 'Văn hóa làm việc',
    text: 'Tôn trọng, chủ động và cùng nhau phát triển trong từng dự án.'
  },
  {
    icon: Gift,
    tone: 'green',
    title: 'Phúc lợi',
    text: 'Lương thưởng cạnh tranh, BHXH đầy đủ, 12 ngày phép và đào tạo định kỳ.'
  }
];

const TONES = ['purple', 'blue', 'green', 'red'];

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
        <span className="job-tag">{jobTypeLabels[job.employmentType] || job.employmentType}</span>
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
  const jobTypes = useMemo(() => Object.keys(jobTypeLabels).filter((type) => jobs.some((job) => job.employmentType === type)), [jobs]);

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

  function clearFilters() {
    setSearch('');
    setDepartmentFilter('');
    setTypeFilter('');
  }

  return (
    <>
      <section className="careers-hero">
        <div className="careers-container careers-hero-inner">
          <div>
            <h1>Cùng xây dựng đội ngũ WebHR</h1>
            <p>
              Chúng tôi phát triển giải pháp quản lý nhân sự, xếp ca và chấm công cho doanh nghiệp Việt. Tìm vị trí
              phù hợp và ứng tuyển chỉ trong vài phút.
            </p>
            <div className="careers-hero-actions">
              <a href="#/viec-lam" className="careers-hero-primary">
                Xem việc làm đang tuyển
              </a>
              <a href="#/gioi-thieu" className="careers-hero-secondary">
                Về chúng tôi
              </a>
            </div>
          </div>

          <div className="careers-stats">
            <strong>Đang tuyển dụng</strong>
            <div>
              <span className="careers-icon purple">
                <BriefcaseBusiness size={20} aria-hidden="true" />
              </span>
              <b>{loading ? '–' : jobs.length}</b>
              <span>Vị trí đang mở</span>
            </div>
            <div>
              <span className="careers-icon blue">
                <Building2 size={20} aria-hidden="true" />
              </span>
              <b>{loading ? '–' : departments.length}</b>
              <span>Phòng ban</span>
            </div>
            <div>
              <span className="careers-icon green">
                <UsersRound size={20} aria-hidden="true" />
              </span>
              <b>{loading ? '–' : openings}</b>
              <span>Người cần tuyển</span>
            </div>
          </div>
        </div>
      </section>

      <section className="careers-section careers-container" id="careers-about">
        <h2 className="careers-title">Về công ty</h2>
        <p className="page-subtitle">Môi trường làm việc trẻ, minh bạch và luôn học hỏi.</p>
        <div className="about-grid">
          {ABOUT.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className="about-card">
                <div>
                  <span className={`careers-icon large ${item.tone}`}>
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3>{item.title}</h3>
                </div>
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="careers-section careers-container" id="careers-jobs">
        <div className="careers-title-row">
          <h2 className="careers-title">Việc làm đang tuyển</h2>
          {!loading && <span className="count-pill">{jobs.length} vị trí</span>}
        </div>

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
                {jobTypeLabels[type]}
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
      </section>
    </>
  );
}
