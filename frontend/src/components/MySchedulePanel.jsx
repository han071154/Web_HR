import { CalendarPlus, ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import {
  addDays,
  formatDate,
  formatDayMonth,
  formatHours,
  formatTime,
  shiftHours,
  startOfWeek,
  todayInputValue,
  toDateInputValue,
  weekDates,
  weekdayLabels
} from '../format.js';
import FormDialog from './FormDialog.jsx';
import { useLatestRequest } from '../useLatestRequest.js';

function shiftLabel(shift) {
  return `${shift.name} (${formatTime(shift.startTime)} – ${formatTime(shift.endTime)})`;
}

// Nhân viên tự đăng ký một ca còn trống (HR-031).
function RegisterDialog({ date, shifts, onClose, onSaved, showToast }) {
  const [shiftId, setShiftId] = useState(shifts[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await api.registerShift(shiftId, date);
      showToast('success', `Đã đăng ký ca ngày ${formatDate(date)}.`);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <FormDialog title="Đăng ký ca" subtitle={`Ngày ${formatDate(date)}`} busy={busy} onClose={onClose}>
      <form className="dialog-form" onSubmit={handleSubmit}>
        <label>
          Ca làm việc
          <select value={shiftId} onChange={(event) => setShiftId(event.target.value)} required>
            {shifts.map((shift) => (
              <option value={shift.id} key={shift.id}>
                {shiftLabel(shift)}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={busy || !shiftId}>
            {busy ? 'Đang gửi' : 'Đăng ký'}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

// Nhân viên xin đổi ca đã xếp (HR-032); HR duyệt ở mục Ca làm việc → Yêu cầu đổi ca.
function ChangeDialog({ schedule, shifts, onClose, onSent, showToast }) {
  const options = shifts.filter((shift) => shift.id !== schedule.shiftId);
  const [requestedShiftId, setRequestedShiftId] = useState(options[0]?.id || '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await api.requestShiftChange(schedule.id, {
        requestedShiftId: requestedShiftId || null,
        reason: reason.trim() || null
      });
      showToast('success', 'Đã gửi yêu cầu đổi ca. Vui lòng chờ phòng nhân sự duyệt.');
      onSent(schedule.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title="Xin đổi ca"
      subtitle={`${formatDate(schedule.workDate)} · đang xếp ${shiftLabel({
        name: schedule.shiftName,
        startTime: schedule.startTime,
        endTime: schedule.endTime
      })}`}
      busy={busy}
      onClose={onClose}
    >
      <form className="dialog-form" onSubmit={handleSubmit}>
        <label>
          Muốn đổi sang
          <select value={requestedShiftId} onChange={(event) => setRequestedShiftId(event.target.value)}>
            {options.map((shift) => (
              <option value={shift.id} key={shift.id}>
                {shiftLabel(shift)}
              </option>
            ))}
            <option value="">Không chọn ca cụ thể (ghi rõ ở lý do)</option>
          </select>
        </label>
        <label>
          Lý do
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows="3"
            maxLength={2000}
            required
            placeholder="VD: Có lịch khám bệnh buổi sáng"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Đang gửi' : 'Gửi yêu cầu'}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

// Lịch làm việc cá nhân theo tuần (HR-033).
export default function MySchedulePanel({ showToast }) {
  const [weekStart, setWeekStart] = useState(() => toDateInputValue(startOfWeek(new Date())));
  const [schedules, setSchedules] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(null);
  const [changing, setChanging] = useState(null);
  // Chưa có API cho nhân viên xem lại yêu cầu đổi ca, nên chỉ nhớ các yêu cầu vừa gửi trong phiên này.
  const [sentRequests, setSentRequests] = useState([]);

  const days = useMemo(() => weekDates(weekStart), [weekStart]);
  const today = todayInputValue();

  const startRequest = useLatestRequest();

  const loadWeek = useCallback(async () => {
    const isLatest = startRequest();

    setLoading(true);
    setError('');

    try {
      const response = await api.mySchedules({ from: days[0], to: days[6] });
      if (!isLatest()) {
        return;
      }

      setSchedules(response.data);
    } catch (err) {
      if (isLatest()) {
        setError(err.message);
      }
    } finally {
      if (isLatest()) {
        setLoading(false);
      }
    }
  }, [startRequest, days]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  useEffect(() => {
    api
      .workShifts({ active: 'true' })
      .then((response) => setShifts(response.data))
      .catch(() => setShifts([]));
  }, []);

  const byDate = useMemo(() => new Map(schedules.map((schedule) => [schedule.workDate, schedule])), [schedules]);
  const weekHours = schedules
    .filter((schedule) => schedule.status === 'SCHEDULED')
    .reduce((total, schedule) => total + shiftHours(schedule), 0);

  return (
    <section className="content-panel">
      <div className="schedule-toolbar">
        <div className="week-nav">
          <button
            type="button"
            className="icon-text-button square"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            title="Tuần trước"
            aria-label="Tuần trước"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <strong>
            {formatDayMonth(days[0])} – {formatDate(days[6])}
          </strong>
          <button
            type="button"
            className="icon-text-button square"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            title="Tuần sau"
            aria-label="Tuần sau"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="ghost-button" onClick={() => setWeekStart(toDateInputValue(startOfWeek(new Date())))}>
            Tuần này
          </button>
        </div>
        <span className="muted-text">Tổng giờ tuần này: {formatHours(weekHours)} giờ</span>
      </div>

      {error && <p className="form-error">{error}</p>}

      <ul className="my-week">
        {days.map((day, index) => {
          const schedule = byDate.get(day);
          const isPast = day < today;
          const isScheduled = schedule?.status === 'SCHEDULED';

          return (
            <li key={day} className={`my-day${day === today ? ' is-today' : ''}${isPast ? ' is-past' : ''}`}>
              <div className="my-day-date">
                <strong>{weekdayLabels[index]}</strong>
                <span>{formatDayMonth(day)}</span>
              </div>
              <div className="my-day-shift">
                {loading && !schedules.length ? (
                  <span className="muted-text">Đang tải</span>
                ) : schedule ? (
                  <>
                    <strong className={isScheduled ? '' : 'cancelled-text'}>{schedule.shiftName}</strong>
                    <span>
                      {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
                      {!isScheduled && ' · Đã hủy'}
                    </span>
                    {schedule.notes && <span className="muted-text">{schedule.notes}</span>}
                  </>
                ) : (
                  <span className="muted-text">Không có ca</span>
                )}
              </div>
              <div className="my-day-action">
                {!isPast && !schedule && !error && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setRegistering(day)}
                    disabled={!shifts.length}
                  >
                    <CalendarPlus size={17} aria-hidden="true" />
                    Đăng ký ca
                  </button>
                )}
                {!isPast && isScheduled &&
                  (sentRequests.includes(schedule.id) ? (
                    <span className="status-pill status-on_leave">Đã gửi yêu cầu đổi ca</span>
                  ) : (
                    <button type="button" className="ghost-button" onClick={() => setChanging(schedule)}>
                      <Repeat size={17} aria-hidden="true" />
                      Xin đổi ca
                    </button>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>

      {registering && (
        <RegisterDialog
          date={registering}
          shifts={shifts}
          onClose={() => setRegistering(null)}
          onSaved={() => {
            setRegistering(null);
            loadWeek();
          }}
          showToast={showToast}
        />
      )}

      {changing && (
        <ChangeDialog
          schedule={changing}
          shifts={shifts}
          onClose={() => setChanging(null)}
          onSent={(scheduleId) => {
            setChanging(null);
            setSentRequests((current) => [...current, scheduleId]);
          }}
          showToast={showToast}
        />
      )}
    </section>
  );
}
