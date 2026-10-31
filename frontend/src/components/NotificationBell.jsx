import { Bell, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { formatDateTime } from '../format.js';

const POLL_MS = 60000;

// Trang mở ra khi bấm vào thông báo, theo loại thông báo.
const targetView = {
  SHIFT_CHANGE_APPROVED: 'my-schedule',
  SHIFT_CHANGE_REJECTED: 'my-schedule',
  LEAVE_APPROVED: 'my-leave',
  LEAVE_REJECTED: 'my-leave'
};

// Chuông thông báo trên thanh tiêu đề (HR-034): báo khi yêu cầu đổi ca / đơn nghỉ phép được duyệt hoặc
// từ chối. Không có đẩy thời gian thực nên tải lại mỗi phút và mỗi lần mở danh sách.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const response = await api.myNotifications({ limit: 20 });
      setItems(response.data);
      setUnreadCount(response.meta.unreadCount);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleClick(event) {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKey(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      load();
    }
    setOpen((current) => !current);
  }

  function openItem(item) {
    if (!item.isRead) {
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
      setUnreadCount((count) => Math.max(count - 1, 0));
      api.markNotificationRead(item.id).catch(() => load());
    }

    setOpen(false);
    if (targetView[item.type]) {
      window.location.hash = targetView[item.type];
    }
  }

  async function markAll() {
    try {
      await api.markAllNotificationsRead();
      setItems((current) => current.map((entry) => ({ ...entry, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="notification-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-text-button square notification-button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
        title="Thông báo"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-panel" role="dialog" aria-label="Thông báo">
          <div className="notification-head">
            <strong>Thông báo</strong>
            {unreadCount > 0 && (
              <button type="button" className="link-button" onClick={markAll}>
                <CheckCheck size={16} aria-hidden="true" />
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>
          {error && <p className="form-error">{error}</p>}
          {items.length ? (
            <ul className="notification-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`notification-item${item.isRead ? '' : ' is-unread'}`}
                    onClick={() => openItem(item)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <small>{formatDateTime(item.createdAt)}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !error && <p className="muted-text notification-empty">Chưa có thông báo nào</p>
          )}
        </div>
      )}
    </div>
  );
}
