import { AlertTriangle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import {
  CONTRACT_DELETE_ROLES,
  CONTRACT_EDIT_ROLES,
  contractDeadline,
  contractStatusClass,
  EXPIRING_SOON_DAYS
} from '../contracts.js';
import {
  contractStatusLabels,
  contractTypeLabels,
  formatDate,
  formatMoney,
  normalizeText
} from '../format.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import ContractForm from './ContractForm.jsx';

// Lọc thêm "Cần xử lý": hợp đồng hiệu lực đã quá hạn hoặc sắp hết hạn.
const ATTENTION_FILTER = 'ATTENTION';

// Màn hình quản lý hợp đồng lao động của toàn công ty.
export default function ContractsPanel({ user, employees, showToast }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const canEdit = CONTRACT_EDIT_ROLES.includes(user?.role);
  const canDelete = CONTRACT_DELETE_ROLES.includes(user?.role);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.contracts();
      setContracts(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const attentionCount = useMemo(() => contracts.filter((contract) => contractDeadline(contract)).length, [contracts]);

  const filtered = useMemo(() => {
    const text = normalizeText(keyword.trim());

    return contracts.filter((contract) => {
      const matchesText =
        !text ||
        normalizeText(`${contract.contractNumber} ${contract.employeeCode} ${contract.employeeName}`).includes(text);
      const matchesStatus =
        !statusFilter ||
        (statusFilter === ATTENTION_FILTER ? Boolean(contractDeadline(contract)) : contract.status === statusFilter);

      return matchesText && matchesStatus;
    });
  }, [contracts, keyword, statusFilter]);

  async function saveContract(values) {
    setFormError('');

    try {
      if (editing?.id) {
        await api.updateContract(editing.id, values);
        showToast('success', `Đã cập nhật hợp đồng ${values.contractNumber}.`);
      } else {
        await api.createContract(values);
        showToast('success', `Đã thêm hợp đồng ${values.contractNumber}.`);
      }

      setEditing(null);
      await loadContracts();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function confirmDelete() {
    const contract = deleting;
    setDeletingBusy(true);

    try {
      await api.deleteContract(contract.id);
      showToast('success', `Đã xóa hợp đồng ${contract.contractNumber}.`);
      await loadContracts();
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

  function openForm(contract) {
    setFormError('');
    setEditing(contract);
  }

  return (
    <section className="content-panel">
      <div className="section-header">
        <h2>Danh sách hợp đồng</h2>
        {canEdit && (
          <button type="button" className="primary-button" onClick={() => openForm({})}>
            <Plus size={18} aria-hidden="true" />
            Thêm hợp đồng
          </button>
        )}
      </div>

      {attentionCount > 0 && (
        <button type="button" className="attention-banner" onClick={() => setStatusFilter(ATTENTION_FILTER)}>
          <AlertTriangle size={18} aria-hidden="true" />
          {attentionCount} hợp đồng đang hiệu lực đã quá hạn hoặc hết hạn trong {EXPIRING_SOON_DAYS} ngày tới. Bấm để
          xem.
        </button>
      )}

      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo số hợp đồng, mã NV, họ tên"
          />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc theo trạng thái">
          <option value="">Tất cả trạng thái</option>
          <option value={ATTENTION_FILTER}>Cần xử lý ({attentionCount})</option>
          {Object.entries(contractStatusLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}

      {editing && (
        <ContractForm
          key={editing.id || 'new'}
          contract={editing.id ? editing : null}
          employees={employees}
          error={formError}
          onSubmit={saveContract}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="table-wrap">
        <table className="responsive-table contracts-list-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Số hợp đồng</th>
              <th>Loại</th>
              <th>Thời hạn</th>
              <th>Mức lương</th>
              <th>Trạng thái</th>
              {(canEdit || canDelete) && <th></th>}
            </tr>
          </thead>
          <tbody>
            {loading && !contracts.length ? (
              <tr>
                <td colSpan="7">Đang tải dữ liệu</td>
              </tr>
            ) : filtered.length ? (
              filtered.map((contract) => {
                const deadline = contractDeadline(contract);

                return (
                  <tr key={contract.id}>
                    <td className="cell-main">
                      <strong>{contract.employeeName}</strong>
                      <span>{contract.employeeCode}</span>
                    </td>
                    <td data-label="Số hợp đồng">
                      <code className="code-tag">{contract.contractNumber}</code>
                    </td>
                    <td data-label="Loại">{contractTypeLabels[contract.contractType] || contract.contractType}</td>
                    <td data-label="Thời hạn">
                      {formatDate(contract.startDate)} – {formatDate(contract.endDate) || 'Không thời hạn'}
                      {deadline && <span className={`deadline-note ${deadline.level}`}>{deadline.text}</span>}
                    </td>
                    <td data-label="Mức lương">{formatMoney(contract.salary)}</td>
                    <td data-label="Trạng thái">
                      <span className={`status-pill ${contractStatusClass[contract.status] || 'status-inactive'}`}>
                        {contractStatusLabels[contract.status] || contract.status}
                      </span>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="cell-actions">
                        <div className="row-actions">
                          {canEdit && (
                            <button
                              type="button"
                              className="icon-button success"
                              onClick={() => openForm(contract)}
                              title="Sửa"
                              aria-label="Sửa"
                            >
                              <Pencil size={17} aria-hidden="true" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() => setDeleting(contract)}
                              title="Xóa"
                              aria-label="Xóa"
                            >
                              <Trash2 size={17} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7">{contracts.length ? 'Không có hợp đồng phù hợp' : 'Chưa có hợp đồng nào'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Xóa hợp đồng?"
          message={`Hợp đồng ${deleting.contractNumber} của ${deleting.employeeName} sẽ bị xóa vĩnh viễn. Nếu hợp đồng đã kết thúc, nên chuyển sang "Hết hạn" hoặc "Đã chấm dứt" để giữ lịch sử.`}
          confirmLabel="Xóa hợp đồng"
          busy={deletingBusy}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </section>
  );
}
