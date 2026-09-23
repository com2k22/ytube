/*
  sw.js — "service worker": đoạn mã chạy NGẦM, kể cả khi app đã đóng hẳn.
  Đây là mảnh bắt buộc để điện thoại nhận được thông báo đẩy — không có file này thì
  iPhone/Android không bao giờ hiện thông báo, dù đã cấp quyền.

  ⚠️ CỐ Ý KHÔNG LƯU ĐỆM (cache) TRANG/APP.
  Service worker thường được dùng để lưu đệm trang cho chạy offline. Ở đây TUYỆT ĐỐI
  không làm vậy với TRANG/MÃ NGUỒN APP (HTML/JS/CSS), vì nó sinh ra đúng cái bẫy khó chịu
  nhất: deploy bản mới lên Vercel xong, mở app ra vẫn thấy bản CŨ, phải xoá dữ liệu trình
  duyệt mới hết. App này luôn cần bản mới nhất (nhất là bản chạy trên TV).

  NGOẠI LỆ DUY NHẤT (thêm cho tính năng "Tải xuống nghe offline" — xem
  src/lib/offlineCache.ts + src/lib/directProxy.ts): phục vụ lại đúng bytes ĐÃ ĐƯỢC APP CHỦ
  ĐỘNG TẢI VÀ GHI VÀO CACHE khi bé bấm nút "Tải xuống" trong trình phát, CHỈ cho ĐÚNG 2 đường
  dẫn media (/api/gdrive-file, /api/proxy-download) — KHÔNG đụng tới trang/JS/CSS/API nào
  khác, nên KHÔNG phá vỡ nguyên tắc "luôn thấy bản mới nhất" ở trên: mọi request khác (kể cả
  gọi tới chính 2 đường dẫn đó nhưng CHƯA từng tải offline) vẫn rơi thẳng ra mạng bình thường,
  y hệt như không có Service Worker này. Service Worker này KHÔNG TỰ Ý cache thêm bất cứ gì —
  chỉ ĐỌC LẠI cache do chính app ghi, xem downloadAndCache() trong offlineCache.ts.
*/

// PHẢI khớp NGUYÊN VĂN với OFFLINE_CACHE_NAME trong src/lib/offlineCache.ts — 2 nơi định
// nghĩa riêng vì Service Worker là 1 file JS cổ điển tách biệt hoàn toàn khỏi bundle Vite của
// app (không import chung module được). Đổi 1 bên mà quên đổi bên kia thì tính năng tải
// offline sẽ âm thầm hỏng (tải xong nhưng lúc mất mạng lại không tìm thấy trong cache).
const OFFLINE_CACHE_NAME = 'ytube-offline-v1';

// 2 tiền tố đường dẫn coi là "media có thể tải offline" — PHẢI khớp với resolvePlayableUrl
// trong src/lib/directProxy.ts (Google Drive qua /api/gdrive-file, link trực tiếp/Dropbox
// khác qua /api/proxy-download). Mọi request KHÁC (trang, Supabase, YouTube iframe, thông
// báo đẩy...) bỏ qua hoàn toàn ở dưới, để trình duyệt tự xử lý như không có SW nào can thiệp.
const OFFLINE_URL_PREFIXES = ['/api/gdrive-file', '/api/proxy-download'];

function isOfflineMediaRequest(url) {
  try {
    return OFFLINE_URL_PREFIXES.some((p) => new URL(url).pathname.startsWith(p));
  } catch {
    return false;
  }
}

/** Cắt đúng đoạn byte trình duyệt xin (header "Range", VD "bytes=1000-") từ 1 Response ĐẦY ĐỦ
    đã cache sẵn — cần để TUA (seek) trong video hoạt động đúng khi phát lại từ cache offline.
    Nếu cứ trả nguyên response 200 đầy đủ cho MỌI yêu cầu Range thì một số trình duyệt sẽ tua
    sai vị trí hoặc không cho tua lúc đang phát offline. */
async function servePartial(cachedResponse, rangeHeader) {
  const buffer = await cachedResponse.arrayBuffer();
  const total = buffer.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || '');
  if (!match) return new Response(buffer, { status: 200, headers: cachedResponse.headers });
  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : total - 1;
  const safeStart = Math.max(0, Math.min(start, total > 0 ? total - 1 : 0));
  const safeEnd = Math.max(safeStart, Math.min(end, total > 0 ? total - 1 : 0));
  const slice = buffer.slice(safeStart, safeEnd + 1);
  const headers = new Headers(cachedResponse.headers);
  headers.set('content-range', `bytes ${safeStart}-${safeEnd}/${total}`);
  headers.set('content-length', String(slice.byteLength));
  headers.set('accept-ranges', 'bytes');
  return new Response(slice, { status: 206, statusText: 'Partial Content', headers });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Không phải GET, hoặc không phải 1 trong 2 đường dẫn media offline → KHÔNG can thiệp gì cả
  // (không gọi respondWith), trình duyệt tự xử lý y hệt như không có Service Worker này.
  if (req.method !== 'GET' || !isOfflineMediaRequest(req.url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) {
        const range = req.headers.get('range');
        return range ? servePartial(cached, range) : cached.clone();
      }
      // Chưa từng tải offline cho link này — cứ để mạng tự lo như bình thường, KHÔNG tự ý
      // ghi vào cache ở đây (chỉ nút "Tải xuống" trong app mới chủ động ghi — xem
      // src/lib/offlineCache.ts). Nếu đang thật sự mất mạng thì fetch() ở đây sẽ tự ném lỗi,
      // trình phát tự hiện thông báo lỗi mạng như hành vi hiện có, không có gì khác biệt.
      return fetch(req);
    })()
  );
});

// Kích hoạt bản service worker mới ngay, không chờ tab cũ đóng hết.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* nội dung lạ — vẫn hiện thông báo mặc định còn hơn im lặng */
  }

  const title = data.title || 'Ytube';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // tag + renotify: nhiều lời xin liên tiếp thì GỘP vào 1 thông báo thay vì xếp chồng
    // một dọc dài trên màn hình khoá, nhưng vẫn rung/kêu lại để bố mẹ biết có cái mới.
    tag: data.tag || 'ytube',
    renotify: true,
    // requireInteraction: bắt thông báo nằm lại tới khi bố mẹ bấm — có người đang ngồi
    // chờ trả lời, để nó tự biến mất sau vài giây là hỏng cả tính năng.
    // (iPhone chưa hỗ trợ tuỳ chọn này, nhưng để đây thì Android được nhờ.)
    requireInteraction: true,
    data: { url: data.url || '/parent' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/parent';

  // Bấm vào thông báo → mở thẳng khu Bố mẹ. Nếu app đang mở sẵn ở đâu đó thì dùng lại
  // cửa sổ đó (đừng mở thêm cửa sổ thứ hai), chỉ khi chưa mở mới bật cửa sổ mới.
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(url);
            } catch {
              /* vài trình duyệt chặn navigate — vẫn đã focus được, coi như xong */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});
