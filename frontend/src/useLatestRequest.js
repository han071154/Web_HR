import { useCallback, useRef } from 'react';

// Đổi bộ lọc liên tục sẽ gửi nhiều request cùng lúc; request cũ có thể về SAU request mới và ghi
// đè kết quả đúng. Gọi startRequest() đầu mỗi lần tải, nhận về hàm isLatest() để kiểm tra trước
// khi setState: chỉ request mới nhất được cập nhật màn hình.
export function useLatestRequest() {
  const counter = useRef(0);

  return useCallback(() => {
    counter.current += 1;
    const id = counter.current;
    return () => id === counter.current;
  }, []);
}
