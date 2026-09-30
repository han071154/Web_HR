import { ArrowLeft, BriefcaseBusiness, CalendarDays, GraduationCap, TriangleAlert, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { daysUntil, formatDate, formatSalaryRange, jobTypeLabels } from '../format.js';

// Mô tả, yêu cầu, quyền lợi lưu mỗi ý một dòng → hiển thị thành danh sách gạch đầu dòng.
function Bullets({ text }) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <ul className="job-bullets">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function deadlineText(deadline) {
  if (!deadline) {
    return 'Không giới hạn';
  }

  const days = daysUntil(deadline);
  const suffix = days > 0 ? ` · còn ${days} ngày` : days === 0 ? ' · hạn chót hôm nay' : '';
  return `${formatDate(deadline)}${suffix}`;
}

export default function JobDetailPage({ jobId }) {
  const [job, setJob] = useState(null);
  const [otherJobs, setOtherJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([api.publicJob(jobId), api.publicJobs().catch(() => ({ data: [] }))])
      .then(([jobResponse, listResponse]) => {
        if (!cancelled) {
          setJob(jobResponse.data);
          setOtherJobs(listResponse.data.filter((item) => item.id !== jobId).slice(0, 3));
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
  }, [jobId]);

  if (loading) {
    return <p className="careers-container careers-empty">Đang tải tin tuyển dụng...</p>;
  }

  if (error || !job) {
    return (
      <div className="careers-container careers-page">
        <div className="careers-card careers-message">
          <p className="form-error">{error || 'Không tìm thấy tin tuyển dụng.'}</p>
          <a href="#/viec-lam" className="ghost-button">
            <ArrowLeft size={16} aria-hidden="true" />
            Quay lại danh sách việc làm
          </a>
        </div>
      </div>
    );
  }

  const applyHref = `#/viec-lam/${job.id}/ung-tuyen`;
  const sections = [
    ['Mô tả công việc', job.description],
    ['Yêu cầu ứng viên', job.requirements],
    ['Quyền lợi', job.benefits],
    ['Địa điểm và thời gian làm việc', [job.location, job.workingTime].filter(Boolean).join('\n')]
  ].filter(([, text]) => text);

  return (
    <div className="careers-container careers-page">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <a href="#/viec-lam">Việc làm</a>
        <span className="breadcrumb-sep">/</span>
        {job.title}
      </nav>

      <div className="job-detail">
        <article className="careers-card job-detail-main">
          <h1>{job.title}</h1>
          <div className="job-tags">
            <span className="job-tag">{job.departmentName || 'Chưa phân phòng ban'}</span>
            <span className="job-tag">{jobTypeLabels[job.employmentType] || job.employmentType}</span>
            <span className="job-tag">Số lượng: {job.quantity}</span>
            {job.deadline && <span className="job-tag warning">Hạn nộp: {formatDate(job.deadline)}</span>}
          </div>

          {!job.isOpen && (
            <p className="form-error job-closed">
              <TriangleAlert size={16} aria-hidden="true" />
              Tin đã hết hạn nhận hồ sơ.
            </p>
          )}

          {sections.map(([title, text]) => (
            <section key={title} className="job-section">
              <h2>{title}</h2>
              <Bullets text={text} />
            </section>
          ))}

          <div className="job-detail-actions">
            {job.isOpen && (
              <a href={applyHref} className="primary-button">
                Ứng tuyển ngay
              </a>
            )}
            <a href="#/viec-lam" className="ghost-button">
              Quay lại danh sách
            </a>
          </div>
        </article>

        <aside className="job-detail-side">
          <div className="careers-card">
            <h2>Thông tin chung</h2>
            <ul className="job-facts">
              <li>
                <span className="careers-icon green">
                  <Wallet size={18} aria-hidden="true" />
                </span>
                <div>
                  <small>Mức lương</small>
                  <strong>{formatSalaryRange(job.salaryMin, job.salaryMax)}</strong>
                </div>
              </li>
              <li>
                <span className="careers-icon blue">
                  <BriefcaseBusiness size={18} aria-hidden="true" />
                </span>
                <div>
                  <small>Hình thức</small>
                  <strong>{jobTypeLabels[job.employmentType] || job.employmentType}</strong>
                </div>
              </li>
              <li>
                <span className="careers-icon purple">
                  <GraduationCap size={18} aria-hidden="true" />
                </span>
                <div>
                  <small>Kinh nghiệm</small>
                  <strong>{job.experience || 'Không yêu cầu'}</strong>
                </div>
              </li>
              <li>
                <span className="careers-icon red">
                  <CalendarDays size={18} aria-hidden="true" />
                </span>
                <div>
                  <small>Hạn nộp</small>
                  <strong>{deadlineText(job.deadline)}</strong>
                </div>
              </li>
            </ul>
            {job.isOpen ? (
              <>
                <a href={applyHref} className="primary-button careers-block-button">
                  Ứng tuyển ngay
                </a>
                <p className="field-hint">
                  Nếu trúng tuyển, Gmail bạn dùng để ứng tuyển sẽ là tài khoản đăng nhập.
                </p>
              </>
            ) : (
              <p className="field-hint">Tin này đã ngừng nhận hồ sơ.</p>
            )}
          </div>

          {otherJobs.length > 0 && (
            <div className="careers-card">
              <h2>Việc làm khác</h2>
              <ul className="other-jobs">
                {otherJobs.map((item) => (
                  <li key={item.id}>
                    <a href={`#/viec-lam/${item.id}`}>{item.title}</a>
                    <small>
                      {item.departmentName || 'Chưa phân phòng ban'}
                      {item.deadline && ` · Hạn ${formatDate(item.deadline)}`}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
