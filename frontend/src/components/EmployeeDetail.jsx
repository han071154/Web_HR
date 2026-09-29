import { UserRoundPen, X } from 'lucide-react';
import { useEffect } from 'react';
import { employmentTypeLabels, formatDate, formatMoney, genderLabels, initials, statusLabels } from '../format.js';

const EMPTY = 'Chưa cập nhật';

// Màn hình xem chi tiết hồ sơ một nhân viên.
export default function EmployeeDetail({ employee, onEdit, onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const sections = [
    {
      title: 'Thông tin cá nhân',
      rows: [
        ['Họ tên', employee.fullName],
        ['Giới tính', genderLabels[employee.gender]],
        ['Ngày sinh', formatDate(employee.dateOfBirth)],
        ['Email', employee.email],
        ['Số điện thoại', employee.phone],
        ['Địa chỉ', employee.address]
      ]
    },
    {
      title: 'Công việc',
      rows: [
        ['Mã nhân viên', employee.employeeCode],
        ['Phòng ban', employee.departmentName],
        ['Chức danh', employee.position],
        ['Loại hợp đồng', employmentTypeLabels[employee.employmentType]],
        ['Ngày vào làm', formatDate(employee.hireDate)],
        ['Lương cơ bản', formatMoney(employee.baseSalary)]
      ]
    }
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal employee-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="detail-header">
          <div className="avatar" aria-hidden="true">
            {initials(employee.fullName)}
          </div>
          <div>
            <p className="eyebrow">{employee.employeeCode}</p>
            <h2 id="employee-detail-title">{employee.fullName}</h2>
            <span className={`status-pill status-${employee.status.toLowerCase()}`}>
              {statusLabels[employee.status] || employee.status}
            </span>
          </div>
          <button type="button" className="icon-button close-button" onClick={onClose} aria-label="Đóng">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {sections.map((section) => (
          <section className="detail-section" key={section.title}>
            <h3>{section.title}</h3>
            <dl className="detail-grid">
              {section.rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className={value ? '' : 'muted'}>{value || EMPTY}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="primary-button" onClick={() => onEdit(employee)}>
            <UserRoundPen size={18} aria-hidden="true" />
            Sửa hồ sơ
          </button>
        </div>
      </div>
    </div>
  );
}
