import multer from 'multer';
import { config } from '../config.js';
import { httpError } from '../utils/httpError.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Lưu vào bộ nhớ (không ghi đĩa) vì file chỉ được đọc để import rồi bỏ.
// Chỉ kiểm tra mimetype thôi chưa đủ: một số trình duyệt/hệ điều hành gửi .xlsx với
// mimetype chung chung (application/octet-stream), nên kiểm tra thêm đuôi file.
export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.excelMaxSizeMb * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    const hasXlsxExtension = file.originalname?.toLowerCase().endsWith('.xlsx');

    if (file.mimetype !== XLSX_MIME && !hasXlsxExtension) {
      callback(httpError(400, 'File must be an Excel .xlsx file'));
      return;
    }

    callback(null, true);
  }
}).single('file');
