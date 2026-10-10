import { Download, Pencil } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import {
  attendanceStatusClass,
  attendanceStatusLabels,
  currentMonthValue,
  downloadBlob,
  formatClock,
  formatDate,
  formatHours,
  monthRange,
  toDateTimeInputValue
} from '../format.js';
import FormDialog from './FormDialog.jsx';
import TabBar from './TabBar.jsx';

// Số giờ làm thực tế của một bản ghi (giờ ra − giờ vào), chưa chấm ra thì trả null.
function workedHours(record) {
  if (!record.checkIn || !record.checkOut) {
    return null;
  }

  return (new Date(record.checkOut) - new Date(record.checkIn)) / 3600000;
}

// HR sửa chấm công thủ công khi nhân viên quên chấm vào/ra hoặc sai trạng thái.
function CorrectionDialog({ record, onClose, onSaved, showToast }) {
  const [checkIn, setCheckIn] = useState(toDateTimeInputValue(record.checkIn));
  const [checkOut, setCheckOut] = useState(toDateTimeInputValue(record.checkOut));
  const [status, setStatus] = useState(record.status);
  const [note, setNote] = useState(record.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    if (checkIn && checkOut && checkOut <= checkIn) {
      setError('Giờ ra phải sau giờ vào.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await api.updateAttendance(record.id, {
        // datetime-local là giờ máy người dùng; toISOString() đổi sang UTC kèm "Z" đúng định dạng backend cần.
        checkIn: checkIn ? new Date(checkIn).toISOString() : null,
        checkOut: checkOut ? new Date(checkOut).toISOString() : null,
        status,
        note: note.trim() || null
      });
      showToast('success', `Đã sửa chấm công của ${record.employeeName} ngày ${formatDate(record.workDate)}.`);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title="Sửa chấm công"
      subtitle={`${record.employeeName} · ${formatDate(record.workDate)}${record.shiftName ? ` · ${record.shiftName}` : ''}`}
      busy={busy}
      onClose={onClose}
    >
      <form className="dialog-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Giờ vào
            <input type="datetime-local" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} />
          </label>
          <label>
            Giờ ra
            <input type="datetime-local" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} />
          </label>
        </div>
        <label>
          Trạng thái
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {Object.entries(attendanceStatusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ghi chú
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows="2"
            maxLength={2000}
            placeholder="VD: Quên chấm công ra, đã xác nhận với quản lý"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Đang lưu' : 'Lưu'}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

// Bảng chấm công chi tiết từng ngày (HR-022, HR-035), lọc theo khoảng ngày/phòng ban/trạng thái.
function AttendanceRecords({ departments, showToast }) {
  const [range, setRange] = useState(() => monthRange(currentMonthValue()));
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  const loadRecords = useCallback(async () => {
    if (!range.from || !range.to) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.attendanceRecords({
        from: range.from,
        to: range.to,
        departmentId: departmentFilter,
        status: statusFilter
      });
      setRecords(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range, departmentFilter, statusFilter]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  return (
    <section className="content-panel">
      <div className="toolbar toolbar-top">
        <label className="inline-field">
          Từ
          <input type="date" value={range.from} max={range.to} onChange={(event) => setRange({ ...range, from: event.target.value })} />
        </label>
        <label className="inline-field">
          Đến
          <input type="date" value={range.to} min={range.from} onChange={(event) => setRange({ ...range, to: event.target.value })} />
        </label>
        <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Lọc theo phòng ban">
          <option value="">Tất cả phòng ban</option>
          {departments.map((department) => (
            <option value={department.id} key={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc theo trạng thái">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(attendanceStatusLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="responsive-table attendance-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Ngày</th>
              <th>Ca</th>
              <th>Giờ vào</th>
              <th>Giờ ra</th>
              <th>Số giờ</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && !records.length ? (
              <tr>
                <td colSpan="9">Đang tải dữ liệu</td>
              </tr>
            ) : records.length ? (
              records.map((record) => {
                const hours = workedHours(record);

                return (
                  <tr key={record.id}>
                    <td className="cell-main">
                      <strong>{record.employeeName}</strong>
                      <span>{record.departmentName || record.employeeCode}</span>
                    </td>
                    <td data-label="Ngày">{formatDate(record.workDate)}</td>
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
                    <td data-label="Ghi chú" className={record.note ? '' : 'muted-cell'}>
                      {record.note || '—'}
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-button success"
                          onClick={() => setEditing(record)}
                          title="Sửa chấm công"
                          aria-label="Sửa chấm công"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9">Không có dữ liệu chấm công trong khoảng này</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <CorrectionDialog
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadRecords();
          }}
          showToast={showToast}
        />
      )}
    </section>
  );
}

// Bảng công tổng hợp theo tháng (HR-036, HR-037): ngày công, đi trễ, vắng, tổng giờ, giờ OT.
function MonthlySummary({ departments, showToast }) {
  const [month, setMonth] = useState(currentMonthValue);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    if (!month) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.monthlyAttendance({ month, departmentId: departmentFilter });
      setRows(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [month, departmentFilter]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function handleExport() {
    try {
      const blob = await api.exportWorkHours({ ...monthRange(month), departmentId: departmentFilter });
      downloadBlob(blob, `bang-cong-${month}.xlsx`);
    } catch (err) {
      showToast('error', err.message);
    }
  }

  return (
    <section className="content-panel">
      <div className="toolbar toolbar-top">
        <label className="inline-field">
          Tháng
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Lọc theo phòng ban">
          <option value="">Tất cả phòng ban</option>
          {departments.map((department) => (
            <option value={department.id} key={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <div className="toolbar-actions">
          <button type="button" className="ghost-button" onClick={handleExport} disabled={!rows.length}>
            <Download size={17} aria-hidden="true" />
            Xuất Excel
          </button>
        </div>
      </div>

      <p className="info-note">Chỉ tính những ngày đã chấm công vào và ra đầy đủ. Giờ OT là phần làm vượt giờ chuẩn của ca.</p>

      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="responsive-table summary-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Ngày công</th>
              <th>Đi trễ</th>
              <th>Vắng</th>
              <th>Tổng giờ</th>
              <th>Giờ OT</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length ? (
              <tr>
                <td colSpan="6">Đang tải dữ liệu</td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.employeeId}>
                  <td className="cell-main">
                    <strong>{row.employeeName}</strong>
                    <span>{row.employeeCode}</span>
                  </td>
                  <td data-label="Ngày công">{row.workDays}</td>
                  <td data-label="Đi trễ" className={row.lateCount ? 'warning-cell' : ''}>
                    {row.lateCount}
                  </td>
                  <td data-label="Vắng" className={row.absentCount ? 'danger-cell' : ''}>
                    {row.absentCount}
                  </td>
                  <td data-label="Tổng giờ">{formatHours(row.totalHours)}h</td>
                  <td data-label="Giờ OT">{formatHours(row.otHours)}h</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6">Chưa có dữ liệu chấm công trong tháng này</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Mục Chấm công phía HR.
export default function AttendancePanel({ departments, showToast }) {
  const [tab, setTab] = useState('records');

  return (
    <>
      <div className="tab-row">
        <TabBar
          label="Chấm công"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'records', label: 'Bảng chấm công' },
            { id: 'summary', label: 'Tổng hợp tháng' }
          ]}
        />
      </div>

      {tab === 'records' ? (
        <AttendanceRecords departments={departments} showToast={showToast} />
      ) : (
        <MonthlySummary departments={departments} showToast={showToast} />
      )}
    </>
  );
}
