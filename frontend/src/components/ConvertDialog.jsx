import { UserCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import {
  MAX_MONEY,
  MAX_MONEY_MESSAGE,
  contractTypeLabels,
  employmentTypeLabels,
  genderLabels,
  toDateInputValue,
  todayInputValue
} from '../format.js';

// Thời hạn hợp đồng đầu tiên gợi ý theo loại (tháng); HR sửa được ngày kết thúc.
const DEFAULT_MONTHS = { PROBATION: 2, FIXED_TERM: 12, SEASONAL: 6 };
const ID_NUMBER_PATTERN = /^(\d{9}|\d{12})$/;

function addYears(date, years) {
  return `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;
}

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
      dateOfBirth: '',
      gender: '',
      idNumber: '',
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

    // Cùng quy tắc với form Sửa nhân sự: ngày sinh, giới tính bắt buộc; đủ 15 tuổi khi vào làm.
    if (!form.dateOfBirth) {
      nextErrors.dateOfBirth = 'Vui lòng chọn ngày sinh';
    } else if (form.dateOfBirth >= todayInputValue()) {
      nextErrors.dateOfBirth = 'Ngày sinh phải trước hôm nay';
    } else if (form.hireDate && form.hireDate < addYears(form.dateOfBirth, 15)) {
      nextErrors.dateOfBirth = 'Nhân viên phải đủ 15 tuổi vào ngày vào làm';
    }

    if (!form.gender) {
      nextErrors.gender = 'Vui lòng chọn giới tính';
    }

    if (form.idNumber.trim() && !ID_NUMBER_PATTERN.test(form.idNumber.trim())) {
      nextErrors.idNumber = 'CCCD gồm 12 chữ số (hoặc CMND 9 chữ số)';
    }

    if (form.baseSalary === '' || Number(form.baseSalary) <= 0) {
      nextErrors.baseSalary = 'Vui lòng nhập lương cơ bản';
    } else if (Number(form.baseSalary) > MAX_MONEY) {
      nextErrors.baseSalary = MAX_MONEY_MESSAGE;
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

      // API chuyển chưa nhận thông tin cá nhân nên lưu bổ sung vào hồ sơ vừa tạo (sửa một phần).
      // Hồ sơ đã tạo xong nên lỗi ở bước này chỉ báo để HR nhập lại trong form Sửa nhân sự.
      let warning = '';

      try {
        await api.updateEmployee(response.data.employeeId, {
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          idNumber: form.idNumber.trim() || null
        });
      } catch (err) {
        warning = `Chưa lưu được ngày sinh, giới tính, CCCD (${err.message}). Vui lòng bổ sung trong hồ sơ nhân viên.`;
      }

      await onConverted(response.data, warning);
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

        <p className="dialog-section">Thông tin cá nhân</p>
        <div className="form-grid">
          <label>
            Ngày sinh *
            <input
              type="date"
              value={form.dateOfBirth}
              max={todayInputValue()}
              onChange={(event) => updateField('dateOfBirth', event.target.value)}
              className={errors.dateOfBirth ? 'invalid' : undefined}
            />
            {fieldError('dateOfBirth')}
          </label>
          <label>
            Giới tính *
            <select
              value={form.gender}
              onChange={(event) => updateField('gender', event.target.value)}
              className={errors.gender ? 'invalid' : undefined}
            >
              <option value="">Chọn giới tính</option>
              {Object.entries(genderLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            {fieldError('gender')}
          </label>
          <label className="span-2">
            CCCD
            <input
              value={form.idNumber}
              onChange={(event) => updateField('idNumber', event.target.value)}
              className={errors.idNumber ? 'invalid' : undefined}
              inputMode="numeric"
              maxLength={12}
              placeholder="12 chữ số"
            />
            {fieldError('idNumber')}
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
              max={MAX_MONEY}
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
