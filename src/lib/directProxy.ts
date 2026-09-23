import { toGdriveProxyUrl } from '@/lib/googleDrive';

/**
 * toDirectProxyUrl — đổi 1 link phát trực tiếp KHÔNG PHẢI Google Drive (Dropbox, mp4/m3u8 tự
 * host...) sang gọi qua "/api/proxy-download?url=..." (trạm trung chuyển chung, xem
 * api/proxy-download.js) — CÙNG Ý TƯỞNG với toGdriveProxyUrl (googleDrive.ts) nhưng cho MỌI
 * nguồn ngoài khác, không riêng Google Drive.
 *
 * VÌ SAO CẦN: tính năng "Tải xuống nghe offline" (xem src/lib/offlineCache.ts) phải đọc TRỌN
 * VẸN bytes bằng fetch() để lưu vào Cache API — một số máy chủ lưu file bên ngoài (VD
 * dropboxusercontent.com) KHÔNG cho phép trang web khác gốc (CORS) đọc trọn vẹn theo cách đó,
 * dù thẻ <video> vẫn phát trực tiếp bình thường (phát bằng thẻ <video> không bị chặn bởi luật
 * CORS, chỉ fetch() bằng tay mới bị). Đi qua đúng gốc (origin) của app một lượt giải quyết dứt
 * điểm, không cần dò/đoán từng máy chủ có cho CORS hay không.
 *
 * KHÔNG đổi gì với link ĐÃ tự gốc (đường dẫn nội bộ "/api/..." có sẵn, VD Drive đã đổi ở bước
 * trước) hay link không phải http(s) thường (blob:, data:... nếu có).
 */
export function toDirectProxyUrl(rawUrl: string): string {
  if (rawUrl.startsWith('/api/')) return rawUrl;
  if (!/^https?:\/\//i.test(rawUrl)) return rawUrl;
  return `/api/proxy-download?url=${encodeURIComponent(rawUrl)}`;
}

/**
 * resolvePlayableUrl — ĐÚNG 1 CHỖ DUY NHẤT quyết định "link này phát/tải THẬT SỰ bằng URL
 * nào" — dùng CHUNG cho CẢ trình phát (DirectVideoPlayer.tsx, thay cho toGdriveProxyUrl trước
 * đây) LẪN tải offline (useOfflineDownloads.ts). Google Drive → trạm trung chuyển Drive (đã
 * có sẵn, dùng tài khoản dịch vụ — xem googleDrive.ts); mọi link http(s) khác (Dropbox,
 * mp4/m3u8 tự host...) → trạm trung chuyển chung mới (proxy-download.js).
 *
 * QUAN TRỌNG: nếu 2 nơi (lúc PHÁT và lúc TẢI OFFLINE) tự tính URL theo 2 cách khác nhau, link
 * tải xuống và link lúc phát thật sẽ LỆCH NHAU — Service Worker (public/sw.js) sẽ không bao
 * giờ tìm thấy đúng bản đã tải trong cache khi mất mạng (tải xong nhưng vẫn không phát được
 * offline, lỗi rất khó phát hiện vì lúc CÓ mạng vẫn phát bình thường qua network như chưa
 * từng tải). Mọi nơi cần "URL để phát/tải 1 link trực tiếp" đều PHẢI gọi hàm này, không tự
 * viết lại logic tương tự ở nơi khác.
 */
export function resolvePlayableUrl(rawUrl: string): string {
  const driveProxied = toGdriveProxyUrl(rawUrl);
  if (driveProxied !== rawUrl) return driveProxied;
  return toDirectProxyUrl(rawUrl);
}
