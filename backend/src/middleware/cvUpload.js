import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { httpError } from '../utils/httpError.js';

// Lưu file CV trong bộ nhớ (req.file.buffer), KHÔNG ghi ra đĩa: nội dung được lưu thẳng vào cột
// applications.cv_data ở route xử lý. Trước đây dùng multer.diskStorage ghi vào storage/cvs — khi backend
// chạy trên môi trường không có đĩa bền vững giữa các lần gọi (serverless, nhiều instance, redeploy), file
// vừa ghi bị mất ngay sau đó dù bản ghi vẫn còn trong CSDL ("Không tìm thấy file CV trên máy chủ").
const storage = multer.memoryStorage();

export const cvUpload = multer({
  storage,
  limits: {
    fileSize: config.cvMaxSizeMb * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(httpError(400, 'CV must be a PDF file'));
      return;
    }

    callback(null, true);
  }
}).single('cv');

// Một tên file ổn định để hiển thị/ghi vào cv_path khi không có tên gốc (CSDL yêu cầu NOT NULL; các route
// đọc CV ưu tiên cv_data nên giá trị này không còn cần trỏ tới một file thật trên đĩa).
export function randomCvFilename() {
  return `${randomUUID()}.pdf`;
}

// Đuôi và mimetype do trình duyệt gửi lên có thể giả, nên đọc 4 byte đầu của nội dung xem có đúng "%PDF".
export function isPdfBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 4 && buffer.toString('latin1', 0, 4) === '%PDF';
}

// Dọn file CV trên đĩa của các hồ sơ cũ (trước bản sửa lưu cv_data vào CSDL) khi xoá hồ sơ; hồ sơ mới
// không còn file trên đĩa nên lệnh này không làm gì (ENOENT bị bỏ qua).
export async function removeCvFile(filename) {
  if (!filename) {
    return;
  }

  try {
    await fsPromises.unlink(path.join(config.cvUploadDir, path.basename(filename)));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}
