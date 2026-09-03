import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { ProfileProvider } from '@/context/ProfileContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/common/Toast';
import './index.css';

// QUAN TRỌNG — vì sao chọn Router theo giao thức (file:// hay http(s)://):
// BrowserRouter định tuyến dựa vào window.location.pathname THẬT của trình duyệt.
// Trên Vercel (https://...) điều đó đúng — pathname luôn bắt đầu bằng "/".
// Nhưng khi đóng gói cho TV LG webOS, app mở trực tiếp qua "file:///media/...
// /index.html" — lúc đó pathname chính là đường dẫn file thật trên đĩa, không route
// nào khai báo (path="/", "/playlist/:sourceId"...) khớp với nó cả. react-router
// (v6) khi không khớp route nào thì âm thầm render null — KHÔNG throw, KHÔNG log gì
// — toàn bộ <App/> biến mất, chỉ còn lại các phần tử của Provider bên ngoài (đây
// chính xác là nguyên nhân màn hình trắng trên TV, xác nhận qua console thật của
// máy: #root chỉ còn "<div class=toast></div>" của ToastProvider, App render null).
// HashRouter thì định tuyến qua phần "#/..." của URL — không phụ thuộc pathname thật
// của file, nên chạy đúng dù mở từ đâu. Chỉ dùng HashRouter khi thật sự đang chạy
// qua file:// (đóng gói TV) — bản Vercel (https://) vẫn giữ nguyên BrowserRouter như
// cũ, để URL trên web vẫn gọn đẹp (không có dấu "#"), không đổi hành vi bản web.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;


/**
 * Bật "chế độ TV" — bộ giao diện phóng to (chữ to, thẻ video to, vùng chọn rõ) để ngồi
 * xem từ 3-4m vẫn đọc được. Chỉ cần gắn thuộc tính data-tv lên thẻ <html>, phần còn lại
 * do CSS lo (xem khối "CHẾ ĐỘ TV" ở cuối src/styles/theme.css).
 *
 * Nhận biết theo 2 cách, cách 1 là chính:
 *  1. Link có kèm "?tv=1" — trang chuyển hướng đóng gói trong app TV luôn gắn dấu này
 *     (xem webos-meta/loader.template.html). Chắc chắn 100%, không phải đoán.
 *  2. Dự phòng: đọc thông tin trình duyệt, nếu là TV LG (webOS) thì cũng bật.
 * Nhờ đó bản mở trên điện thoại/máy tính vẫn giữ nguyên giao diện thường như cũ.
 */
function isTvScreen(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('tv') === '1') return true;
  } catch {
    // Một số trình duyệt rất cũ không có URLSearchParams — bỏ qua, dùng cách 2 bên dưới.
  }
  return /web0s|webos|smarttv|webappmanager/i.test(navigator.userAgent);
}

if (isTvScreen()) {
  document.documentElement.setAttribute('data-tv', '1');
}

/*
  Đăng ký phần chạy ngầm (service worker) — bắt buộc phải có thì ĐIỆN THOẠI mới nhận được
  thông báo đẩy lúc app đã đóng.

  Cố ý BỎ QUA trên TV: TV không bao giờ nhận thông báo đẩy, nên đăng ký ở đó chỉ tổ tải
  thêm 1 file và tốn thêm bộ nhớ của một cái máy vốn đã yếu — không đổi lại được gì.
  Cũng bỏ qua khi chạy bằng file:// (bản đóng gói cũ cho TV), vì trình duyệt không cho.

  File public/sw.js CỐ Ý không lưu đệm trang nào cả, nên không có chuyện deploy bản mới mà
  vẫn hiện bản cũ — xem ghi chú trong chính file đó.
*/
if ('serviceWorker' in navigator && window.location.protocol === 'https:' && !isTvScreen()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[Ytube] Không đăng ký được service worker:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <ProfileProvider>
        <ThemeProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ThemeProvider>
      </ProfileProvider>
    </Router>
  </React.StrictMode>
);
