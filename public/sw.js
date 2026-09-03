/*
  sw.js — "service worker": đoạn mã chạy NGẦM, kể cả khi app đã đóng hẳn.
  Đây là mảnh bắt buộc để điện thoại nhận được thông báo đẩy — không có file này thì
  iPhone/Android không bao giờ hiện thông báo, dù đã cấp quyền.

  ⚠️ CỐ Ý KHÔNG CÓ PHẦN LƯU ĐỆM (cache).
  Service worker thường được dùng để lưu đệm trang cho chạy offline. Ở đây TUYỆT ĐỐI
  không làm vậy, vì nó sinh ra đúng cái bẫy khó chịu nhất: deploy bản mới lên Vercel
  xong, mở app ra vẫn thấy bản CŨ, phải xoá dữ liệu trình duyệt mới hết. App này luôn
  cần bản mới nhất (nhất là bản chạy trên TV), nên file này chỉ làm đúng 1 việc: nhận
  thông báo và mở app khi bấm vào.
*/

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
