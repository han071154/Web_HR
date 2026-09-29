import { BriefcaseBusiness, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import ConfirmDialog from './ConfirmDialog.jsx';

// Chỉ các vai trò này được thêm/sửa/xóa chức vụ (khớp với backend).
const MANAGE_ROLES = ['ADMIN', 'HR_MANAGER'];

const emptyPosition = { code: '', name: '', departmentId: '', description: '', isActive: true };

function PositionForm({ position, departments, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    code: position?.code || '',
    name: position?.name || '',
    departmentId: position?.departmentId || '',
    description: position?.description || '',
    isActive: position?.isActive ?? true
  }));
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSubmit({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        departmentId: form.departmentId || null,
        description: form.description.trim() || null,
        isActive: form.isActive
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="employee-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Mã chức vụ
          <input
            value={form.code}
            onChange={(event) => updateField('code', event.target.value)}
            placeholder="VD: BE-DEV"
            minLength={2}
            maxLength={40}
            required
            autoFocus
          />
        </label>
        <label>
          Tên chức vụ
          <input
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        <label>
          Phòng ban
          <select value={form.departmentId} onChange={(event) => updateField('departmentId', event.target.value)}>
            <option value="">Dùng chung (không thuộc phòng nào)</option>
            {departments.map((department) => (
              <option value={department.id} key={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => updateField('isActive', event.target.checked)}
          />
          Đang sử dụng
        </label>
      </div>
      <label>
        Mô tả
        <textarea
          value={form.description}
          onChange={(event) => updateField('description', event.target.value)}
          rows="3"
          maxLength={2000}
        />
      </label>
      <div className="form-actions">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={saving}>
          Hủy
        </button>
        <button type="submit" className="primary-button" disabled={saving}>
          <BriefcaseBusiness size={18} aria-hidden="true" />
          {position?.id ? 'Cập nhật' : 'Thêm chức vụ'}
        </button>
      </div>
    </form>
  );
}

// Màn hình quản lý chức vụ (WBS 4.2.2).
export default function PositionsPanel({ user, departments, showToast }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const canManage = MANAGE_ROLES.includes(user?.role);

  const loadPositions = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.positions();
      setPositions(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase();

    return positions.filter((position) => {
      if (text && !`${position.code} ${position.name} ${position.description || ''}`.toLowerCase().includes(text)) {
        return false;
      }

      if (departmentFilter === 'none' && position.departmentId) {
        return false;
      }

      if (departmentFilter && departmentFilter !== 'none' && position.departmentId !== departmentFilter) {
        return false;
      }

      if (activeFilter && String(position.isActive) !== activeFilter) {
        return false;
      }

      return true;
    });
  }, [positions, keyword, departmentFilter, activeFilter]);

  async function savePosition(values) {
    setError('');

    try {
      if (editing?.id) {
        await api.updatePosition(editing.id, values);
        showToast('success', `Đã cập nhật chức vụ ${values.name}.`);
      } else {
        await api.createPosition(values);
        showToast('success', `Đã thêm chức vụ ${values.name}.`);
      }

      setEditing(null);
      await loadPositions();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete() {
    const position = deleting;
    setDeletingBusy(true);

    try {
      await api.deletePosition(position.id);
      showToast('success', `Đã xóa chức vụ ${position.name}.`);
      await loadPositions();
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

  const columnCount = canManage ? 6 : 5;

  return (
    <section className="content-panel" id="positions">
      <div className="section-header">
        <h2>Danh sách chức vụ</h2>
        {canManage && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setError('');
              setEditing(emptyPosition);
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
            placeholder="Tìm theo mã, tên, mô tả"
          />
        </label>
        <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
          <option value="">Tất cả phòng ban</option>
          <option value="none">Dùng chung</option>
          {departments.map((department) => (
            <option value={department.id} key={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đang sử dụng</option>
          <option value="false">Ngừng sử dụng</option>
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}

      {editing && (
        <PositionForm
          key={editing.id || 'new'}
          position={editing}
          departments={departments}
          onSubmit={savePosition}
          onCancel={() => {
            setEditing(null);
            setError('');
          }}
        />
      )}

      <div className="table-wrap">
        <table className="positions-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên chức vụ</th>
              <th>Phòng ban</th>
              <th>Mô tả</th>
              <th>Trạng thái</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columnCount}>Đang tải dữ liệu</td>
              </tr>
            ) : filtered.length ? (
              filtered.map((position) => (
                <tr key={position.id}>
                  <td>
                    <code className="code-tag">{position.code}</code>
                  </td>
                  <td>
                    <strong>{position.name}</strong>
                  </td>
                  <td className={position.departmentName ? '' : 'muted-cell'}>
                    {position.departmentName || 'Dùng chung'}
                  </td>
                  <td className={position.description ? '' : 'muted-cell'}>
                    {position.description || 'Chưa có mô tả'}
                  </td>
                  <td>
                    <span className={`status-pill ${position.isActive ? 'status-active' : 'status-inactive'}`}>
                      {position.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-button success"
                          onClick={() => {
                            setError('');
                            setEditing(position);
                          }}
                          title="Sửa"
                        >
                          <Pencil size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => setDeleting(position)}
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
                <td colSpan={columnCount}>
                  {positions.length ? 'Không có chức vụ phù hợp' : 'Chưa có chức vụ nào'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Xóa chức vụ?"
          message={`Chức vụ "${deleting.name}" (${deleting.code}) sẽ bị xóa vĩnh viễn. Nếu chỉ tạm ngừng dùng, hãy sửa và bỏ chọn "Đang sử dụng".`}
          confirmLabel="Xóa chức vụ"
          busy={deletingBusy}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </section>
  );
}
