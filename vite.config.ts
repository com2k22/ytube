import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cấu hình Vite cho ứng dụng Ytube (Mina & Cốm)
//
// === Chỉ còn MỘT bản build duy nhất ===
// Trước đây file này từng phải "chế biến" đầu ra riêng cho TV (gộp hết JS/CSS vào 1 file
// HTML, bỏ khai báo module...) vì app trên TV được mở trực tiếp từ ổ đĩa qua "file://".
// Cách đó đã bị bỏ hẳn: app trên TV giờ chạy theo kiểu "hosted" — file .ipk cài lên TV chỉ
// là 1 trang mỏng, tự mở link Vercel (xem scripts/prepare-webos.js). Nghĩa là TV và điện
// thoại/máy tính đều dùng CHUNG đúng 1 bản web bình thường, không còn bản đặc biệt nào nữa.
//
// Nhờ vậy file này quay về đúng cấu hình Vite tiêu chuẩn — ít chỗ hỏng, dễ hiểu, và mọi
// thứ chạy được trên web thì cũng chạy y hệt trên TV.
export default defineConfig({
  plugins: [react()],
  // base: '/' (ĐƯỜNG DẪN TUYỆT ĐỐI) — trước đây để './' (đường dẫn TƯƠNG ĐỐI) từ thời còn
  // mở qua file://. Giờ app luôn chạy qua https://<tên-miền>/... (xem prepare-webos.js) và
  // có NHIỀU ĐƯỜNG DẪN khác nhau (/, /parent, /player, /channel/...). Với base './', mở
  // THẲNG 1 đường dẫn con (vd bấm thông báo đẩy mở /parent) thì trình duyệt tính SAI chỗ
  // lấy file JS/CSS — tính tương đối theo "/parent/" thay vì gốc trang — ra lỗi 404/màn
  // hình trắng. base: '/' luôn trỏ đúng gốc trang dù đang đứng ở đường dẫn con nào.
  base: '/',
  resolve: {
    alias: {
      // Khai báo "@" trỏ vào thư mục src — PHẢI khớp với "paths" trong tsconfig.json, vì
      // tsconfig chỉ giúp TypeScript kiểm tra kiểu, còn Vite/Rollup (bước build/bundle
      // thật) cần khai báo alias riêng ở đây mới resolve được.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // target: 'es2015' — hạ cấp cú pháp JS đời mới (?., ??...) xuống dạng cũ hơn, để trình
    // duyệt trên các đời TV cũ không bị lỗi cú pháp khi đọc code. Không ảnh hưởng gì đến
    // điện thoại/máy tính đời mới.
    target: 'es2015',
  },
})
