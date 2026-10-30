import { isHrManager } from '../roles.js';

// Tên nhân viên bấm được, mở chi tiết nhân viên (#employees/<id>). Không có id (vd hồ sơ đã bị xóa) hoặc
// người xem không quản lý hồ sơ nhân sự (HR Staff) thì chỉ hiện chữ in đậm như trước.
export default function EmployeeLink({ id, children, className = '' }) {
  if (!id || !isHrManager()) {
    return <strong className={className}>{children}</strong>;
  }

  return (
    <a className={`employee-link ${className}`.trim()} href={`#employees/${id}`} title="Xem hồ sơ nhân viên">
      {children}
    </a>
  );
}
