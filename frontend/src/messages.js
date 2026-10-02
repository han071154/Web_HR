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
  'Avatar file is required in the avatar field': 'Vui lòng chọn ảnh đại diện.',
  'Avatar must be a JPEG, PNG, or WebP image': 'Ảnh đại diện phải là file JPG, PNG hoặc WebP.',
  'Job posting code already exists': 'Mã tin tuyển dụng đã tồn tại. Vui lòng dùng mã khác.',
  'Job posting still has applications': 'Tin đã có hồ sơ ứng tuyển nên không xóa được. Hãy chuyển tin sang "Đã đóng".',
  'Application not found': 'Không tìm thấy hồ sơ ứng viên.',
  'CV file not found': 'Không tìm thấy file CV trên máy chủ.',
  'Hired application status cannot be changed': 'Hồ sơ đã trúng tuyển nên không đổi trạng thái được.',
  'Application has already been hired': 'Hồ sơ này đã được tuyển thành nhân viên.',
  'Rejected application cannot be hired': 'Hồ sơ đã bị loại nên không tuyển được. Hãy đổi trạng thái trước.'
};

// Giới hạn dung lượng lấy từ cấu hình backend nên số MB có thể thay đổi.
const fileSizeLabels = { Avatar: 'Ảnh đại diện', CV: 'CV' };
const FILE_TOO_LARGE = /^(Avatar|CV) must not exceed (\d+(?:\.\d+)?) MB$/;

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
  interviewAt: 'Lịch phỏng vấn'
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
