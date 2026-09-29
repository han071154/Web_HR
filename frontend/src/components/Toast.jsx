import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { useEffect } from 'react';

const DISPLAY_TIME_MS = 3500;

// Thông báo nhỏ góc màn hình, tự ẩn sau vài giây.
// toast = { id, type: 'success' | 'error', message }
export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = setTimeout(onClose, DISPLAY_TIME_MS);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) {
    return null;
  }

  const Icon = toast.type === 'error' ? CircleAlert : CircleCheck;

  return (
    <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} key={toast.id}>
      <Icon size={20} aria-hidden="true" />
      <span>{toast.message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Đóng thông báo">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
