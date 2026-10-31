import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

// Log hệ thống (WBS 218). LOG_FORMAT=json (mặc định khi chạy Docker) in mỗi sự kiện một dòng JSON để
// gom/tìm kiếm bằng log collector hoặc `docker compose logs backend | jq`; LOG_FORMAT=pretty dễ đọc khi dev.
// LOG_FILE (tùy chọn) ghi thêm ra file, đổi sang file mới mỗi ngày (app-YYYY-MM-DD.log) và xóa file cũ
// hơn LOG_RETENTION_DAYS ngày.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = LEVELS[config.logLevel] ?? LEVELS.info;

let fileStream = null;
let fileDay = null;

function dailyFilePath(day) {
  const { dir, name, ext } = path.parse(config.logFile);
  return path.join(dir, `${name}-${day}${ext || '.log'}`);
}

function removeOldFiles() {
  const { dir, name } = path.parse(config.logFile);
  const cutoff = Date.now() - config.logRetentionDays * 24 * 60 * 60 * 1000;

  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);

    if (file.startsWith(`${name}-`) && fs.statSync(fullPath).mtimeMs < cutoff) {
      fs.rmSync(fullPath, { force: true });
    }
  }
}

function writeToFile(line, time) {
  const day = time.slice(0, 10);

  if (day !== fileDay) {
    fileStream?.end();
    fs.mkdirSync(path.dirname(config.logFile), { recursive: true });
    fileStream = fs.createWriteStream(dailyFilePath(day), { flags: 'a' });
    fileDay = day;
    removeOldFiles();
  }

  fileStream.write(`${line}\n`);
}

function serializeError(error) {
  return { name: error.name, message: error.message, code: error.code, stack: error.stack };
}

function write(level, message, fields = {}) {
  if (LEVELS[level] < minLevel) {
    return;
  }

  const time = new Date().toISOString();
  const entry = { time, level, msg: message, ...fields };

  if (entry.error instanceof Error) {
    entry.error = serializeError(entry.error);
  }

  const json = JSON.stringify(entry);
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;

  if (config.logFormat === 'json') {
    stream.write(`${json}\n`);
  } else {
    const rest = { ...entry };
    const { msg, error } = entry;
    delete rest.time;
    delete rest.level;
    delete rest.msg;
    delete rest.error;
    const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
    stream.write(`${time.slice(11, 19)} ${level.toUpperCase().padEnd(5)} ${msg}${extra}\n`);

    if (error?.stack) {
      stream.write(`${error.stack}\n`);
    }
  }

  if (config.logFile) {
    try {
      writeToFile(json, time);
    } catch (fileError) {
      process.stderr.write(`Could not write log file: ${fileError.message}\n`);
    }
  }
}

export const logger = {
  debug: (message, fields) => write('debug', message, fields),
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields)
};

// Gắn mã request (nhận X-Request-Id từ proxy nếu có, không thì tạo mới) và ghi một dòng log khi request kết
// thúc: method, đường dẫn, mã trạng thái, thời gian xử lý, người dùng. Bỏ qua health check để log không bị ngập.
export function requestLogger(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[\w-]{1,100}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    if (req.originalUrl === '/api/health') {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    write(level, `${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode}`, {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: req.user?.sub,
      ip: req.ip
    });
  });

  next();
}
