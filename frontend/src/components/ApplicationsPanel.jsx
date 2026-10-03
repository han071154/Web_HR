import { Download, Eye, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { downloadCv } from '../cv.js';
import { applicationStatusClass, applicationStatusLabels, formatDate, formatDateTime } from '../format.js';
import Avatar from './Avatar.jsx';
import Pagination from './Pagination.jsx';

const PAGE_SIZE = 10;

// Danh sách hồ sơ ứng viên phía HR (Figma M-08c): chip lọc trạng thái, tìm kiếm, lọc theo tin.
export default function ApplicationsPanel({ jobs, jobFilter, onJobFilterChange, onOpen, showToast }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.applications(jobFilter ? { jobId: jobFilter } : {});
      setApplications(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobFilter]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const counts = useMemo(() => {
    const result = {};

    for (const application of applications) {
      result[application.status] = (result[application.status] || 0) + 1;
    }

    return result;
  }, [applications]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return applications.filter(
      (application) =>
        (!statusFilter || application.status === statusFilter) &&
        (!keyword ||
          [application.fullName, application.email, application.phone, application.applicationCode].some((value) =>
            String(value || '').toLowerCase().includes(keyword)
          ))
    );
  }, [applications, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, jobFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageApplications = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function handleDownload(application) {
    try {
      await downloadCv(application);
    } catch (err) {
      showToast('error', err.message);
    }
  }

  return (
    <section className="content-panel">
      <div className="status-chips" role="group" aria-label="Lọc theo trạng thái">
        <button type="button" className={statusFilter === '' ? 'active' : ''} onClick={() => setStatusFilter('')}>
          Tất cả <span className="chip-count">{applications.length}</span>
        </button>
        {Object.entries(applicationStatusLabels).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={statusFilter === value ? 'active' : ''}
            onClick={() => setStatusFilter(value)}
          >
            {label} <span className={`chip-count chip-${value.toLowerCase()}`}>{counts[value] || 0}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên, email, SĐT, mã hồ sơ..."
          />
        </label>
        <select value={jobFilter} onChange={(event) => onJobFilterChange(event.target.value)} aria-label="Lọc theo tin">
          <option value="">Tin tuyển dụng: Tất cả</option>
          {jobs.map((job) => (
            <option value={job.id} key={job.id}>
              {job.title} ({job.code})
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="responsive-table applications-table">
          <thead>
            <tr>
              <th>Mã HS</th>
              <th>Ứng viên</th>
              <th>SĐT</th>
              <th>Vị trí ứng tuyển</th>
              <th>Ngày nộp</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && !applications.length ? (
              <tr>
                <td colSpan="7">Đang tải dữ liệu</td>
              </tr>
            ) : pageApplications.length ? (
              pageApplications.map((application) => {
                const unread = !application.viewedAt;

                return (
                  <tr key={application.id} className={unread ? 'row-unread' : undefined}>
                    <td data-label="Mã HS">
                      {unread ? <strong>{application.applicationCode}</strong> : application.applicationCode}
                    </td>
                    <td className="cell-main">
                      <div className="person-cell">
                        <Avatar name={application.fullName} size="small" />
                        <div>
                          <button type="button" className="link-button" onClick={() => onOpen(application)}>
                            {application.fullName}
                            {unread && <i className="unread-dot" title="Chưa xem" aria-label="Chưa xem" />}
                          </button>
                          <span>{application.email}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="SĐT">{application.phone}</td>
                    <td data-label="Vị trí">{application.jobTitle}</td>
                    <td data-label="Ngày nộp">{formatDate(application.createdAt)}</td>
                    <td data-label="Trạng thái">
                      <span className={`status-pill ${applicationStatusClass[application.status]}`}>
                        {applicationStatusLabels[application.status]}
                      </span>
                      {application.status === 'INTERVIEW' && application.interviewAt && (
                        <span>{formatDateTime(application.interviewAt)}</span>
                      )}
                      {application.status === 'HIRED' && (
                        <span className={application.employeeId ? '' : 'text-danger'}>
                          {application.employeeId ? `Đã thành ${application.employeeCode || 'nhân viên'}` : 'Chưa chuyển'}
                        </span>
                      )}
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onOpen(application)}
                          title="Xem hồ sơ"
                          aria-label="Xem hồ sơ"
                        >
                          <Eye size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => handleDownload(application)}
                          title="Tải CV"
                          aria-label="Tải CV"
                        >
                          <Download size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7">{applications.length ? 'Không có hồ sơ phù hợp' : 'Chưa có hồ sơ nào'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} unit="hồ sơ" onChange={setPage} />
    </section>
  );
}
