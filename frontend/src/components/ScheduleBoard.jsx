import { CalendarPlus, ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
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
import { toVietnameseError } from '../messages.js';
import FormDialog from './FormDialog.jsx';

// Khớp MAX_WEEKLY_WORK_HOURS mặc định của backend: chỉ để tô cảnh báo trên lưới,
// backend mới là nơi chặn thật (trả lỗi 409 khi vượt).
const MAX_WEEKLY_HOURS = 48;

// Hộp thoại xếp ca / sửa ca của một nhân viên trong một ngày.
function CellDialog({ cell, shifts, onClose, onSaved, showToast }) {
  const { employee, date, schedule } = cell;
  const [shiftId, setShiftId] = useState(schedule?.shiftId || shifts[0]?.id || '');
  const [status, setStatus] = useState(schedule?.status || 'SCHEDULED');
  const [notes, setNotes] = useState(schedule?.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Ca đang gán có thể đã ngừng sử dụng: vẫn giữ trong danh sách để không bị đổi ngầm.
  const options = schedule && !shifts.some((shift) => shift.id === schedule.shiftId)
    ? [...shifts, { id: schedule.shiftId, name: schedule.shiftName, startTime: schedule.startTime, endTime: schedule.endTime }]
    : shifts;

  async function run(action, successMessage) {
    setBusy(true);
    setError('');

    try {
      await action();
      showToast('success', successMessage);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const payload = { shiftId, status, notes: notes.trim() || null };

    if (schedule) {
      run(() => api.updateWorkSchedule(schedule.id, payload), `Đã cập nhật ca của ${employee.fullName}.`);
    } else {
      run(
        () => api.createWorkSchedule({ ...payload, employeeId: employee.id, workDate: date }),
        `Đã xếp ca cho ${employee.fullName}.`
      );
    }
  }

  return (
    <FormDialog
      title={schedule ? 'Sửa ca làm việc' : 'Xếp ca làm việc'}
      subtitle={`${employee.fullName} · ${weekdayLabels[(new Date(`${date}T00:00`).getDay() + 6) % 7]}, ${formatDate(date)}`}
      busy={busy}
      onClose={onClose}
    >
      <form className="dialog-form" onSubmit={handleSubmit}>
        <label>
          Ca làm việc
          <select value={shiftId} onChange={(event) => setShiftId(event.target.value)} required>
            {options.map((shift) => (
              <option value={shift.id} key={shift.id}>
                {shift.name} ({formatTime(shift.startTime)} – {formatTime(shift.endTime)})
              </option>
            ))}
          </select>
        </label>
        {schedule && (
          <label>
            Trạng thái
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="SCHEDULED">Đã xếp</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </label>
        )}
        <label>
          Ghi chú
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="2" maxLength={2000} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          {schedule && (
            <button
              type="button"
              className="ghost-button danger-text"
              disabled={busy}
              onClick={() => run(() => api.deleteWorkSchedule(schedule.id), `Đã xóa ca của ${employee.fullName}.`)}
            >
              <Trash2 size={17} aria-hidden="true" />
              Xóa
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={busy || !shiftId}>
            {busy ? 'Đang lưu' : 'Lưu'}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

// Xếp một ca cho nhiều nhân viên trong nhiều ngày của tuần (POST /work-schedules/bulk).
function BulkDialog({ employees, days, shifts, onClose, onSaved, showToast }) {
  const [shiftId, setShiftId] = useState(shifts[0]?.id || '');
  const [selectedDays, setSelectedDays] = useState(() => days.slice(0, 5));
  const [selectedEmployees, setSelectedEmployees] = useState(() => employees.map((employee) => employee.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [skipped, setSkipped] = useState([]);

  const employeeNames = useMemo(
    () => Object.fromEntries(employees.map((employee) => [employee.id, employee.fullName])),
    [employees]
  );

  function toggle(list, setList, value) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const assignments = selectedEmployees.flatMap((employeeId) =>
      selectedDays.map((workDate) => ({ employeeId, shiftId, workDate }))
    );

    if (!assignments.length) {
      setError('Hãy chọn ít nhất một nhân viên và một ngày.');
      return;
    }

    if (assignments.length > 200) {
      setError('Mỗi lần chỉ xếp tối đa 200 ca. Hãy chọn bớt nhân viên hoặc ngày.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const { data } = await api.bulkWorkSchedules(assignments);
      showToast(data.skipped ? 'error' : 'success', `Đã xếp ${data.created} ca, bỏ qua ${data.skipped} ca bị trùng hoặc vượt giờ.`);
      onSaved({ keepOpen: data.skipped > 0 });

      if (data.skipped) {
        setSkipped(data.errors);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog title="Xếp ca hàng loạt" subtitle="Chọn ca, các ngày và nhân viên cần xếp" wide busy={busy} onClose={onClose}>
      <form className="dialog-form" onSubmit={handleSubmit}>
        <label>
          Ca làm việc
          <select value={shiftId} onChange={(event) => setShiftId(event.target.value)} required>
            {shifts.map((shift) => (
              <option value={shift.id} key={shift.id}>
                {shift.name} ({formatTime(shift.startTime)} – {formatTime(shift.endTime)})
              </option>
            ))}
          </select>
        </label>

        <fieldset className="choice-group">
          <legend>Ngày trong tuần</legend>
          <div className="choice-chips">
            {days.map((day, index) => (
              <label key={day} className={`choice-chip${selectedDays.includes(day) ? ' checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedDays.includes(day)}
                  onChange={() => toggle(selectedDays, setSelectedDays, day)}
                />
                {weekdayLabels[index]} {formatDayMonth(day)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="choice-group">
          <legend>
            Nhân viên ({selectedEmployees.length}/{employees.length})
            <button
              type="button"
              className="link-button"
              onClick={() =>
                setSelectedEmployees(
                  selectedEmployees.length === employees.length ? [] : employees.map((employee) => employee.id)
                )
              }
            >
              {selectedEmployees.length === employees.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </legend>
          <div className="choice-list">
            {employees.map((employee) => (
              <label key={employee.id} className="checkbox-field">
                <input
                  type="checkbox"
                  checked={selectedEmployees.includes(employee.id)}
                  onChange={() => toggle(selectedEmployees, setSelectedEmployees, employee.id)}
                />
                {employee.fullName} <span className="muted-text">{employee.employeeCode}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="form-error">{error}</p>}

        {skipped.length > 0 && (
          <div className="skipped-list">
            <strong>Các ca bị bỏ qua:</strong>
            <ul>
              {skipped.map((item) => (
                <li key={`${item.employeeId}-${item.workDate}`}>
                  {employeeNames[item.employeeId] || 'Nhân viên'} · {formatDate(item.workDate)}:{' '}
                  {toVietnameseError(409, { message: item.message })}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Đóng
          </button>
          <button type="submit" className="primary-button" disabled={busy || !shiftId}>
            <CalendarPlus size={18} aria-hidden="true" />
            {busy ? 'Đang xếp' : 'Xếp ca'}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

// Lưới lịch phân ca theo tuần (HR-021, HR-030): mỗi dòng một nhân viên, mỗi cột một ngày.
export default function ScheduleBoard({ departments, shifts, showToast }) {
  const [weekStart, setWeekStart] = useState(() => toDateInputValue(startOfWeek(new Date())));
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [employees, setEmployees] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cell, setCell] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  const days = useMemo(() => weekDates(weekStart), [weekStart]);
  const today = todayInputValue();
  const activeShifts = useMemo(() => shifts.filter((shift) => shift.isActive), [shifts]);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [employeeResponse, scheduleResponse] = await Promise.all([
        api.employees({ status: 'ACTIVE', departmentId: departmentFilter, limit: 100 }),
        api.workSchedules({ from: days[0], to: days[6], departmentId: departmentFilter })
      ]);
      setEmployees(employeeResponse.data);
      setTotalEmployees(employeeResponse.pagination.total);
      setSchedules(scheduleResponse.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days, departmentFilter]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  // Nhân viên đã nghỉ nhưng vẫn còn lịch trong tuần thì vẫn hiện một dòng để HR thấy và xử lý.
  const rows = useMemo(() => {
    const list = employees.map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      employeeCode: employee.employeeCode
    }));
    const known = new Set(list.map((employee) => employee.id));

    for (const schedule of schedules) {
      if (!known.has(schedule.employeeId)) {
        known.add(schedule.employeeId);
        list.push({ id: schedule.employeeId, fullName: schedule.employeeName, employeeCode: schedule.employeeCode });
      }
    }

    return list.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  }, [employees, schedules]);

  const scheduleMap = useMemo(() => {
    const map = new Map();

    for (const schedule of schedules) {
      map.set(`${schedule.employeeId}|${schedule.workDate}`, schedule);
    }

    return map;
  }, [schedules]);

  function weeklyHours(employeeId) {
    return schedules
      .filter((schedule) => schedule.employeeId === employeeId && schedule.status === 'SCHEDULED')
      .reduce((total, schedule) => total + shiftHours(schedule), 0);
  }

  async function copyPreviousWeek() {
    setCopying(true);

    try {
      const { data } = await api.copyPreviousWeek(weekStart, departmentFilter);
      showToast(
        data.created ? 'success' : 'error',
        data.created
          ? `Đã sao chép ${data.created} ca từ tuần trước${data.skipped ? `, bỏ qua ${data.skipped} ca bị trùng` : ''}.`
          : 'Không có ca nào để sao chép (tuần trước trống hoặc tuần này đã xếp đủ).'
      );
      await loadWeek();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setCopying(false);
    }
  }

  const noShifts = !activeShifts.length;

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
          <button
            type="button"
            className="ghost-button"
            onClick={() => setWeekStart(toDateInputValue(startOfWeek(new Date())))}
          >
            Tuần này
          </button>
        </div>
        <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Lọc theo phòng ban">
          <option value="">Tất cả phòng ban</option>
          {departments.map((department) => (
            <option value={department.id} key={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <div className="toolbar-actions">
          <button type="button" className="ghost-button" onClick={copyPreviousWeek} disabled={copying || loading}>
            <Copy size={17} aria-hidden="true" />
            {copying ? 'Đang sao chép' : 'Sao chép tuần trước'}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => setBulkOpen(true)}
            disabled={noShifts || !rows.length}
          >
            <CalendarPlus size={18} aria-hidden="true" />
            Xếp ca hàng loạt
          </button>
        </div>
      </div>

      {noShifts && !loading && (
        <p className="info-note">Chưa có ca làm việc đang sử dụng. Hãy thêm ca ở tab "Danh mục ca" trước khi xếp lịch.</p>
      )}
      {totalEmployees > employees.length && (
        <p className="info-note">
          Đang hiện {employees.length}/{totalEmployees} nhân viên. Hãy lọc theo phòng ban để xem đủ.
        </p>
      )}
      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap schedule-wrap">
        <table className="schedule-grid">
          <thead>
            <tr>
              <th className="sticky-col">Nhân viên</th>
              {days.map((day, index) => (
                <th key={day} className={day === today ? 'is-today' : ''}>
                  <span>{weekdayLabels[index]}</span>
                  <small>{formatDayMonth(day)}</small>
                </th>
              ))}
              <th>Tổng giờ</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length ? (
              <tr>
                <td colSpan="9">Đang tải dữ liệu</td>
              </tr>
            ) : rows.length ? (
              rows.map((employee) => {
                const hours = weeklyHours(employee.id);

                return (
                  <tr key={employee.id}>
                    <td className="sticky-col">
                      <strong>{employee.fullName}</strong>
                      <span className="muted-text">{employee.employeeCode}</span>
                    </td>
                    {days.map((day) => {
                      const schedule = scheduleMap.get(`${employee.id}|${day}`);

                      return (
                        <td key={day} className={day === today ? 'is-today' : ''}>
                          {schedule ? (
                            <button
                              type="button"
                              className={`shift-chip${schedule.status === 'CANCELLED' ? ' cancelled' : ''}`}
                              onClick={() => setCell({ employee, date: day, schedule })}
                              title={schedule.notes || 'Sửa ca'}
                            >
                              <strong>{schedule.shiftName}</strong>
                              <span>
                                {formatTime(schedule.startTime)}–{formatTime(schedule.endTime)}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="add-shift-button"
                              onClick={() => setCell({ employee, date: day })}
                              disabled={noShifts}
                              title="Xếp ca"
                              aria-label={`Xếp ca cho ${employee.fullName} ngày ${formatDate(day)}`}
                            >
                              <Plus size={16} aria-hidden="true" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className={hours > MAX_WEEKLY_HOURS ? 'hours-over' : 'hours-cell'}>
                      {formatHours(hours)}h
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9">Không có nhân viên đang làm việc</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cell && (
        <CellDialog
          cell={cell}
          shifts={activeShifts}
          onClose={() => setCell(null)}
          onSaved={() => {
            setCell(null);
            loadWeek();
          }}
          showToast={showToast}
        />
      )}

      {bulkOpen && (
        <BulkDialog
          employees={rows}
          days={days}
          shifts={activeShifts}
          onClose={() => setBulkOpen(false)}
          onSaved={({ keepOpen }) => {
            if (!keepOpen) {
              setBulkOpen(false);
            }

            loadWeek();
          }}
          showToast={showToast}
        />
      )}
    </section>
  );
}
