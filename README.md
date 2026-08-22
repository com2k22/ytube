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

**E.2 — Tạo file `.ipk` để cài lên TV**

> **App trên TV hoạt động thế nào** (đọc 1 lần cho dễ hình dung): file `.ipk` cài lên TV
> KHÔNG chứa code app. Nó chỉ là 1 trang mỏng, nhiệm vụ duy nhất là mở link Vercel của
> bạn. Nghĩa là TV và điện thoại đều xem chung đúng 1 bản app trên Vercel.
>
> Cách này (LG gọi là "Hosted Web App") giải quyết dứt điểm 2 việc:
> - **Phát được video YouTube.** Từ cuối 2025, YouTube bắt buộc trang nhúng video phải
>   gửi kèm thông tin "trang này là ai" mới cho phát. Trình duyệt KHÔNG BAO GIỜ gửi thông
>   tin đó khi app được mở trực tiếp từ ổ đĩa TV — nên bản đóng gói kiểu cũ luôn báo
>   "Lỗi 153: Lỗi cấu hình trình phát video", không có cách nào sửa bằng code.
> - **Cập nhật cực nhanh về sau.** Sửa code xong chỉ cần deploy lại Vercel là TV tự có
>   bản mới — KHÔNG phải build, đóng gói, cài lại `.ipk` nữa. Chỉ phải làm lại Bước E này
>   khi đổi link Vercel hoặc đổi icon app.
>
> Đổi lại: TV phải có mạng Internet mới mở được app (vốn app này luôn cần mạng để xem
> YouTube và tải danh sách từ Supabase, nên thực tế không mất gì).

1. **Đảm bảo bản Vercel đang chạy và đã là bản mới nhất** (Bước D). Thử mở link Vercel
   trên điện thoại xem app hiện đúng chưa — TV sẽ mở đúng cái đó.
2. **Điền link Vercel vào file `webos-meta/tv-app-url.txt`** (chỉ làm 1 lần, trừ khi đổi
   link). Mở file đó bằng Notepad, thay **dòng đầu tiên** bằng link thật của bạn:
   ```
   https://ten-app-cua-ban.vercel.app
   ```
   (bắt đầu bằng `https://`, không có dấu `/` ở cuối; các dòng bắt đầu bằng `#` chỉ là
   ghi chú, cứ để nguyên).
3. **Tăng số phiên bản** trong file `webos-meta/appinfo.json` — tìm dòng `"version"`,
   tăng lên 1 nấc (ví dụ `1.0.3` → `1.0.4`). **Bắt buộc mỗi lần tạo lại `.ipk`**: TV có
   cơ chế nhớ bản cũ theo số phiên bản, không đổi số thì TV rất dễ chạy lại bản cũ dù đã
   cài đè bản mới.
4. Mở File Explorer, vào đúng thư mục chứa code (`C:\Users\PHONG\OneDrive\Viber coding\YTclone`).
   Click vào thanh địa chỉ trên cùng cửa sổ, xoá hết chữ, gõ `cmd` rồi bấm Enter — 1 cửa
   sổ đen (Command Prompt) mở ra, đã tự đứng đúng tại thư mục này.
5. Gõ lệnh sau, bấm Enter (chạy trong 1–2 giây):
   ```
   npm run build:webos
   ```
   Kết thúc phải thấy dòng báo `[webos] Đã tạo xong thư mục dist-webos/ ...` kèm đúng
   link Vercel của bạn. Nếu thấy chữ đỏ báo lỗi — đọc dòng chữ đó, thường là chưa điền
   link ở bước 2; sửa xong chạy lại.
6. Gõ lệnh đóng gói, bấm Enter:
   ```
   ares-package -n ./dist-webos
   ```
   (Cần đã làm xong **E.1** trước đó — nếu báo `'ares-package' is not recognized`, nghĩa
   là E.1 chưa cài xong, hoặc cần đóng cửa sổ Command Prompt cũ và mở cửa sổ mới.)
7. Xong sẽ có 1 file mới nằm ngay trong thư mục `YTclone` (cùng cấp với `package.json`),
   tên dạng `com.ytube.minacom_1.0.3_all.ipk` — đây là file sẽ cài lên TV ở Bước E.5.

Lưu ý: file `.env` **không còn liên quan** tới bước đóng gói TV nữa (các key chỉ cần khai
báo bên Vercel, xem Bước D) — vì code app giờ chạy hoàn toàn từ Vercel.

(3 file icon đã có sẵn ở `public/webos/icon.png` / `largeIcon.png` / `splash.png`,
dùng logo Ytube mặc định. Muốn đổi logo riêng: thay 3 file này — đúng kích thước
80×80px / 130×130px / 1920×1080px, định dạng PNG — rồi làm lại bước 3–7.)

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
ares-install --device <tên-TV-đã-đặt-ở-E.4> -r com.ytube.minacom
ares-install --device <tên-TV-đã-đặt-ở-E.4> com.ytube.minacom_1.0.3_all.ipk
ares-launch --device <tên-TV-đã-đặt-ở-E.4> com.ytube.minacom
```

(Dòng đầu có `-r` = gỡ sạch bản cũ trước khi cài bản mới — làm vậy cho chắc, tránh TV
chạy lại bản cũ còn nhớ trong máy. Lần cài đầu tiên chưa có gì để gỡ thì dòng này sẽ báo
lỗi nhẹ, cứ bỏ qua và chạy tiếp 2 dòng sau.)

App Ytube mở ngay trên TV, và cũng xuất hiện sẵn trong menu Launcher của TV như 1 app
bình thường — lần sau bé bấm vào icon là mở, không cần máy tính nữa.

**Cập nhật app sau này — việc nhẹ hẳn:**

- **Sửa code app (99% các lần)**: chỉ cần đẩy code lên GitHub và để Vercel deploy lại
  (Bước D). TV tự có bản mới ở lần mở app kế tiếp. **KHÔNG cần build, đóng gói hay cài
  lại `.ipk`.** Nếu TV vẫn hiện bản cũ: thoát hẳn app rồi mở lại; cùng lắm tắt/bật lại TV.
- **Chỉ khi đổi link Vercel, đổi icon, hoặc đổi tên app**: mới phải làm lại Bước E.2 và
  E.5. Nhớ tăng số `"version"` trong `webos-meta/appinfo.json` trước khi tạo `.ipk` mới —
  TV nhớ bản cũ theo số phiên bản, không đổi số thì rất dễ chạy lại bản cũ.

**Vài lỗi hay gặp:**
- **Video không phát, báo "Lỗi 153 — Lỗi cấu hình trình phát video"**: app đang chạy kiểu
  đóng gói cũ (mở trực tiếp từ ổ đĩa TV) chứ không phải kiểu hosted. Kiểm tra
  `webos-meta/tv-app-url.txt` đã điền đúng link Vercel chưa, rồi làm lại E.2 + E.5.
- `ares-package ERR! [Tips]: Failed to minify code...`: quên cờ `-n` — chạy lại đúng
  `ares-package -n ./dist-webos` (xem bước E.2.6).
- `ares-setup-device` hoặc `ares-install` bị treo/timeout: kiểm tra TV và máy tính có
  đang chung 1 Wi-Fi không; thử tắt tạm Windows Firewall nếu vẫn không được.
- `ares-package` báo lỗi icon: kiểm tra `icon.png` đúng 80×80px, `largeIcon.png` đúng
  130×130px, cả 2 đều định dạng PNG.
- IP của TV tự đổi (Wi-Fi cấp IP động): chạy lại `ares-setup-device` để cập nhật IP
  mới, hoặc vào router đặt IP tĩnh (DHCP reservation) cho TV.
- **App kẹt ở màn hình "Đang mở Ytube" hoặc báo "Không kết nối được mạng"**: TV đang
  không vào được Internet, hoặc link trong `webos-meta/tv-app-url.txt` sai. Thử mở link
  đó trên điện thoại xem có ra app không.
- **Bấm icon app thì hiện màn hình trắng trơn**: gần như chắc chắn TV đang chạy bản `.ipk`
  CŨ (kiểu đóng gói cũ, mở từ ổ đĩa) chứ không phải bản hosted. Gỡ hẳn app
  (`ares-install --device <tên-TV> -r com.ytube.minacom`), tăng `"version"` trong
  `webos-meta/appinfo.json`, làm lại E.2 + E.5, rồi tắt/bật lại TV 1 lần.

> 📌 **Ghi chú kỹ thuật (không cần đọc nếu app đang chạy tốt)** — vì sao bỏ kiểu đóng gói
> cũ: khi mở app trực tiếp từ ổ đĩa qua `file://`, có 2 rào cản của chính trình duyệt,
> không sửa được bằng code — (1) trình duyệt chặn tải file JS khai báo kiểu "module", âm
> thầm không báo lỗi; (2) trình duyệt không gửi thông tin nhận diện trang cho YouTube nên
> YouTube từ chối phát, báo lỗi 153. Chuyển sang kiểu hosted (app chạy qua `https://` thật)
> làm cả 2 rào cản này biến mất cùng lúc. File `webos-meta/index.template.html` là tàn dư
> của cách làm cũ, hiện không còn được dùng — cứ để đó cũng không sao.

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
- **Lọc bỏ video ngắn (YouTube Shorts)**: app tự loại mọi video dài **từ 60 giây trở
  xuống** khỏi mọi playlist/kênh, và bỏ qua luôn các playlist do chủ kênh đặt tên
  "Shorts". YouTube KHÔNG cung cấp dấu hiệu nào để biết chắc "đây là Short", nên độ dài
  là cách nhận biết đáng tin cậy nhất app tự làm được. Cố ý không nâng ngưỡng lên 3 phút
  (dù Short nay có thể dài tới vậy) vì rất nhiều bài hát/truyện thiếu nhi bình thường chỉ
  dài 1–3 phút, nâng lên sẽ xoá oan gần hết nội dung tử tế. Nếu vẫn thấy lọt Short: mở
  `src/lib/youtube.ts`, sửa số ở dòng `const SHORT_MAX_SECONDS = 60;` rồi deploy lại.
- **Phụ đề (CC) mặc định TẮT**: YouTube chỉ có tham số ép BẬT phụ đề, không có tham số nào
  ép tắt — nên app phải gỡ hẳn bộ phụ đề ra khỏi trình phát bằng tay (2 lần: lúc trình phát
  sẵn sàng và lúc video bắt đầu chạy). Cách này có tác dụng thật nhưng không nằm trong tài
  liệu chính thức của YouTube, nên nếu một bản cập nhật nào đó của YouTube làm nó thôi tác
  dụng thì phụ đề có thể hiện lại. Riêng chữ ĐỐT SẴN vào hình ảnh video thì không thể tắt.
- **Giao diện của mỗi bé được lưu riêng trong Supabase** (cột `theme_preference` bảng
  `profiles`), nên sửa code không đổi được giao diện mặc định. Muốn cả 2 bé về giao diện
  tối: chạy file `supabase/005_default_theme_dark.sql` trong SQL Editor của Supabase —
  hoặc đơn giản hơn, trên TV bấm nút 🎨 Giao diện ở cuối menu trái (app tự lưu lại), nhớ
  làm cho cả Mina lẫn Cốm.

## 5. Cấu trúc thư mục

Xem chi tiết trong tài liệu bạn đã duyệt ở Bước 2 của quá trình trao đổi — cấu trúc
thực tế trong code này bám sát 100% theo đó (`src/components`, `src/hooks`,
`src/context`, `src/pages`, `src/lib`, `src/utils`, `supabase/`).

## 6. Đóng gói lên TV LG (webOS)

Xem **Bước E** ở mục 3 phía trên — đóng gói ứng dụng thành file `.ipk` và cài thẳng
lên TV LG (webOS), mở lên là chạy full màn hình luôn, không cần trình duyệt.
