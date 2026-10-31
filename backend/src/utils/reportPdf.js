import { createRequire } from 'node:module';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { config } from '../config.js';

// Font DejaVu Sans có đủ dấu tiếng Việt (font chuẩn Helvetica của PDF không hiển thị được).
const require = createRequire(import.meta.url);
const fontDir = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const FONT_REGULAR = path.join(fontDir, 'DejaVuSans.ttf');
const FONT_BOLD = path.join(fontDir, 'DejaVuSans-Bold.ttf');

const MARGIN = 36;
const ROW_HEIGHT = 20;

function formatDate(date) {
  const [year, month, day] = String(date).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatHours(value) {
  return Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

// Báo cáo giờ công dạng PDF (HR-040), cùng số liệu và cột với bản Excel. Ghi thẳng vào `output`
// (stream, vd response), scope là mô tả phạm vi lọc (toàn công ty / phòng ban / nhân viên).
export function buildWorkHoursPdf({ rows, from, to, scope, generatedAt = new Date() }, output) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: MARGIN, bufferPages: true });
  doc.pipe(output);
  doc.registerFont('regular', FONT_REGULAR);
  doc.registerFont('bold', FONT_BOLD);

  const tableWidth = doc.page.width - MARGIN * 2;
  const columns = [
    { header: 'Mã NV', value: (row) => row.employeeCode, width: 0.1 },
    { header: 'Họ tên', value: (row) => row.employeeName, width: 0.24 },
    { header: 'Ngày công', value: (row) => row.workDays, width: 0.09, align: 'right' },
    { header: 'Đi trễ', value: (row) => row.lateCount, width: 0.08, align: 'right' },
    { header: 'Về sớm', value: (row) => row.earlyLeaveCount ?? 0, width: 0.08, align: 'right' },
    { header: 'Vắng', value: (row) => row.absentCount, width: 0.08, align: 'right' },
    { header: 'Tổng giờ công', value: (row) => formatHours(row.totalHours), width: 0.17, align: 'right' },
    { header: 'Giờ OT', value: (row) => formatHours(row.otHours), width: 0.16, align: 'right' }
  ].map((column) => ({ ...column, px: column.width * tableWidth }));

  function drawRow(cells, y, { bold = false, fill = null } = {}) {
    if (fill) {
      doc.rect(MARGIN, y, tableWidth, ROW_HEIGHT).fill(fill);
    }

    let x = MARGIN;
    doc.fillColor('#0f2c66').font(bold ? 'bold' : 'regular').fontSize(9);

    columns.forEach((column, index) => {
      doc.text(String(cells[index] ?? ''), x + 4, y + 6, {
        width: column.px - 8,
        align: column.align || 'left',
        lineBreak: false,
        ellipsis: true
      });
      x += column.px;
    });

    doc.moveTo(MARGIN, y + ROW_HEIGHT).lineTo(MARGIN + tableWidth, y + ROW_HEIGHT).strokeColor('#dee2e6').lineWidth(0.5).stroke();
  }

  function drawHeader(y) {
    drawRow(columns.map((column) => column.header), y, { bold: true, fill: '#ebf3ff' });
    return y + ROW_HEIGHT;
  }

  doc.font('bold').fontSize(16).fillColor('#0f2c66').text('BÁO CÁO GIỜ CÔNG', { align: 'center' });
  doc.moveDown(0.3);
  doc.font('regular').fontSize(10).fillColor('#607080')
    .text(`Từ ngày ${formatDate(from)} đến ngày ${formatDate(to)} · ${scope}`, { align: 'center' });
  doc.moveDown(1);

  let y = drawHeader(doc.y);
  const bottom = doc.page.height - MARGIN - 20;

  for (const row of rows) {
    if (y + ROW_HEIGHT > bottom) {
      doc.addPage();
      y = drawHeader(MARGIN);
    }

    drawRow(columns.map((column) => column.value(row)), y);
    y += ROW_HEIGHT;
  }

  if (!rows.length) {
    doc.font('regular').fontSize(10).fillColor('#607080').text('Không có dữ liệu chấm công trong khoảng thời gian này.', MARGIN, y + 8);
    y += ROW_HEIGHT;
  } else {
    if (y + ROW_HEIGHT > bottom) {
      doc.addPage();
      y = MARGIN;
    }

    const sum = (key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
    drawRow(
      ['', `Tổng cộng (${rows.length} nhân viên)`, sum('workDays'), sum('lateCount'), sum('earlyLeaveCount'), sum('absentCount'),
        formatHours(sum('totalHours')), formatHours(sum('otHours'))],
      y,
      { bold: true, fill: '#f2f7ff' }
    );
  }

  // Chân trang: thời điểm xuất và số trang.
  const range = doc.bufferedPageRange();
  const stamp = generatedAt.toLocaleString('vi-VN', { timeZone: config.timezone, hour12: false });

  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    // Chân trang nằm trong lề dưới: bỏ lề tạm thời để pdfkit không tự sang trang mới.
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(8).fillColor('#607080').text(
      `Web HR · Xuất lúc ${stamp} · Trang ${index + 1}/${range.count}`,
      MARGIN,
      doc.page.height - MARGIN,
      { width: tableWidth, align: 'right', lineBreak: false }
    );
  }

  doc.end();
  return doc;
}
