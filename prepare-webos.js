// prepare-webos.js — tạo thư mục dist-webos/ để đóng gói app cho TV LG webOS.
//
// === App TV chạy theo kiểu "hosted" (mở thẳng link Vercel) — vì sao ===
// Trước đây file .ipk chứa toàn bộ code app, TV mở trực tiếp từ ổ đĩa qua "file://...".
// Cách đó gặp 1 rào cản KHÔNG THỂ vá được từ phía app: từ cuối 2025, YouTube bắt buộc
// trang nhúng video phải gửi kèm thông tin "trang này là ai" (HTTP Referer) thì mới cho
// phát. Trình duyệt KHÔNG BAO GIỜ gửi thông tin đó khi trang được mở qua file:// (quy
// định bảo mật của chính trình duyệt) — nên YouTube luôn từ chối, báo "Lỗi 153: Lỗi cấu
// hình trình phát video". Không có cách sửa nào bằng code khi còn chạy qua file://.
//
// Cách làm đúng (LG gọi là "Hosted Web App"): file .ipk cài lên TV chỉ còn là 1 trang
// mỏng, nhiệm vụ duy nhất là chuyển hướng sang link Vercel thật. Nhờ vậy app chạy qua
// https:// như 1 trang web bình thường → YouTube phát được, Supabase hoạt động bình
// thường, và mọi rắc rối của file:// (chặn tải module, sai đường dẫn định tuyến...) biến
// mất hoàn toàn.
//
// Lợi ích kèm theo, rất đáng giá: mỗi lần cập nhật code sau này bạn CHỈ cần deploy lại
// Vercel là TV tự có bản mới — KHÔNG phải build, đóng gói .ipk, cài lại lên TV nữa.
//
// Script này chỉ làm 3 việc đơn giản:
//   1. Đọc link app thật từ webos-meta/tv-app-url.txt.
//   2. Chèn link đó vào khung trang chuyển hướng webos-meta/loader.template.html.
//   3. Ghi kết quả + appinfo.json + bộ icon vào thư mục dist-webos/ để đem đi đóng gói.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const metaDir = join(root, 'webos-meta');
const appinfoSrc = join(metaDir, 'appinfo.json');
const templateSrc = join(metaDir, 'loader.template.html');
const urlFileSrc = join(metaDir, 'tv-app-url.txt');
const iconsSrcDir = join(root, 'public', 'webos');

const outDir = join(root, 'dist-webos');
const outIconsDir = join(outDir, 'webos');

function fail(msg) {
  console.error(`\n[webos] ${msg}\n`);
  process.exit(1);
}

if (!existsSync(appinfoSrc)) fail('Không thấy file webos-meta/appinfo.json.');
if (!existsSync(templateSrc)) fail('Không thấy file webos-meta/loader.template.html.');
if (!existsSync(urlFileSrc)) fail('Không thấy file webos-meta/tv-app-url.txt.');
if (!existsSync(iconsSrcDir)) fail('Không thấy thư mục public/webos/ (chứa icon.png, largeIcon.png, splash.png).');

// --- 1. Đọc & kiểm tra link app ------------------------------------------------------
// Bỏ qua dòng trống và dòng ghi chú (bắt đầu bằng #), lấy dòng thật đầu tiên.
const appUrl = readFileSync(urlFileSrc, 'utf-8')
  .split('\n')
  .map((line) => line.trim())
  .find((line) => line.length > 0 && !line.startsWith('#'));

if (!appUrl) {
  fail('File webos-meta/tv-app-url.txt chưa có link nào — mở file đó ra, điền link Vercel của bạn vào dòng đầu tiên.');
}
if (appUrl.includes('DAN-LINK-VERCEL-CUA-BAN')) {
  fail(
    'File webos-meta/tv-app-url.txt vẫn đang để link mẫu.\n' +
      '        Mở file đó ra, thay dòng đầu tiên bằng link Vercel thật của bạn\n' +
      '        (dạng https://ten-app.vercel.app — chính là link bạn vẫn mở trên điện thoại).'
  );
}
if (!/^https:\/\/[^\s"'\\<>]+$/.test(appUrl)) {
  fail(
    `Link trong webos-meta/tv-app-url.txt không hợp lệ: "${appUrl}"\n` +
      '        Link phải bắt đầu bằng https:// và không chứa dấu cách hay dấu nháy.'
  );
}

// Bỏ dấu "/" thừa ở cuối cho gọn (https://abc.vercel.app/ → https://abc.vercel.app).
const cleanUrl = appUrl.replace(/\/+$/, '');

// --- 2. Dọn & tạo lại thư mục đầu ra -------------------------------------------------
// Xoá sạch rồi tạo mới, để không còn sót file cũ từ lần đóng gói trước (trước đây từng
// có lỗi TV chạy nhầm bản cũ vì file thừa còn sót lại).
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outIconsDir, { recursive: true });

// --- 3. appinfo.json + bộ icon -------------------------------------------------------
copyFileSync(appinfoSrc, join(outDir, 'appinfo.json'));

const iconFiles = readdirSync(iconsSrcDir).filter((f) => f.toLowerCase().endsWith('.png'));
if (iconFiles.length === 0) {
  fail('Thư mục public/webos/ không có file .png nào — cần icon.png, largeIcon.png, splash.png.');
}
iconFiles.forEach((f) => copyFileSync(join(iconsSrcDir, f), join(outIconsDir, f)));

// --- 4. Trang chuyển hướng -----------------------------------------------------------
const template = readFileSync(templateSrc, 'utf-8');
if (!template.includes('__YTUBE_APP_URL__')) {
  fail('File webos-meta/loader.template.html thiếu chỗ đánh dấu __YTUBE_APP_URL__ — file có vẻ đã bị sửa nhầm.');
}
// Dùng hàm thay vì chuỗi trong .replace() — nếu dùng chuỗi, các ký tự "$" nếu có trong
// link sẽ bị JavaScript hiểu nhầm thành ký hiệu đặc biệt và làm hỏng nội dung.
const html = template.replace('__YTUBE_APP_URL__', () => cleanUrl);
writeFileSync(join(outDir, 'index.html'), html, 'utf-8');

// --- 5. Xong -------------------------------------------------------------------------
const appVersion = JSON.parse(readFileSync(appinfoSrc, 'utf-8')).version;

console.log(`
[webos] Đã tạo xong thư mục dist-webos/ (app phiên bản ${appVersion}).
[webos] App trên TV sẽ mở: ${cleanUrl}
[webos] ${iconFiles.length} file icon + appinfo.json + trang chuyển hướng đã sẵn sàng.

Bước tiếp theo, chạy lần lượt:

  ares-package -n ./dist-webos
  ares-install --device <ten-TV> -r com.ytube.minacom
  ares-install --device <ten-TV> com.ytube.minacom_${appVersion}_all.ipk
  ares-launch  --device <ten-TV> com.ytube.minacom
`);
