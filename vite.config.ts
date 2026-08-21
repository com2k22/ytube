import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cấu hình Vite cho ứng dụng Ytube (Mina & Cốm)
// - base: '' để build ra vẫn chạy tốt khi đóng gói lên webOS TV (đường dẫn tương đối)
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
