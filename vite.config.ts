import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cấu hình Vite cho ứng dụng Ytube (Mina & Cốm)
// - base: '' để build ra vẫn chạy tốt khi đóng gói lên webOS TV (đường dẫn tương đối)
// - resolve.alias: khai báo "@" trỏ vào thư mục src — PHẢI khớp với "paths" trong
//   tsconfig.json, vì tsconfig chỉ giúp TypeScript kiểm tra kiểu, còn Vite/Rollup
//   (bước build/bundle thật) cần khai báo alias riêng ở đây mới resolve được.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
