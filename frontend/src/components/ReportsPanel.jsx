import { Download, FileText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { currentMonthValue, downloadBlob, formatCompact, formatHours, monthRange } from '../format.js';
import { useLatestRequest } from '../useLatestRequest.js';
import { HorizontalBarChart } from './charts.jsx';
import EmployeeLink from './EmployeeLink.jsx';
import Pagination from './Pagination.jsx';

// Chỉ vẽ một trang của bảng: 5.000 nhân viên = 5.000 dòng làm trình duyệt khựng (tổng và biểu đồ vẫn tính trên đủ dữ liệu).
const ROWS_PAGE_SIZE = 50;

function StatTile({ label, value, tone = 'primary' }) {
  return (
    <div className={`stat-tile tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// Báo cáo thống kê (HR-010, HR-038, HR-040): nhân sự theo phòng ban và giờ công theo khoảng thời gian.
export default function ReportsPanel({ departments, showToast }) {
  const [headcount, setHeadcount] = useState([]);
  const [range, setRange] = useState(() => monthRange(currentMonthValue()));
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [workHours, setWorkHours] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .reportByDepartment()
      .then((response) => setHeadcount(response.data))
      .catch((err) => setError(err.message));
  }, []);

  const startRequest = useLatestRequest();

  const loadWorkHours = useCallback(async () => {
    const isLatest = startRequest();

    if (!range.from || !range.to) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.reportWorkHours({ ...range, departmentId: departmentFilter });
      if (!isLatest()) {
        return;
      }

      setWorkHours(response.data);
      setPage(1);
    } catch (err) {
      if (isLatest()) {
        setError(err.message);
      }
    } finally {
      if (isLatest()) {
        setLoading(false);
      }
    }
  }, [startRequest, range, departmentFilter]);

  useEffect(() => {
    loadWorkHours();
  }, [loadWorkHours]);

  async function handleExport(format) {
    try {
      const blob = await api.exportWorkHours({ ...range, departmentId: departmentFilter, format });
      downloadBlob(blob, `bao-cao-gio-cong-${range.from}-${range.to}.${format}`);
    } catch (err) {
      showToast('error', err.message);
    }
  }

  const totalEmployees = headcount.reduce((sum, row) => sum + row.employeeCount, 0);
  const totals = workHours.reduce(
    (sum, row) => ({
      hours: sum.hours + row.totalHours,
      ot: sum.ot + row.otHours,
      late: sum.late + row.lateCount
    }),
    { hours: 0, ot: 0, late: 0 }
  );

  return (
    <>
      {error && <p className="form-error">{error}</p>}

      <section className="content-panel">
        <div className="section-header">
          <h2>Nhân sự theo phòng ban</h2>
          <span className="muted-text">{formatCompact(totalEmployees)} nhân viên đang làm đã có phòng ban</span>
        </div>
        {headcount.length ? (
          <div className="viz-root">
            <HorizontalBarChart
              data={headcount.map((row) => ({ key: row.departmentId, label: row.departmentName, value: row.employeeCount }))}
              color="var(--series-1)"
              unit=" người"
              ariaLabel="Số nhân viên đang làm theo phòng ban"
            />
          </div>
        ) : (
          <p className="muted-text">Chưa có phòng ban nào.</p>
        )}
      </section>

      <section className="content-panel">
        <div className="section-header">
          <h2>Giờ công theo nhân viên</h2>
        </div>
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
          <div className="toolbar-actions">
            <button type="button" className="ghost-button" onClick={() => handleExport('xlsx')} disabled={!workHours.length}>
              <Download size={17} aria-hidden="true" />
              Xuất Excel
            </button>
            <button type="button" className="ghost-button" onClick={() => handleExport('pdf')} disabled={!workHours.length}>
              <FileText size={17} aria-hidden="true" />
              Xuất PDF
            </button>
          </div>
        </div>

        <div className="stat-tiles">
          <StatTile label="Nhân viên có chấm công" value={formatCompact(workHours.length)} />
          <StatTile label="Tổng giờ công" value={`${formatCompact(totals.hours)} giờ`} tone="success" />
          <StatTile label="Giờ tăng ca (OT)" value={`${formatCompact(totals.ot)} giờ`} tone="info" />
          <StatTile label="Lượt đi trễ" value={formatCompact(totals.late)} tone="warning" />
        </div>

        <div className="table-wrap">
          <table className="responsive-table summary-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Ngày công</th>
                <th>Đi trễ</th>
                <th>Về sớm</th>
                <th>Vắng</th>
                <th>Tổng giờ</th>
                <th>Giờ OT</th>
              </tr>
            </thead>
            <tbody>
              {loading && !workHours.length ? (
                <tr>
                  <td colSpan="7">Đang tải dữ liệu</td>
                </tr>
              ) : workHours.length ? (
                workHours.slice((page - 1) * ROWS_PAGE_SIZE, page * ROWS_PAGE_SIZE).map((row) => (
                  <tr key={row.employeeId}>
                    <td className="cell-main">
                      <EmployeeLink id={row.employeeId}>{row.employeeName}</EmployeeLink>
                      <span>{row.employeeCode}</span>
                    </td>
                    <td data-label="Ngày công">{row.workDays}</td>
                    <td data-label="Đi trễ" className={row.lateCount ? 'warning-cell' : ''}>
                      {row.lateCount}
                    </td>
                    <td data-label="Về sớm" className={row.earlyLeaveCount ? 'warning-cell' : ''}>
                      {row.earlyLeaveCount ?? 0}
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
                  <td colSpan="7">Chưa có dữ liệu chấm công trong khoảng này</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={ROWS_PAGE_SIZE} total={workHours.length} unit="nhân viên" onChange={setPage} />
      </section>
    </>
  );
}
