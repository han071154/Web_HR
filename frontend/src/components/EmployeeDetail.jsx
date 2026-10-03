import { Hash, Mail, Pencil, Phone, Plus, Trash2, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { contractDeadline, contractStatusClass } from '../contracts.js';
import {
  contractStatusLabels,
  contractTypeLabels,
  employmentTypeLabels,
  formatDate,
  formatMoney,
  genderLabels,
  statusLabels
} from '../format.js';
import Avatar from './Avatar.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import ContractForm from './ContractForm.jsx';
import HistoryTimeline from './HistoryTimeline.jsx';

const EMPTY = 'Chưa cập nhật';

function InfoGrid({ rows }) {
  return (
    <dl className="detail-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={value ? '' : 'muted'}>{value || EMPTY}</dd>
        </div>
      ))}
    </dl>
  );
}

// Trang chi tiết hồ sơ một nhân viên theo mockup M-03a.
export default function EmployeeDetail({
  employee,
  canDeactivate,
  canEditContracts,
  canDeleteContracts,
  onEdit,
  onDeactivate,
  showToast
}) {
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractsError, setContractsError] = useState('');
  // Tăng số này để tải lại danh sách hợp đồng sau khi thêm/sửa/xóa.
  const [contractsVersion, setContractsVersion] = useState(0);
  const [editingContract, setEditingContract] = useState(null);
  const [contractFormError, setContractFormError] = useState('');
  const [deletingContract, setDeletingContract] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const isWorking = employee.status === 'ACTIVE' || employee.status === 'ON_LEAVE';
  const showContractActions = canEditContracts || canDeleteContracts;

  useEffect(() => {
    let ignore = false;
    setContractsLoading(true);
    setContractsError('');

    api
      .contracts({ employeeId: employee.id })
      .then((response) => {
        if (!ignore) {
          setContracts(response.data);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setContractsError(err.message);
        }
      })
      .finally(() => {
        if (!ignore) {
          setContractsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [employee.id, contractsVersion]);

  // Lịch sử thay đổi: tải lại khi hồ sơ vừa được sửa (updatedAt đổi) hoặc hợp đồng thay đổi.
  useEffect(() => {
    let ignore = false;
    setHistoryLoading(true);
    setHistoryError('');

    api
      .employeeHistory(employee.id)
      .then((response) => {
        if (!ignore) {
          setHistory(response.data);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setHistoryError(err.message);
        }
      })
      .finally(() => {
        if (!ignore) {
          setHistoryLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [employee.id, employee.updatedAt, contractsVersion]);

  function openContractForm(contract) {
    setContractFormError('');
    setEditingContract(contract);
  }

  async function saveContract(values) {
    setContractFormError('');

    try {
      if (editingContract?.id) {
        await api.updateContract(editingContract.id, values);
        showToast('success', `Đã cập nhật hợp đồng ${values.contractNumber}.`);
      } else {
        await api.createContract(values);
        showToast('success', `Đã thêm hợp đồng ${values.contractNumber}.`);
      }

      setEditingContract(null);
      setContractsVersion((version) => version + 1);
    } catch (err) {
      setContractFormError(err.message);
    }
  }

  async function confirmDeleteContract() {
    const contract = deletingContract;
    setDeletingBusy(true);

    try {
      await api.deleteContract(contract.id);
      showToast('success', `Đã xóa hợp đồng ${contract.contractNumber}.`);
      setContractsVersion((version) => version + 1);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setDeletingBusy(false);
      setDeletingContract(null);
    }
  }

  const cancelDeleteContract = useCallback(() => {
    if (!deletingBusy) {
      setDeletingContract(null);
    }
  }, [deletingBusy]);

  const jobLine = [employee.position, employee.departmentName].filter(Boolean).join(' · ');

  return (
    <div className="detail-page">
      <div className="detail-top">
        <section className="content-panel profile-card">
          <Avatar name={employee.fullName} src={employee.avatarUrl} size="large" />
          <h2>{employee.fullName}</h2>
          {jobLine && <p className="profile-job">{jobLine}</p>}
          <span className={`status-pill status-${employee.status.toLowerCase()}`}>
            {statusLabels[employee.status] || employee.status}
          </span>

          <ul className="profile-facts">
            <li>
              <Hash size={16} aria-hidden="true" />
              <span>Mã nhân viên</span>
              <strong>{employee.employeeCode}</strong>
            </li>
            <li>
              <Mail size={16} aria-hidden="true" />
              <span>Email</span>
              <strong>{employee.email}</strong>
            </li>
            <li>
              <Phone size={16} aria-hidden="true" />
              <span>Điện thoại</span>
              <strong className={employee.phone ? '' : 'muted'}>{employee.phone || EMPTY}</strong>
            </li>
          </ul>

          <div className="profile-actions">
            <button type="button" className="primary-button" onClick={() => onEdit(employee)}>
              <Pencil size={16} aria-hidden="true" />
              Sửa
            </button>
            {canDeactivate && isWorking && (
              <button type="button" className="outline-danger-button" onClick={() => onDeactivate(employee)}>
                <UserX size={16} aria-hidden="true" />
                Vô hiệu hóa
              </button>
            )}
          </div>
        </section>

        <section className="content-panel info-card">
          <h2>Thông tin cá nhân</h2>
          <InfoGrid
            rows={[
              ['Họ tên', employee.fullName],
              ['Ngày sinh', formatDate(employee.dateOfBirth)],
              ['Giới tính', genderLabels[employee.gender]],
              ['Số điện thoại', employee.phone],
              ['Email', employee.email],
              ['CCCD', employee.idNumber],
              ['Địa chỉ', employee.address]
            ]}
          />

          <h2 className="info-divider">Thông tin công việc</h2>
          <InfoGrid
            rows={[
              ['Phòng ban', employee.departmentName],
              ['Chức vụ', employee.position],
              ['Quản lý trực tiếp', employee.managerName],
              ['Ngày vào làm', formatDate(employee.hireDate)],
              ['Hình thức làm việc', employmentTypeLabels[employee.employmentType]],
              ['Lương cơ bản', formatMoney(employee.baseSalary)]
            ]}
          />
        </section>
      </div>

      <div className="detail-bottom">
        <section className="content-panel">
          <div className="section-header">
            <h2>Hợp đồng</h2>
            {canEditContracts && (
              <button type="button" className="primary-button" onClick={() => openContractForm({})}>
                <Plus size={18} aria-hidden="true" />
                Thêm hợp đồng
              </button>
            )}
          </div>
          {contractsError && <p className="form-error">{contractsError}</p>}

          {editingContract && (
            <ContractForm
              key={editingContract.id || 'new'}
              contract={editingContract.id ? editingContract : null}
              employee={employee}
              error={contractFormError}
              onSubmit={saveContract}
              onCancel={() => setEditingContract(null)}
            />
          )}

          <div className="table-wrap">
            <table className="responsive-table compact-table contracts-table">
              <thead>
                <tr>
                  <th>Loại hợp đồng</th>
                  <th>Số hợp đồng</th>
                  <th>Từ ngày</th>
                  <th>Đến ngày</th>
                  <th>Mức lương</th>
                  <th>Trạng thái</th>
                  {showContractActions && <th></th>}
                </tr>
              </thead>
              <tbody>
                {contractsLoading ? (
                  <tr>
                    <td colSpan="7">Đang tải hợp đồng</td>
                  </tr>
                ) : contracts.length ? (
                  contracts.map((contract) => {
                    const deadline = contractDeadline(contract);

                    return (
                      <tr key={contract.id}>
                        <td className="cell-main">
                          <strong>{contractTypeLabels[contract.contractType] || contract.contractType}</strong>
                        </td>
                        <td data-label="Số hợp đồng">{contract.contractNumber}</td>
                        <td data-label="Từ ngày">{formatDate(contract.startDate)}</td>
                        <td data-label="Đến ngày">
                          {formatDate(contract.endDate) || '—'}
                          {deadline && <span className={`deadline-note ${deadline.level}`}>{deadline.text}</span>}
                        </td>
                        <td data-label="Mức lương">{formatMoney(contract.salary)}</td>
                        <td data-label="Trạng thái">
                          <span className={`status-pill ${contractStatusClass[contract.status] || 'status-inactive'}`}>
                            {contractStatusLabels[contract.status] || contract.status}
                          </span>
                        </td>
                        {showContractActions && (
                          <td className="cell-actions">
                            <div className="row-actions">
                              {canEditContracts && (
                                <button
                                  type="button"
                                  className="icon-button success"
                                  onClick={() => openContractForm(contract)}
                                  title="Sửa"
                                  aria-label="Sửa"
                                >
                                  <Pencil size={17} aria-hidden="true" />
                                </button>
                              )}
                              {canDeleteContracts && (
                                <button
                                  type="button"
                                  className="icon-button danger"
                                  onClick={() => setDeletingContract(contract)}
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
                    <td colSpan="7">Chưa có hợp đồng</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="content-panel">
          <h2>Lịch sử thay đổi</h2>
          <HistoryTimeline entries={history} loading={historyLoading} error={historyError} />
        </section>
      </div>

      {deletingContract && (
        <ConfirmDialog
          title="Xóa hợp đồng?"
          message={`Hợp đồng ${deletingContract.contractNumber} sẽ bị xóa vĩnh viễn. Nếu hợp đồng đã kết thúc, nên chuyển sang "Hết hạn" hoặc "Đã chấm dứt" để giữ lịch sử.`}
          confirmLabel="Xóa hợp đồng"
          busy={deletingBusy}
          onConfirm={confirmDeleteContract}
          onCancel={cancelDeleteContract}
        />
      )}
    </div>
  );
}
