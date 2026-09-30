import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { httpError } from '../utils/httpError.js';

fs.mkdirSync(config.cvUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: config.cvUploadDir,
  filename: (_req, _file, callback) => {
    callback(null, `${randomUUID()}.pdf`);
  }
});

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

// Đuôi và mimetype do trình duyệt gửi lên có thể giả, nên đọc 4 byte đầu xem có đúng "%PDF".
export async function isPdfFile(filePath) {
  const handle = await fsPromises.open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(4);
    await handle.read(buffer, 0, 4, 0);
    return buffer.toString('latin1') === '%PDF';
  } finally {
    await handle.close();
  }
}

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
