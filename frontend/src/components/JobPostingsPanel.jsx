import { ExternalLink, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { daysUntil, employmentTypeLabels, formatDate, jobStatusLabels, normalizeText } from '../format.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Pagination from './Pagination.jsx';

// Quyền khớp với backend: HR nào cũng đăng/sửa/đóng tin, chỉ Admin và HR Manager được xóa tin nháp.
const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const DELETE_ROLES = ['ADMIN', 'HR_MANAGER'];
const PAGE_SIZE = 10;

// Trạng thái hiển thị (M-08a): tin "Đang mở" mà đã quá hạn nộp thì hiện "Hết hạn".
const DISPLAY_STATUSES = {
  DRAFT: { label: jobStatusLabels.DRAFT, className: 'status-inactive' },
  OPEN: { label: jobStatusLabels.OPEN, className: 'status-active' },
  EXPIRED: { label: 'Hết hạn', className: 'status-on_leave' },
  CLOSED: { label: jobStatusLabels.CLOSED, className: 'status-resigned' }
};

function displayStatus(job) {
  return job.status === 'OPEN' && !job.isOpen ? 'EXPIRED' : job.status;
}

// Danh sách tin tuyển dụng phía HR (Figma M-08a).
export default function JobPostingsPanel({
  user,
  jobs,
  loading,
  departments,
  onChanged,
  onCreate,
  onEdit,
  onShowApplications,
  showToast
}) {
  const [keyword, setKeyword] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const canEdit = EDIT_ROLES.includes(user?.role);
  const canDelete = DELETE_ROLES.includes(user?.role);

  const filtered = useMemo(() => {
    const text = normalizeText(keyword.trim());

    return jobs.filter(
      (job) =>
        (!text || normalizeText(`${job.code} ${job.title}`).includes(text)) &&
        (!departmentFilter || job.departmentId === departmentFilter) &&
        (!statusFilter || displayStatus(job) === statusFilter)
    );
  }, [jobs, keyword, departmentFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [keyword, departmentFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageJobs = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Mở lại tin: còn hạn thì mở luôn; hết hạn thì mở trang sửa để HR chọn hạn nộp mới.
  async function reopen(job) {
    if (job.deadline && daysUntil(job.deadline) < 0) {
      showToast('error', `Tin "${job.title}" đã quá hạn nộp. Hãy chọn hạn nộp mới rồi bấm Đăng tin.`);
      onEdit(job, { status: 'OPEN' });
      return;
    }

    try {
      await api.updateJob(job.id, { status: 'OPEN' });
      showToast('success', `Đã mở lại tin ${job.title}.`);
      await onChanged();
    } catch (err) {
      showToast('error', err.message);
    }
  }

  async function runConfirm() {
    const { type, job } = confirm;
    setConfirmBusy(true);

    try {
      if (type === 'close') {
        await api.updateJob(job.id, { status: 'CLOSED' });
        showToast('success', `Đã đóng tin ${job.title}.`);
      } else {
        await api.deleteJob(job.id);
        showToast('success', `Đã xóa tin ${job.title}.`);
      }

      await onChanged();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  }

  const cancelConfirm = useCallback(() => {
    if (!confirmBusy) {
      setConfirm(null);
    }
  }, [confirmBusy]);

  return (
    <section className="content-panel">
      <div className="toolbar toolbar-top">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo mã, tên vị trí..." />
        </label>
        <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Lọc theo phòng ban">
          <option value="">Phòng ban</option>
          {departments.map((department) => (
            <option value={department.id} key={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc theo trạng thái">
          <option value="">Trạng thái</option>
          {Object.entries(DISPLAY_STATUSES).map(([value, status]) => (
            <option value={value} key={value}>
              {status.label}
            </option>
          ))}
        </select>
        {canEdit && (
          <button type="button" className="primary-button toolbar-push" onClick={onCreate}>
            <Plus size={18} aria-hidden="true" />
            Đăng tin mới
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="responsive-table jobs-table">
          <thead>
            <tr>
              <th>Vị trí</th>
              <th>Phòng ban</th>
              <th>Hình thức</th>
              <th>SL</th>
              <th>Hạn nộp</th>
              <th>Hồ sơ</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && !jobs.length ? (
              <tr>
                <td colSpan="8">Đang tải dữ liệu</td>
              </tr>
            ) : pageJobs.length ? (
              pageJobs.map((job) => {
                const status = displayStatus(job);
                const pastDeadline = job.deadline && daysUntil(job.deadline) < 0;

                return (
                  <tr key={job.id}>
                    <td className="cell-main">
                      <strong>{job.title}</strong>
                      <span>{job.code}</span>
                    </td>
                    <td data-label="Phòng ban" className={job.departmentName ? '' : 'muted-cell'}>
                      {job.departmentName || '—'}
                    </td>
                    <td data-label="Hình thức">{employmentTypeLabels[job.employmentType] || job.employmentType}</td>
                    <td data-label="SL">{job.quantity}</td>
                    <td data-label="Hạn nộp" className={pastDeadline && status !== 'CLOSED' ? 'text-danger' : ''}>
                      {formatDate(job.deadline) || '—'}
                    </td>
                    <td data-label="Hồ sơ">
                      <button
                        type="button"
                        className="count-pill count-button"
                        onClick={() => onShowApplications(job)}
                        title="Xem hồ sơ của tin này"
                      >
                        {job.applicationCount}
                      </button>
                    </td>
                    <td data-label="Trạng thái">
                      <span className={`status-pill ${DISPLAY_STATUSES[status].className}`}>
                        {DISPLAY_STATUSES[status].label}
                      </span>
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        {job.isOpen && (
                          <a
                            className="icon-button"
                            href={`#/viec-lam/${job.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Xem trên trang công khai"
                            aria-label="Xem trên trang công khai"
                          >
                            <ExternalLink size={17} aria-hidden="true" />
                          </a>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            className="icon-button success"
                            onClick={() => onEdit(job)}
                            title="Sửa"
                            aria-label="Sửa"
                          >
                            <Pencil size={17} aria-hidden="true" />
                          </button>
                        )}
                        {canEdit && status === 'OPEN' && (
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => setConfirm({ type: 'close', job })}
                            title="Đóng tin"
                            aria-label="Đóng tin"
                          >
                            <X size={17} aria-hidden="true" />
                          </button>
                        )}
                        {canEdit && (status === 'CLOSED' || status === 'EXPIRED') && (
                          <button
                            type="button"
                            className="icon-button success"
                            onClick={() => reopen(job)}
                            title="Mở lại"
                            aria-label="Mở lại"
                          >
                            <RotateCcw size={17} aria-hidden="true" />
                          </button>
                        )}
                        {canDelete && status === 'DRAFT' && job.applicationCount === 0 && (
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => setConfirm({ type: 'delete', job })}
                            title="Xóa tin nháp"
                            aria-label="Xóa tin nháp"
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8">{jobs.length ? 'Không có tin phù hợp' : 'Chưa có tin tuyển dụng nào'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} unit="tin" onChange={setPage} />

      {confirm && (
        <ConfirmDialog
          title={confirm.type === 'close' ? 'Đóng tin tuyển dụng?' : 'Xóa tin nháp?'}
          message={
            confirm.type === 'close'
              ? `Tin "${confirm.job.title}" sẽ không còn hiện trên trang việc làm và ngừng nhận hồ sơ. Có thể mở lại sau.`
              : `Tin nháp "${confirm.job.title}" (${confirm.job.code}) sẽ bị xóa vĩnh viễn.`
          }
          confirmLabel={confirm.type === 'close' ? 'Đóng tin' : 'Xóa tin'}
          busy={confirmBusy}
          onConfirm={runConfirm}
          onCancel={cancelConfirm}
        />
      )}
    </section>
  );
}
