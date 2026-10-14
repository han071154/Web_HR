import { getStoredUser } from './api.js';

// Phân quyền HR theo chức năng (khớp backend): HR Manager/Admin quản lý nhân sự, hợp đồng, tuyển dụng,
// phòng ban – chức vụ, báo cáo và duyệt đơn nghỉ / đổi ca. HR Staff chỉ lo vận hành hằng ngày: ca làm việc,
// chấm công, xem đơn nghỉ và yêu cầu đổi ca.
export const MANAGER_ROLES = ['ADMIN', 'HR_MANAGER'];

export function isHrManager(user = getStoredUser()) {
  return MANAGER_ROLES.includes(user?.role);
}
