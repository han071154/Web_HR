import { dataOf, dateQuery, fileResponse, json, listOf, operation, queryParam, ROLES, ref } from './helpers.js';

const TAG = 'Reports';

export const tag = { name: TAG, description: 'Báo cáo thống kê / Reports and statistics' };

const rangeParams = [
  dateQuery('from', 'Từ ngày (YYYY-MM-DD)', true),
  dateQuery('to', 'Đến ngày (YYYY-MM-DD)', true),
  queryParam('employeeId', { type: 'string', format: 'uuid' }),
  queryParam('departmentId', { type: 'string', format: 'uuid' })
];

export const paths = {
  '/reports/dashboard': {
    get: operation({
      tag: TAG,
      summary: 'Số liệu trang Tổng quan / Dashboard figures',
      description: 'Đếm chấm công 7 ngày kết thúc ở date và tổng giờ công / OT của tháng chứa date, tổng hợp bằng SQL.',
      roles: ROLES.HR,
      parameters: [dateQuery('date', 'Mặc định hôm nay theo APP_TIMEZONE')],
      responses: { 200: json('Số liệu', dataOf(ref('Dashboard'))) },
      validation: true
    })
  },
  '/reports/by-department': {
    get: operation({
      tag: TAG,
      summary: 'Số nhân viên đang làm theo phòng ban / Active headcount per department',
      roles: ROLES.HR,
      responses: { 200: json('Theo phòng ban', listOf(ref('DepartmentHeadcount'))) }
    })
  },
  '/reports/work-hours': {
    get: operation({
      tag: TAG,
      summary: 'Báo cáo giờ công theo khoảng ngày / Work-hour report for a date range',
      description: 'Cùng cách tính với /attendance-records/monthly-summary.',
      roles: ROLES.MANAGERS,
      parameters: rangeParams,
      responses: { 200: json('Thống kê theo nhân viên', listOf(ref('WorkHourStat'))) },
      validation: true
    })
  },
  '/reports/export': {
    get: operation({
      tag: TAG,
      summary: 'Xuất báo cáo giờ công (Excel hoặc PDF) / Export the work-hour report (xlsx or pdf)',
      description: 'Cùng số liệu với /reports/work-hours. format mặc định xlsx.',
      roles: ROLES.HR,
      parameters: [
        ...rangeParams,
        queryParam('format', { type: 'string', enum: ['xlsx', 'pdf'], default: 'xlsx' }, 'Định dạng file')
      ],
      responses: {
        200: fileResponse('File báo cáo (.xlsx hoặc .pdf)', [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/pdf'
        ])
      },
      validation: true
    })
  }
};
