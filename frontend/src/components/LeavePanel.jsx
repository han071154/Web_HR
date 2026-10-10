import { Check, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import {
  approvalStatusClass,
  approvalStatusLabels,
  countDays,
  formatDate,
  formatDateTime,
  leaveTypeLabels
} from '../format.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import { useLatestRequest } from '../useLatestRequest.js';

// Duyệt đơn nghỉ phép (HR-023). Duyệt xong thì các ngày nghỉ được ghi "Nghỉ phép" trong bảng chấm công.
export default function LeavePanel({ showToast }) {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const startRequest = useLatestRequest();

  const loadRequests = useCallback(async () => {
    const isLatest = startRequest();

    setLoading(true);
    setError('');

    try {
      const response = await api.leaveRequests({ status: statusFilter });
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
      await api.reviewLeaveRequest(request.id, status);
      showToast(
        'success',
        status === 'APPROVED'
          ? `Đã duyệt đơn nghỉ của ${request.employeeName}.`
          : `Đã từ chối đơn nghỉ của ${request.employeeName}.`
      );
      await loadRequests();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusyId(null);
      setRejecting(null);
    }
  }

  const cancelReject = useCallback(() => {
    if (!busyId) {
      setRejecting(null);
    }
  }, [busyId]);

  return (
    <section className="content-panel">
      <div className="section-header">
        <h2>Đơn nghỉ phép</h2>
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
        <table className="responsive-table leave-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Loại nghỉ</th>
              <th>Thời gian</th>
              <th>Số ngày</th>
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
                    <span>{request.departmentName || request.employeeCode}</span>
                  </td>
                  <td data-label="Loại nghỉ">{leaveTypeLabels[request.leaveType] || request.leaveType}</td>
                  <td data-label="Thời gian">
                    {request.startDate === request.endDate
                      ? formatDate(request.startDate)
                      : `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`}
                  </td>
                  <td data-label="Số ngày">{countDays(request.startDate, request.endDate)}</td>
                  <td data-label="Lý do" className={request.reason ? '' : 'muted-cell'}>
                    {request.reason || 'Không ghi lý do'}
                  </td>
                  <td data-label="Gửi lúc">{formatDateTime(request.createdAt)}</td>
                  <td data-label="Trạng thái">
                    <span
                      className={`status-pill ${approvalStatusClass[request.status]}`}
                      title={request.approvedByName ? `${request.approvedByName} · ${formatDateTime(request.approvedAt)}` : undefined}
                    >
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
                          onClick={() => setRejecting(request)}
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
                <td colSpan="8">{statusFilter === 'PENDING' ? 'Không có đơn nào đang chờ duyệt' : 'Chưa có đơn nghỉ phép'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <ConfirmDialog
          title="Từ chối đơn nghỉ?"
          message={`Đơn ${leaveTypeLabels[rejecting.leaveType]?.toLowerCase()} của ${rejecting.employeeName} sẽ bị từ chối. Đã duyệt hoặc từ chối thì không đổi lại được.`}
          confirmLabel="Từ chối đơn"
          busy={busyId === rejecting.id}
          onConfirm={() => review(rejecting, 'REJECTED')}
          onCancel={cancelReject}
        />
      )}
    </section>
  );
}
