/**
 * offlineCache.ts — đọc/ghi/xoá bytes trong "Cache API" của trình duyệt (CacheStorage) cho
 * tính năng "Tải xuống nghe offline" (Drive/Dropbox/link trực tiếp khác).
 *
 * KHÔNG lo phần "phục vụ lại lúc mất mạng" ở đây — việc đó do public/sw.js (Service Worker)
 * đảm nhiệm, vì CHỈ Service Worker mới chặn được request <video src> bình thường của trình
 * duyệt để trả lời bằng bytes đã lưu. File này chỉ lo việc GHI vào/XOÁ khỏi/ĐỌC DUNG LƯỢNG của
 * đúng 1 "ngăn" cache đó — việc này làm được thẳng từ mã JS của trang, không cần qua Service
 * Worker (Cache API là 1 API trình duyệt độc lập, chỉ tình cờ hay đi kèm Service Worker).
 *
 * ⚠️ TÊN "ngăn" cache (OFFLINE_CACHE_NAME) PHẢI khớp NGUYÊN VĂN với hằng số cùng tên khai báo
 * TRONG public/sw.js — 2 nơi định nghĩa riêng vì Service Worker là 1 file JS cổ điển tách biệt
 * hoàn toàn khỏi bundle Vite của app (không import chung module được giữa 2 bên). Đổi 1 bên mà
 * quên đổi bên kia thì tính năng tải offline sẽ ÂM THẦM HỎNG (tải xong, báo thành công, nhưng
 * lúc mất mạng Service Worker lại tìm trong 1 ngăn cache KHÁC — không thấy gì, coi như chưa hề
 * tải).
 */
export const OFFLINE_CACHE_NAME = 'ytube-offline-v1';

/** true = trình duyệt/hoàn cảnh hiện tại CÓ THỂ tải offline thật sự (không phải giả vờ). Cần
    ĐỦ CẢ 3: Cache API (lưu bytes), Service Worker (phục vụ lại lúc mất mạng — đăng ký sẵn ở
    main.tsx cho mọi trang HTTPS không phải TV) và đang chạy trên HTTPS (Service Worker + Cache
    API đều bị trình duyệt chặn trên http:// thường, trừ localhost lúc phát triển). Gọi hàm này
    TRƯỚC khi hiện nút "Tải xuống" — false thì ẩn hẳn nút đi, không hiện ra rồi bấm mới báo lỗi. */
export function isOfflineDownloadSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isSecure = window.location.protocol === 'https:' || isLocalhost;
  return isSecure && 'caches' in window && 'serviceWorker' in navigator;
}

export interface DownloadResult {
  ok: boolean;
  /** Số bytes đã lưu (ước lượng từ header Content-Length nếu có, không thì đếm bytes đọc
      được thật) — dùng để hiện dung lượng từng mục trong tab "Tải xuống". */
  bytes: number;
  /** Có giá trị khi ok=false — LÝ DO THẬT, không phải thông báo mập mờ, để bố mẹ/bé biết đang
      lỗi mạng, lỗi máy chủ hay link hỏng, xem chỗ gọi ở useOfflineDownloads.ts. */
  error?: string;
}

/**
 * downloadAndCache — tải TRỌN VẸN 1 link (đã qua resolvePlayableUrl() — xem directProxy.ts,
 * BẮT BUỘC dùng ĐÚNG url này, không phải url gốc trước khi qua trạm trung chuyển, vì Service
 * Worker sẽ tìm trong cache đúng theo url mà thẻ <video> thật sự gọi lúc phát) rồi lưu vào Cache
 * API. Gọi `onProgress` với % THẬT (0-100, dựa trên header Content-Length máy chủ trả về — nếu
 * máy chủ không kèm Content-Length thì truyền null, nơi gọi tự hiện "đang tải..." không kèm %)
 * kèm số bytes đã tải được tới thời điểm đó.
 *
 * KHÔNG BAO GIỜ báo "ok: true" giả — mọi lỗi mạng/máy chủ (link hỏng, hết hạn chia sẻ, mất
 * mạng giữa chừng...) đều trả về ok:false kèm lý do thật, đúng tinh thần "không giả vờ hỗ trợ
 * offline" đã áp dụng cho MobileDownloadsPage.tsx từ trước.
 */
export async function downloadAndCache(
  playableUrl: string,
  onProgress?: (percent: number | null, loadedBytes: number) => void,
  signal?: AbortSignal
): Promise<DownloadResult> {
  try {
    const res = await fetch(playableUrl, { signal });
    if (!res.ok) {
      return { ok: false, bytes: 0, error: `Máy chủ báo lỗi (${res.status}) — link có thể đã hỏng hoặc hết hạn.` };
    }

    const cache = await caches.open(OFFLINE_CACHE_NAME);
    // Nhân bản Response NGAY từ lúc CHƯA đọc gì cả (clone() chỉ hợp lệ khi thân response còn
    // nguyên) — 1 bản giao thẳng cho Cache API tự đọc/lưu (không cần đợi ở đây), 1 bản mình tự
    // đọc từng phần bên dưới CHỈ để đếm tiến độ % thật, không lưu trùng ở đâu khác.
    const forCache = res.clone();
    const cachePutPromise = cache.put(playableUrl, forCache);

    const totalHeader = res.headers.get('content-length');
    const total = totalHeader ? parseInt(totalHeader, 10) : null;
    let loaded = 0;
    if (res.body) {
      const reader = res.body.getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.byteLength;
        onProgress?.(total && total > 0 ? Math.min(100, (loaded / total) * 100) : null, loaded);
      }
    }

    await cachePutPromise;
    return { ok: true, bytes: total ?? loaded };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, bytes: 0, error: 'Đã huỷ tải.' };
    }
    return {
      ok: false,
      bytes: 0,
      error: 'Lỗi mạng khi tải — kiểm tra lại kết nối Internet rồi thử lại.',
    };
  }
}

/** Xoá đúng 1 bản đã tải khỏi Cache API — gọi kèm lúc bé bấm nút xoá trong tab "Tải xuống"
    HOẶC bấm lại nút tim tải xuống trong trình phát khi đang ở trạng thái "đã tải". */
export async function removeCached(playableUrl: string): Promise<void> {
  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    await cache.delete(playableUrl);
  } catch {
    // Trình duyệt chặn Cache API (hiếm, VD chế độ ẩn danh nghiêm ngặt) — không có gì để xoá
    // thêm, bỏ qua, useOfflineDownloads.ts vẫn xoá được mục khỏi danh sách (localStorage).
  }
}

/** "1.2 GB", "340 MB"... — hiện dung lượng cho dễ đọc thay vì số bytes thô. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Ước lượng tổng dung lượng trình duyệt đang dùng cho TOÀN BỘ dữ liệu của app (không tách
    riêng được đúng phần "đã tải offline" — giới hạn của chính API `navigator.storage.estimate`,
    nó chỉ báo tổng chung, không chia theo từng Cache/IndexedDB/localStorage) — vẫn hữu ích để
    bố mẹ/bé biết ĐẠI KHÁI đang chiếm bao nhiêu chỗ, hiện kèm ghi chú "ước lượng" ở nơi gọi
    (MobileDownloadsPage.tsx) để không hiểu nhầm là số chính xác tuyệt đối. null = trình duyệt
    không hỗ trợ API này (Safari cũ...). */
export async function estimateStorageUsage(): Promise<number | null> {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return null;
    const { usage } = await navigator.storage.estimate();
    return typeof usage === 'number' ? usage : null;
  } catch {
    return null;
  }
}
