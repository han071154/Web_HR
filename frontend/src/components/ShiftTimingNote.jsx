// Số phút đi trễ / về sớm so với khung giờ ca của một ngày chấm công (HR-035), hiện dưới trạng thái.
export default function ShiftTimingNote({ record }) {
  const parts = [];

  if (record.lateMinutes > 0) {
    parts.push(`Trễ ${record.lateMinutes} phút`);
  }

  if (record.earlyLeaveMinutes > 0) {
    parts.push(`Về sớm ${record.earlyLeaveMinutes} phút`);
  }

  return parts.length ? <span className="muted-text block">{parts.join(' · ')}</span> : null;
}
