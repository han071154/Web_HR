import { X } from 'lucide-react';
import { useEffect } from 'react';

// Hộp thoại chứa một form nhỏ (xếp ca, sửa chấm công, đăng ký ca...). Nhấn Esc hoặc bấm ra ngoài để đóng.
export default function FormDialog({ title, subtitle, wide = false, busy = false, onClose, children }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className={`modal form-dialog${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="form-dialog-header">
          <div>
            <h2 id="form-dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={busy} title="Đóng" aria-label="Đóng">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
