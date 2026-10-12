import { CalendarClock, Clock, Plane, Repeat, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import {
  addDays,
  attendanceStatusLabels,
  formatCompact,
  formatDayMonth,
  statusLabels,
  todayInputValue
} from '../format.js';
import { ChartLegend, HorizontalBarChart, StackedColumnChart } from './charts.jsx';

// Màu chuỗi số liệu: 4 ô đầu của bảng màu phân loại, thứ tự cố định (đã chạy bộ kiểm tra màu:
// đạt CVD/độ sáng; vàng và xanh ngọc dưới 3:1 trên nền trắng nên luôn kèm chú thích + bảng số).
const ATTENDANCE_SERIES = [
  { key: 'PRESENT', label: attendanceStatusLabels.PRESENT, color: 'var(--series-1)' },
  { key: 'LATE', label: attendanceStatusLabels.LATE, color: 'var(--series-2)' },
  { key: 'ON_LEAVE', label: attendanceStatusLabels.ON_LEAVE, color: 'var(--series-3)' },
  { key: 'ABSENT', label: attendanceStatusLabels.ABSENT, color: 'var(--series-4)' }
];

const EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'];

function StatCard({ icon, label, value, note, href }) {
  const Icon = icon;
  const content = (
    <>
      <span className="stat-card-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className="stat-card-body">
        <span className="stat-card-label">{label}</span>
        <strong className="stat-card-value">{value}</strong>
        {note && <span className="stat-card-note">{note}</span>}
      </span>
    </>
  );

  return href ? (
    <a className="stat-card" href={href}>
      {content}
    </a>
  ) : (
    <div className="stat-card">{content}</div>
  );
}

// Trang Tổng quan cho HR (WBS 6.3.3, 6.3.4): số liệu nhanh trong ngày và biểu đồ.
export default function DashboardPanel() {
  const today = todayInputValue();
  const weekStart = addDays(today, -6);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async () => {
    setError('');

    try {
      // Số liệu đã tổng hợp sẵn ở backend (GET /reports/dashboard): trước đây tải cả danh sách chấm công
      // và giờ công từng người để tự đếm, 5.000 nhân viên là ~12 MB mỗi lần mở trang (WBS 6.4.5).
      const [summary, departments] = await Promise.all([
        api.reportDashboard({ date: today }),
        api.reportByDepartment()
      ]);
      const stats = summary.data;

      const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
      const byDay = days.map((day) => {
        const values = {};

        for (const row of stats.attendanceDaily) {
          if (row.workDate === day) {
            values[row.status] = row.count;
          }
        }

        return { date: day, label: formatDayMonth(day), values };
      });

      setData({
        byDay,
        todayValues: byDay[6].values,
        departments: departments.data
          .map((row) => ({ key: row.departmentId, label: row.departmentName, value: row.employeeCount }))
          .sort((a, b) => b.value - a.value),
        employeeStatus: EMPLOYEE_STATUSES.map((status) => ({
          key: status,
          label: statusLabels[status],
          value: stats.employeeStatus[status]
        })),
        pendingLeaves: stats.pendingLeaves,
        pendingChanges: stats.pendingShiftChanges,
        monthHours: stats.month.totalHours,
        monthOt: stats.month.otHours
      });
    } catch (err) {
      setError(err.message);
    }
  }, [today, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (!data) {
    return <section className="content-panel">Đang tải dữ liệu</section>;
  }

  const activeCount = data.employeeStatus[0].value;
  const presentToday = (data.todayValues.PRESENT || 0) + (data.todayValues.LATE || 0);

  return (
    <div className="viz-root dashboard">
      <div className="stat-cards">
        <StatCard icon={Users} label="Nhân viên đang làm" value={formatCompact(activeCount)} href="#employees" />
        <StatCard
          icon={Clock}
          label="Đi làm hôm nay"
          value={formatCompact(presentToday)}
          note={data.todayValues.LATE ? `${data.todayValues.LATE} người đi trễ` : 'Không ai đi trễ'}
          href="#attendance"
        />
        <StatCard icon={Plane} label="Đơn nghỉ chờ duyệt" value={data.pendingLeaves} href="#leave" />
        <StatCard icon={Repeat} label="Yêu cầu đổi ca chờ duyệt" value={data.pendingChanges} href="#shifts" />
        <StatCard
          icon={CalendarClock}
          label="Giờ công tháng này"
          value={`${formatCompact(data.monthHours)} giờ`}
          note={`Trong đó ${formatCompact(data.monthOt)} giờ tăng ca`}
          href="#reports"
        />
      </div>

      <section className="content-panel chart-card">
        <div className="section-header">
          <div>
            <h2>Chấm công 7 ngày gần nhất</h2>
            <p className="muted-text">Số lượt chấm công theo trạng thái, từ {formatDayMonth(weekStart)} đến hôm nay</p>
          </div>
          <button type="button" className="ghost-button" onClick={() => setShowTable(!showTable)}>
            {showTable ? 'Xem biểu đồ' : 'Xem dạng bảng'}
          </button>
        </div>
        <ChartLegend series={ATTENDANCE_SERIES} />
        {showTable ? (
          <div className="table-wrap">
            <table className="chart-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  {ATTENDANCE_SERIES.map((s) => (
                    <th key={s.key}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.byDay.map((day) => (
                  <tr key={day.date}>
                    <td>{day.label}</td>
                    {ATTENDANCE_SERIES.map((s) => (
                      <td key={s.key}>{day.values[s.key] || 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StackedColumnChart
            data={data.byDay}
            series={ATTENDANCE_SERIES}
            unit=" lượt"
            ariaLabel="Biểu đồ cột chồng số lượt chấm công 7 ngày gần nhất theo trạng thái"
          />
        )}
      </section>

      <div className="chart-grid-2">
        <section className="content-panel chart-card">
          <h2>Nhân sự theo phòng ban</h2>
          <p className="muted-text">Nhân viên đang làm việc</p>
          <HorizontalBarChart
            data={data.departments}
            color="var(--series-1)"
            unit=" người"
            ariaLabel="Số nhân viên đang làm theo phòng ban"
          />
        </section>
        <section className="content-panel chart-card">
          <h2>Tình trạng nhân sự</h2>
          <p className="muted-text">Toàn bộ hồ sơ nhân viên</p>
          <HorizontalBarChart
            data={data.employeeStatus}
            color="var(--series-1)"
            unit=" người"
            ariaLabel="Số hồ sơ nhân viên theo tình trạng"
          />
        </section>
      </div>
    </div>
  );
}
