import { Check, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { employmentTypeLabels, genderLabels, statusLabels, toDateInputValue, todayInputValue } from '../format.js';
import Avatar from './Avatar.jsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+().\s-]{8,20}$/;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_MB = 5;

const emptyEmployee = {
  employeeCode: '',
  fullName: '',
  email: '',
  phone: '',
  gender: '',
  dateOfBirth: '',
  departmentId: '',
  positionId: '',
  position: '',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  hireDate: '',
  baseSalary: 0,
  address: ''
};

function toFormState(employee, suggestedCode) {
  if (!employee) {
    return { ...emptyEmployee, employeeCode: suggestedCode || '', hireDate: todayInputValue() };
  }

  return {
    ...employee,
    phone: employee.phone || '',
    gender: employee.gender || '',
    departmentId: employee.departmentId || '',
    positionId: employee.positionId || '',
    address: employee.address || '',
    dateOfBirth: toDateInputValue(employee.dateOfBirth),
    hireDate: toDateInputValue(employee.hireDate)
  };
}

function validate(form) {
  const errors = {};
  const required = {
    fullName: 'Vui lòng nhập họ và tên',
    employeeCode: 'Vui lòng nhập mã nhân viên',
    dateOfBirth: 'Vui lòng chọn ngày sinh',
    gender: 'Vui lòng chọn giới tính',
    phone: 'Vui lòng nhập số điện thoại',
    email: 'Vui lòng nhập email',
    departmentId: 'Vui lòng chọn phòng ban',
    position: 'Vui lòng chọn chức vụ',
    hireDate: 'Vui lòng chọn ngày vào làm'
  };

  for (const [field, message] of Object.entries(required)) {
    if (!String(form[field] ?? '').trim()) {
      errors[field] = message;
    }
  }

  if (!errors.email && !EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = 'Email không hợp lệ';
  }

  if (!errors.phone && !PHONE_PATTERN.test(form.phone.trim())) {
    errors.phone = 'Số điện thoại không hợp lệ';
  }

  if (Number(form.baseSalary) < 0) {
    errors.baseSalary = 'Lương không được âm';
  }

  return errors;
}

// Form thêm / sửa nhân sự theo mockup M-03b.
export default function EmployeeForm({ employee, departments, positions, suggestedCode, saving, error, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => toFormState(employee, suggestedCode));
  const [errors, setErrors] = useState({});
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    setForm(toFormState(employee, suggestedCode));
    setErrors({});
  }, [employee, suggestedCode]);

  // Giải phóng URL xem trước ảnh khi đổi ảnh khác hoặc rời trang.
  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  // Chức vụ: chỉ hiện chức vụ của phòng ban đang chọn (và chức vụ dùng chung).
  // Phòng ban chưa có chức vụ nào thì hiện tất cả để vẫn chọn được.
  // Mỗi lựa chọn có value là id chức vụ; chức vụ cũ chưa có trong danh mục dùng value "name:<tên>".
  const positionOptions = useMemo(() => {
    const active = positions.filter((position) => position.isActive !== false);
    const inDepartment = active.filter(
      (position) => !form.departmentId || !position.departmentId || position.departmentId === form.departmentId
    );
    const options = (inDepartment.length ? inDepartment : active).map((position) => ({
      value: position.id,
      label: position.name
    }));

    // Chức vụ đang giữ đã ngừng dùng vẫn hiện để sửa hồ sơ không bị mất chức vụ.
    const linked = positions.find((position) => position.id === employee?.positionId);

    if (linked && !options.some((option) => option.value === linked.id)) {
      options.unshift({ value: linked.id, label: linked.name });
    }

    // Chức vụ gõ tay từ trước (chưa liên kết danh mục) thì vẫn giữ để không mất dữ liệu.
    if (employee?.position && !employee.positionId) {
      options.unshift({ value: `name:${employee.position}`, label: employee.position });
    }

    return options;
  }, [positions, form.departmentId, employee]);

  const positionValue = form.positionId || (form.position ? `name:${form.position}` : '');

  // Đổi phòng ban mà chức vụ đang chọn không thuộc phòng mới thì bỏ chọn.
  useEffect(() => {
    if (positionValue && positionOptions.length && !positionOptions.some((option) => option.value === positionValue)) {
      setForm((current) => ({ ...current, positionId: '', position: '' }));
    }
  }, [positionValue, positionOptions]);

  function handlePositionChange(event) {
    const { value } = event.target;
    const option = positionOptions.find((item) => item.value === value);

    setForm((current) => ({
      ...current,
      positionId: value.startsWith('name:') ? '' : value,
      position: option?.label || ''
    }));
    setErrors((current) => (current.position ? { ...current, position: undefined } : current));
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Chỉ nhận ảnh PNG, JPG hoặc WEBP');
      return;
    }

    if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
      setAvatarError(`Ảnh tối đa ${AVATAR_MAX_MB}MB`);
      return;
    }

    setAvatarError('');
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    onSubmit(
      {
        ...form,
        employeeCode: form.employeeCode.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        baseSalary: Number(form.baseSalary) || 0,
        address: form.address.trim() || null,
        positionId: form.positionId || null
      },
      avatarFile
    );
  }

  function fieldProps(field) {
    return {
      value: form[field] ?? '',
      onChange: (event) => updateField(field, event.target.value),
      className: errors[field] ? 'invalid' : undefined,
      'aria-invalid': Boolean(errors[field])
    };
  }

  function fieldError(field) {
    return errors[field] ? <small className="field-error">{errors[field]}</small> : null;
  }

  return (
    <form className="content-panel employee-form-page" onSubmit={handleSubmit} noValidate>
      <h2>Thông tin nhân viên</h2>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="avatar-upload">
        <Avatar name={form.fullName} src={avatarPreview || employee?.avatarUrl} size="medium" />
        <div>
          <button type="button" className="soft-button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            Tải ảnh lên
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={AVATAR_TYPES.join(',')}
            onChange={handleAvatarChange}
            hidden
          />
          <small className={avatarError ? 'field-error' : 'field-hint'}>
            {avatarError || `PNG hoặc JPG, tối đa ${AVATAR_MAX_MB}MB`}
          </small>
        </div>
      </div>

      <div className="form-grid">
        <label>
          <span>Họ và tên <em className="required">*</em></span>
          <input {...fieldProps('fullName')} placeholder="Nguyễn Văn An" />
          {fieldError('fullName')}
        </label>
        <label>
          <span>Mã nhân viên <em className="required">*</em></span>
          <input {...fieldProps('employeeCode')} placeholder={suggestedCode ? `Tự sinh: ${suggestedCode}` : 'NV001'} />
          {fieldError('employeeCode')}
        </label>
        <label>
          <span>Ngày sinh <em className="required">*</em></span>
          <input {...fieldProps('dateOfBirth')} type="date" />
          {fieldError('dateOfBirth')}
        </label>
        <label>
          <span>Giới tính <em className="required">*</em></span>
          <select {...fieldProps('gender')}>
            <option value="">Chọn giới tính</option>
            {Object.entries(genderLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          {fieldError('gender')}
        </label>
        <label>
          <span>Số điện thoại <em className="required">*</em></span>
          <input {...fieldProps('phone')} type="tel" placeholder="0901 234 567" />
          {fieldError('phone')}
        </label>
        <label>
          <span>Email <em className="required">*</em></span>
          <input {...fieldProps('email')} type="email" placeholder="an.nv@example.com" />
          {fieldError('email')}
        </label>
        <label>
          <span>Phòng ban <em className="required">*</em></span>
          <select {...fieldProps('departmentId')}>
            <option value="">Chọn phòng ban</option>
            {departments.map((department) => (
              <option value={department.id} key={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          {fieldError('departmentId')}
        </label>
        <label>
          <span>Chức vụ <em className="required">*</em></span>
          <select
            value={positionValue}
            onChange={handlePositionChange}
            className={errors.position ? 'invalid' : undefined}
            aria-invalid={Boolean(errors.position)}
          >
            <option value="">Chọn chức vụ</option>
            {positionOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldError('position') ||
            (!positionOptions.length && <small className="field-hint">Chưa có chức vụ nào, hãy thêm ở mục Chức vụ</small>)}
        </label>
        <label>
          <span>Ngày vào làm <em className="required">*</em></span>
          <input {...fieldProps('hireDate')} type="date" />
          {fieldError('hireDate')}
        </label>
        <label>
          <span>Trạng thái</span>
          <select {...fieldProps('status')}>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Loại hợp đồng</span>
          <select {...fieldProps('employmentType')}>
            {Object.entries(employmentTypeLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Lương cơ bản (VNĐ)</span>
          <input {...fieldProps('baseSalary')} type="number" min="0" step="100000" />
          {fieldError('baseSalary')}
        </label>
        <label className="span-2">
          <span>Địa chỉ</span>
          <input {...fieldProps('address')} placeholder="Số nhà, đường, quận" />
        </label>
      </div>

      <div className="form-footer">
        <button type="submit" className="primary-button" disabled={saving}>
          <Check size={18} aria-hidden="true" />
          {saving ? 'Đang lưu...' : 'Lưu nhân sự'}
        </button>
        <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
          Hủy
        </button>
        <span className="form-note">
          <em className="required">*</em> Trường bắt buộc
        </span>
      </div>
    </form>
  );
}
