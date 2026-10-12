import { UserX } from 'lucide-react';

// Thay cả trang khi tài khoản EMPLOYEE chưa gắn với hồ sơ nhân viên (xem isNotLinkedError).
export default function NotLinkedNotice() {
  return (
    <section className="content-panel empty-state">
      <div className="empty-state-icon">
        <UserX size={28} aria-hidden="true" />
      </div>
      <h2>Tài khoản chưa được liên kết với hồ sơ nhân viên</h2>
      <p>
        Bạn cần được phòng nhân sự gắn tài khoản với hồ sơ nhân viên trước khi chấm công, xem lịch làm việc
        hoặc gửi đơn nghỉ phép. Hãy liên hệ phòng nhân sự để được hỗ trợ.
      </p>
    </section>
  );
}
