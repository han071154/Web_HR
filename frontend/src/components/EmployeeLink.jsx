// Tên nhân viên bấm được, mở chi tiết nhân viên (#employees/<id>). Không có id (vd hồ sơ đã bị xóa)
// thì chỉ hiện chữ in đậm như trước.
export default function EmployeeLink({ id, children, className = '' }) {
  if (!id) {
    return <strong className={className}>{children}</strong>;
  }

  return (
    <a className={`employee-link ${className}`.trim()} href={`#employees/${id}`} title="Xem hồ sơ nhân viên">
      {children}
    </a>
  );
}
