import {
  applicationStatusLabels,
  contractStatusLabels,
  contractTypeLabels,
  employmentTypeLabels,
  formatDate,
  formatDateTime,
  formatMoney,
  genderLabels,
  statusLabels
} from '../format.js';

// Tên tiếng Việt của các trường được ghi trong lịch sử (khớp HISTORY_FIELDS ở backend).
const FIELD_LABELS = {
  employeeCode: 'mã nhân viên',
  fullName: 'họ tên',
  email: 'email',
  phone: 'số điện thoại',
  gender: 'giới tính',
  dateOfBirth: 'ngày sinh',
  idNumber: 'CCCD',
  departmentName: 'phòng ban',
  managerName: 'quản lý trực tiếp',
  position: 'chức vụ',
  employmentType: 'hình thức làm việc',
  status: 'trạng thái',
  hireDate: 'ngày vào làm',
  baseSalary: 'lương cơ bản',
  address: 'địa chỉ',
  contractNumber: 'số hợp đồng',
  contractType: 'loại hợp đồng',
  startDate: 'ngày bắt đầu',
  endDate: 'ngày kết thúc',
  signedDate: 'ngày ký',
  salary: 'mức lương'
};

// Những trường hiện cả giá trị cũ → mới (các trường khác chỉ ghi tên trường cho gọn).
const SHOW_VALUES = ['status', 'position', 'departmentName', 'managerName', 'employmentType', 'contractType'];

function formatValue(field, value, isContract) {
  if (value === null || value === undefined || value === '') {
    return 'trống';
  }

  if (field === 'status') {
    return (isContract ? contractStatusLabels[value] : statusLabels[value]) || value;
  }

  if (field === 'employmentType') {
    return employmentTypeLabels[value] || value;
  }

  if (field === 'contractType') {
    return contractTypeLabels[value] || value;
  }

  if (field === 'gender') {
    return genderLabels[value] || value;
  }

  if (field === 'baseSalary' || field === 'salary') {
    return formatMoney(value);
  }

  if (/Date$/.test(field)) {
    return formatDate(value);
  }

  return value;
}

function changeLines(fields = {}, isContract = false) {
  return Object.entries(fields)
    .filter(([field]) => SHOW_VALUES.includes(field))
    .map(([field, change]) => `${FIELD_LABELS[field]}: ${formatValue(field, change.from, isContract)} → ${formatValue(field, change.to, isContract)}`);
}

function fieldList(fields = {}) {
  return Object.keys(fields)
    .map((field) => FIELD_LABELS[field] || field)
    .join(', ');
}

// Đổi một dòng nhật ký từ API thành tiêu đề và mô tả tiếng Việt.
function describe(entry) {
  const { action, details = {} } = entry;

  switch (action) {
    case 'CREATED':
      return { title: details.applicationCode ? `Tạo hồ sơ từ hồ sơ ứng viên ${details.applicationCode}` : 'Tạo hồ sơ' };
    case 'UPDATED':
      return { title: `Cập nhật ${fieldList(details.fields)}`, lines: changeLines(details.fields) };
    case 'AVATAR_UPDATED':
      return { title: 'Cập nhật ảnh đại diện' };
    case 'AVATAR_REMOVED':
      return { title: 'Xóa ảnh đại diện' };
    case 'CONTRACT_ADDED':
      return {
        title: `Thêm hợp đồng ${details.contractNumber}`,
        lines: details.contractType ? [contractTypeLabels[details.contractType] || details.contractType] : []
      };
    case 'CONTRACT_UPDATED':
      return { title: `Sửa hợp đồng ${details.contractNumber}`, lines: changeLines(details.fields, true) };
    case 'CONTRACT_DELETED':
      return { title: `Xóa hợp đồng ${details.contractNumber}` };
    case 'SUBMITTED':
      return { title: 'Ứng viên nộp hồ sơ' };
    case 'STATUS_CHANGED':
      return {
        title: `${applicationStatusLabels[details.from] || details.from} → ${applicationStatusLabels[details.to] || details.to}`
      };
    case 'INTERVIEW_SCHEDULED':
      return { title: `Hẹn phỏng vấn ${formatDateTime(details.interviewAt)}` };
    case 'NOTE_UPDATED':
      return { title: 'Cập nhật ghi chú' };
    case 'CONVERTED':
      return { title: `Chuyển thành nhân sự ${details.employeeCode}` };
    default:
      return { title: action };
  }
}

// Thẻ "Lịch sử" (Figma M-03a, M-08d): mỗi mốc gồm việc đã làm, thời gian và người làm.
export default function HistoryTimeline({ entries, loading, error }) {
  if (loading) {
    return <p className="muted-text">Đang tải lịch sử</p>;
  }

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (!entries.length) {
    return <p className="muted-text">Chưa có thay đổi nào được ghi lại.</p>;
  }

  return (
    <ol className="history-timeline">
      {entries.map((entry) => {
        const { title, lines = [] } = describe(entry);

        return (
          <li key={entry.id}>
            <strong>{title}</strong>
            {lines.map((line) => (
              <span key={line} className="history-change">
                {line}
              </span>
            ))}
            <span className="history-meta">
              {formatDateTime(entry.createdAt)}
              {entry.actorName ? ` · ${entry.actorName}` : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
