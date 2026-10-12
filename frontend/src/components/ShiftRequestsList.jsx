import { Check, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { approvalStatusClass, approvalStatusLabels, formatDate, formatDateTime } from '../format.js';
import { useLatestRequest } from '../useLatestRequest.js';

// Yêu cầu đổi ca của nhân viên (HR-032): HR duyệt thì lịch tự đổi sang ca mới.
export default function ShiftRequestsList({ showToast, onReviewed }) {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const startRequest = useLatestRequest();

  const loadRequests = useCallback(async () => {
    const isLatest = startRequest();

    setLoading(true);
    setError('');

    try {
      const response = await api.shiftChangeRequests({ status: statusFilter });
      if (!isLatest()) {
        return;
      }

      setRequests(response.data);
    } catch (err) {
      if (isLatest()) {
        setError(err.message);
      }
    } finally {
      if (isLatest()) {
        setLoading(false);
      }
    }
  }, [startRequest, statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function review(request, status) {
    setBusyId(request.id);

    try {
      await api.reviewShiftChangeRequest(request.id, status);
      showToast(
        'success',
        status === 'APPROVED'
          ? `Đã duyệt yêu cầu đổi ca của ${request.employeeName}.`
          : `Đã từ chối yêu cầu đổi ca của ${request.employeeName}.`
      );
      await loadRequests();
      onReviewed?.();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="content-panel">
      <div className="section-header">
        <h2>Yêu cầu đổi ca</h2>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc theo trạng thái">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(approvalStatusLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="responsive-table requests-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Ngày làm</th>
              <th>Ca hiện tại</th>
              <th>Muốn đổi sang</th>
              <th>Lý do</th>
              <th>Gửi lúc</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && !requests.length ? (
              <tr>
                <td colSpan="8">Đang tải dữ liệu</td>
              </tr>
            ) : requests.length ? (
              requests.map((request) => (
                <tr key={request.id}>
                  <td className="cell-main">
                    <strong>{request.employeeName}</strong>
                  </td>
                  <td data-label="Ngày làm">{formatDate(request.workDate)}</td>
                  <td data-label="Ca hiện tại">{request.currentShiftName}</td>
                  <td data-label="Muốn đổi sang" className={request.requestedShiftName ? '' : 'muted-cell'}>
                    {request.requestedShiftName || 'Không chọn ca cụ thể'}
                  </td>
                  <td data-label="Lý do" className={request.reason ? '' : 'muted-cell'}>
                    {request.reason || 'Không ghi lý do'}
                  </td>
                  <td data-label="Gửi lúc">{formatDateTime(request.createdAt)}</td>
                  <td data-label="Trạng thái">
                    <span className={`status-pill ${approvalStatusClass[request.status]}`}>
                      {approvalStatusLabels[request.status] || request.status}
                    </span>
                  </td>
                  <td className="cell-actions">
                    {request.status === 'PENDING' && (
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-button success"
                          onClick={() => review(request, 'APPROVED')}
                          disabled={busyId === request.id}
                          title="Duyệt"
                          aria-label="Duyệt"
                        >
                          <Check size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => review(request, 'REJECTED')}
                          disabled={busyId === request.id}
                          title="Từ chối"
                          aria-label="Từ chối"
                        >
                          <X size={17} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8">{statusFilter === 'PENDING' ? 'Không có yêu cầu nào đang chờ duyệt' : 'Chưa có yêu cầu đổi ca'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
