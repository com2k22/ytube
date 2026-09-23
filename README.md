# Ytube — cho Mina & Cốm

Đây là code thật của ứng dụng đã được bạn duyệt qua các bản demo. Tài liệu này viết cho
người **không phải lập trình viên**, làm theo từng bước là chạy được.

**Phiên bản hiện tại: v1.1.0** — xem mục "Có gì mới ở v1.1.0" ngay dưới đây, và mục
**9. Lịch sử phiên bản** ở cuối tài liệu cho các bản trước.

## Có gì mới ở v1.1.0

- **"Bé thích" phân biệt ĐÚNG TỪNG TẬP trong playlist.** Trước đây bấm tim 1 tập trong
  playlist sẽ đánh dấu "thích" luôn cho CẢ playlist (mọi tập dùng chung 1 trạng thái).
  Giờ mỗi tập có trạng thái thích riêng, bấm tim ngay trong trình phát (không còn nút tim
  trên thẻ playlist/video ở Trang chủ/Khám phá nữa) — khối "Bé thích" ở Trang chủ hiện
  đúng từng video/audio đã bấm tim, kể cả khi chúng nằm trong cùng 1 playlist.
  ⚠️ Cần chạy thêm `supabase/022_favorites_video_ref.sql` trong SQL Editor (chạy sau file
  `021_favorites.sql`) — xem mục 3, Bước A.
- **Tải xuống nghe offline (Google Drive/Dropbox/link trực tiếp).** Nút "Tải xuống" mới
  nằm ngay trong trình phát điện thoại (cạnh nút tim) — tải xong thì phát lại được cả khi
  không có mạng. Tab "Tải xuống" đổi vai trò: từ 1 trang rỗng thành nơi quản lý/xem lại
  các mục đã tải, xoá từng mục, xem ước lượng dung lượng đang dùng. Tải được ở **bất kỳ
  mạng nào** (không giới hạn chỉ Wi-Fi). Không áp dụng cho video YouTube (không có hạ tầng
  tải hợp lệ) — chỉ áp dụng cho nội dung Google Drive/Dropbox/link trực tiếp.
  - Thay đổi kỹ thuật đi kèm: mọi link phát trực tiếp (không riêng Google Drive như trước)
    giờ đi qua 1 "trạm trung chuyển" riêng của app (`/api/proxy-download`, cùng nguyên lý
    với trạm Google Drive đã có) — cần thiết để đọc trọn vẹn bytes lưu offline, không đổi
    trải nghiệm xem bình thường.
- **Sửa lỗi "kẹt ở Đang tải" khi mở 1 tập Google Drive/Dropbox nằm trong playlist tự tạo**
  (từ khối "Bé thích", "Tiếp tục xem", nút "video tiếp theo", hoặc danh sách trong trình
  phát) — trước đây app nhầm những tập đó thành video YouTube (đọc sai loại link) nên trình
  phát đứng mãi ở "Đang tải", không bao giờ phát được. Phát bình thường (mở lần đầu từ
  trang chi tiết playlist) không bị ảnh hưởng, chỉ các đường vào "gián tiếp" kể trên bị lỗi.
- **Tối ưu hiệu năng đáng kể khi phát nội dung Google Drive/Dropbox**: trước đây MỖI GIÂY
  phát 1 video/audio loại này gửi tới hàng chục yêu cầu mạng lên Supabase một cách vô ích
  (báo tiến độ xem không được giới hạn nhịp độ) — giờ chỉ báo mỗi 5 giây thật, giống hệt
  video YouTube, giảm mạnh dữ liệu di động tiêu tốn và tải cho Supabase. Bỏ luôn 1 lượt tải
  lại thừa (đọc lại toàn bộ tiến độ xem) sau mỗi lần lưu.

## 1. Những gì đã có trong code này

- **Giao diện riêng cho điện thoại** (Trang chủ / Khám phá / Tải xuống / Khu Bố mẹ), và
  giao diện TV/iPad/máy tính điều hướng bằng phím mũi tên kiểu Remote TV
  (`useTvNavigation`) — cùng 1 app, tự nhận diện thiết bị để hiện đúng giao diện.
- 2 theme: Dark TV và Chibi Cute (đổi được ngay trên app, lưu riêng theo từng bé).
- Trang chủ: Tiếp tục xem / Bé thích / Playlist đề xuất / Kênh yêu thích.
- Trình phát video an toàn (`SafeYouTubePlayer`) — không hiện gợi ý video ngoài whitelist.
- Phát cả link YouTube (playlist / video đơn lẻ / kênh) và link trực tiếp (mp4/m3u8,
  Google Drive, Dropbox) — kể cả playlist tự tạo TRỘN LẪN video YouTube và tập Drive.
- **"Bé thích"**: bé tự bấm tim ngay trong trình phát, phân biệt đúng từng tập trong
  playlist (xem "Có gì mới ở v1.1.0").
- **Tải xuống nghe offline** cho nội dung Google Drive/Dropbox/link trực tiếp (xem "Có gì
  mới ở v1.1.0").
- Thông báo đẩy (push notification) khi có sự kiện cần bố mẹ chú ý.
- Ghép nhiều thiết bị vào cùng 1 gia đình (mã ghép cặp), quản lý thiết bị đã ghép.
- Khu vực "Bố mẹ" khoá bằng PIN (mặc định `1234`, đổi được), gồm:
  - Thêm/xoá nội dung whitelist, chọn "dành cho bé" nào, gán nhãn (Ưu tiên/Ẩn/Chỉ điện
    thoại/Chỉ TV-máy tính).
  - Chặn riêng lẻ 1 video/playlist "lạc nguồn" trong 1 kênh đã whitelist mà không cần
    chặn hẳn cả kênh.
  - Quản lý thời gian xem theo từng **nhóm ngày** riêng (khung giờ, tổng giờ/ngày, giờ/lượt).
  - Xem & điều khiển **phiên xem hiện tại của TV ngay từ thiết bị khác** (vd: iPad) —
    "kết thúc phiên ngay" hoặc "xem xong phiên rồi tắt" — nhờ Supabase Realtime.
  - Duyệt/từ chối lời xin thêm giờ của bé.
  - Báo cáo tuần (thời lượng xem theo ngày/nội dung).
  - Sao lưu/xuất dữ liệu whitelist.
  - Màn hình nhắc nhẹ nhàng (chữ + hình + âm thanh) khi bé mở app ngoài giờ được xem.

## 2. Cần chuẩn bị gì

- Máy tính đã cài **Node.js** (bản 18 trở lên) — tải tại https://nodejs.org (chọn bản LTS).
- Một tài khoản **Supabase** (miễn phí) — https://supabase.com
- (Khuyến khích) Một **YouTube Data API v3 key** (miễn phí, giới hạn 10.000 lượt gọi/ngày)
  để app đọc được danh sách video thật trong playlist/kênh — không có key này, phần
  hiển thị playlist/kênh sẽ không tải được video, nhưng phần link trực tiếp (mp4/m3u8)
  và video đơn lẻ vẫn hoạt động bình thường qua trình phát an toàn.
- (Cho tính năng phát Google Drive/Dropbox) Xem biến `GDRIVE_SERVICE_ACCOUNT_JSON` trong
  file `.env.example` — cần 1 "tài khoản dịch vụ" (service account) của Google Cloud để
  app phát nội dung Google Drive ổn định, không bị Google tạm chặn.

## 3. Cài đặt lần đầu (làm theo thứ tự)

### Bước A — Tạo project Supabase & chạy SQL

1. Vào https://supabase.com, tạo project mới (chọn khu vực gần Việt Nam, ví dụ Singapore).
2. Vào **SQL Editor > New query**, dán toàn bộ nội dung file `supabase/001_schema.sql`,
   bấm **Run**.
3. Làm tương tự, LẦN LƯỢT theo đúng số thứ tự, với TẤT CẢ các file còn lại trong thư mục
   `supabase/` (002, 003, ... cho tới file có số lớn nhất hiện có, ví dụ
   `022_favorites_video_ref.sql`) — mỗi file dán vào 1 ô **New query** riêng rồi **Run**.
   Chạy ĐÚNG THỨ TỰ SỐ, không chạy tắt/bỏ file nào, kể cả khi cài đặt lần đầu (không phải
   nâng cấp) — nhiều file sau chỉnh sửa/mở rộng bảng do file trước tạo ra.
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
4. Ở bước cấu hình, vào **Environment Variables**, thêm các biến giống hệt trong file
   `.env`/`.env.example` của bạn — tối thiểu `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_YOUTUBE_API_KEY`, và (nếu dùng Google Drive) `GDRIVE_SERVICE_ACCOUNT_JSON`.
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

### Bước G — Đóng gói `.apk` dùng CHUNG cho điện thoại Android & Android TV

Bước F ở trên (PWA) đã đủ dùng cho hầu hết trường hợp trên điện thoại/máy tính bảng —
chỉ làm Bước G này nếu muốn có hẳn 1 file `.apk` để cài như app thật (vd: TV Android
không hỗ trợ kiểu "Thêm vào màn hình chính" như điện thoại).

Nguyên lý giống HỆT Bước E (webOS): file `.apk` chỉ là 1 lớp vỏ mỏng mở link Vercel
qua `https://`, KHÔNG nhúng code app vào trong — nhờ vậy video YouTube phát bình
thường (không bị lỗi kiểu "Lỗi 153" như cách đóng gói cũ), và mỗi lần sửa code chỉ
cần deploy lại Vercel là điện thoại/TV tự có bản mới, KHÔNG cần đóng gói `.apk` lại.

**G.1 — Tạo file `.apk` bằng PWABuilder (miễn phí, làm ngay trên trình duyệt máy tính,
không cần cài phần mềm gì)**

1. Vào https://www.pwabuilder.com bằng trình duyệt máy tính.
2. Dán link Vercel của bạn vào ô tìm kiếm, bấm **Start**.
3. Đợi vài giây — PWABuilder tự kiểm tra 3 mục (Manifest / Service Worker / HTTPS).
   App này đã có sẵn cả 3 (đã chuẩn bị từ Bước F) nên thường thấy dấu ✅ hết, không
   cần sửa gì thêm.
4. Bấm **Package For Stores** → chọn thẻ **Android**.
5. Điền các mục hiện ra:
   - **Package ID**: gõ `com.ytube.minacom` (giống tên app webOS cho đồng bộ, không
     bắt buộc phải trùng).
   - **App name**: để mặc định "Ytube" (tự lấy từ manifest có sẵn).
   - **Signing key**: chọn **"Create new"** để PWABuilder tự tạo giúp. Bấm tải file
     khoá đó về máy và **CẤT KỸ, đừng làm mất** — lần sau muốn cập nhật icon/tên app
     (đóng gói `.apk` mới) mà không có đúng file khoá này thì máy sẽ coi là 1 app
     hoàn toàn khác, không cài đè lên bản cũ được, phải gỡ bản cũ đi cài lại từ đầu.
   - **Fallback Behavior**: chọn **"Web View"** (KHÔNG chọn "Custom Tabs"). Đây là
     lựa chọn quan trọng nhất — giúp app tự mang theo trình duyệt riêng bên trong,
     chạy được cả trên Android TV (phần lớn TV Android KHÔNG có sẵn trình duyệt
     Chrome cài riêng như điện thoại, chọn "Custom Tabs" sẽ không mở được trên TV).
6. Bấm **Generate** → tải về 1 file `.zip`.
7. Giải nén ra, tìm file đuôi `.apk` bên trong (thường nằm trong thư mục dạng
   `app-release-signed`) — đây chính là file sẽ cài lên điện thoại và TV.

**G.2 — Cài lên điện thoại Android**

1. Chuyển file `.apk` vào điện thoại (gửi qua Zalo/Email cho chính mình, dây cáp,
   hoặc Google Drive rồi tải về trên điện thoại).
2. Mở file đó trên điện thoại — nếu máy hỏi "Cho phép cài từ nguồn này", bấm
   Cho phép/Cài đặt.
3. Xong sẽ có icon Ytube trên màn hình điện thoại — bấm vào mở full màn hình y như
   app thật, tự khoá thẳng vào Khu vực Bố mẹ giống hệt bên iPhone.

**G.3 — Cài lên Android TV**

Android TV không có cách "mở file cài" dễ như điện thoại, chọn 1 trong 2 cách:

*Cách A — dễ nhất, không cần máy tính:*
1. Trên Android TV, vào kho ứng dụng (Play Store/CH Play), tìm và cài app miễn phí
   **"Downloader"** (biểu tượng màu vàng, của AFTVnews) — TV Android/Google TV nào
   cũng có sẵn trên kho.
2. Tải file `.apk` lên Google Drive, bấm chia sẻ để lấy link tải trực tiếp (hoặc bất
   kỳ dịch vụ chia sẻ file nào có link tải thẳng).
3. Mở app "Downloader" trên TV, gõ đúng link đó vào ô, bấm tải — Downloader tự hỏi
   "Cài đặt", bấm Cài đặt là xong.

*Cách B — dùng máy tính, giống hệt cách cài webOS bằng lệnh (`adb` thay cho `ares`):*
1. Trên TV: vào **Cài đặt > Giới thiệu** (About), bấm liên tục vào **"Số bản dựng"**
   (Build number) vài lần để mở **Tuỳ chọn nhà phát triển**, vào đó bật
   **"Gỡ lỗi USB qua mạng"** (Network debugging) — TV hiện ra 1 địa chỉ IP.
2. Trên máy tính, tải **"Android SDK Platform Tools"** (tìm trên Google, có bản
   Windows), giải nén ra 1 thư mục.
3. Mở Command Prompt tại đúng thư mục đó, gõ:
   ```
   adb connect <IP-của-TV>:5555
   adb install duong-dan-toi-file.apk
   ```

Lưu ý: vì đây là app đóng gói kiểu điện thoại, TV có thể KHÔNG hiện icon ở hàng
Launcher chính — mở mục **"Ứng dụng đã cài"** (Apps) trong Cài đặt TV để tìm và mở
lần đầu.

**Cập nhật app sau này**: giống hệt webOS — sửa code chỉ cần deploy lại Vercel,
KHÔNG cần đóng gói `.apk` lại. Chỉ khi đổi icon/tên app mới cần làm lại G.1 (nhớ
dùng ĐÚNG file signing key cũ để cài đè được lên bản đang có).

**Vài lỗi hay gặp:**
- **"App not installed" khi cài trên điện thoại**: máy có thể đã có 1 bản Ytube
  khác cài từ trước với chữ ký khác nhau — gỡ bản cũ rồi cài lại.
- **Mở app thấy toàn màn hình trắng**: TV/điện thoại không có mạng, hoặc link Vercel
  chưa đúng — thử mở đúng link đó bằng trình duyệt xem có ra app không.
- **Cài xong trên Android TV mà không thấy icon đâu**: mở **"Ứng dụng đã cài"**
  trong Cài đặt TV để tìm — kiểu cài này thường không tự lên hàng Launcher chính.

## 4. Giới hạn hiện tại (được chọn có chủ đích để giữ mọi thứ đơn giản, miễn phí)

- **PIN mặc định**: `1234` — vào tab "🔑 Đổi PIN" trong khu Bố mẹ để đổi ngay sau khi
  triển khai thật.
- **% đã xem** (YouTube lẫn Google Drive/Dropbox/link trực tiếp): lưu định kỳ mỗi
  **~5 giây thật** trong lúc đang phát (từ v1.1.0, cả 2 loại nội dung cùng nhịp báo, xem
  "Có gì mới ở v1.1.0") — đủ tốt cho tính năng "Tiếp tục xem", không phải để chấm điểm
  học tập chính xác tuyệt đối.
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
- **Quản lý thời gian dùng CHUNG cho cả 2 bé**: một bộ khung giờ + hạn mức phút/ngày áp
  dụng cho cả Mina và Cốm (Mina xem 30 phút rồi thì Cốm chỉ còn phần còn lại). Muốn chuyển
  dữ liệu cũ (mỗi bé một bộ riêng) sang kiểu này, chạy `supabase/006_shared_time_rules.sql`
  trong SQL Editor của Supabase — ⚠️ file đó có xoá cấu hình riêng của bé thứ hai, giữ lại
  cấu hình của Mina làm bộ chung.
- **Số phút đã xem trong ngày là ƯỚC LƯỢNG**: tính bằng cách cộng thời gian của các phiên
  xem trong ngày (bảng `watch_sessions`), bám theo % đã xem của trình phát và cập nhật mỗi
  ~5 giây. Đủ chính xác để giới hạn giờ xem của bé, không phải để tính từng giây.
- **"Bố mẹ cho xem ngay"**: nhập đúng PIN ở màn hình chặn là bỏ qua giới hạn giờ, nhưng
  CHỈ đến khi tắt app — mở lại là tự khoá theo cài đặt (lưu trong sessionStorage, loại bộ
  nhớ tự mất khi đóng app). Bố mẹ không cần nhớ đi khoá lại.
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
- **Tải xuống nghe offline là dữ liệu RIÊNG CỦA TỪNG THIẾT BỊ** (lưu trong bộ nhớ trình
  duyệt của máy đó — không đồng bộ qua Supabase, không chia theo từng bé): tải ở điện
  thoại nào thì chỉ xem offline được ở đúng điện thoại đó, giống cách Spotify/YouTube
  offline hoạt động. Xoá dữ liệu trình duyệt (hoặc gỡ cài app) sẽ mất luôn các mục đã tải,
  phải tải lại.
- **Trạm trung chuyển phát/tải link trực tiếp** (`/api/gdrive-file`, `/api/proxy-download`)
  về bản chất là 1 "proxy mở" — nhận link do bố mẹ tự thêm rồi gọi hộ, có chặn sẵn các dải
  địa chỉ mạng nội bộ (localhost/192.168.x...) làm lớp phòng vệ cơ bản, nhưng không loại
  bỏ hoàn toàn rủi ro proxy mở — chấp nhận đánh đổi này vì đây là app dùng riêng trong 1
  gia đình, không phải dịch vụ công khai.

## 5. Cấu trúc thư mục

Xem chi tiết trong tài liệu bạn đã duyệt ở Bước 2 của quá trình trao đổi — cấu trúc
thực tế trong code này bám sát 100% theo đó (`src/components`, `src/hooks`,
`src/context`, `src/pages`, `src/lib`, `src/utils`, `supabase/`, `api/`).

## 6. Đóng gói lên TV LG (webOS)

Xem **Bước E** ở mục 3 phía trên — đóng gói ứng dụng thành file `.ipk` và cài thẳng
lên TV LG (webOS), mở lên là chạy full màn hình luôn, không cần trình duyệt.

## 7. Lịch sử phiên bản

Đánh số phiên bản trong `package.json` (trường `"version"`) — không liên quan tới số
`"version"` riêng của `webos-meta/appinfo.json` (số đó chỉ TV LG dùng để biết có bản
`.ipk` mới, xem Bước E.2.3).

- **v1.1.0** (bản hiện tại) — "Bé thích" phân biệt từng tập trong playlist; Tải xuống
  nghe offline (Google Drive/Dropbox/link trực tiếp); sửa lỗi kẹt "Đang tải" khi mở 1 tập
  Drive/Dropbox trong playlist tự tạo qua Bé thích/Tiếp tục xem/danh sách trong trình
  phát; tối ưu hiệu năng phát Google Drive/Dropbox (giảm mạnh số yêu cầu mạng lên
  Supabase). Xem đầy đủ ở mục "Có gì mới ở v1.1.0" phía trên.
- **v1.0.x** — Bản nền: giao diện TV/iPad/máy tính + giao diện điện thoại riêng, trình
  phát an toàn (YouTube/link trực tiếp/Google Drive), khu vực Bố mẹ (PIN, quản lý thời
  gian xem theo nhóm ngày, điều khiển phiên xem từ xa, chặn nội dung riêng lẻ, nhãn nội
  dung, báo cáo tuần, sao lưu/xuất dữ liệu, thông báo đẩy, ghép nhiều thiết bị), đóng gói
  cài lên TV LG (webOS) và Android/Android TV, cài như PWA trên iPad/iPhone.
