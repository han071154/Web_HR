import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { httpError } from '../utils/httpError.js';

const allowedTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

fs.mkdirSync(config.avatarUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: config.avatarUploadDir,
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}${allowedTypes.get(file.mimetype)}`);
  }
});

export const avatarUpload = multer({
  storage,
  limits: {
    fileSize: config.avatarMaxSizeMb * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      callback(httpError(400, 'Avatar must be a JPEG, PNG, or WebP image'));
      return;
    }

    callback(null, true);
  }
}).single('avatar');

export function getAvatarPath(filename) {
  return `/uploads/avatars/${filename}`;
}

export function getAvatarUrl(req, avatarPath) {
  return avatarPath ? `${req.protocol}://${req.get('host')}${avatarPath}` : null;
}

export async function removeAvatarFile(avatarPath) {
  if (!avatarPath?.startsWith('/uploads/avatars/')) {
    return;
  }

  const filePath = path.join(config.avatarUploadDir, path.basename(avatarPath));

  try {
    await fsPromises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}
