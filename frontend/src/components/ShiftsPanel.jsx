import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import ScheduleBoard from './ScheduleBoard.jsx';
import ShiftRequestsList from './ShiftRequestsList.jsx';
import TabBar from './TabBar.jsx';
import WorkShiftsList from './WorkShiftsList.jsx';

// Mục Ca làm việc phía HR: lịch phân ca theo tuần, danh mục ca và yêu cầu đổi ca.
export default function ShiftsPanel({ departments, showToast }) {
  const [tab, setTab] = useState('schedule');
  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState('');

  const loadShifts = useCallback(async () => {
    setShiftsLoading(true);

    try {
      const response = await api.workShifts();
      setShifts(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setShiftsLoading(false);
    }
  }, []);

  const loadPendingCount = useCallback(async () => {
    try {
      const response = await api.shiftChangeRequests({ status: 'PENDING' });
      setPendingCount(response.data.length);
    } catch {
      // Chỉ là số đếm trên tab, lỗi thật sẽ hiện khi mở tab yêu cầu.
    }
  }, []);

  useEffect(() => {
    loadShifts();
    loadPendingCount();
  }, [loadShifts, loadPendingCount]);

  return (
    <>
      <div className="tab-row">
        <TabBar
          label="Ca làm việc"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'schedule', label: 'Lịch phân ca' },
            { id: 'shifts', label: 'Danh mục ca', count: shifts.length },
            { id: 'requests', label: 'Yêu cầu đổi ca', count: pendingCount }
          ]}
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      {tab === 'schedule' ? (
        <ScheduleBoard departments={departments} shifts={shifts} showToast={showToast} />
      ) : tab === 'shifts' ? (
        <WorkShiftsList shifts={shifts} loading={shiftsLoading} onChanged={loadShifts} showToast={showToast} />
      ) : (
        <ShiftRequestsList showToast={showToast} onReviewed={loadPendingCount} />
      )}
    </>
  );
}
