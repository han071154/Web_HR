import { FileSignature } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  MAX_MONEY,
  MAX_MONEY_MESSAGE,
  contractStatusLabels,
  contractTypeLabels,
  normalizeText,
  toDateInputValue,
  todayInputValue
} from '../format.js';
import EmployeeLink from './EmployeeLink.jsx';

// Thời hạn gợi ý theo loại hợp đồng (bấm để tự điền ngày kết thúc).
const DURATION_PRESETS = {
  PROBATION: [1, 2],
  FIXED_TERM: [12, 24, 36],
  SEASONAL: [3, 6]
};

// Ngày kết thúc = ngày bắt đầu + n tháng - 1 ngày (01/01 + 12 tháng → 31/12).
function addMonths(startDate, months) {
  const [year, month, day] = startDate.split('-').map(Number);
  return toDateInputValue(new Date(year, month - 1 + months, day - 1));
}

function suggestNumber(employee, startDate) {
  return employee ? `HDLD-${employee.employeeCode}-${(startDate || todayInputValue()).slice(0, 4)}` : '';
}

function validate(form) {
  if (!form.employeeId) {
    return 'Vui lòng chọn nhân viên.';
  }

  if (Number(form.salary) > MAX_MONEY) {
    return MAX_MONEY_MESSAGE;
  }

  if (form.contractType === 'INDEFINITE') {
    return '';
  }

  if (!form.endDate) {
    return 'Hợp đồng có thời hạn cần có ngày kết thúc.';
  }

  return form.endDate < form.startDate ? 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' : '';
}

// Form thêm / sửa hợp đồng lao động. Có employee thì nhân viên cố định (mở từ trang chi tiết),
// không thì chọn nhân viên trong danh sách employees.
export default function ContractForm({ contract, employee, employees = [], error, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => {
    const startDate = contract?.startDate || todayInputValue();
    const owner = employee || employees.find((item) => item.id === contract?.employeeId);

    return {
      contractNumber: contract?.contractNumber || suggestNumber(owner, startDate),
      employeeId: contract?.employeeId || employee?.id || '',
      contractType: contract?.contractType || 'PROBATION',
      startDate,
      endDate: contract?.endDate || '',
      signedDate: contract?.signedDate || '',
      salary: contract?.salary ?? owner?.baseSalary ?? 0,
      status: contract?.status || 'ACTIVE',
      notes: contract?.notes || ''
    };
  });
  // Số hợp đồng tự gợi ý cho tới khi người dùng tự gõ.
  const [numberTouched, setNumberTouched] = useState(Boolean(contract?.id));
  const [localError, setLocalError] = useState('');
  const [saving, setSaving] = useState(false);
  // Gõ tên hoặc mã (không dấu cũng được) để lọc danh sách chọn nhân viên – có hàng nghìn nhân viên (BUG-36).
  const [employeeSearch, setEmployeeSearch] = useState('');
  const isIndefinite = form.contractType === 'INDEFINITE';

  const { employeeOptions, matchCount } = useMemo(() => {
    const keyword = normalizeText(employeeSearch.trim());

    if (!keyword) {
      return { employeeOptions: employees, matchCount: employees.length };
    }

    const matches = employees.filter((item) => normalizeText(`${item.fullName} ${item.employeeCode}`).includes(keyword));
    const selected = employees.find((item) => item.id === form.employeeId);

    // Giữ nhân viên đang chọn trong danh sách để ô chọn không bị trống khi đổi từ khóa.
    return {
      employeeOptions: selected && !matches.includes(selected) ? [selected, ...matches] : matches,
      matchCount: matches.length
    };
  }, [employees, employeeSearch, form.employeeId]);

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      const owner = employee || employees.find((item) => item.id === next.employeeId);

      if (!numberTouched && (field === 'employeeId' || field === 'startDate')) {
        next.contractNumber = suggestNumber(owner, next.startDate);
      }

      // Chọn nhân viên khác thì lấy lương cơ bản của nhân viên đó làm mức lương gợi ý.
      if (field === 'employeeId' && !contract?.id && owner) {
        next.salary = owner.baseSalary ?? 0;
      }

      if (field === 'contractType' && value === 'INDEFINITE') {
        next.endDate = '';
      }

      return next;
    });
    setLocalError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const message = validate(form);

    if (message) {
      setLocalError(message);
      return;
    }

    setSaving(true);

    try {
      await onSubmit({
        contractNumber: form.contractNumber.trim(),
        employeeId: form.employeeId,
        contractType: form.contractType,
        startDate: form.startDate,
        endDate: isIndefinite ? null : form.endDate,
        signedDate: form.signedDate || null,
        salary: Number(form.salary) || 0,
        status: form.status,
        notes: form.notes.trim() || null
      });
    } finally {
      setSaving(false);
    }
  }

  const shownError = localError || error;

  return (
    <form className="employee-form panel-form" onSubmit={handleSubmit}>
      <h3>{contract?.id ? `Sửa hợp đồng ${contract.contractNumber}` : 'Thêm hợp đồng'}</h3>
      {shownError && (
        <p className="form-error" role="alert">
          {shownError}
        </p>
      )}
      <div className="form-grid">
        {employee ? (
          <label>
            Nhân viên
            <input value={`${employee.fullName} (${employee.employeeCode})`} disabled />
          </label>
        ) : (
          <label>
            Nhân viên
            <input
              type="search"
              value={employeeSearch}
              onChange={(event) => {
                const value = event.target.value;
                setEmployeeSearch(value);
                // Gõ ra đúng 1 người thì chọn luôn, khỏi phải mở danh sách.
                const keyword = normalizeText(value.trim());
                const matches = keyword
                  ? employees.filter((item) => normalizeText(`${item.fullName} ${item.employeeCode}`).includes(keyword))
                  : [];
                if (matches.length === 1 && matches[0].id !== form.employeeId) {
                  updateField('employeeId', matches[0].id);
                }
              }}
              placeholder="Tìm theo tên hoặc mã nhân viên"
              aria-label="Tìm nhân viên"
            />
            <select
              value={form.employeeId}
              onChange={(event) => updateField('employeeId', event.target.value)}
              required
              aria-label="Chọn nhân viên"
            >
              <option value="">
                {employeeSearch.trim() ? `Chọn nhân viên (${matchCount} kết quả)` : 'Chọn nhân viên'}
              </option>
              {employeeOptions.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.fullName} ({item.employeeCode})
                </option>
              ))}
            </select>
            {form.employeeId && (
              <small className="field-hint">
                <EmployeeLink id={form.employeeId}>Xem hồ sơ nhân viên →</EmployeeLink>
              </small>
            )}
          </label>
        )}
        <label>
          Số hợp đồng
          <input
            value={form.contractNumber}
            onChange={(event) => {
              setNumberTouched(true);
              updateField('contractNumber', event.target.value);
            }}
            placeholder="VD: HDLD-NV001-2026"
            minLength={2}
            maxLength={60}
            required
          />
        </label>
        <label>
          Loại hợp đồng
          <select value={form.contractType} onChange={(event) => updateField('contractType', event.target.value)}>
            {Object.entries(contractTypeLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trạng thái
          <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
            {Object.entries(contractStatusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ngày bắt đầu
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => updateField('startDate', event.target.value)}
            required
          />
        </label>
        <label>
          Ngày kết thúc
          <input
            type="date"
            value={form.endDate}
            min={form.startDate}
            onChange={(event) => updateField('endDate', event.target.value)}
            disabled={isIndefinite}
            required={!isIndefinite}
          />
          {isIndefinite ? (
            <small className="field-hint">Hợp đồng không thời hạn không có ngày kết thúc</small>
          ) : (
            form.startDate && (
              <span className="duration-presets">
                {DURATION_PRESETS[form.contractType].map((months) => (
                  <button
                    type="button"
                    key={months}
                    onClick={() => updateField('endDate', addMonths(form.startDate, months))}
                  >
                    {months} tháng
                  </button>
                ))}
              </span>
            )
          )}
        </label>
        <label>
          Ngày ký
          <input type="date" value={form.signedDate} onChange={(event) => updateField('signedDate', event.target.value)} />
        </label>
        <label>
          Mức lương (VNĐ)
          <input
            type="number"
            min="0"
            max={MAX_MONEY}
            step="100000"
            value={form.salary}
            onChange={(event) => updateField('salary', event.target.value)}
            required
          />
        </label>
      </div>
      <label>
        Ghi chú
        <textarea
          value={form.notes}
          onChange={(event) => updateField('notes', event.target.value)}
          rows="2"
          maxLength={5000}
        />
      </label>
      <div className="form-actions">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
          Hủy
        </button>
        <button type="submit" className="primary-button" disabled={saving}>
          <FileSignature size={18} aria-hidden="true" />
          {saving ? 'Đang lưu...' : contract?.id ? 'Cập nhật' : 'Thêm hợp đồng'}
        </button>
      </div>
    </form>
  );
}
