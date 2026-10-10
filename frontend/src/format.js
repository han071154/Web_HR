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
  HR_STAFF: 'Nhân viên nhân sự',
  EMPLOYEE: 'Nhân viên'
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

// ---------- Ca làm việc, chấm công, nghỉ phép (HR-021 → HR-038) ----------

// Trạng thái duyệt dùng chung cho đơn nghỉ phép và yêu cầu đổi ca.
export const approvalStatusLabels = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối'
};

export const approvalStatusClass = {
  PENDING: 'status-on_leave',
  APPROVED: 'status-active',
  REJECTED: 'status-terminated'
};

export const leaveTypeLabels = {
  ANNUAL: 'Nghỉ phép năm',
  SICK: 'Nghỉ ốm',
  UNPAID: 'Nghỉ không lương',
  OTHER: 'Khác'
};

export const attendanceStatusLabels = {
  PRESENT: 'Đúng giờ',
  LATE: 'Đi trễ',
  ABSENT: 'Vắng',
  ON_LEAVE: 'Nghỉ phép'
};

export const attendanceStatusClass = {
  PRESENT: 'status-active',
  LATE: 'status-on_leave',
  ABSENT: 'status-terminated',
  ON_LEAVE: 'status-reviewing'
};

export const weekdayLabels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

// Giờ từ API ("08:00:00") → "08:00".
export function formatTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

// Giờ trong ngày của một mốc thời gian (check-in/check-out): "08:05".
export function formatClock(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Số giờ: 8 → "8", 7.5 → "7,5" (tối đa 1 chữ số thập phân).
export function formatHours(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value || 0);
}

function minutesOfDay(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

// Giờ công chuẩn của một ca (giờ kết thúc − giờ bắt đầu − giờ nghỉ), khớp cách backend tính giới hạn giờ/tuần.
export function shiftHours(shift) {
  if (!shift?.startTime || !shift?.endTime) {
    return 0;
  }

  return (minutesOfDay(shift.endTime) - minutesOfDay(shift.startTime) - (shift.breakMinutes || 0)) / 60;
}

// Thứ 2 của tuần chứa ngày đã cho (tuần tính từ thứ 2 đến chủ nhật như backend).
export function startOfWeek(value) {
  const date = toLocalDate(value);
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Cộng/trừ số ngày, trả về "YYYY-MM-DD".
export function addDays(value, days) {
  const date = toLocalDate(value);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

// 7 ngày của tuần bắt đầu từ weekStart, dạng "YYYY-MM-DD".
export function weekDates(weekStart) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

// "12/10" — ngày/tháng ngắn gọn cho tiêu đề cột lịch.
export function formatDayMonth(value) {
  const date = toLocalDate(value);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Tháng hiện tại dạng "YYYY-MM" cho <input type="month">.
export function currentMonthValue() {
  return todayInputValue().slice(0, 7);
}

// Ngày đầu và ngày cuối của tháng "YYYY-MM".
export function monthRange(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

// Số ngày của khoảng nghỉ phép (tính cả ngày đầu và ngày cuối).
export function countDays(from, to) {
  return Math.round((toLocalDate(to) - toLocalDate(from)) / 86400000) + 1;
}

// Tải file (blob) về máy với tên cho trước.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
