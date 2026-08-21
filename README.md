# Ytube — cho Mina & Cốm

Đây là code thật của ứng dụng đã được bạn duyệt qua các bản demo. Tài liệu này viết cho
người **không phải lập trình viên**, làm theo từng bước là chạy được.

## 1. Những gì đã có trong code này

- Giao diện 2 theme: Dark TV và Chibi Cute (đổi được ngay trên app).
- Trang chủ: Tiếp tục xem / Playlist đề xuất / Kênh yêu thích, điều hướng bằng phím
  mũi tên kiểu Remote TV (`useTvNavigation`).
- Trình phát video an toàn (`SafeYouTubePlayer`) — không hiện gợi ý video ngoài whitelist.
- Phát cả link YouTube (playlist / video đơn lẻ / kênh) và link trực tiếp (mp4/m3u8).
- Khu vực "Bố mẹ" khoá bằng PIN (mặc định `1234`, đổi được), gồm:
  - Thêm/xoá nội dung whitelist, chọn "dành cho bé" nào.
  - Quản lý thời gian xem theo từng **nhóm ngày** riêng (khung giờ, tổng giờ/ngày, giờ/lượt).
  - Xem & điều khiển **phiên xem hiện tại của TV ngay từ thiết bị khác** (vd: iPad) —
    "kết thúc phiên ngay" hoặc "xem xong phiên rồi tắt" — nhờ Supabase Realtime.
  - Màn hình nhắc nhẹ nhàng (chữ + hình + âm thanh) khi bé mở app ngoài giờ được xem.

## 2. Cần chuẩn bị gì

- Máy tính đã cài **Node.js** (bản 18 trở lên) — tải tại https://nodejs.org (chọn bản LTS).
- Một tài khoản **Supabase** (miễn phí) — https://supabase.com
- (Khuyến khích) Một **YouTube Data API v3 key** (miễn phí, giới hạn 10.000 lượt gọi/ngày)
  để app đọc được danh sách video thật trong playlist/kênh — không có key này, phần
  hiển thị playlist/kênh sẽ không tải được video, nhưng phần link trực tiếp (mp4/m3u8)
  và video đơn lẻ vẫn hoạt động bình thường qua trình phát an toàn.

## 3. Cài đặt lần đầu (làm theo thứ tự)

### Bước A — Tạo project Supabase & chạy SQL

1. Vào https://supabase.com, tạo project mới (chọn khu vực gần Việt Nam, ví dụ Singapore).
2. Vào **SQL Editor > New query**, dán toàn bộ nội dung file `supabase/001_schema.sql`,
   bấm **Run**.
3. Làm tương tự với file `supabase/002_time_management.sql` (chạy SAU file 001).
4. Vào **Project Settings > API**, copy 2 giá trị: **Project URL** và **anon public key**.

### Bước B — (Khuyến khích) Lấy YouTube Data API key

1. Vào https://console.cloud.google.com, tạo project mới (hoặc dùng project có sẵn).
2. Vào **APIs & Services > Library**, tìm "YouTube Data API v3", bấm **Enable**.
3. Vào **APIs & Services > Credentials > Create Credentials > API key**.
4. Bấm vào key vừa tạo, ở mục **Application restrictions** chọn **Websites**, thêm domain
   Vercel của bạn sau khi deploy (Bước D) để tránh người khác dùng ké key của bạn.

### Bước C — Cấu hình & chạy thử trên máy tính

Mở Command Prompt / Terminal tại thư mục chứa code này (ví dụ `C:\Users\PHONG\OneDrive\Viber coding\YTclone`), gõ lần lượt:

```
npm install
copy .env.example .env        (Windows)   —  hoặc  cp .env.example .env  (Mac)
```

Mở file `.env` vừa tạo, điền `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Bước A),
và `VITE_YOUTUBE_API_KEY` (Bước B, có thể bỏ trống nếu chưa làm Bước B). Sau đó:

```
npm run dev
```

Mở trình duyệt vào địa chỉ hiện ra (thường là `http://localhost:5173`) — app sẽ chạy
đầy đủ, video YouTube phát được bình thường (khác với việc mở file HTML rời, vì giờ
đã chạy qua địa chỉ web thật).

### Bước D — Đưa code lên GitHub & Deploy Vercel (miễn phí)

1. Mở **GitHub Desktop**, chọn **File > Add Local Repository**, trỏ vào thư mục này.
2. Commit lần đầu, bấm **Publish repository** để đưa lên GitHub.
3. Vào https://vercel.com, đăng nhập bằng GitHub, bấm **Add New > Project**, chọn repo
   vừa tạo.
4. Ở bước cấu hình, vào **Environment Variables**, thêm 3 biến giống hệt trong file
   `.env` của bạn (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_YOUTUBE_API_KEY`).
5. Bấm **Deploy**. Sau vài phút, Vercel cho bạn 1 link `https://ten-app.vercel.app` —
   đây là link chính thức, mở được trên iPad, PC, và TV LG (Bước E bên dưới đóng gói
   thành app cài thẳng lên TV, không cần mở trình duyệt).

### Bước E — Đóng gói `.ipk` & cài lên TV LG (webOS)

Bước này biến app thành 1 icon cài thẳng trên TV LG (webOS), mở lên là chạy full màn
hình luôn, không cần mở trình duyệt hay gõ địa chỉ web mỗi lần.

**Cần chuẩn bị:**
- TV LG dùng hệ điều hành **webOS** (hầu hết TV thông minh LG từ khoảng 2014 trở đi).
- TV và máy tính đang dùng **chung 1 mạng Wi-Fi** (không phải mạng khách/guest riêng).
- 1 tài khoản **LG Developer** miễn phí — đăng ký bằng email tại https://developer.lge.com

**E.1 — Cài công cụ đóng gói (chỉ làm 1 lần)**

```
npm install -g @webos-tools/cli
```

**E.2 — Build & đóng gói app thành file `.ipk`**

1. Mở File Explorer, vào đúng thư mục chứa code (`C:\Users\PHONG\OneDrive\Viber coding\YTclone`).
2. Click vào thanh địa chỉ trên cùng cửa sổ File Explorer, xoá hết chữ, gõ `cmd` rồi
   bấm Enter — 1 cửa sổ đen (Command Prompt) mở ra, đã tự đứng đúng tại thư mục này.
3. **Kiểm tra file `.env` đã điền key thật chưa** (quan trọng!): app đóng gói lên TV
   cũng cần đúng 3 key giống bên Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_YOUTUBE_API_KEY`) — vì Vite "nướng" các key này ngay lúc build, không đọc
   được lúc app đang chạy. Mở file `.env` bằng Notepad, kiểm tra đã điền giá trị thật
   (giống Bước A, B) chưa — để trống thì app trên TV sẽ hiện banner đỏ báo lỗi.
   ⚠️ Nếu đây là lần đầu build lại sau khi nhận code mới (hoặc trước đó từng thấy lỗi
   "màn hình trắng" trên TV) — **bắt buộc chạy lại `npm install` trước** (gõ lệnh
   `npm install`, đợi xong) vì có thêm 1 công cụ mới cần cài. Bỏ qua bước này thì lệnh
   build ở dưới sẽ báo lỗi.
4. Gõ lệnh build, bấm Enter, đợi khoảng 10–30 giây:
   ```
   npm run build:webos
   ```
   Sẽ thấy chữ chạy dọc màn hình, kết thúc bằng dòng:
   ```
   [webos] Đã copy appinfo.json vào dist/ — giờ chạy: ares-package ./dist
   ```
   Nếu KHÔNG thấy dòng này mà thấy chữ đỏ "error" — dừng lại, chụp màn hình gửi lại,
   đừng làm tiếp bước 5.
5. Gõ lệnh đóng gói, bấm Enter:
   ```
   ares-package -n ./dist
   ```
   (Cần đã làm xong **E.1** trước đó — nếu báo `'ares-package' is not recognized`,
   nghĩa là E.1 chưa cài xong, hoặc cần đóng cửa sổ Command Prompt cũ, mở cửa sổ mới.
   Cờ `-n` = bỏ qua bước tự minify code của `ares-package` — **bắt buộc phải có**,
   vì code trong `dist/` đã được build tool nén sẵn, để `ares-package` nén lại lần
   nữa hay báo lỗi `Failed to minify code` dù code không hề sai.)
6. Chạy xong sẽ có 1 file mới nằm ngay trong thư mục `YTclone` (cùng cấp với
   `package.json`), tên dạng `com.ytube.minacom_1.0.0_all.ipk` — đây là file sẽ cài
   lên TV ở Bước E.5.

Muốn build lại sau này (khi sửa code): lặp lại đúng bước 4 và 5 ở trên — file `.ipk`
cũ sẽ bị ghi đè bằng bản mới.

(3 file icon đã có sẵn ở `public/webos/icon.png` / `largeIcon.png` / `splash.png`,
dùng logo Ytube mặc định. Muốn đổi logo riêng: thay 3 file này — đúng kích thước
80×80px / 130×130px / 1920×1080px, định dạng PNG — rồi build lại.)

**E.3 — Bật Developer Mode trên TV**

1. Trên TV: vào **LG Content Store**, tìm và cài app **"Developer Mode"**.
2. Mở app đó, đăng nhập bằng tài khoản LG Developer ở trên.
3. Bật công tắc **"Dev Mode Status"** — TV sẽ tự khởi động lại.
4. Sau khi khởi động lại xong, mở lại app "Developer Mode", ghi lại **địa chỉ IP** của
   TV hiện trong app (hoặc xem ở Cài đặt > Mạng > Wi-Fi của TV).

⚠️ **Developer Mode chỉ có hiệu lực 50 tiếng mỗi lần bật** — hết hạn TV tự khởi động lại
và **xoá app đã cài qua đường này**. Trước khi hết hạn, mở lại app "Developer Mode" trên
TV, bấm **"Extend"** để gia hạn — gia hạn được vô hạn lần, miễn bấm trước khi hết giờ.

**E.4 — Kết nối máy tính với TV**

```
ares-setup-device
```

Làm theo hướng dẫn: đặt tên cho TV (vd `tv-phong-khach`), nhập IP TV (bước E.3), cổng
`9922`, tài khoản `prisoner` (để trống mật khẩu). Sau đó quay lại app "Developer Mode"
trên TV, bấm **"Key Server"** — 1 mã 6 ký tự hiện lên, gõ mã đó vào máy tính khi được
hỏi để hoàn tất kết nối. (Mã chỉ có hiệu lực khoảng 1-2 phút — chậm tay thì bấm lại
"Key Server" lấy mã mới.)

**E.5 — Cài & mở app trên TV**

```
ares-install --device <tên-TV-đã-đặt-ở-E.4> com.ytube.minacom_1.0.1_all.ipk
ares-launch --device <tên-TV-đã-đặt-ở-E.4> com.ytube.minacom
```

App Ytube mở ngay trên TV, và cũng xuất hiện sẵn trong menu Launcher của TV như 1 app
bình thường — lần sau bé bấm vào icon là mở, không cần máy tính nữa.

**Cập nhật app sau này — QUAN TRỌNG, phải làm đúng thứ tự để tránh TV chạy nhầm bản
cũ đã cache**:
1. Mở `webos-meta/appinfo.json`, tăng số ở dòng `"version"` lên 1 nấc (vd `1.0.1` →
   `1.0.2`) — **bắt buộc mỗi lần cập nhật**, kể cả khi chỉ sửa vài dòng nhỏ. TV LG webOS
   có cơ chế cache nội bộ theo app id + version; nếu version không đổi, có trường hợp
   TV vẫn hiển thị bản CŨ dù đã `ares-install` đè file mới lên đĩa — nhìn bên ngoài y
   hệt lỗi cũ dù code đã sửa xong, rất dễ gây nhầm tưởng "sửa không có tác dụng".
2. Gỡ bản cũ trên TV trước khi cài bản mới, để chắc chắn không còn cache:
   ```
   ares-install --device <tên-TV> -r com.ytube.minacom
   ```
3. Lặp lại E.2 (build) rồi E.5 (cài + mở) với file `.ipk` có số version mới.
4. Nếu vẫn nghi ngờ TV đang chạy bản cũ: tắt hẳn TV (rút điện hoặc giữ nút nguồn) rồi
   bật lại, để xoá luôn cache đang chạy trong bộ nhớ của WebAppManager trên TV.

**Vài lỗi hay gặp:**
- `ares-package ERR! [Tips]: Failed to minify code...`: quên cờ `-n` — chạy lại đúng
  `ares-package -n ./dist` (xem bước E.2.5).
- `ares-setup-device` hoặc `ares-install` bị treo/timeout: kiểm tra TV và máy tính có
  đang chung 1 Wi-Fi không; thử tắt tạm Windows Firewall nếu vẫn không được.
- `ares-package` báo lỗi icon: kiểm tra `icon.png` đúng 80×80px, `largeIcon.png` đúng
  130×130px, cả 2 đều định dạng PNG.
- IP của TV tự đổi (Wi-Fi cấp IP động): chạy lại `ares-setup-device` để cập nhật IP
  mới, hoặc vào router đặt IP tĩnh (DHCP reservation) cho TV.
- **Cài xong, bấm vào icon app thì hiện màn hình trắng trơn (không lỗi gì)**: có 2
  nguyên nhân đã gặp, kiểm tra theo đúng thứ tự sau:
  1. **App trên TV đang chạy bản CŨ do cache, không phải bản vừa cài** (nguyên nhân
     hay gặp nhất nếu đã làm đúng bước build). Luôn tăng `"version"` trong
     `webos-meta/appinfo.json` mỗi lần cập nhật, gỡ app cũ bằng
     `ares-install --device <tên-TV> -r com.ytube.minacom` trước khi cài bản mới, và
     nếu vẫn nghi ngờ thì tắt/bật lại TV hẳn 1 lần — xem chi tiết ở mục "Cập nhật app
     sau này" phía trên.
  2. **Lỗi tải module qua `file://`**: khi mở app trực tiếp từ ổ đĩa qua đường dẫn
     `file://...`, trình duyệt luôn CHẶN việc tải các file JS khai báo kiểu "module"
     (`<script type="module" src="...">`) — chặn ngay ở tầng trình duyệt, không phải
     lỗi code, và thường không hiện gì trong Console. Code trong thư mục này đã xử lý
     dứt điểm bằng `scripts/prepare-webos.js`: build xong, script này tự đọc file
     JS/CSS thật từ `dist/assets/` rồi ghép thẳng vào 1 khung HTML viết tay
     (`webos-meta/index.template.html`), ghi đè `dist/index.html` — không còn file
     JS/CSS rời, không còn phụ thuộc hành vi ẩn của Vite/plugin nào. Chỉ cần
     `npm run build:webos` (không cần `npm install` gì thêm nếu chỉ lấy code từ đây,
     trừ lần đầu setup máy mới).

### Bước F — Cài lên iPad/iPhone/Android như 1 app (PWA)

Không cần công cụ hay build gì thêm — app đã hỗ trợ sẵn "Thêm vào Màn hình chính"
(PWA), mở lên full màn hình như app thật, không có thanh địa chỉ Safari/Chrome.

**Trên iPad/iPhone:**
1. Mở Safari, vào link Vercel của bạn (`https://ten-app.vercel.app`).
2. Bấm nút **Chia sẻ** (hình vuông có mũi tên đi lên) ở thanh công cụ.
3. Chọn **"Thêm vào MH chính"** (Add to Home Screen).
4. Icon Ytube xuất hiện ở màn hình chính — bấm vào mở full màn hình như app thật.

**Trên điện thoại/máy tính bảng Android:** mở Chrome vào link Vercel, Chrome sẽ tự
gợi ý "Thêm Ytube vào màn hình chính" (hoặc vào menu ⋮ > "Cài đặt ứng dụng").

Cách này không cần cài thêm gì, không có "giới hạn 50 tiếng" hay bước đóng gói nào
cả — mỗi lần bạn cập nhật code, chỉ cần deploy lại trên Vercel, mở lại app trên
iPad là thấy bản mới ngay (không cần cài lại).

## 4. Giới hạn hiện tại (được chọn có chủ đích để giữ mọi thứ đơn giản, miễn phí)

- **PIN mặc định**: `1234` — vào tab "🔑 Đổi PIN" trong khu Bố mẹ để đổi ngay sau khi
  triển khai thật.
- **% đã xem của video YouTube**: được tính qua YouTube IFrame Player API (chính thức,
  chính xác theo thời gian thực đang phát), lưu định kỳ mỗi ~5 giây — đủ tốt cho tính
  năng "Tiếp tục xem", không phải để chấm điểm học tập chính xác tuyệt đối.
- **Playlist "mượn" từ 1 kênh đã whitelist**: không có "Tiếp tục xem" riêng (vì không
  nằm trong whitelist chính thức) — muốn có Tiếp tục xem, thêm hẳn playlist đó vào
  whitelist qua tab "Thêm nội dung".

## 5. Cấu trúc thư mục

Xem chi tiết trong tài liệu bạn đã duyệt ở Bước 2 của quá trình trao đổi — cấu trúc
thực tế trong code này bám sát 100% theo đó (`src/components`, `src/hooks`,
`src/context`, `src/pages`, `src/lib`, `src/utils`, `supabase/`).

## 6. Đóng gói lên TV LG (webOS)

Xem **Bước E** ở mục 3 phía trên — đóng gói ứng dụng thành file `.ipk` và cài thẳng
lên TV LG (webOS), mở lên là chạy full màn hình luôn, không cần trình duyệt.
