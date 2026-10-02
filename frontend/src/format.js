// Nhãn tiếng Việt và hàm định dạng dùng chung cho các màn hình nhân sự.

export const statusLabels = {
  ACTIVE: 'Đang làm',
  ON_LEAVE: 'Nghỉ phép',
  RESIGNED: 'Đã nghỉ',
  TERMINATED: 'Chấm dứt'
};

export const genderLabels = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác'
};

// Hình thức làm việc, dùng chung cho hồ sơ nhân viên và tin tuyển dụng
// (khớp EMPLOYMENT_TYPES trong backend/src/constants.js).
export const employmentTypeLabels = {
  FULL_TIME: 'Toàn thời gian',
  PART_TIME: 'Bán thời gian',
  SHIFT: 'Theo ca',
  CONTRACT: 'Hợp đồng khoán',
  INTERN: 'Thực tập'
};

export const jobStatusLabels = {
  DRAFT: 'Nháp',
  OPEN: 'Đang mở',
  CLOSED: 'Đã đóng'
};

// Thứ tự xử lý hồ sơ ứng viên (Figma M-08c): Mới nộp → Đang xét → Phỏng vấn → Đậu / Trượt.
export const applicationStatusLabels = {
  NEW: 'Mới nộp',
  REVIEWING: 'Đang xét',
  INTERVIEW: 'Phỏng vấn',
  HIRED: 'Đậu',
  REJECTED: 'Trượt'
};

// Màu badge theo trạng thái hồ sơ (Figma M-08c).
export const applicationStatusClass = {
  NEW: 'status-new',
  REVIEWING: 'status-reviewing',
  INTERVIEW: 'status-on_leave',
  HIRED: 'status-active',
  REJECTED: 'status-terminated'
};

export const contractTypeLabels = {
  PROBATION: 'Thử việc',
  FIXED_TERM: 'Xác định thời hạn',
  INDEFINITE: 'Không thời hạn',
  SEASONAL: 'Thời vụ'
};

export const contractStatusLabels = {
  DRAFT: 'Nháp',
  ACTIVE: 'Hiệu lực',
  EXPIRED: 'Hết hạn',
  TERMINATED: 'Đã chấm dứt'
};

export const roleLabels = {
  ADMIN: 'Quản trị viên',
  HR_MANAGER: 'Quản lý nhân sự',
  HR_STAFF: 'Nhân viên nhân sự'
};

// Bỏ dấu để tìm "nguyen" vẫn ra "Nguyễn".
export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

// Chữ cái đầu cho avatar: chữ đầu của họ + chữ đầu của tên (Trần Thị Bình → TB).
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);

  if (!words.length) {
    return '?';
  }

  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

export function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(value || 0);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Đổi ngày từ API sang Date theo giờ máy người dùng.
// API có thể trả "1998-03-12" hoặc "1998-03-11T17:00:00.000Z" (đã lệch múi giờ UTC+7).
function toLocalDate(value) {
  if (DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

export function formatDate(value) {
  if (!value) {
    return '';
  }

  return toLocalDate(value).toLocaleDateString('vi-VN');
}

// Ngày giờ theo giờ máy người dùng: "10/10/2026 09:00".
export function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

  return `${date.toLocaleDateString('vi-VN')} ${time}`;
}

// Giá trị cho <input type="datetime-local">: "YYYY-MM-DDTHH:mm" theo giờ địa phương.
export function toDateTimeInputValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${toDateInputValue(date)}T${hours}:${minutes}`;
}

// Giá trị cho <input type="date">: luôn là "YYYY-MM-DD" theo giờ địa phương.
export function toDateInputValue(value) {
  if (!value) {
    return '';
  }

  const date = toLocalDate(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

// Hôm nay theo giờ máy người dùng. Không dùng toISOString() vì đó là giờ UTC:
// mở form lúc 0h–7h sáng ở Việt Nam sẽ ra ngày hôm qua.
export function todayInputValue() {
  return toDateInputValue(new Date());
}

function formatMillion(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / 1000000);
}

// Mức lương trên tin tuyển dụng: 10000000–15000000 → "10–15 triệu", không có → "Thỏa thuận".
export function formatSalaryRange(min, max) {
  if (min && max) {
    return min === max ? `${formatMillion(min)} triệu` : `${formatMillion(min)}–${formatMillion(max)} triệu`;
  }

  if (min) {
    return `Từ ${formatMillion(min)} triệu`;
  }

  if (max) {
    return `Đến ${formatMillion(max)} triệu`;
  }

  return 'Thỏa thuận';
}

// Số ngày còn lại tới hạn nộp (hôm nay = 0), null nếu tin không có hạn.
export function daysUntil(value) {
  if (!value) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((toLocalDate(value) - today) / 86400000);
}
