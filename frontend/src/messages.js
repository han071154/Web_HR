// Chuyển thông báo lỗi từ backend (tiếng Anh) sang tiếng Việt cho người dùng.

const exactMessages = {
  'Missing authorization token': 'Bạn chưa đăng nhập. Vui lòng đăng nhập lại.',
  'Invalid or expired token': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  'Email or password is incorrect': 'Email hoặc mật khẩu không đúng.',
  'You do not have permission to perform this action': 'Bạn không có quyền thực hiện thao tác này.',
  'Employee not found': 'Không tìm thấy nhân viên.',
  'Department not found': 'Không tìm thấy phòng ban.',
  'Employee code already exists': 'Mã nhân viên đã tồn tại. Vui lòng dùng mã khác.',
  'Employee email already exists': 'Email đã được sử dụng. Vui lòng dùng email khác.',
  'Department name already exists': 'Tên phòng ban đã tồn tại. Vui lòng dùng tên khác.',
  'Department still has employees': 'Phòng ban vẫn còn nhân viên. Hãy chuyển nhân viên sang phòng khác trước khi xóa.',
  'Position not found': 'Không tìm thấy chức vụ.',
  'Position code already exists': 'Mã chức vụ đã tồn tại. Vui lòng dùng mã khác.',
  'Selected position does not exist': 'Chức vụ đã chọn không còn trong danh mục. Vui lòng chọn lại.',
  'Position still has employees': 'Chức vụ vẫn còn nhân viên đang giữ. Hãy đổi chức vụ khác cho họ trước khi xóa.',
  'Related record does not exist or is still in use': 'Dữ liệu liên quan không tồn tại hoặc đang được sử dụng.',
  'Invalid identifier or database value': 'Dữ liệu gửi lên không hợp lệ.',
  'Internal server error': 'Hệ thống đang gặp lỗi. Vui lòng thử lại sau.',
  'Job posting not found': 'Không tìm thấy tin tuyển dụng.',
  'Job posting is closed': 'Tin tuyển dụng đã hết hạn nhận hồ sơ.',
  'You have already applied for this job': 'Bạn đã nộp hồ sơ cho vị trí này và hồ sơ đang được xét.',
  'CV file is required': 'Vui lòng đính kèm CV.',
  'CV must be a PDF file': 'CV phải là file PDF.',
  'Too many applications, please try again later': 'Bạn đã nộp quá nhiều hồ sơ. Vui lòng thử lại sau.',
  'Employment contract not found': 'Không tìm thấy hợp đồng.',
  'Contract number already exists': 'Số hợp đồng đã tồn tại. Vui lòng dùng số khác.',
  'Employee already has an active contract':
    'Nhân viên đang có một hợp đồng hiệu lực. Hãy chuyển hợp đồng đó sang "Hết hạn" hoặc "Đã chấm dứt" trước.',
  'Avatar file is required in the avatar field': 'Vui lòng chọn ảnh đại diện.',
  'Avatar must be a JPEG, PNG, or WebP image': 'Ảnh đại diện phải là file JPG, PNG hoặc WebP.',
  'Job posting code already exists': 'Mã tin tuyển dụng đã tồn tại. Vui lòng dùng mã khác.',
  'Job posting still has applications': 'Tin đã có hồ sơ ứng tuyển nên không xóa được. Hãy chuyển tin sang "Đã đóng".',
  'Application not found': 'Không tìm thấy hồ sơ ứng viên.',
  'CV file not found': 'Không tìm thấy file CV trên máy chủ.',
  'Converted application status cannot be changed': 'Hồ sơ đã chuyển thành nhân sự nên không đổi trạng thái được.',
  'Application has already been converted': 'Hồ sơ này đã được chuyển thành nhân sự.',
  'Cannot delete an application that has already been converted to an employee':
    'Hồ sơ đã chuyển thành nhân sự nên không xóa được.',
  'Only passed applications can be converted': 'Chỉ hồ sơ ở trạng thái "Đậu" mới chuyển thành nhân sự được.',
  'Interview time is required for interview status': 'Vui lòng chọn lịch phỏng vấn.',
  'Deadline must be today or later to open a job posting': 'Hạn nộp hồ sơ phải từ hôm nay trở đi.',
  'ID number already exists': 'Số CCCD đã được dùng cho nhân viên khác.',
  'An employee cannot be their own manager': 'Nhân viên không thể là quản lý trực tiếp của chính mình.',
  'File must be an Excel .xlsx file': 'Vui lòng chọn file Excel định dạng .xlsx.',
  'Excel file is required in the file field': 'Vui lòng chọn file Excel để nhập.',
  'Excel file has no worksheet': 'File Excel không có dữ liệu.',
  'Work shift not found': 'Không tìm thấy ca làm việc.',
  'Shift code already exists': 'Mã ca đã tồn tại. Vui lòng dùng mã khác.',
  'End time must be after start time': 'Giờ kết thúc phải sau giờ bắt đầu.',
  'This shift is already used in a schedule; deactivate it instead of deleting':
    'Ca này đã được xếp lịch nên không xóa được. Hãy sửa và bỏ chọn "Đang sử dụng".',
  'Selected shift does not exist': 'Ca làm việc đã chọn không còn tồn tại.',
  'Schedule not found': 'Không tìm thấy lịch phân ca.',
  'Employee already has a shift scheduled for this date': 'Nhân viên đã có ca trong ngày này.',
  'This account is not linked to an employee profile':
    'Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên. Hãy liên hệ phòng nhân sự.',
  'You can only request a change for your own schedule': 'Bạn chỉ được xin đổi ca của chính mình.',
  'Shift change request not found': 'Không tìm thấy yêu cầu đổi ca.',
  'This request has already been reviewed': 'Yêu cầu này đã được duyệt trước đó.',
  'Already checked in today': 'Hôm nay bạn đã chấm công vào rồi.',
  'You have not checked in today': 'Bạn chưa chấm công vào hôm nay.',
  'Already checked out today': 'Hôm nay bạn đã chấm công ra rồi.',
  'Attendance record not found': 'Không tìm thấy bản ghi chấm công.',
  'Attendance already recorded for this date': 'Ngày này đã có bản ghi chấm công.',
  'Leave request not found': 'Không tìm thấy đơn nghỉ phép.',
  'This leave request has already been reviewed': 'Đơn nghỉ phép này đã được duyệt trước đó.',
  'End date must be on or after start date': 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'
};

// "Weekly work hour limit exceeded (max 48h/week)": số giờ lấy từ cấu hình backend.
const WEEKLY_LIMIT = /^Weekly work hour limit exceeded \(max (\d+(?:\.\d+)?)h\/week\)$/;

// Giới hạn dung lượng lấy từ cấu hình backend nên số MB có thể thay đổi.
const fileSizeLabels = { Avatar: 'Ảnh đại diện', CV: 'CV', 'Excel file': 'File Excel' };
const FILE_TOO_LARGE = /^(Avatar|CV|Excel file) must not exceed (\d+(?:\.\d+)?) MB$/;

const fieldLabels = {
  employeeCode: 'Mã nhân viên',
  fullName: 'Họ tên',
  email: 'Email',
  password: 'Mật khẩu',
  name: 'Tên',
  code: 'Mã',
  description: 'Mô tả',
  isActive: 'Trạng thái sử dụng',
  phone: 'Số điện thoại',
  gender: 'Giới tính',
  dateOfBirth: 'Ngày sinh',
  departmentId: 'Phòng ban',
  positionId: 'Chức vụ',
  position: 'Chức vụ',
  employmentType: 'Hình thức làm việc',
  status: 'Trạng thái',
  hireDate: 'Ngày vào làm',
  baseSalary: 'Lương cơ bản',
  address: 'Địa chỉ',
  coverLetter: 'Thư giới thiệu',
  consent: 'Đồng ý xử lý hồ sơ',
  contractNumber: 'Số hợp đồng',
  employeeId: 'Nhân viên',
  contractType: 'Loại hợp đồng',
  startDate: 'Ngày bắt đầu',
  endDate: 'Ngày kết thúc',
  signedDate: 'Ngày ký',
  salary: 'Mức lương',
  notes: 'Ghi chú',
  title: 'Tiêu đề',
  quantity: 'Số lượng',
  salaryMin: 'Lương từ',
  salaryMax: 'Lương đến',
  experience: 'Kinh nghiệm',
  location: 'Địa điểm',
  workingTime: 'Thời gian làm việc',
  requirements: 'Yêu cầu',
  benefits: 'Quyền lợi',
  deadline: 'Hạn nộp',
  note: 'Ghi chú',
  interviewAt: 'Lịch phỏng vấn',
  idNumber: 'CCCD',
  managerId: 'Quản lý trực tiếp',
  contractEndDate: 'Ngày kết thúc hợp đồng',
  startTime: 'Giờ bắt đầu',
  endTime: 'Giờ kết thúc',
  breakMinutes: 'Giờ nghỉ',
  shiftId: 'Ca làm việc',
  workDate: 'Ngày làm',
  checkIn: 'Giờ vào',
  checkOut: 'Giờ ra',
  leaveType: 'Loại nghỉ',
  reason: 'Lý do',
  from: 'Từ ngày',
  to: 'Đến ngày',
  month: 'Tháng'
};

const statusMessages = {
  400: 'Dữ liệu gửi lên không hợp lệ.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu yêu cầu.',
  409: 'Dữ liệu bị trùng với bản ghi đã có.',
  429: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.'
};

function translateDuplicate(message) {
  if (message.includes('employee_code')) {
    return 'Mã nhân viên đã tồn tại. Vui lòng dùng mã khác.';
  }

  if (message.includes('email')) {
    return 'Email đã được sử dụng. Vui lòng dùng email khác.';
  }

  return statusMessages[409];
}

export function toVietnameseError(status, payload) {
  const message = payload?.message || '';

  if (exactMessages[message]) {
    return exactMessages[message];
  }

  const weeklyLimit = WEEKLY_LIMIT.exec(message);

  if (weeklyLimit) {
    return `Vượt quá giới hạn ${weeklyLimit[1]} giờ làm/tuần theo luật lao động.`;
  }

  const tooLarge = FILE_TOO_LARGE.exec(message);

  if (tooLarge) {
    return `${fileSizeLabels[tooLarge[1]]} không được lớn hơn ${tooLarge[2]} MB.`;
  }

  if (message === 'Validation error') {
    const fields = (payload.details || [])
      .map((detail) => fieldLabels[detail.path?.[0]] || detail.path?.[0])
      .filter(Boolean);
    const uniqueFields = [...new Set(fields)];

    return uniqueFields.length
      ? `Thông tin chưa hợp lệ: ${uniqueFields.join(', ')}.`
      : statusMessages[400];
  }

  if (message.includes('duplicate key')) {
    return translateDuplicate(message);
  }

  if (message.includes('invalid input syntax')) {
    return statusMessages[400];
  }

  if (statusMessages[status]) {
    return statusMessages[status];
  }

  return 'Có lỗi xảy ra. Vui lòng thử lại.';
}

export const networkErrorMessage = 'Không kết nối được máy chủ. Hãy kiểm tra backend đã chạy chưa.';

// Các API tự-phục vụ (GET /.../me) trả 409 khi tài khoản EMPLOYEE chưa gắn với hồ sơ nhân viên
// (users.employee_id = NULL). Chỉ dùng cho lỗi khi TẢI dữ liệu: thao tác như chấm công lần 2 cũng trả 409.
export function isNotLinkedError(error) {
  return error?.status === 409;
}
