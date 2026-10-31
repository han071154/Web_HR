import { ref } from './helpers.js';

// Schema dùng chung cho toàn bộ API. Trường ngày (DATE) trả về dạng "YYYY-MM-DD", thời điểm
// (TIMESTAMPTZ) dạng ISO 8601. Tên trường theo camelCase như response thật của backend.

const uuid = { type: 'string', format: 'uuid' };
const nullableUuid = { type: 'string', format: 'uuid', nullable: true };
const date = { type: 'string', format: 'date', example: '2026-10-12' };
const nullableDate = { ...date, nullable: true };
const dateTime = { type: 'string', format: 'date-time' };
const nullableDateTime = { ...dateTime, nullable: true };
const nullableString = { type: 'string', nullable: true };
const time = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$', example: '08:00' };
const money = { type: 'number', minimum: 0, maximum: 999999999999.99, example: 15000000 };
const password = {
  type: 'string',
  minLength: 8,
  maxLength: 72,
  description: '8–72 ký tự, có ít nhất một chữ cái và một chữ số / 8–72 chars with a letter and a digit'
};
const timestamps = { createdAt: dateTime, updatedAt: dateTime };

const schemas = {
  Error: {
    type: 'object',
    required: ['message'],
    properties: {
      message: { type: 'string', example: 'Validation error' },
      details: {
        type: 'array',
        description: 'Danh sách lỗi của zod khi message là "Validation error" / zod issues',
        items: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            path: { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'integer' }] } },
            message: { type: 'string' }
          }
        }
      }
    }
  },
  Pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 5000 },
      totalPages: { type: 'integer', example: 250 }
    }
  },
  Role: { type: 'string', enum: ['ADMIN', 'HR_MANAGER', 'HR_STAFF', 'EMPLOYEE'] },
  EmploymentType: { type: 'string', enum: ['FULL_TIME', 'PART_TIME', 'SHIFT', 'CONTRACT', 'INTERN'] },
  EmployeeStatus: { type: 'string', enum: ['ACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED'] },
  ContractType: { type: 'string', enum: ['PROBATION', 'FIXED_TERM', 'INDEFINITE', 'SEASONAL'] },
  ContractStatus: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'] },
  ApplicationStatus: { type: 'string', enum: ['NEW', 'REVIEWING', 'INTERVIEW', 'HIRED', 'REJECTED'] },
  AttendanceStatus: { type: 'string', enum: ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'] },
  RequestStatus: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
  ReviewDecision: {
    type: 'object',
    required: ['status'],
    properties: { status: { type: 'string', enum: ['APPROVED', 'REJECTED'] } }
  },
  AuditEntry: {
    type: 'object',
    properties: {
      id: uuid,
      action: { type: 'string', example: 'UPDATED' },
      details: {
        type: 'object',
        additionalProperties: true,
        example: { fields: { phone: { from: '0901000002', to: '0912345678' } } }
      },
      actorName: nullableString,
      createdAt: dateTime
    }
  },

  // --- Auth ---
  AuthUser: {
    type: 'object',
    properties: {
      id: uuid,
      email: { type: 'string', format: 'email' },
      fullName: { type: 'string' },
      role: ref('Role')
    }
  },
  TokenPayload: {
    type: 'object',
    description: 'Nội dung access token (JWT) / Decoded access token',
    properties: {
      sub: { ...uuid, description: 'users.id' },
      email: { type: 'string', format: 'email' },
      fullName: { type: 'string' },
      role: ref('Role'),
      iat: { type: 'integer' },
      exp: { type: 'integer' }
    }
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'admin@webhr.local' },
      password: { type: 'string', example: 'admin123' }
    }
  },
  LoginResponse: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'Access token (JWT), hết hạn theo JWT_EXPIRES_IN (mặc định 1d)' },
      refreshToken: { type: 'string', description: 'Chỉ dùng cho /auth/refresh, hết hạn theo JWT_REFRESH_EXPIRES_IN (mặc định 30d)' },
      user: ref('AuthUser')
    }
  },
  ChangePasswordRequest: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: { currentPassword: { type: 'string' }, newPassword: password }
  },

  // --- Departments / Positions ---
  Department: {
    type: 'object',
    properties: {
      id: uuid,
      name: { type: 'string', example: 'Engineering' },
      description: nullableString,
      employeeCount: { type: 'integer' },
      ...timestamps
    }
  },
  DepartmentInput: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 120, example: 'Engineering' },
      description: { type: 'string', maxLength: 2000, nullable: true, example: 'Product engineering' }
    }
  },
  Position: {
    type: 'object',
    properties: {
      id: uuid,
      code: { type: 'string', example: 'BE-DEV' },
      name: { type: 'string', example: 'Backend Developer' },
      description: nullableString,
      departmentId: nullableUuid,
      departmentName: nullableString,
      isActive: { type: 'boolean' },
      ...timestamps
    }
  },
  PositionInput: {
    type: 'object',
    required: ['code', 'name'],
    properties: {
      code: { type: 'string', minLength: 2, maxLength: 40, description: 'Lưu dạng chữ hoa / stored upper-case' },
      name: { type: 'string', minLength: 2, maxLength: 120 },
      description: { type: 'string', maxLength: 2000, nullable: true },
      departmentId: nullableUuid,
      isActive: { type: 'boolean', default: true }
    }
  },

  // --- Employees ---
  Employee: {
    type: 'object',
    properties: {
      id: uuid,
      employeeCode: { type: 'string', example: 'NV003' },
      fullName: { type: 'string', example: 'Nguyễn Văn An' },
      email: { type: 'string', format: 'email' },
      phone: nullableString,
      gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER'], nullable: true },
      dateOfBirth: nullableDate,
      idNumber: { type: 'string', nullable: true, description: 'CMND 9 số hoặc CCCD 12 số' },
      departmentId: nullableUuid,
      departmentName: nullableString,
      managerId: nullableUuid,
      managerName: nullableString,
      positionId: nullableUuid,
      position: { type: 'string', example: 'Backend Developer' },
      employmentType: ref('EmploymentType'),
      status: ref('EmployeeStatus'),
      hireDate: date,
      baseSalary: { type: 'number', example: 15000000 },
      address: nullableString,
      avatarUrl: { type: 'string', format: 'uri', nullable: true },
      ...timestamps
    }
  },
  EmployeeForStaff: {
    type: 'object',
    description: 'Bản rút gọn trả cho HR_STAFF (không có lương, CCCD, ngày sinh, địa chỉ) / Reduced view for HR_STAFF',
    properties: {
      id: uuid,
      employeeCode: { type: 'string' },
      fullName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: nullableString,
      departmentId: nullableUuid,
      departmentName: nullableString,
      position: { type: 'string' },
      status: ref('EmployeeStatus'),
      avatarUrl: { type: 'string', format: 'uri', nullable: true }
    }
  },
  EmployeeLookup: {
    type: 'object',
    properties: {
      id: uuid,
      employeeCode: { type: 'string' },
      fullName: { type: 'string' },
      position: { type: 'string' },
      status: ref('EmployeeStatus')
    }
  },
  EmployeeInput: {
    type: 'object',
    required: ['employeeCode', 'fullName', 'email', 'employmentType', 'status', 'hireDate', 'baseSalary'],
    description: 'Cần positionId hoặc position khi tạo mới / positionId or position is required on create',
    properties: {
      employeeCode: { type: 'string', minLength: 2, maxLength: 40, example: 'NV003' },
      fullName: { type: 'string', minLength: 2, maxLength: 160, example: 'Nguyễn Văn An' },
      email: { type: 'string', format: 'email', maxLength: 160, example: 'an.nv@webhr.local' },
      phone: { type: 'string', maxLength: 40, nullable: true, example: '0901234567' },
      gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER'], nullable: true },
      dateOfBirth: { ...nullableDate, description: 'Phải ở quá khứ / must be in the past' },
      idNumber: { type: 'string', pattern: '^(\\d{9}|\\d{12})$', nullable: true, example: '079200001234' },
      departmentId: nullableUuid,
      managerId: { ...nullableUuid, description: 'Quản lý trực tiếp, không được là chính nhân viên đó' },
      positionId: { ...nullableUuid, description: 'Chức vụ trong danh mục /positions; tên chức vụ lấy từ danh mục' },
      position: { type: 'string', minLength: 2, maxLength: 120, example: 'Backend Developer' },
      employmentType: ref('EmploymentType'),
      status: ref('EmployeeStatus'),
      hireDate: date,
      baseSalary: money,
      address: nullableString
    }
  },
  SelfProfileUpdate: {
    type: 'object',
    additionalProperties: false,
    description: 'Chỉ được sửa phone và address; trường khác bị từ chối (400) / only phone and address',
    properties: {
      phone: { type: 'string', pattern: '^[0-9+().\\s-]{8,20}$', nullable: true },
      address: { type: 'string', maxLength: 500, nullable: true }
    }
  },
  EmployeeImportResult: {
    type: 'object',
    properties: {
      created: { type: 'integer', example: 12 },
      updated: { type: 'integer', example: 3 },
      skipped: { type: 'integer', example: 1 },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: { row: { type: 'integer', example: 7 }, message: { type: 'string', example: 'Invalid email' } }
        }
      }
    }
  },

  // --- Contracts ---
  Contract: {
    type: 'object',
    properties: {
      id: uuid,
      contractNumber: { type: 'string', example: 'HDLD-EMP001-2026' },
      employeeId: uuid,
      employeeCode: { type: 'string' },
      employeeName: { type: 'string' },
      contractType: ref('ContractType'),
      startDate: date,
      endDate: nullableDate,
      signedDate: nullableDate,
      salary: { type: 'number' },
      status: ref('ContractStatus'),
      notes: nullableString,
      ...timestamps
    }
  },
  ContractInput: {
    type: 'object',
    required: ['contractNumber', 'employeeId', 'contractType', 'startDate', 'salary', 'status'],
    description:
      'INDEFINITE không có endDate; các loại khác bắt buộc endDate ≥ startDate. Mỗi nhân viên chỉ một hợp đồng ACTIVE.',
    properties: {
      contractNumber: { type: 'string', minLength: 2, maxLength: 60 },
      employeeId: uuid,
      contractType: ref('ContractType'),
      startDate: date,
      endDate: nullableDate,
      signedDate: nullableDate,
      salary: money,
      status: ref('ContractStatus'),
      notes: { type: 'string', maxLength: 5000, nullable: true }
    }
  },

  // --- Recruitment ---
  PublicJobSummary: {
    type: 'object',
    properties: {
      id: uuid,
      code: { type: 'string' },
      title: { type: 'string', example: 'Nhân viên Kế toán' },
      departmentId: nullableUuid,
      departmentName: nullableString,
      employmentType: ref('EmploymentType'),
      quantity: { type: 'integer' },
      salaryMin: { type: 'number', nullable: true, description: 'null = thỏa thuận / negotiable' },
      salaryMax: { type: 'number', nullable: true },
      deadline: nullableDate,
      isOpen: { type: 'boolean' }
    }
  },
  PublicJobDetail: {
    allOf: [
      ref('PublicJobSummary'),
      {
        type: 'object',
        properties: {
          experience: nullableString,
          location: nullableString,
          workingTime: nullableString,
          description: { type: 'string' },
          requirements: nullableString,
          benefits: nullableString
        }
      }
    ]
  },
  PublicApplicationForm: {
    type: 'object',
    required: ['fullName', 'email', 'phone', 'consent', 'cv'],
    properties: {
      fullName: { type: 'string', minLength: 2, maxLength: 160 },
      email: { type: 'string', format: 'email', maxLength: 160 },
      phone: { type: 'string', description: '10 chữ số bắt đầu bằng 0 (bỏ khoảng trắng, dấu chấm, gạch)', example: '0901234567' },
      coverLetter: { type: 'string', maxLength: 3000 },
      consent: { type: 'string', enum: ['true'] },
      cv: { type: 'string', format: 'binary', description: 'File PDF thật (kiểm tra nội dung), tối đa 5 MB' }
    }
  },
  PublicApplicationResult: {
    type: 'object',
    properties: {
      applicationCode: { type: 'string', example: 'HS-000123' },
      status: { type: 'string', example: 'NEW' },
      jobId: uuid,
      jobTitle: { type: 'string' },
      fullName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      createdAt: dateTime
    }
  },
  JobPosting: {
    type: 'object',
    properties: {
      id: uuid,
      code: { type: 'string', example: 'JOB-ACC-02' },
      title: { type: 'string' },
      departmentId: nullableUuid,
      departmentName: nullableString,
      employmentType: ref('EmploymentType'),
      quantity: { type: 'integer' },
      salaryMin: { type: 'number', nullable: true },
      salaryMax: { type: 'number', nullable: true },
      experience: nullableString,
      location: nullableString,
      workingTime: nullableString,
      description: { type: 'string' },
      requirements: nullableString,
      benefits: nullableString,
      deadline: nullableDate,
      status: { type: 'string', enum: ['DRAFT', 'OPEN', 'CLOSED'] },
      isOpen: { type: 'boolean' },
      applicationCount: { type: 'integer' },
      newApplicationCount: { type: 'integer' },
      ...timestamps
    }
  },
  JobPostingInput: {
    type: 'object',
    required: ['code', 'title', 'employmentType', 'quantity', 'description', 'status'],
    properties: {
      code: { type: 'string', minLength: 2, maxLength: 40, description: 'Lưu chữ hoa, duy nhất' },
      title: { type: 'string', minLength: 2, maxLength: 160 },
      departmentId: nullableUuid,
      employmentType: ref('EmploymentType'),
      quantity: { type: 'integer', minimum: 1, maximum: 1000 },
      salaryMin: { ...money, nullable: true },
      salaryMax: { ...money, nullable: true, description: 'Phải ≥ salaryMin' },
      experience: { type: 'string', maxLength: 120, nullable: true },
      location: { type: 'string', maxLength: 255, nullable: true },
      workingTime: { type: 'string', maxLength: 255, nullable: true },
      description: { type: 'string', minLength: 10, maxLength: 10000 },
      requirements: { type: 'string', maxLength: 10000, nullable: true },
      benefits: { type: 'string', maxLength: 10000, nullable: true },
      deadline: { ...nullableDate, description: 'Tin OPEN cần hạn từ hôm nay trở đi' },
      status: { type: 'string', enum: ['DRAFT', 'OPEN', 'CLOSED'] }
    }
  },
  Application: {
    type: 'object',
    properties: {
      id: uuid,
      applicationCode: { type: 'string', example: 'HS-000123' },
      jobId: uuid,
      jobCode: { type: 'string' },
      jobTitle: { type: 'string' },
      jobDepartmentId: nullableUuid,
      jobEmploymentType: ref('EmploymentType'),
      fullName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      cvOriginalName: nullableString,
      coverLetter: nullableString,
      status: ref('ApplicationStatus'),
      note: nullableString,
      interviewAt: nullableDateTime,
      employeeId: { ...nullableUuid, description: 'Nhân viên được tạo khi chuyển hồ sơ (convert)' },
      employeeCode: nullableString,
      viewedAt: { ...nullableDateTime, description: 'null cho tới khi HR mở chi tiết lần đầu' },
      ...timestamps
    }
  },
  ApplicationDetail: {
    allOf: [
      ref('Application'),
      {
        type: 'object',
        properties: {
          cvSize: { type: 'integer', nullable: true, description: 'Dung lượng file CV (byte)' },
          history: { type: 'array', items: ref('AuditEntry') }
        }
      }
    ]
  },
  ApplicationUpdate: {
    type: 'object',
    properties: {
      status: ref('ApplicationStatus'),
      interviewAt: { ...nullableDateTime, description: 'ISO 8601 có múi giờ; bắt buộc khi status = INTERVIEW' },
      note: { type: 'string', maxLength: 2000, nullable: true }
    }
  },
  ApplicationConvert: {
    type: 'object',
    required: ['employeeCode', 'hireDate', 'baseSalary', 'contractType'],
    properties: {
      employeeCode: { type: 'string', minLength: 2, maxLength: 40, example: 'NV010' },
      departmentId: { ...nullableUuid, description: 'Mặc định là phòng ban của tin tuyển dụng' },
      positionId: { ...nullableUuid, description: 'Mặc định lấy tiêu đề tin làm tên chức vụ' },
      position: { type: 'string', minLength: 2, maxLength: 120 },
      employmentType: ref('EmploymentType'),
      hireDate: date,
      baseSalary: money,
      contractType: ref('ContractType'),
      contractEndDate: { ...nullableDate, description: 'Bắt buộc (≥ hireDate) trừ khi contractType = INDEFINITE' }
    }
  },

  // --- Work shifts / schedules ---
  WorkShift: {
    type: 'object',
    properties: {
      id: uuid,
      code: { type: 'string', example: 'SHIFT-SANG' },
      name: { type: 'string', example: 'Ca sáng' },
      startTime: { type: 'string', example: '08:00:00' },
      endTime: { type: 'string', example: '12:00:00' },
      breakMinutes: { type: 'integer' },
      isActive: { type: 'boolean' },
      ...timestamps
    }
  },
  WorkShiftInput: {
    type: 'object',
    required: ['code', 'name', 'startTime', 'endTime'],
    description: 'endTime phải sau startTime; breakMinutes phải ngắn hơn ca',
    properties: {
      code: { type: 'string', minLength: 2, maxLength: 40 },
      name: { type: 'string', minLength: 2, maxLength: 120 },
      startTime: time,
      endTime: { ...time, example: '12:00' },
      breakMinutes: { type: 'integer', minimum: 0, maximum: 480, default: 0 },
      isActive: { type: 'boolean', default: true }
    }
  },
  WorkSchedule: {
    type: 'object',
    properties: {
      id: uuid,
      employeeId: uuid,
      employeeCode: { type: 'string' },
      employeeName: { type: 'string' },
      departmentId: nullableUuid,
      departmentName: nullableString,
      shiftId: uuid,
      shiftCode: { type: 'string' },
      shiftName: { type: 'string' },
      startTime: { type: 'string', example: '08:00:00' },
      endTime: { type: 'string', example: '17:00:00' },
      breakMinutes: { type: 'integer' },
      workDate: date,
      status: { type: 'string', enum: ['SCHEDULED', 'CANCELLED'] },
      notes: nullableString,
      ...timestamps
    }
  },
  WorkScheduleInput: {
    type: 'object',
    required: ['employeeId', 'shiftId', 'workDate'],
    properties: {
      employeeId: uuid,
      shiftId: uuid,
      workDate: date,
      status: { type: 'string', enum: ['SCHEDULED', 'CANCELLED'], default: 'SCHEDULED' },
      notes: { type: 'string', maxLength: 2000, nullable: true }
    }
  },
  ScheduleBatchResult: {
    type: 'object',
    properties: {
      created: { type: 'integer', example: 5 },
      skipped: { type: 'integer', example: 1 },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: { employeeId: uuid, workDate: date, message: { type: 'string' } }
        }
      }
    }
  },
  ShiftChangeRequest: {
    type: 'object',
    properties: {
      id: uuid,
      employeeId: uuid,
      employeeName: { type: 'string' },
      scheduleId: uuid,
      workDate: date,
      currentShiftId: uuid,
      currentShiftName: { type: 'string' },
      requestedShiftId: nullableUuid,
      requestedShiftName: nullableString,
      reason: nullableString,
      status: ref('RequestStatus'),
      reviewedBy: nullableUuid,
      reviewedAt: nullableDateTime,
      ...timestamps
    }
  },

  // --- Attendance ---
  AttendanceRecord: {
    type: 'object',
    properties: {
      id: uuid,
      employeeId: uuid,
      employeeCode: { type: 'string' },
      employeeName: { type: 'string' },
      departmentId: nullableUuid,
      departmentName: nullableString,
      scheduleId: nullableUuid,
      shiftName: nullableString,
      workDate: date,
      checkIn: nullableDateTime,
      checkOut: nullableDateTime,
      workedHours: {
        type: 'number',
        nullable: true,
        description: 'Giờ công (đã trừ giờ nghỉ giữa ca); null khi chưa đủ giờ vào và giờ ra'
      },
      lateMinutes: { type: 'integer', minimum: 0, description: 'Số phút vào trễ so với giờ bắt đầu ca' },
      earlyLeaveMinutes: { type: 'integer', minimum: 0, description: 'Số phút về sớm so với giờ kết thúc ca' },
      status: ref('AttendanceStatus'),
      note: nullableString,
      ...timestamps
    }
  },
  AttendanceCorrection: {
    type: 'object',
    description: 'Gửi bất kỳ tập con nào. checkIn/checkOut phải cùng ngày chấm công và checkOut > checkIn.',
    properties: {
      checkIn: { ...nullableDateTime, description: 'ISO 8601 có múi giờ' },
      checkOut: { ...nullableDateTime, description: 'ISO 8601 có múi giờ' },
      status: ref('AttendanceStatus'),
      note: { type: 'string', maxLength: 2000, nullable: true }
    }
  },
  MarkAbsentRequest: {
    type: 'object',
    required: ['date'],
    properties: { date: { ...date, description: 'Ngày cần chốt vắng, phải trước hôm nay / must be before today' } }
  },
  MarkAbsentResult: {
    type: 'object',
    properties: { date, created: { type: 'integer', description: 'Số bản ghi ABSENT vừa tạo' } }
  },
  WorkHourStat: {
    type: 'object',
    properties: {
      employeeId: uuid,
      employeeCode: { type: 'string' },
      employeeName: { type: 'string' },
      workDays: { type: 'integer', description: 'Số ngày PRESENT hoặc LATE' },
      lateCount: { type: 'integer' },
      earlyLeaveCount: { type: 'integer', description: 'Số ngày về sớm' },
      absentCount: { type: 'integer' },
      totalHours: { type: 'number' },
      otHours: { type: 'number' }
    }
  },

  // --- Leave requests ---
  LeaveRequest: {
    type: 'object',
    properties: {
      id: uuid,
      employeeId: uuid,
      employeeCode: { type: 'string' },
      employeeName: { type: 'string' },
      departmentId: nullableUuid,
      departmentName: nullableString,
      leaveType: { type: 'string', enum: ['ANNUAL', 'SICK', 'UNPAID', 'OTHER'] },
      startDate: date,
      endDate: date,
      leaveDays: { type: 'integer', description: 'Số ngày nghỉ: T2–T6 cộng T7/CN có ca SCHEDULED' },
      reason: nullableString,
      status: ref('RequestStatus'),
      approvedBy: nullableUuid,
      approvedByName: nullableString,
      approvedAt: nullableDateTime,
      ...timestamps
    }
  },
  LeaveRequestInput: {
    type: 'object',
    required: ['leaveType', 'startDate', 'endDate'],
    properties: {
      leaveType: { type: 'string', enum: ['ANNUAL', 'SICK', 'UNPAID', 'OTHER'] },
      startDate: date,
      endDate: { ...date, description: 'Phải ≥ startDate; được chọn ngày đã qua' },
      reason: { type: 'string', maxLength: 2000, nullable: true }
    }
  },

  // --- Reports ---
  Dashboard: {
    type: 'object',
    properties: {
      date,
      from: { ...date, description: 'date − 6 ngày' },
      employeeStatus: {
        type: 'object',
        properties: {
          ACTIVE: { type: 'integer' },
          ON_LEAVE: { type: 'integer' },
          RESIGNED: { type: 'integer' },
          TERMINATED: { type: 'integer' }
        }
      },
      attendanceDaily: {
        type: 'array',
        items: {
          type: 'object',
          properties: { workDate: date, status: ref('AttendanceStatus'), count: { type: 'integer' } }
        }
      },
      pendingLeaves: { type: 'integer' },
      pendingShiftChanges: { type: 'integer' },
      month: {
        type: 'object',
        properties: { from: date, to: date, totalHours: { type: 'number' }, otHours: { type: 'number' } }
      }
    }
  },
  DepartmentHeadcount: {
    type: 'object',
    properties: { departmentId: uuid, departmentName: { type: 'string' }, employeeCount: { type: 'integer' } }
  },

  // --- Users ---
  UserAccount: {
    type: 'object',
    properties: {
      id: uuid,
      email: { type: 'string', format: 'email' },
      fullName: { type: 'string' },
      role: ref('Role'),
      isActive: { type: 'boolean' },
      employeeId: nullableUuid,
      employeeCode: nullableString,
      employeeName: nullableString,
      departmentName: nullableString,
      passwordChangedAt: nullableDateTime,
      ...timestamps
    }
  },
  UserAccountDetail: {
    allOf: [
      ref('UserAccount'),
      { type: 'object', properties: { history: { type: 'array', items: ref('AuditEntry') } } }
    ]
  },
  UserCreate: {
    type: 'object',
    required: ['email', 'role', 'password'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 160 },
      fullName: { type: 'string', minLength: 2, maxLength: 160, description: 'Mặc định lấy tên hồ sơ nhân viên' },
      role: ref('Role'),
      password,
      employeeId: { ...nullableUuid, description: 'Bắt buộc với role EMPLOYEE' }
    }
  },
  UserUpdate: {
    type: 'object',
    minProperties: 1,
    properties: {
      fullName: { type: 'string', minLength: 2, maxLength: 160 },
      role: ref('Role'),
      employeeId: { ...nullableUuid, description: 'null = bỏ liên kết / unlink' },
      isActive: { type: 'boolean', description: 'false = khóa tài khoản / lock' }
    }
  },
  EmployeeOption: {
    type: 'object',
    properties: {
      id: uuid,
      employeeCode: { type: 'string' },
      fullName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      status: ref('EmployeeStatus'),
      position: nullableString,
      departmentName: nullableString,
      linkedUserId: nullableUuid,
      linkedUserEmail: nullableString
    }
  },
  BulkUserResult: {
    type: 'object',
    properties: {
      created: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: uuid,
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            employeeCode: { type: 'string' },
            password: { type: 'string', description: 'Mật khẩu tạm, chỉ trả về một lần / returned once' }
          }
        }
      },
      skipped: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            employeeId: uuid,
            employeeCode: nullableString,
            fullName: nullableString,
            reason: {
              type: 'string',
              enum: ['ALREADY_LINKED', 'EMPLOYEE_NOT_WORKING', 'NO_EMAIL', 'EMAIL_TAKEN', 'EMPLOYEE_NOT_FOUND']
            }
          }
        }
      }
    }
  },

  // --- Notifications ---
  Notification: {
    type: 'object',
    properties: {
      id: uuid,
      type: {
        type: 'string',
        enum: ['SHIFT_CHANGE_APPROVED', 'SHIFT_CHANGE_REJECTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED']
      },
      title: { type: 'string', example: 'Yêu cầu đổi ca đã được duyệt' },
      message: { type: 'string' },
      entityType: { type: 'string', nullable: true, example: 'SHIFT_CHANGE_REQUEST' },
      entityId: nullableUuid,
      isRead: { type: 'boolean' },
      createdAt: dateTime,
      readAt: nullableDateTime
    }
  }
};

// Bản "Update" của các schema Input: cùng trường nhưng không bắt buộc (PUT/PATCH nhận tập con bất kỳ).
for (const name of ['DepartmentInput', 'PositionInput', 'EmployeeInput', 'ContractInput', 'JobPostingInput', 'WorkShiftInput', 'WorkScheduleInput']) {
  const update = { ...schemas[name], description: 'Gửi bất kỳ tập con nào của các trường / any subset of the fields' };
  delete update.required;
  schemas[name.replace('Input', 'Update')] = update;
}

export const components = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Access token lấy từ POST /auth/login hoặc /auth/refresh'
    }
  },
  schemas
};
