import { api } from './api.js';

// CV chỉ tải được kèm token đăng nhập, nên lấy file về dạng blob rồi mới tải xuống / mở.
export async function downloadCv(application) {
  const blob = await api.applicationCv(application.id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = application.cvOriginalName || `${application.applicationCode}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

// URL tạm để xem trước CV trong trang hoặc mở tab mới. Nhớ URL.revokeObjectURL khi không dùng nữa.
export async function cvPreviewUrl(application) {
  const blob = await api.applicationCv(application.id, true);
  return URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
}
