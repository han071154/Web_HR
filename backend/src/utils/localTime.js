import { config } from '../config.js';

// Ngày/giờ theo múi giờ của công ty (config.timezone), KHÔNG theo giờ UTC hay giờ của máy chủ:
// máy chủ/Docker thường chạy UTC, nên new Date().toISOString() lúc 0h–7h sáng ở Việt Nam vẫn
// trả về ngày hôm qua, và getHours() lệch 7 tiếng khi xét đi trễ.
function partsInTimezone(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

// "YYYY-MM-DD" của ngày đang diễn ra ở múi giờ công ty.
export function localDate(date = new Date()) {
  const parts = partsInTimezone(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Số phút tính từ 0h (theo múi giờ công ty), dùng để so với giờ bắt đầu ca.
export function localMinutesOfDay(date = new Date()) {
  const parts = partsInTimezone(date);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

// Ngày cuối của tháng "YYYY-MM" → "YYYY-MM-DD", tính thuần bằng UTC nên không lệch múi giờ.
export function lastDayOfMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
}
