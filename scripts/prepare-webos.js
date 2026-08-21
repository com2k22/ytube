// prepare-webos.js — chạy SAU khi "vite build" đã tạo xong thư mục dist/.
// Việc của file này chỉ đơn giản: copy webos-meta/appinfo.json vào thẳng trong dist/,
// để cả thư mục dist/ trở thành 1 "gói app webOS" hợp lệ, sẵn sàng cho lệnh:
//   ares-package ./dist
//
// Vì sao cần bước này: ares-package cần appinfo.json nằm CÙNG cấp với index.html và
// các file tĩnh khác (index.html đã có sẵn trong dist/ do Vite build ra). Icon/largeIcon/
// splash thì đã tự động có trong dist/webos/ rồi (Vite copy nguyên thư mục public/ sang
// dist/ khi build) — appinfo.json trỏ tới đúng đường dẫn "webos/icon.png" nên không cần
// làm gì thêm cho phần ảnh.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');
const appinfoSrc = join(root, 'webos-meta', 'appinfo.json');
const appinfoDest = join(distDir, 'appinfo.json');

if (!existsSync(distDir)) {
  console.error('[webos] Không thấy thư mục dist/ — chạy "npm run build" trước đã nhé.');
  process.exit(1);
}
if (!existsSync(appinfoSrc)) {
  console.error('[webos] Không thấy webos-meta/appinfo.json.');
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });
copyFileSync(appinfoSrc, appinfoDest);

console.log('[webos] Đã copy appinfo.json vào dist/ — giờ chạy: ares-package ./dist');
