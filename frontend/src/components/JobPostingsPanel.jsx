import { ExternalLink, Megaphone, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { api } from '../api.js';
import { employmentTypeLabels, formatDate, formatSalaryRange, jobStatusLabels, normalizeText } from '../format.js';
import ConfirmDialog from './ConfirmDialog.jsx';

// Quyền khớp với backend: HR nào cũng tạo/sửa tin, chỉ Admin và HR Manager được xóa.
const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const DELETE_ROLES = ['ADMIN', 'HR_MANAGER'];

const emptyJob = {
  code: '',
  title: '',
  departmentId: '',
  employmentType: 'FULL_TIME',
  quantity: 1,
  salaryMin: '',
  salaryMax: '',
  experience: '',
  location: '',
  workingTime: '',
  deadline: '',
  status: 'DRAFT',
  description: '',
  requirements: '',
  benefits: ''
};

// Tin "Đang tuyển" nhưng đã quá hạn nộp thì hiện "Hết hạn" cho HR biết trang công khai không còn hiện tin.
function jobStatus(job) {
  if (job.status === 'OPEN' && !job.isOpen) {
    return { label: 'Hết hạn', className: 'status-resigned' };
  }

  const className = { DRAFT: 'status-inactive', OPEN: 'status-active', CLOSED: 'status-resigned' }[job.status];
  return { label: jobStatusLabels[job.status] || job.status, className };
}

function toNumberOrNull(value) {
  return value === '' || value === null ? null : Number(value);
}

function JobForm({ job, departments, onSubmit, onCancel }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(Object.entries(emptyJob).map(([field, value]) => [field, job?.[field] ?? value]))
  );
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function textProps(field, maxLength) {
    return {
      value: form[field] ?? '',
      onChange: (event) => updateField(field, event.target.value),
      maxLength
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSubmit({
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        departmentId: form.departmentId || null,
        employmentType: form.employmentType,
        quantity: Number(form.quantity),
        salaryMin: toNumberOrNull(form.salaryMin),
        salaryMax: toNumberOrNull(form.salaryMax),
        experience: form.experience.trim() || null,
        location: form.location.trim() || null,
        workingTime: form.workingTime.trim() || null,
        deadline: form.deadline || null,
        status: form.status,
        description: form.description.trim(),
        requirements: form.requirements.trim() || null,
        benefits: form.benefits.trim() || null
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="employee-form panel-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Mã tin
          <input {...textProps('code', 40)} placeholder="VD: JOB-ACC-02" minLength={2} required autoFocus />
        </label>
        <label>
          Tiêu đề
          <input {...textProps('title', 160)} placeholder="VD: Nhân viên Kế toán" minLength={2} required />
        </label>
        <label>
          Phòng ban
          <select value={form.departmentId} onChange={(event) => updateField('departmentId', event.target.value)}>
            <option value="">Không thuộc phòng nào</option>
            {departments.map((department) => (
              <option value={department.id} key={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hình thức làm việc
          <select value={form.employmentType} onChange={(event) => updateField('employmentType', event.target.value)}>
            {Object.entries(employmentTypeLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Số lượng cần tuyển
          <input
            type="number"
            min="1"
            max="1000"
            value={form.quantity}
            onChange={(event) => updateField('quantity', event.target.value)}
            required
          />
        </label>
        <label>
          Hạn nộp hồ sơ
          <input type="date" value={form.deadline || ''} onChange={(event) => updateField('deadline', event.target.value)} />
        </label>
        <label>
          Lương từ (VNĐ)
          <input
            type="number"
            min="0"
            step="500000"
            value={form.salaryMin ?? ''}
            onChange={(event) => updateField('salaryMin', event.target.value)}
            placeholder="Để trống nếu thỏa thuận"
          />
        </label>
        <label>
          Lương đến (VNĐ)
          <input
            type="number"
            min={form.salaryMin || 0}
            step="500000"
            value={form.salaryMax ?? ''}
            onChange={(event) => updateField('salaryMax', event.target.value)}
            placeholder="Để trống nếu thỏa thuận"
          />
        </label>
        <label>
          Kinh nghiệm
          <input {...textProps('experience', 120)} placeholder="VD: Từ 1 năm" />
        </label>
        <label>
          Trạng thái
          <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
            {Object.entries(jobStatusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Địa điểm làm việc
          <input {...textProps('location', 255)} />
        </label>
        <label>
          Thời gian làm việc
          <input {...textProps('workingTime', 255)} placeholder="VD: Thứ 2 – Thứ 6, 8:00 – 17:00" />
        </label>
      </div>
      <label>
        Mô tả công việc (mỗi ý một dòng)
        <textarea {...textProps('description', 10000)} rows="4" minLength={10} required />
      </label>
      <label>
        Yêu cầu ứng viên
        <textarea {...textProps('requirements', 10000)} rows="3" />
      </label>
      <label>
        Quyền lợi
        <textarea {...textProps('benefits', 10000)} rows="3" />
      </label>
      <div className="form-actions">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
          Hủy
        </button>
        <button type="submit" className="primary-button" disabled={saving}>
          <Megaphone size={18} aria-hidden="true" />
          {job?.id ? 'Cập nhật' : 'Thêm tin'}
        </button>
      </div>
    </form>
  );
}

// Danh sách tin tuyển dụng phía HR. Bấm số hồ sơ để xem hồ sơ của tin đó.
export default function JobPostingsPanel({ user, jobs, loading, departments, onChanged, onShowApplications, showToast }) {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const canEdit = EDIT_ROLES.includes(user?.role);
  const canDelete = DELETE_ROLES.includes(user?.role);

  const filtered = useMemo(() => {
    const text = normalizeText(keyword.trim());

    return jobs.filter(
      (job) =>
        (!text || normalizeText(`${job.code} ${job.title}`).includes(text)) &&
        (!statusFilter || job.status === statusFilter)
    );
  }, [jobs, keyword, statusFilter]);

  async function saveJob(values) {
    setError('');

    try {
      if (editing?.id) {
        await api.updateJob(editing.id, values);
        showToast('success', `Đã cập nhật tin ${values.title}.`);
      } else {
        await api.createJob(values);
        showToast('success', `Đã thêm tin ${values.title}.`);
      }

      setEditing(null);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  // Tin đã có hồ sơ thì API chặn xóa, nên báo luôn thay vì mở hộp xác nhận.
  function requestDelete(job) {
    if (job.applicationCount > 0) {
      showToast('error', `Tin "${job.title}" đã có ${job.applicationCount} hồ sơ nên không xóa được. Hãy chuyển tin sang "Đã đóng".`);
      return;
    }

    setDeleting(job);
  }

  async function confirmDelete() {
    const job = deleting;
    setDeletingBusy(true);

    try {
      await api.deleteJob(job.id);
      showToast('success', `Đã xóa tin ${job.title}.`);
      await onChanged();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setDeletingBusy(false);
      setDeleting(null);
    }
  }

  const cancelDelete = useCallback(() => {
    if (!deletingBusy) {
      setDeleting(null);
    }
  }, [deletingBusy]);

  return (
    <section className="content-panel">
      <div className="section-header">
        <h2>Tin tuyển dụng</h2>
        {canEdit && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setError('');
              setEditing(emptyJob);
            }}
          >
            <Plus size={18} aria-hidden="true" />
            Thêm tin
          </button>
        )}
      </div>

      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo mã, tiêu đề" />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc theo trạng thái">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(jobStatusLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}

      {editing && (
        <JobForm
          key={editing.id || 'new'}
          job={editing}
          departments={departments}
          onSubmit={saveJob}
          onCancel={() => {
            setEditing(null);
            setError('');
          }}
        />
      )}

      <div className="table-wrap">
        <table className="responsive-table jobs-table">
          <thead>
            <tr>
              <th>Tin tuyển dụng</th>
              <th>Hình thức</th>
              <th>Mức lương</th>
              <th>Hạn nộp</th>
              <th>Trạng thái</th>
              <th>Hồ sơ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && !jobs.length ? (
              <tr>
                <td colSpan="7">Đang tải dữ liệu</td>
              </tr>
            ) : filtered.length ? (
              filtered.map((job) => {
                const status = jobStatus(job);

                return (
                  <tr key={job.id}>
                    <td className="cell-main">
                      <strong>{job.title}</strong>
                      <span>
                        {job.code} · {job.departmentName || 'Không thuộc phòng nào'} · Cần {job.quantity}
                      </span>
                    </td>
                    <td data-label="Hình thức">{employmentTypeLabels[job.employmentType] || job.employmentType}</td>
                    <td data-label="Mức lương">{formatSalaryRange(job.salaryMin, job.salaryMax)}</td>
                    <td data-label="Hạn nộp" className={job.deadline ? '' : 'muted-cell'}>
                      {formatDate(job.deadline) || 'Không giới hạn'}
                    </td>
                    <td data-label="Trạng thái">
                      <span className={`status-pill ${status.className}`}>{status.label}</span>
                    </td>
                    <td data-label="Hồ sơ">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => onShowApplications(job)}
                        title="Xem hồ sơ của tin này"
                      >
                        {job.applicationCount} hồ sơ
                      </button>
                      {job.newApplicationCount > 0 && <span>{job.newApplicationCount} hồ sơ mới</span>}
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        {job.isOpen && (
                          <a
                            className="icon-button"
                            href={`#/viec-lam/${job.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Xem trên trang việc làm"
                            aria-label="Xem trên trang việc làm"
                          >
                            <ExternalLink size={17} aria-hidden="true" />
                          </a>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            className="icon-button success"
                            onClick={() => {
                              setError('');
                              setEditing(job);
                            }}
                            title="Sửa"
                            aria-label="Sửa"
                          >
                            <Pencil size={17} aria-hidden="true" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => requestDelete(job)}
                            title="Xóa"
                            aria-label="Xóa"
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
                <td colSpan="7">{jobs.length ? 'Không có tin phù hợp' : 'Chưa có tin tuyển dụng nào'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Xóa tin tuyển dụng?"
          message={`Tin "${deleting.title}" (${deleting.code}) sẽ bị xóa vĩnh viễn.`}
          confirmLabel="Xóa tin"
          busy={deletingBusy}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </section>
  );
}
