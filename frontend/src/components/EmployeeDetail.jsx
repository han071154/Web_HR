import { Hash, Mail, Pencil, Phone, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
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

const EMPTY = 'Chưa cập nhật';

// Trạng thái hợp đồng → màu badge (Hiệu lực xanh, Hết hạn xám...).
const contractStatusClass = {
  DRAFT: 'status-inactive',
  ACTIVE: 'status-active',
  EXPIRED: 'status-resigned',
  TERMINATED: 'status-terminated'
};

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
export default function EmployeeDetail({ employee, canDeactivate, onEdit, onDeactivate }) {
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractsError, setContractsError] = useState('');
  const isWorking = employee.status === 'ACTIVE' || employee.status === 'ON_LEAVE';

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
  }, [employee.id]);

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
              ['Địa chỉ', employee.address]
            ]}
          />

          <h2 className="info-divider">Thông tin công việc</h2>
          <InfoGrid
            rows={[
              ['Phòng ban', employee.departmentName],
              ['Chức vụ', employee.position],
              ['Ngày vào làm', formatDate(employee.hireDate)],
              ['Hình thức làm việc', employmentTypeLabels[employee.employmentType]],
              ['Lương cơ bản', formatMoney(employee.baseSalary)]
            ]}
          />
        </section>
      </div>

      <section className="content-panel">
        <h2>Hợp đồng</h2>
        {contractsError && <p className="form-error">{contractsError}</p>}
        <div className="table-wrap">
          <table className="responsive-table compact-table contracts-table">
            <thead>
              <tr>
                <th>Loại hợp đồng</th>
                <th>Số hợp đồng</th>
                <th>Từ ngày</th>
                <th>Đến ngày</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {contractsLoading ? (
                <tr>
                  <td colSpan="5">Đang tải hợp đồng</td>
                </tr>
              ) : contracts.length ? (
                contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td className="cell-main">
                      <strong>{contractTypeLabels[contract.contractType] || contract.contractType}</strong>
                    </td>
                    <td data-label="Số hợp đồng">{contract.contractNumber}</td>
                    <td data-label="Từ ngày">{formatDate(contract.startDate)}</td>
                    <td data-label="Đến ngày">{formatDate(contract.endDate) || '—'}</td>
                    <td data-label="Trạng thái">
                      <span className={`status-pill ${contractStatusClass[contract.status] || 'status-inactive'}`}>
                        {contractStatusLabels[contract.status] || contract.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">Chưa có hợp đồng</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
