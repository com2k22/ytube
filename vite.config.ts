import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cấu hình Vite cho ứng dụng Ytube (Mina & Cốm)
// - base: '' để build ra vẫn chạy tốt khi đóng gói lên webOS TV (đường dẫn tương đối)
// - resolve.alias: khai báo "@" trỏ vào thư mục src — PHẢI khớp với "paths" trong
//   tsconfig.json, vì tsconfig chỉ giúp TypeScript kiểm tra kiểu, còn Vite/Rollup
//   (bước build/bundle thật) cần khai báo alias riêng ở đây mới resolve được.
//
// === Về việc đóng gói cho TV LG webOS — GIẢI PHÁP CUỐI CÙNG, làm lại từ gốc ===
// Nhiều bước sửa trước đây (dùng vite-plugin-singlefile rồi tự viết code "vá" lại file
// HTML sau khi Vite build xong) đều bị lỗi vì phải đoán ĐÚNG THỜI ĐIỂM các plugin chạy
// bên trong Vite/Rollup — thứ tự này không ổn định, khó kiểm soát, dẫn tới sửa hoài
// không hết lỗi (dời thẻ script không có tác dụng, bọc code cũng chạy sai lúc...).
//
// Quyết định làm lại đúng cách: KHÔNG cố "vá" đầu ra của Vite nữa. Thay vào đó,
// vite.config.ts giờ chỉ làm ĐÚNG việc của Vite — build code/CSS bình thường, không
// có plugin can thiệp vào HTML gì cả (bản build cho Vercel vì vậy cũng không đổi gì).
// Việc "đóng gói riêng cho TV" (gộp JS/CSS vào 1 file HTML do MÌNH TỰ VIẾT, đặt đúng
// chỗ, không cần đoán plugin nào chạy trước/sau) chuyển hết sang file
// scripts/prepare-webos.js — chạy SAU KHI Vite build xong hoàn toàn, đọc thẳng file JS/
// CSS thật đã build ra từ đĩa, tự ghép vào 1 khung HTML mình tự viết
// (webos-meta/index.template.html) — 100% chắc chắn, không phụ thuộc hành vi ẩn của
// plugin nào nữa. Xem chi tiết giải thích trong scripts/prepare-webos.js.
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
    // target: 'es2015' — hạ cấp cú pháp JS đời mới (?., ??...) để trình duyệt cũ trên
    // TV không bị lỗi cú pháp khi phân tích code.
    target: 'es2015',
    // cssCodeSplit: false — gộp toàn bộ CSS thành 1 file duy nhất (thay vì tách theo
    // từng trang/route) — giúp bước đóng gói webOS ở dưới dễ tìm và gộp file CSS hơn,
    // không ảnh hưởng gì đến bản Vercel.
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // format: 'iife' — xuất code dạng "tự gọi ngay" kiểu cổ điển nhất, không có
        // "import"/"export" — quan trọng cho bước gộp file HTML thủ công ở
        // prepare-webos.js (không cần cơ chế module/import/export gì cả, dán thẳng
        // code vào 1 thẻ <script> thường là chạy được ngay). Không ảnh hưởng gì đến
        // bản Vercel — trình duyệt hiện đại chạy code này bình thường dù thẻ <script>
        // vẫn đang khai báo type="module" như mặc định của Vite.
        format: 'iife',
        // inlineDynamicImports: bắt buộc khi dùng format "iife" — gộp toàn bộ code
        // (kể cả phần vốn tải "lười" qua dynamic import) vào 1 file JS duy nhất, để
        // bước đóng gói webOS chỉ cần đọc đúng 1 file, không phải lo về nhiều chunk.
        inlineDynamicImports: true,
      },
    },
  },
})
