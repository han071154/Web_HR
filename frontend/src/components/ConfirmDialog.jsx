import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';

// Hộp thoại hỏi lại trước khi làm thao tác không hoàn tác được (ví dụ: xóa).
export default function ConfirmDialog({ title, message, confirmLabel = 'Xác nhận', busy = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    // Focus sẵn nút "Hủy" để lỡ nhấn Enter cũng không xóa nhầm.
    cancelRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon">
          <TriangleAlert size={22} aria-hidden="true" />
        </div>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onCancel} ref={cancelRef} disabled={busy}>
            Hủy
          </button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Đang xử lý' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
