import { Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { api } from '../api.js';
import { formatHours, formatTime, shiftHours } from '../format.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const emptyShift = { code: '', name: '', startTime: '08:00', endTime: '17:00', breakMinutes: 60, isActive: true };

function ShiftForm({ shift, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    code: shift.code,
    name: shift.name,
    startTime: formatTime(shift.startTime),
    endTime: formatTime(shift.endTime),
    breakMinutes: shift.breakMinutes ?? 0,
    isActive: shift.isActive ?? true
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.endTime <= form.startTime) {
      setError('Giờ kết thúc phải sau giờ bắt đầu (ca qua đêm chưa được hỗ trợ).');
      return;
    }

    setError('');
    setSaving(true);

    try {
      await onSubmit({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        startTime: form.startTime,
        endTime: form.endTime,
        breakMinutes: Number(form.breakMinutes) || 0,
        isActive: form.isActive
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="inline-form boxed" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Mã ca
          <input
            value={form.code}
            onChange={(event) => updateField('code', event.target.value)}
            placeholder="VD: SHIFT-SANG"
            minLength={2}
            maxLength={40}
            required
            autoFocus
          />
        </label>
        <label>
          Tên ca
          <input
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="VD: Ca sáng"
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        <label>
          Giờ bắt đầu
          <input type="time" value={form.startTime} onChange={(event) => updateField('startTime', event.target.value)} required />
        </label>
        <label>
          Giờ kết thúc
          <input type="time" value={form.endTime} onChange={(event) => updateField('endTime', event.target.value)} required />
        </label>
        <label>
          Nghỉ giữa ca (phút)
          <input
            type="number"
            min="0"
            max="480"
            step="5"
            value={form.breakMinutes}
            onChange={(event) => updateField('breakMinutes', event.target.value)}
          />
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} />
          Đang sử dụng
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
          Hủy
        </button>
        <button type="submit" className="primary-button" disabled={saving}>
          <Clock size={18} aria-hidden="true" />
          {shift.id ? 'Cập nhật' : 'Thêm ca'}
        </button>
      </div>
    </form>
  );
}

// Danh mục loại ca (HR-029): tên ca, khung giờ, giờ nghỉ — làm cơ sở xếp lịch.
export default function WorkShiftsList({ shifts, loading, onChanged, showToast }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  async function saveShift(values) {
    setError('');

    try {
      if (editing.id) {
        await api.updateWorkShift(editing.id, values);
        showToast('success', `Đã cập nhật ${values.name}.`);
      } else {
        await api.createWorkShift(values);
        showToast('success', `Đã thêm ${values.name}.`);
      }

      setEditing(null);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete() {
    const shift = deleting;
    setDeletingBusy(true);

    try {
      await api.deleteWorkShift(shift.id);
      showToast('success', `Đã xóa ${shift.name}.`);
      await onChanged();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setDeletingBusy(false);
      setDeleting(null);
    }
  }

  const cancelDelete = useCallback(() => {
    if (!deletingBusy) {
      setDeleting(null);
    }
  }, [deletingBusy]);

  return (
    <section className="content-panel">
      <div className="section-header">
        <h2>Danh mục ca làm việc</h2>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setError('');
            setEditing(emptyShift);
          }}
        >
          <Plus size={18} aria-hidden="true" />
          Thêm ca
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {editing && (
        <ShiftForm
          key={editing.id || 'new'}
          shift={editing}
          onSubmit={saveShift}
          onCancel={() => {
            setEditing(null);
            setError('');
          }}
        />
      )}

      <div className="table-wrap">
        <table className="responsive-table shifts-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên ca</th>
              <th>Khung giờ</th>
              <th>Nghỉ giữa ca</th>
              <th>Giờ công</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && !shifts.length ? (
              <tr>
                <td colSpan="7">Đang tải dữ liệu</td>
              </tr>
            ) : shifts.length ? (
              shifts.map((shift) => (
                <tr key={shift.id}>
                  <td data-label="Mã">
                    <code className="code-tag">{shift.code}</code>
                  </td>
                  <td className="cell-main">
                    <strong>{shift.name}</strong>
                  </td>
                  <td data-label="Khung giờ">
                    {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                  </td>
                  <td data-label="Nghỉ giữa ca">{shift.breakMinutes ? `${shift.breakMinutes} phút` : 'Không'}</td>
                  <td data-label="Giờ công">{formatHours(shiftHours(shift))} giờ</td>
                  <td data-label="Trạng thái">
                    <span className={`status-pill ${shift.isActive ? 'status-active' : 'status-inactive'}`}>
                      {shift.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-button success"
                        onClick={() => {
                          setError('');
                          setEditing(shift);
                        }}
                        title="Sửa"
                        aria-label="Sửa"
                      >
                        <Pencil size={17} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => setDeleting(shift)}
                        title="Xóa"
                        aria-label="Xóa"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7">Chưa có ca làm việc nào</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Xóa ca làm việc?"
          message={`Ca "${deleting.name}" (${deleting.code}) sẽ bị xóa. Nếu ca đã được xếp lịch thì không xóa được — hãy sửa và bỏ chọn "Đang sử dụng".`}
          confirmLabel="Xóa ca"
          busy={deletingBusy}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </section>
  );
}
