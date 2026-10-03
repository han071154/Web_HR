import { ExternalLink, Megaphone, Save } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api.js';
import { employmentTypeLabels, todayInputValue } from '../format.js';

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
  status: 'OPEN',
  description: '',
  requirements: '',
  benefits: ''
};

// Lựa chọn trạng thái kèm giải thích (Figma M-08b, khung "Đăng tin").
const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Nháp', hint: 'Chưa hiện trên trang công khai' },
  { value: 'OPEN', label: 'Đang mở', hint: 'Hiện trên trang tuyển dụng, nhận hồ sơ' },
  { value: 'CLOSED', label: 'Đã đóng', hint: 'Ngừng nhận hồ sơ' }
];

const SUBMIT_LABELS = { DRAFT: 'Lưu nháp', OPEN: 'Đăng tin', CLOSED: 'Lưu' };

function toNumberOrNull(value) {
  return value === '' || value === null ? null : Number(value);
}

function validate(form) {
  const errors = {};

  if (form.salaryMin !== '' && form.salaryMax !== '' && Number(form.salaryMax) < Number(form.salaryMin)) {
    errors.salaryMax = 'Lương đến phải lớn hơn hoặc bằng lương từ';
  }

  if (form.status === 'OPEN' && form.deadline && form.deadline < todayInputValue()) {
    errors.deadline = 'Hạn nộp phải từ hôm nay trở đi';
  }

  return errors;
}

// Trang đăng / sửa tin tuyển dụng (Figma M-08b): nội dung tin bên trái, khung Đăng tin bên phải.
export default function JobFormPage({ job, departments, onSaved, onCancel, showToast }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(Object.entries(emptyJob).map(([field, value]) => [field, job?.[field] ?? value]))
  );
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
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
    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    setSaving(true);
    setError('');

    const values = {
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
    };

    try {
      if (job?.id) {
        await api.updateJob(job.id, values);
        showToast('success', `Đã cập nhật tin ${values.title}.`);
      } else {
        await api.createJob(values);
        showToast('success', values.status === 'OPEN' ? `Đã đăng tin ${values.title}.` : `Đã lưu tin ${values.title}.`);
      }

      await onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="detail-split" onSubmit={handleSubmit}>
      <section className="content-panel panel-stack">
        <h2>Thông tin chung</h2>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-grid">
          <label>
            Mã tin *
            <input {...textProps('code', 40)} placeholder="VD: JOB-ACC-02" minLength={2} required autoFocus />
            <small className="field-hint">Gợi ý: JOB-viết tắt phòng-số thứ tự</small>
          </label>
          <label>
            Tên vị trí *
            <input {...textProps('title', 160)} placeholder="VD: Nhân viên Kế toán" minLength={2} required />
          </label>
          <label>
            Phòng ban
            <select value={form.departmentId || ''} onChange={(event) => updateField('departmentId', event.target.value)}>
              <option value="">Không thuộc phòng nào</option>
              {departments.map((department) => (
                <option value={department.id} key={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hình thức *
            <select value={form.employmentType} onChange={(event) => updateField('employmentType', event.target.value)}>
              {Object.entries(employmentTypeLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Số lượng cần tuyển *
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
            Kinh nghiệm
            <input {...textProps('experience', 120)} placeholder="VD: Từ 1 năm" />
          </label>
          <label>
            Lương từ (VNĐ)
            <input
              type="number"
              min="0"
              step="500000"
              value={form.salaryMin ?? ''}
              onChange={(event) => updateField('salaryMin', event.target.value)}
            />
            <small className="field-hint">Để trống cả hai = &quot;Thỏa thuận&quot;</small>
          </label>
          <label>
            Lương đến (VNĐ)
            <input
              type="number"
              min="0"
              step="500000"
              value={form.salaryMax ?? ''}
              onChange={(event) => updateField('salaryMax', event.target.value)}
              className={errors.salaryMax ? 'invalid' : undefined}
            />
            {errors.salaryMax && <small className="field-error">{errors.salaryMax}</small>}
          </label>
          <label className="span-2">
            Địa điểm làm việc
            <input {...textProps('location', 255)} placeholder="VD: 123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh" />
          </label>
          <label className="span-2">
            Thời gian làm việc
            <input {...textProps('workingTime', 255)} placeholder="VD: Thứ 2 – Thứ 6, 8:00 – 17:00" />
          </label>
        </div>

        <h2 className="info-divider">Nội dung tin</h2>
        <label>
          Mô tả công việc *
          <textarea {...textProps('description', 10000)} rows="4" minLength={10} required />
          <small className="field-hint">Mỗi ý một dòng — trang công khai tự hiển thị dạng gạch đầu dòng</small>
        </label>
        <label>
          Yêu cầu ứng viên
          <textarea {...textProps('requirements', 10000)} rows="3" />
        </label>
        <label>
          Quyền lợi
          <textarea {...textProps('benefits', 10000)} rows="3" />
        </label>
      </section>

      <div className="side-stack">
        <section className="content-panel panel-stack">
          <h2>Đăng tin</h2>
          <fieldset className="radio-group">
            <legend>Trạng thái</legend>
            {STATUS_OPTIONS.map((option) => (
              <label key={option.value} className="radio-option">
                <input
                  type="radio"
                  name="job-status"
                  value={option.value}
                  checked={form.status === option.value}
                  onChange={() => updateField('status', option.value)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label>
            Hạn nộp hồ sơ
            <input
              type="date"
              value={form.deadline || ''}
              onChange={(event) => updateField('deadline', event.target.value)}
              className={errors.deadline ? 'invalid' : undefined}
            />
            {errors.deadline ? (
              <small className="field-error">{errors.deadline}</small>
            ) : (
              <small className="field-hint">Để trống nếu nhận hồ sơ tới khi đóng tin</small>
            )}
          </label>
          {job?.id && <p className="muted-text">Hồ sơ đã nhận: {job.applicationCount}</p>}
          <div className="form-actions">
            <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {form.status === 'OPEN' ? <Megaphone size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
              {saving ? 'Đang lưu...' : SUBMIT_LABELS[form.status]}
            </button>
          </div>
          {job?.isOpen && (
            <a className="text-link" href={`#/viec-lam/${job.id}`} target="_blank" rel="noreferrer">
              <ExternalLink size={15} aria-hidden="true" />
              Xem tin trên trang công khai
            </a>
          )}
        </section>
      </div>
    </form>
  );
}
