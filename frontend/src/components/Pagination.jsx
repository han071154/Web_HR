import { ChevronLeft, ChevronRight } from 'lucide-react';

// Danh sách số trang cần hiện: 1 … 4 5 6 … 18 (luôn có trang đầu, trang cuối, trang quanh trang hiện tại).
function pageItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const items = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) {
    items.push('start-gap');
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < total - 1) {
    items.push('end-gap');
  }

  items.push(total);
  return items;
}

// Chân bảng: "Hiển thị 1–10 trong 120 nhân sự" + nút chuyển trang.
export default function Pagination({ page, pageSize, total, unit, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span>
        Hiển thị {from}–{to} trong {total} {unit}
      </span>
      {totalPages > 1 && (
        <nav className="pagination-pages" aria-label="Phân trang">
          <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Trang trước">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          {pageItems(page, totalPages).map((item) =>
            typeof item === 'number' ? (
              <button
                type="button"
                key={item}
                className={item === page ? 'active' : ''}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onChange(item)}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="pagination-gap">
                …
              </span>
            )
          )}
          <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Trang sau">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
