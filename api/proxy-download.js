/*
  /api/proxy-download — chạy TRÊN MÁY CHỦ (Vercel Edge Function).

  Nhiệm vụ: "trạm trung chuyển" CHUNG cho MỌI link phát trực tiếp KHÔNG PHẢI Google Drive
  (Dropbox, mp4/m3u8 tự host ở máy chủ khác...) — CÙNG Ý TƯỞNG với api/gdrive-file.js nhưng
  không cần đăng nhập tài khoản dịch vụ nào (link công khai, ai có link cũng xem được, không
  như Drive cần xác thực để tránh bị chặn "truy vấn tự động").

  VÌ SAO CẦN CÁI NÀY: tính năng "Tải xuống nghe offline" (xem src/lib/offlineCache.ts) phải
  đọc TRỌN VẸN bytes bằng fetch() để lưu vào Cache API của trình duyệt. Một số máy chủ lưu file
  bên ngoài (ví dụ dropboxusercontent.com) KHÔNG cho phép trang web KHÁC GỐC (CORS) đọc trọn vẹn
  theo cách đó — dù thẻ <video> vẫn phát trực tiếp bình thường (phát bằng thẻ <video> không bị
  luật CORS chặn, chỉ fetch() bằng tay mới bị). Đi qua ĐÚNG GỐC (origin) của app một lượt giải
  quyết dứt điểm, không cần dò/đoán từng máy chủ ngoài có bật CORS hay không — SAU NÂNG CẤP NÀY,
  MỌI link trực tiếp không phải Drive (kể cả khi KHÔNG tải offline, chỉ phát bình thường) đều đi
  qua trạm này (xem src/lib/directProxy.ts: resolvePlayableUrl() — dùng CHUNG 1 hàm cho cả lúc
  PHÁT lẫn lúc TẢI, để 2 URL luôn khớp nhau, xem chú thích đầy đủ ở đó).

  ⚠️ ĐÁNH ĐỔI BẢO MẬT ĐÃ CÂN NHẮC: về bản chất đây là 1 "proxy mở" — nhận bất kỳ ?url= nào rồi
  gọi hộ, KHÔNG giới hạn chỉ 1 danh sách máy chủ được duyệt trước (không thể giới hạn vậy mà vẫn
  giữ được tính linh hoạt "bố mẹ tự dán link bất kỳ lúc Thêm nội dung"). Có chặn sẵn các dải địa
  chỉ mạng NỘI BỘ (localhost/127.x/10.x/172.16-31.x/192.168.x/169.254.x — nơi thường chạy dịch
  vụ nội bộ không muốn lộ ra ngoài) làm lớp phòng vệ RẺ TIỀN, nhưng KHÔNG loại bỏ hoàn toàn rủi
  ro proxy mở — chấp nhận đánh đổi này vì đây là app dùng riêng trong 1 gia đình, cùng tinh thần
  thực dụng đã áp dụng cho các luật RLS mở của favorites/watch_progress.
*/

export const config = { runtime: 'edge' };

/** Chặn các dải địa chỉ mạng NỘI BỘ — xem ghi chú "đánh đổi bảo mật" ở trên. So khớp theo
    HOSTNAME thô (chưa phân giải DNS thật — Edge Function không có API tra DNS thủ công), nên
    đây là lớp phòng vệ CƠ BẢN, không phải tuyệt đối (VD 1 tên miền công khai trỏ ngầm vào IP
    nội bộ vẫn lọt qua) — chấp nhận được với quy mô sử dụng của app này. */
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
  return false;
}

export default async function handler(request) {
  try {
    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get('url');
    if (!target) return new Response('Thiếu tham số ?url=', { status: 400 });

    let parsedTarget;
    try {
      parsedTarget = new URL(target);
    } catch {
      return new Response('Link không hợp lệ', { status: 400 });
    }
    if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
      return new Response('Chỉ nhận link http/https', { status: 400 });
    }
    if (isBlockedHost(parsedTarget.hostname)) {
      return new Response('Không cho phép gọi tới địa chỉ mạng nội bộ', { status: 400 });
    }

    const upstreamHeaders = {};
    // Chuyển tiếp "Range" (tua tới/lui, hoặc đọc từng phần lúc tải offline) sang máy chủ gốc —
    // thiếu bước này thì tua video sẽ luôn phải tải lại từ đầu, rất chậm/giật.
    const range = request.headers.get('range');
    if (range) upstreamHeaders.Range = range;

    const upstream = await fetch(parsedTarget.toString(), { headers: upstreamHeaders });

    if (!upstream.ok && upstream.status !== 206) {
      return new Response(`Máy chủ nguồn từ chối (${upstream.status})`, { status: upstream.status });
    }

    const headers = new Headers();
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes');
    // private (không phải public/CDN chung) — nội dung whitelist riêng của từng gia đình, chỉ
    // nên cache trong đúng trình duyệt bé đang xem, không cache ở tầng chia sẻ nào khác.
    headers.set('cache-control', 'private, max-age=3600');

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    return new Response('Lỗi trạm trung chuyển: ' + (err && err.message ? err.message : String(err)), {
      status: 500,
    });
  }
}
