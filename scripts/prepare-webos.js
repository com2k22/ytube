// prepare-webos.js — chạy SAU khi "vite build" đã tạo xong thư mục dist/.
//
// === Vì sao file này được viết lại hoàn toàn (không còn dùng vite-plugin-singlefile
// hay "vá" file HTML do Vite tự sinh ra nữa) ===
// TV LG webOS mở app trực tiếp từ ổ đĩa qua đường dẫn "file://...", KHÔNG qua máy chủ
// web. Với giao thức này, trình duyệt luôn từ chối tải file JS khai báo kiểu "module"
// (<script type="module" src="...">) — hoàn toàn im lặng, không báo lỗi gì. Các lần
// sửa trước đây cố "vá" lại file dist/index.html do Vite tự sinh ra (qua các plugin
// Vite chạy ở nhiều thời điểm khác nhau: transformIndexHtml, writeBundle...) liên tục
// gặp vấn đề vì rất khó biết CHÍNH XÁC lúc nào 1 plugin thực sự chạy so với các plugin
// khác (đặc biệt là vite-plugin-singlefile, vốn tự gộp file JS/CSS vào HTML theo cách
// riêng, không rõ ràng).
//
// Cách làm ĐÚNG và CHẮC CHẮN: không đụng vào file dist/index.html do Vite sinh ra nữa.
// Thay vào đó, file này (chạy SAU KHI Vite build xong hoàn toàn, code JS/CSS đã có sẵn
// thành file thật trên đĩa):
//   1. Đọc thẳng nội dung file JS và CSS thật (đã build xong) từ dist/assets/.
//   2. Đọc khung HTML mẫu do CHÍNH MÌNH viết tay, có sẵn từ trước, tại
//      webos-meta/index.template.html (KHÔNG phải do Vite sinh ra) — trong đó
//      <div id="root"> đã được đặt đúng vị trí, TRƯỚC thẻ <script>, viết chết sẵn.
//   3. Dán JS/CSS thật vào đúng chỗ trong khung mẫu đó, ghi thành dist/index.html
//      cuối cùng — ĐÈ LÊN bản do Vite tự sinh ra.
// Không còn phụ thuộc bất kỳ hành vi ẩn/thời điểm chạy nào của Vite hay plugin nào nữa
// — mọi thứ đều do mình tự đọc/tự ghép/tự ghi, kiểm soát 100%.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');
const assetsDir = join(distDir, 'assets');
const appinfoSrc = join(root, 'webos-meta', 'appinfo.json');
const appinfoDest = join(distDir, 'appinfo.json');
const templateSrc = join(root, 'webos-meta', 'index.template.html');
const indexDest = join(distDir, 'index.html');

function fail(msg) {
  console.error(`[webos] ${msg}`);
  process.exit(1);
}

if (!existsSync(distDir)) {
  fail('Không thấy thư mục dist/ — chạy "npm run build" trước đã nhé.');
}
if (!existsSync(appinfoSrc)) {
  fail('Không thấy webos-meta/appinfo.json.');
}
if (!existsSync(templateSrc)) {
  fail('Không thấy webos-meta/index.template.html.');
}
if (!existsSync(assetsDir)) {
  fail('Không thấy thư mục dist/assets/ — bản build có vẻ không đúng, kiểm tra lại "npm run build".');
}

// appinfo.json cần nằm cùng cấp với index.html để ares-package nhận đúng gói app.
mkdirSync(distDir, { recursive: true });
copyFileSync(appinfoSrc, appinfoDest);

// Tìm đúng file JS và CSS thật đã build ra (tên có mã hash ngẫu nhiên, không cố định
// trước được — nên quét thư mục assets/ để tìm, thay vì đoán tên).
const assetFiles = readdirSync(assetsDir);
const jsFiles = assetFiles.filter((f) => f.endsWith('.js'));
const cssFiles = assetFiles.filter((f) => f.endsWith('.css'));

if (jsFiles.length === 0) {
  fail('Không tìm thấy file .js nào trong dist/assets/ — bản build có vấn đề.');
}
if (jsFiles.length > 1) {
  console.warn(
    `[webos] Cảnh báo: tìm thấy ${jsFiles.length} file .js trong dist/assets/ (đáng lẽ chỉ có 1 do đã bật inlineDynamicImports) — sẽ gộp hết lại, nhưng nên kiểm tra lại cấu hình build nếu thấy app chạy sai.`,
  );
}

const jsContent = jsFiles.map((f) => readFileSync(join(assetsDir, f), 'utf-8')).join('\n;\n');
const cssContent = cssFiles.map((f) => readFileSync(join(assetsDir, f), 'utf-8')).join('\n');

// "Escape" mọi chuỗi "</script" hoặc "</style" xuất hiện BÊN TRONG nội dung JS/CSS
// thật (ví dụ: code xử lý/soát lọc HTML có thể chứa chuỗi chữ y hệt "<script>" như 1
// đoạn text bình thường) — nếu không escape, trình duyệt sẽ hiểu nhầm đó là điểm KẾT
// THÚC thẻ <script>/<style> thật của trang, cắt cụt code giữa chừng. Đây là 1 lỗi HTML
// kinh điển khi nhúng JS/CSS thẳng vào HTML, luôn phải xử lý.
function escapeForInlineTag(code, tagName) {
  const pattern = new RegExp(`</${tagName}`, 'gi');
  return code.replace(pattern, `<\\/${tagName}`);
}
const safeJs = escapeForInlineTag(jsContent, 'script');
const safeCss = escapeForInlineTag(cssContent, 'style');

const template = readFileSync(templateSrc, 'utf-8');
// Dùng hàm thay vì chuỗi trực tiếp trong .replace() — vì nếu dùng chuỗi, các ký tự "$"
// xuất hiện rất phổ biến trong code JS đã nén (ví dụ "$1", "$&"...) sẽ bị chính
// JavaScript hiểu nhầm thành ký hiệu đặc biệt của .replace() và làm hỏng nội dung.
const finalHtml = template
  .replace('__YTUBE_CSS__', () => safeCss)
  .replace('__YTUBE_JS__', () => safeJs);

writeFileSync(indexDest, finalHtml, 'utf-8');

console.log(
  `[webos] Đã tự ghép ${jsFiles.length} file JS + ${cssFiles.length} file CSS thật vào dist/index.html (viết đè bản Vite tự sinh) — giờ chạy: ares-package -n ./dist`,
);
