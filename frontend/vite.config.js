import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Giữ cố định cổng 5173: đăng nhập Google và CORS của backend chỉ cho phép cổng này.
  // Cổng đang bận thì báo lỗi luôn thay vì tự nhảy sang 5174.
  server: {
    port: 5173,
    strictPort: true
  }
});
