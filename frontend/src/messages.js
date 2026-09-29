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
  'Position not found': 'Không tìm thấy chức vụ.',
  'Position code already exists': 'Mã chức vụ đã tồn tại. Vui lòng dùng mã khác.',
  'Related record does not exist or is still in use': 'Dữ liệu liên quan không tồn tại hoặc đang được sử dụng.',
  'Invalid identifier or database value': 'Dữ liệu gửi lên không hợp lệ.',
  'Internal server error': 'Hệ thống đang gặp lỗi. Vui lòng thử lại sau.'
};

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
  position: 'Chức danh',
  employmentType: 'Loại hợp đồng',
  status: 'Trạng thái',
  hireDate: 'Ngày vào làm',
  baseSalary: 'Lương cơ bản',
  address: 'Địa chỉ'
};

const statusMessages = {
  400: 'Dữ liệu gửi lên không hợp lệ.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu yêu cầu.',
  409: 'Dữ liệu bị trùng với bản ghi đã có.'
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
