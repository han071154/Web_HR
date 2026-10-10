import { LogIn, LogOut } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useLatestRequest } from '../useLatestRequest.js';
import {
  attendanceStatusClass,
  attendanceStatusLabels,
  currentMonthValue,
  formatClock,
  formatDate,
  formatHours,
  formatTime,
  monthRange,
  todayInputValue
} from '../format.js';

function workedHours(record) {
  if (!record?.checkIn || !record?.checkOut) {
    return null;
  }

  return (new Date(record.checkOut) - new Date(record.checkIn)) / 3600000;
}

// Đồng hồ hiện giờ, cập nhật mỗi 30 giây.
function useNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  return now;
}

// Nhân viên tự chấm công vào/ra theo ca (HR-022) và xem bảng công cá nhân theo tháng (HR-037).
export default function MyAttendancePanel({ showToast }) {
  const today = todayInputValue();
  const now = useNow();
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [todayRecord, setTodayRecord] = useState(null);
  const [month, setMonth] = useState(currentMonthValue);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadToday = useCallback(async () => {
    try {
      const [scheduleResponse, recordResponse] = await Promise.all([
        api.mySchedules({ from: today, to: today }),
        api.myAttendance({ from: today, to: today })
      ]);
      setTodaySchedule(scheduleResponse.data.find((schedule) => schedule.status === 'SCHEDULED') || null);
      setTodayRecord(recordResponse.data[0] || null);
    } catch (err) {
      setError(err.message);
    }
  }, [today]);

  const startRequest = useLatestRequest();

  const loadMonth = useCallback(async () => {
    const isLatest = startRequest();

    if (!month) {
      return;
    }

    setLoading(true);

    try {
      const response = await api.myAttendance(monthRange(month));
      if (!isLatest()) {
        return;
      }

      setRecords(response.data);
    } catch (err) {
      if (isLatest()) {
        setError(err.message);
      }
    } finally {
      if (isLatest()) {
        setLoading(false);
      }
    }
  }, [startRequest, month]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  async function handleCheck(type) {
    setBusy(true);

    try {
      const response = type === 'in' ? await api.checkIn() : await api.checkOut();
      const record = response.data;
      showToast(
        'success',
        type === 'in'
          ? `Đã chấm công vào lúc ${formatClock(record.checkIn)}${record.status === 'LATE' ? ' (đi trễ)' : ''}.`
          : `Đã chấm công ra lúc ${formatClock(record.checkOut)}.`
      );
      await Promise.all([loadToday(), loadMonth()]);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  const checkedIn = Boolean(todayRecord?.checkIn);
  const checkedOut = Boolean(todayRecord?.checkOut);
  const onLeave = todayRecord?.status === 'ON_LEAVE' && !checkedIn;
  const totals = records.reduce(
    (sum, record) => ({
      days: sum.days + (record.checkIn ? 1 : 0),
      late: sum.late + (record.status === 'LATE' ? 1 : 0),
      hours: sum.hours + (workedHours(record) || 0)
    }),
    { days: 0, late: 0, hours: 0 }
  );

  return (
    <>
      {error && <p className="form-error">{error}</p>}

      <section className="content-panel check-card">
        <div className="check-clock">
          <span>{now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
          <strong>{formatClock(now)}</strong>
          <p>
            {todaySchedule
              ? `Ca hôm nay: ${todaySchedule.shiftName} (${formatTime(todaySchedule.startTime)} – ${formatTime(todaySchedule.endTime)})`
              : 'Hôm nay bạn không có ca được xếp.'}
          </p>
        </div>

        <dl className="check-status">
          <div>
            <dt>Giờ vào</dt>
            <dd>{formatClock(todayRecord?.checkIn) || '—'}</dd>
          </div>
          <div>
            <dt>Giờ ra</dt>
            <dd>{formatClock(todayRecord?.checkOut) || '—'}</dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd>
              {todayRecord ? (
                <span className={`status-pill ${attendanceStatusClass[todayRecord.status]}`}>
                  {attendanceStatusLabels[todayRecord.status]}
                </span>
              ) : (
                'Chưa chấm công'
              )}
            </dd>
          </div>
        </dl>

        <div className="check-actions">
          {onLeave ? (
            <p className="info-note">Hôm nay bạn đang nghỉ phép.</p>
          ) : !checkedIn ? (
            <button type="button" className="primary-button large" onClick={() => handleCheck('in')} disabled={busy || Boolean(error)}>
              <LogIn size={20} aria-hidden="true" />
              {busy ? 'Đang chấm công' : 'Chấm công vào'}
            </button>
          ) : !checkedOut ? (
            <button type="button" className="primary-button large" onClick={() => handleCheck('out')} disabled={busy}>
              <LogOut size={20} aria-hidden="true" />
              {busy ? 'Đang chấm công' : 'Chấm công ra'}
            </button>
          ) : (
            <p className="info-note">
              Bạn đã hoàn thành chấm công hôm nay ({formatHours(workedHours(todayRecord))} giờ).
            </p>
          )}
        </div>
      </section>

      <section className="content-panel">
        <div className="section-header">
          <h2>Bảng công của tôi</h2>
          <label className="inline-field">
            Tháng
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        </div>

        <div className="stat-tiles">
          <div className="stat-tile tone-primary">
            <span>Ngày đi làm</span>
            <strong>{totals.days}</strong>
          </div>
          <div className="stat-tile tone-warning">
            <span>Đi trễ</span>
            <strong>{totals.late}</strong>
          </div>
          <div className="stat-tile tone-success">
            <span>Tổng giờ làm</span>
            <strong>{formatHours(totals.hours)}h</strong>
          </div>
        </div>

        <div className="table-wrap">
          <table className="responsive-table my-attendance-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Ca</th>
                <th>Giờ vào</th>
                <th>Giờ ra</th>
                <th>Số giờ</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loading && !records.length ? (
                <tr>
                  <td colSpan="6">Đang tải dữ liệu</td>
                </tr>
              ) : records.length ? (
                records.map((record) => {
                  const hours = workedHours(record);

                  return (
                    <tr key={record.id}>
                      <td className="cell-main">
                        <strong>{formatDate(record.workDate)}</strong>
                      </td>
                      <td data-label="Ca" className={record.shiftName ? '' : 'muted-cell'}>
                        {record.shiftName || 'Không có lịch'}
                      </td>
                      <td data-label="Giờ vào">{formatClock(record.checkIn) || '—'}</td>
                      <td data-label="Giờ ra">{formatClock(record.checkOut) || '—'}</td>
                      <td data-label="Số giờ">{hours === null ? '—' : `${formatHours(hours)}h`}</td>
                      <td data-label="Trạng thái">
                        <span className={`status-pill ${attendanceStatusClass[record.status]}`}>
                          {attendanceStatusLabels[record.status] || record.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6">Chưa có dữ liệu chấm công trong tháng này</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
