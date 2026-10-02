import { Download, Eye, Save, Search, UserCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import {
  applicationStatusLabels,
  employmentTypeLabels,
  formatDate,
  formatDateTime,
  toDateTimeInputValue,
  todayInputValue
} from '../format.js';

// Quyền khớp với backend: HR nào cũng xử lý hồ sơ và tuyển được.
const EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];

// "Trúng tuyển" chỉ đạt được qua nút Tuyển (tạo hồ sơ nhân viên), không chọn trong danh sách.
const PROCESS_STATUSES = ['NEW', 'REVIEWING', 'INTERVIEW', 'REJECTED'];

const statusClass = {
  NEW: 'status-new',
  REVIEWING: 'status-on_leave',
  INTERVIEW: 'status-interview',
  HIRED: 'status-active',
  REJECTED: 'status-terminated'
};

function StatusPill({ status }) {
  return (
    <span className={`status-pill ${statusClass[status] || 'status-inactive'}`}>
      {applicationStatusLabels[status] || status}
    </span>
  );
}

async function downloadCv(application) {
  const blob = await api.applicationCv(application.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = application.cvOriginalName || `${application.applicationCode}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

// Form tuyển: tạo hồ sơ nhân viên từ hồ sơ ứng viên. Mặc định theo tin tuyển dụng.
function HireForm({ application, departments, positions, suggestedCode, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    employeeCode: suggestedCode,
    departmentId: application.jobDepartmentId || '',
    positionId: '',
    employmentType: employmentTypeLabels[application.jobEmploymentType] ? application.jobEmploymentType : 'FULL_TIME',
    hireDate: todayInputValue(),
    baseSalary: 0
  });
  const [saving, setSaving] = useState(false);

  const positionOptions = positions.filter(
    (position) =>
      position.isActive !== false &&
      (!form.departmentId || !position.departmentId || position.departmentId === form.departmentId)
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSubmit({
        employeeCode: form.employeeCode.trim(),
        departmentId: form.departmentId || null,
        positionId: form.positionId || null,
        employmentType: form.employmentType,
        hireDate: form.hireDate,
        baseSalary: Number(form.baseSalary) || 0
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="hire-form" onSubmit={handleSubmit}>
      <h3>Tuyển {application.fullName} thành nhân viên</h3>
      <p className="field-hint">
        Họ tên, email và số điện thoại lấy từ hồ sơ. Sau khi tuyển có thể bổ sung ngày sinh, giới tính, địa chỉ ở mục
        Nhân sự.
      </p>
      <div className="form-grid">
        <label>
          Mã nhân viên
          <input
            value={form.employeeCode}
            onChange={(event) => updateField('employeeCode', event.target.value)}
            minLength={2}
            maxLength={40}
            required
            autoFocus
          />
        </label>
        <label>
          Ngày vào làm
          <input
            type="date"
            value={form.hireDate}
            onChange={(event) => updateField('hireDate', event.target.value)}
            required
          />
        </label>
        <label>
          Phòng ban
          <select
            value={form.departmentId}
            onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value, positionId: '' }))}
          >
            <option value="">Chưa phân phòng</option>
            {departments.map((department) => (
              <option value={department.id} key={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chức vụ
          <select value={form.positionId} onChange={(event) => updateField('positionId', event.target.value)}>
            <option value="">Theo tin tuyển dụng: {application.jobTitle}</option>
            {positionOptions.map((position) => (
              <option value={position.id} key={position.id}>
                {position.name}
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
          Lương cơ bản (VNĐ)
          <input
            type="number"
            min="0"
            step="100000"
            value={form.baseSalary}
            onChange={(event) => updateField('baseSalary', event.target.value)}
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
          Hủy
        </button>
        <button type="submit" className="primary-button" disabled={saving}>
          <UserCheck size={18} aria-hidden="true" />
          {saving ? 'Đang tuyển...' : 'Tuyển thành nhân viên'}
        </button>
      </div>
    </form>
  );
}

// Chi tiết một hồ sơ: thông tin ứng viên, tải CV, đổi trạng thái / hẹn phỏng vấn, tuyển.
function ApplicationDetail({ application, canEdit, departments, positions, suggestedCode, onSaved, onHired, onClose, showToast }) {
  const [form, setForm] = useState({
    status: application.status,
    interviewAt: toDateTimeInputValue(application.interviewAt),
    note: application.note || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hiring, setHiring] = useState(false);
  const isHired = application.status === 'HIRED';
  const canHire = canEdit && !isHired && application.status !== 'REJECTED';

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const changes = { note: form.note.trim() || null };

      if (!isHired) {
        changes.status = form.status;
        // datetime-local là giờ máy người dùng; gửi kèm múi giờ để backend lưu đúng thời điểm.
        changes.interviewAt = form.interviewAt ? new Date(form.interviewAt).toISOString() : null;
      }

      const response = await api.updateApplication(application.id, changes);
      showToast('success', `Đã cập nhật hồ sơ ${application.applicationCode}.`);
      onSaved(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleHire(values) {
    setError('');

    try {
      const response = await api.hireApplication(application.id, values);
      showToast('success', `Đã tuyển ${application.fullName} thành nhân viên ${response.data.employeeCode}.`);
      setHiring(false);
      onHired(response.data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDownload() {
    try {
      await downloadCv(application);
    } catch (err) {
      showToast('error', err.message);
    }
  }

  return (
    <div className="application-detail">
      <div className="section-header">
        <div>
          <h3>
            {application.fullName} <StatusPill status={application.status} />
          </h3>
          <p className="page-subtitle">
            {application.applicationCode} · {application.jobTitle}
          </p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} title="Đóng" aria-label="Đóng">
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <dl className="detail-grid">
        <div>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${application.email}`}>{application.email}</a>
          </dd>
        </div>
        <div>
          <dt>Điện thoại</dt>
          <dd>
            <a href={`tel:${application.phone}`}>{application.phone}</a>
          </dd>
        </div>
        <div>
          <dt>Ngày nộp</dt>
          <dd>{formatDateTime(application.createdAt)}</dd>
        </div>
        <div>
          <dt>Lịch phỏng vấn</dt>
          <dd className={application.interviewAt ? '' : 'muted'}>
            {formatDateTime(application.interviewAt) || 'Chưa hẹn'}
          </dd>
        </div>
        {isHired && (
          <div>
            <dt>Mã nhân viên</dt>
            <dd>{application.employeeCode || 'Hồ sơ nhân viên đã bị xóa'}</dd>
          </div>
        )}
        <div className="span-2">
          <dt>Thư giới thiệu</dt>
          <dd className={application.coverLetter ? 'cover-letter' : 'muted'}>
            {application.coverLetter || 'Ứng viên không viết thư giới thiệu'}
          </dd>
        </div>
      </dl>

      <div className="form-actions application-actions">
        <button type="button" className="soft-button" onClick={handleDownload}>
          <Download size={16} aria-hidden="true" />
          Tải CV
        </button>
        {canHire && !hiring && (
          <button type="button" className="primary-button" onClick={() => setHiring(true)}>
            <UserCheck size={18} aria-hidden="true" />
            Tuyển thành nhân viên
          </button>
        )}
      </div>

      {hiring && (
        <HireForm
          application={application}
          departments={departments}
          positions={positions}
          suggestedCode={suggestedCode}
          onSubmit={handleHire}
          onCancel={() => setHiring(false)}
        />
      )}

      {canEdit && !hiring && (
        <form className="process-form" onSubmit={handleSave}>
          <div className="form-grid">
            <label>
              Trạng thái
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                disabled={isHired}
              >
                {(isHired ? ['HIRED'] : PROCESS_STATUSES).map((status) => (
                  <option value={status} key={status}>
                    {applicationStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lịch phỏng vấn
              <input
                type="datetime-local"
                value={form.interviewAt}
                onChange={(event) => setForm((current) => ({ ...current, interviewAt: event.target.value }))}
                disabled={isHired}
                required={form.status === 'INTERVIEW'}
              />
            </label>
          </div>
          <label>
            Ghi chú nội bộ
            <textarea
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              rows="3"
              maxLength={2000}
              placeholder="VD: CV phù hợp, hẹn phỏng vấn vòng 1"
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              <Save size={18} aria-hidden="true" />
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Danh sách hồ sơ ứng viên phía HR, lọc theo tin, trạng thái, tìm theo tên/email/SĐT/mã hồ sơ.
export default function ApplicationsPanel({
  user,
  jobs,
  jobFilter,
  onJobFilterChange,
  departments,
  positions,
  suggestedCode,
  onChanged,
  onHired,
  showToast
}) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const canEdit = EDIT_ROLES.includes(user?.role);

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

  const selected = applications.find((application) => application.id === selectedId);

  function replaceApplication(updated) {
    setApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  return (
    <section className="content-panel">
      <div className="section-header">
        <h2>Hồ sơ ứng viên</h2>
      </div>

      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên, email, SĐT, mã hồ sơ"
          />
        </label>
        <select value={jobFilter} onChange={(event) => onJobFilterChange(event.target.value)} aria-label="Lọc theo tin">
          <option value="">Tất cả tin tuyển dụng</option>
          {jobs.map((job) => (
            <option value={job.id} key={job.id}>
              {job.title} ({job.code})
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc theo trạng thái">
          <option value="">Tất cả trạng thái ({applications.length})</option>
          {Object.entries(applicationStatusLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label} ({counts[value] || 0})
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}

      {selected && (
        <ApplicationDetail
          key={`${selected.id}-${selected.updatedAt}`}
          application={selected}
          canEdit={canEdit}
          departments={departments}
          positions={positions}
          suggestedCode={suggestedCode}
          onSaved={(updated) => {
            replaceApplication(updated);
            // Số hồ sơ "mới" trên tab và trong danh sách tin cần tính lại.
            onChanged();
          }}
          onHired={(updated) => {
            replaceApplication(updated);
            onHired();
          }}
          onClose={() => setSelectedId(null)}
          showToast={showToast}
        />
      )}

      <div className="table-wrap">
        <table className="responsive-table applications-table">
          <thead>
            <tr>
              <th>Ứng viên</th>
              <th>Mã hồ sơ</th>
              <th>Vị trí</th>
              <th>Ngày nộp</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && !applications.length ? (
              <tr>
                <td colSpan="6">Đang tải dữ liệu</td>
              </tr>
            ) : filtered.length ? (
              filtered.map((application) => (
                <tr key={application.id} className={application.id === selectedId ? 'row-selected' : undefined}>
                  <td className="cell-main">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setSelectedId(application.id)}
                      title="Xem hồ sơ"
                    >
                      {application.fullName}
                    </button>
                    <span>{application.email}</span>
                  </td>
                  <td data-label="Mã hồ sơ">
                    <code className="code-tag">{application.applicationCode}</code>
                  </td>
                  <td data-label="Vị trí">{application.jobTitle}</td>
                  <td data-label="Ngày nộp">{formatDate(application.createdAt)}</td>
                  <td data-label="Trạng thái">
                    <StatusPill status={application.status} />
                    {application.status === 'INTERVIEW' && application.interviewAt && (
                      <span>{formatDateTime(application.interviewAt)}</span>
                    )}
                  </td>
                  <td className="cell-actions">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => setSelectedId(application.id)}
                        title="Xem"
                        aria-label="Xem"
                      >
                        <Eye size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6">{applications.length ? 'Không có hồ sơ phù hợp' : 'Chưa có hồ sơ nào'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
