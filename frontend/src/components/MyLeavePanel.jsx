import { Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import {
  approvalStatusClass,
  approvalStatusLabels,
  countDays,
  formatDate,
  formatDateTime,
  leaveTypeLabels,
  todayInputValue
} from '../format.js';
import { isNotLinkedError } from '../messages.js';
import NotLinkedNotice from './NotLinkedNotice.jsx';

// Nhân viên gửi đơn nghỉ phép và theo dõi kết quả duyệt (HR-023).
export default function MyLeavePanel({ showToast }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notLinked, setNotLinked] = useState(false);
  const [form, setForm] = useState(() => ({
    leaveType: 'ANNUAL',
    startDate: todayInputValue(),
    endDate: todayInputValue(),
    reason: ''
  }));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.myLeaveRequests();
      setRequests(response.data);
      setError('');
    } catch (err) {
      if (isNotLinkedError(err)) {
        setNotLinked(true);
      }

      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };

      // Đổi ngày bắt đầu sang sau ngày kết thúc thì kéo ngày kết thúc theo, khỏi phải sửa 2 lần.
      if (field === 'startDate' && next.endDate < value) {
        next.endDate = value;
      }

      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.endDate < form.startDate) {
      setFormError('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      await api.createLeaveRequest({ ...form, reason: form.reason.trim() || null });
      showToast('success', 'Đã gửi đơn nghỉ phép. Vui lòng chờ phòng nhân sự duyệt.');
      setForm((current) => ({ ...current, reason: '' }));
      await loadRequests();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const days = form.startDate && form.endDate && form.endDate >= form.startDate ? countDays(form.startDate, form.endDate) : 0;

  if (notLinked) {
    return <NotLinkedNotice />;
  }

  return (
    <>
      <section className="content-panel">
        <div className="section-header">
          <h2>Gửi đơn nghỉ phép</h2>
        </div>
        <form className="inline-form leave-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Loại nghỉ
              <select value={form.leaveType} onChange={(event) => updateField('leaveType', event.target.value)}>
                {Object.entries(leaveTypeLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <span className="leave-days">{days ? `Tổng cộng ${days} ngày` : ''}</span>
            <label>
              Từ ngày
              <input type="date" value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} required />
            </label>
            <label>
              Đến ngày
              <input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={(event) => updateField('endDate', event.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Lý do
            <textarea
              value={form.reason}
              onChange={(event) => updateField('reason', event.target.value)}
              rows="3"
              maxLength={2000}
              placeholder="VD: Về quê có việc gia đình"
            />
          </label>
          {formError && <p className="form-error">{formError}</p>}
          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={saving || Boolean(error)}>
              <Send size={18} aria-hidden="true" />
              {saving ? 'Đang gửi' : 'Gửi đơn'}
            </button>
          </div>
        </form>
      </section>

      <section className="content-panel">
        <div className="section-header">
          <h2>Đơn của tôi</h2>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="table-wrap">
          <table className="responsive-table my-leave-table">
            <thead>
              <tr>
                <th>Loại nghỉ</th>
                <th>Thời gian</th>
                <th>Số ngày</th>
                <th>Lý do</th>
                <th>Gửi lúc</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loading && !requests.length ? (
                <tr>
                  <td colSpan="6">Đang tải dữ liệu</td>
                </tr>
              ) : requests.length ? (
                requests.map((request) => (
                  <tr key={request.id}>
                    <td className="cell-main">
                      <strong>{leaveTypeLabels[request.leaveType] || request.leaveType}</strong>
                    </td>
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
                      <span className={`status-pill ${approvalStatusClass[request.status]}`}>
                        {approvalStatusLabels[request.status] || request.status}
                      </span>
                      {request.approvedByName && <span className="muted-text block">bởi {request.approvedByName}</span>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">Bạn chưa gửi đơn nghỉ phép nào</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
