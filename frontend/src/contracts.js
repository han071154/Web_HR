import { daysUntil } from './format.js';

// Quyền khớp với backend: HR nào cũng thêm/sửa hợp đồng, chỉ Admin và HR Manager được xóa.
export const CONTRACT_EDIT_ROLES = ['ADMIN', 'HR_MANAGER', 'HR_STAFF'];
export const CONTRACT_DELETE_ROLES = ['ADMIN', 'HR_MANAGER'];

// Hợp đồng hiệu lực sắp hết hạn trong số ngày này thì nhắc HR gia hạn.
export const EXPIRING_SOON_DAYS = 30;

// Trạng thái hợp đồng → màu badge (Hiệu lực xanh, Hết hạn xám...).
export const contractStatusClass = {
  DRAFT: 'status-inactive',
  ACTIVE: 'status-active',
  EXPIRED: 'status-resigned',
  TERMINATED: 'status-terminated'
};

// Nhắc về thời hạn của hợp đồng đang hiệu lực: quá hạn / sắp hết hạn. Không có gì để nhắc thì trả null.
export function contractDeadline(contract) {
  if (contract.status !== 'ACTIVE' || !contract.endDate) {
    return null;
  }

  const days = daysUntil(contract.endDate);

  if (days < 0) {
    return { level: 'overdue', text: `Đã quá hạn ${-days} ngày` };
  }

  if (days <= EXPIRING_SOON_DAYS) {
    return { level: 'soon', text: days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày` };
  }

  return null;
}
