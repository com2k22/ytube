import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cấu hình Vite cho ứng dụng Ytube (Mina & Cốm)
// - base: '' để build ra vẫn chạy tốt khi đóng gói lên webOS TV (đường dẫn tương đối)
// - resolve.alias: khai báo "@" trỏ vào thư mục src — PHẢI khớp với "paths" trong
//   tsconfig.json, vì tsconfig chỉ giúp TypeScript kiểm tra kiểu, còn Vite/Rollup
//   (bước build/bundle thật) cần khai báo alias riêng ở đây mới resolve được.
// - build.target: 'es2015' — trình duyệt (Chromium) tích hợp sẵn trong TV LG webOS
//   thường CŨ hơn nhiều so với Chrome trên máy tính, không hiểu nổi cú pháp JS đời mới
//   như "?." (optional chaining) hay "??" mà code này dùng rất nhiều. Nếu build không
//   hạ cấp cú pháp này, cả file JS sẽ lỗi cú pháp ngay khi TV cố chạy → toàn bộ app
//   không chạy được gì cả, hiện màn hình trắng trơn (không phải lỗi mạng/Supabase).
//   target: 'es2015' bắt esbuild tự "dịch" các cú pháp mới đó sang dạng cũ hơn, TV
//   nào cũng chạy được.
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
    target: 'es2015',
  },
})
