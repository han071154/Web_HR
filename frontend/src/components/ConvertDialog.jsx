import { UserCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { contractTypeLabels, employmentTypeLabels, toDateInputValue, todayInputValue } from '../format.js';

// Thời hạn hợp đồng đầu tiên gợi ý theo loại (tháng); HR sửa được ngày kết thúc.
const DEFAULT_MONTHS = { PROBATION: 2, FIXED_TERM: 12, SEASONAL: 6 };

function addMonths(startDate, months) {
  const [year, month, day] = startDate.split('-').map(Number);
  return toDateInputValue(new Date(year, month - 1 + months, day - 1));
}

function defaultEndDate(contractType, hireDate) {
  return contractType === 'INDEFINITE' || !hireDate ? '' : addMonths(hireDate, DEFAULT_MONTHS[contractType]);
}

// Hộp thoại chuyển ứng viên "Đậu" thành nhân sự (Figma M-08e): tạo hồ sơ nhân viên + hợp đồng đầu tiên.
export default function ConvertDialog({ application, departments, positions, suggestedCode, onCancel, onConverted }) {
  const [form, setForm] = useState(() => {
    const hireDate = todayInputValue();

    return {
      employeeCode: suggestedCode,
      hireDate,
      departmentId: application.jobDepartmentId || '',
      positionId: '',
      employmentType: employmentTypeLabels[application.jobEmploymentType] ? application.jobEmploymentType : 'FULL_TIME',
      contractType: 'PROBATION',
      contractEndDate: defaultEndDate('PROBATION', hireDate),
      baseSalary: ''
    };
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving) {
        onCancel();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, saving]);

  const positionOptions = positions.filter(
    (position) =>
      position.isActive !== false &&
      (!form.departmentId || !position.departmentId || position.departmentId === form.departmentId)
  );

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };

      // Đổi loại hợp đồng hoặc ngày vào làm thì gợi ý lại ngày kết thúc hợp đồng.
      if (field === 'contractType' || field === 'hireDate') {
        next.contractEndDate = defaultEndDate(next.contractType, next.hireDate);
      }

      if (field === 'departmentId') {
        next.positionId = '';
      }

      return next;
    });
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  function validate() {
    const nextErrors = {};

    if (form.employeeCode.trim().length < 2) {
      nextErrors.employeeCode = 'Vui lòng nhập mã nhân viên';
    }

    if (!form.hireDate) {
      nextErrors.hireDate = 'Vui lòng chọn ngày vào làm';
    }

    if (form.baseSalary === '' || Number(form.baseSalary) <= 0) {
      nextErrors.baseSalary = 'Vui lòng nhập lương cơ bản';
    }

    if (form.contractType !== 'INDEFINITE' && (!form.contractEndDate || form.contractEndDate < form.hireDate)) {
      nextErrors.contractEndDate = 'Ngày kết thúc phải sau ngày vào làm';
    }

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await api.convertApplication(application.id, {
        employeeCode: form.employeeCode.trim(),
        hireDate: form.hireDate,
        departmentId: form.departmentId || null,
        positionId: form.positionId || null,
        employmentType: form.employmentType,
        baseSalary: Number(form.baseSalary),
        contractType: form.contractType,
        contractEndDate: form.contractType === 'INDEFINITE' ? null : form.contractEndDate
      });
      await onConverted(response.data);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  function fieldError(field) {
    return errors[field] ? <small className="field-error">{errors[field]}</small> : null;
  }

  return (
    <div className="modal-backdrop" onClick={() => !saving && onCancel()}>
      <form
        className="modal convert-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="section-header">
          <div>
            <h2 id="convert-title">Chuyển ứng viên thành nhân sự</h2>
            <p className="page-subtitle">
              {application.applicationCode} · {application.fullName} · {application.jobTitle}{' '}
              <span className="status-pill status-active">Đậu</span>
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} disabled={saving} title="Đóng" aria-label="Đóng">
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <p className="dialog-section">Lấy từ hồ sơ ứng viên</p>
        <div className="form-grid">
          <label>
            Họ và tên
            <input value={application.fullName} disabled />
          </label>
          <label>
            Số điện thoại
            <input value={application.phone} disabled />
          </label>
          <label className="span-2">
            Email
            <input value={application.email} disabled />
          </label>
        </div>

        <p className="dialog-section">HR bổ sung</p>
        <div className="form-grid">
          <label>
            Mã nhân viên *
            <input
              value={form.employeeCode}
              onChange={(event) => updateField('employeeCode', event.target.value)}
              className={errors.employeeCode ? 'invalid' : undefined}
              maxLength={40}
              autoFocus
            />
            {fieldError('employeeCode') || <small className="field-hint">Gợi ý mã kế tiếp</small>}
          </label>
          <label>
            Ngày vào làm *
            <input
              type="date"
              value={form.hireDate}
              onChange={(event) => updateField('hireDate', event.target.value)}
              className={errors.hireDate ? 'invalid' : undefined}
            />
            {fieldError('hireDate')}
          </label>
          <label>
            Phòng ban
            <select value={form.departmentId} onChange={(event) => updateField('departmentId', event.target.value)}>
              <option value="">Chưa phân phòng</option>
              {departments.map((department) => (
                <option value={department.id} key={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Chức danh
            <select value={form.positionId} onChange={(event) => updateField('positionId', event.target.value)}>
              <option value="">{application.jobTitle}</option>
              {positionOptions.map((position) => (
                <option value={position.id} key={position.id}>
                  {position.name}
                </option>
              ))}
            </select>
            <small className="field-hint">Mặc định lấy từ tin tuyển dụng</small>
          </label>
          <label>
            Loại hợp đồng *
            <select value={form.contractType} onChange={(event) => updateField('contractType', event.target.value)}>
              {Object.entries(contractTypeLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hết hạn hợp đồng
            <input
              type="date"
              value={form.contractEndDate}
              min={form.hireDate}
              onChange={(event) => updateField('contractEndDate', event.target.value)}
              disabled={form.contractType === 'INDEFINITE'}
              className={errors.contractEndDate ? 'invalid' : undefined}
            />
            {fieldError('contractEndDate')}
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
            Lương cơ bản (VNĐ) *
            <input
              type="number"
              min="0"
              step="100000"
              value={form.baseSalary}
              onChange={(event) => updateField('baseSalary', event.target.value)}
              className={errors.baseSalary ? 'invalid' : undefined}
            />
            {fieldError('baseSalary')}
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            <UserCheck size={18} aria-hidden="true" />
            {saving ? 'Đang chuyển...' : 'Chuyển thành nhân sự'}
          </button>
        </div>
      </form>
    </div>
  );
}
