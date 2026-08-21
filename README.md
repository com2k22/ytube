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

Mở Command Prompt / Terminal tại thư mục này (`ytclone-app`), gõ lần lượt:

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
   đây là link chính thức, mở được trên iPad, PC, và TV LG (Bước 4 sẽ đóng gói riêng).

## 4. Giới hạn hiện tại (được chọn có chủ đích để giữ mọi thứ đơn giản, miễn phí)

- **Link kênh dạng `@tenkenh`**: YouTube Data API cần đổi `@handle` sang `channelId`
  (dạng `UC...`) mới tra được danh sách playlist. Nếu link bạn dán là dạng `@handle`,
  app sẽ báo cần đổi thủ công — cách nhanh nhất là dán link kênh vào
  https://commentpicker.com/youtube-channel-id.php để lấy `channelId`, rồi đổi link
  đã lưu trong whitelist sang dạng `https://www.youtube.com/channel/UC...`.
- **% đã xem của video YouTube**: được tính qua YouTube IFrame Player API (chính thức,
  chính xác theo thời gian thực đang phát), lưu định kỳ mỗi ~5 giây — đủ tốt cho tính
  năng "Tiếp tục xem", không phải để chấm điểm học tập chính xác tuyệt đối.
- **Playlist "mượn" từ 1 kênh đã whitelist**: không có "Tiếp tục xem" riêng (vì không
  nằm trong whitelist chính thức) — muốn có Tiếp tục xem, thêm hẳn playlist đó vào
  whitelist qua tab "Thêm nội dung".
- **PIN mặc định**: `1234` — đổi ngay sau khi triển khai thật bằng cách gọi hàm
  `set_parent_pin` (có thể làm qua SQL Editor tạm thời, hoặc nhờ bổ sung màn hình đổi
  PIN trong app nếu bạn cần — hiện chưa có UI đổi PIN, chỉ có backend sẵn sàng).

## 5. Cấu trúc thư mục

Xem chi tiết trong tài liệu bạn đã duyệt ở Bước 2 của quá trình trao đổi — cấu trúc
thực tế trong code này bám sát 100% theo đó (`src/components`, `src/hooks`,
`src/context`, `src/pages`, `src/lib`, `src/utils`, `supabase/`).

## 6. Bước tiếp theo

Bước 4 — đóng gói ứng dụng thành file `.ipk` để cài lên TV LG webOS — sẽ được hướng
dẫn riêng (đã có sẵn khung `webos-meta/appinfo.json` trong project này).
