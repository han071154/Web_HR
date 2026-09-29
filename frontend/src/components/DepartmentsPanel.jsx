import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { api } from '../api.js';
import ConfirmDialog from './ConfirmDialog.jsx';

// Chỉ các vai trò này được thêm/sửa/xóa phòng ban (khớp với backend).
const MANAGE_ROLES = ['ADMIN', 'HR_MANAGER'];

const emptyDepartment = { name: '', description: '' };

function DepartmentForm({ department, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: department?.name || '',
    description: department?.description || ''
  }));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim() || null
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="employee-form" onSubmit={handleSubmit}>
      <label>
        Tên phòng ban
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          minLength={2}
          maxLength={120}
          required
          autoFocus
        />
      </label>
      <label>
        Mô tả
        <textarea
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          rows="3"
          maxLength={2000}
        />
      </label>
      <div className="form-actions">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
          Hủy
        </button>
        <button type="submit" className="primary-button" disabled={saving}>
          <Building2 size={18} aria-hidden="true" />
          {department?.id ? 'Cập nhật' : 'Thêm phòng ban'}
        </button>
      </div>
    </form>
  );
}

// Màn hình quản lý phòng ban (WBS 4.2.1).
export default function DepartmentsPanel({ user, departments, loading, onChanged, showToast }) {
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const canManage = MANAGE_ROLES.includes(user?.role);

  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase();

    if (!text) {
      return departments;
    }

    return departments.filter((department) =>
      `${department.name} ${department.description || ''}`.toLowerCase().includes(text)
    );
  }, [departments, keyword]);

  async function saveDepartment(values) {
    setError('');

    try {
      if (editing?.id) {
        await api.updateDepartment(editing.id, values);
        showToast('success', `Đã cập nhật phòng ban ${values.name}.`);
      } else {
        await api.createDepartment(values);
        showToast('success', `Đã thêm phòng ban ${values.name}.`);
      }

      setEditing(null);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete() {
    const department = deleting;
    setDeletingBusy(true);

    try {
      await api.deleteDepartment(department.id);
      showToast('success', `Đã xóa phòng ban ${department.name}.`);
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

  function deleteMessage(department) {
    const base = `Phòng ban "${department.name}" sẽ bị xóa vĩnh viễn.`;

    return department.employeeCount > 0
      ? `${base} ${department.employeeCount} nhân viên đang thuộc phòng này sẽ chuyển thành "Chưa phân phòng".`
      : base;
  }

  return (
    <section className="content-panel" id="departments">
      <div className="section-header">
        <h2>Danh sách phòng ban</h2>
        {canManage && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setError('');
              setEditing(emptyDepartment);
            }}
          >
            <Plus size={18} aria-hidden="true" />
            Thêm
          </button>
        )}
      </div>

      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo tên, mô tả"
          />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}

      {editing && (
        <DepartmentForm
          key={editing.id || 'new'}
          department={editing}
          onSubmit={saveDepartment}
          onCancel={() => {
            setEditing(null);
            setError('');
          }}
        />
      )}

      <div className="table-wrap">
        <table className="compact-table responsive-table">
          <thead>
            <tr>
              <th>Tên phòng ban</th>
              <th>Mô tả</th>
              <th>Số nhân viên</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4">Đang tải dữ liệu</td>
              </tr>
            ) : filtered.length ? (
              filtered.map((department) => (
                <tr key={department.id}>
                  <td className="cell-main">
                    <strong>{department.name}</strong>
                  </td>
                  <td data-label="Mô tả" className={department.description ? '' : 'muted-cell'}>
                    {department.description || 'Chưa có mô tả'}
                  </td>
                  <td data-label="Số nhân viên">
                    <span className="count-pill">{department.employeeCount ?? 0}</span>
                  </td>
                  {canManage && (
                    <td className="cell-actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-button success"
                          onClick={() => {
                            setError('');
                            setEditing(department);
                          }}
                          title="Sửa"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => setDeleting(department)}
                          title="Xóa"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4">{keyword ? 'Không có phòng ban phù hợp' : 'Chưa có phòng ban nào'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Xóa phòng ban?"
          message={deleteMessage(deleting)}
          confirmLabel="Xóa phòng ban"
          busy={deletingBusy}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </section>
  );
}
