import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { resolvePlayableUrl } from '@/lib/directProxy';
import { downloadAndCache, isOfflineDownloadSupported, removeCached } from '@/lib/offlineCache';

const STORAGE_KEY = 'ytube_offline_downloads';

export interface OfflineDownloadEntry {
  sourceId: string;
  /** Link GỐC (trước khi qua trạm trung chuyển /api/gdrive-file hoặc /api/proxy-download) —
      CHÍNH LÀ `directUrl` mà usePlayerEngine dùng, giống hệt quy ước `video_ref` của
      favorites/watch_progress (xem useFavorites.ts). Lúc thật sự TẢI hay PHÁT LẠI đều tự tính
      lại `resolvePlayableUrl(url)` NGAY LÚC DÙNG (xem startDownload/removeDownload bên dưới) —
      KHÔNG lưu sẵn link đã qua proxy — để nếu sau này đổi cách proxy (đổi tên hàm, thêm tham
      số...) thì các mục ĐÃ tải từ trước vẫn tự khớp lại đúng, không cần dọn dữ liệu cũ. */
  url: string;
  playlistId: string | null;
  title: string;
  thumbnail: string | null;
  bytes: number;
  downloadedAt: string;
}

interface StatusEntry {
  status: 'downloading' | 'error';
  percent: number | null;
  error?: string;
}

function keyOf(sourceId: string, url: string): string {
  return `${sourceId}::${url}`;
}

function readRowsFromStorage(): OfflineDownloadEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * "Kho" NGOÀI React cho danh sách đã tải — CỐ Ý không dùng `useState` cục bộ trong hook (bản
 * đầu tiên đã làm vậy, xem lỗi bên dưới): `useOfflineDownloads()` có thể được gọi ở NHIỀU nơi
 * CÙNG LÚC (MobilePlayerHost.tsx — nút tải trong trình phát — VÀ MobileDownloadsPage.tsx — tab
 * quản lý — có thể cùng mount khi bé đang nghe 1 bài rồi mở tab "Tải xuống" xem danh sách), mỗi
 * nơi gọi hook là 1 `useState` RIÊNG, không tự đồng bộ với nhau — tải xong ở trình phát thì tab
 * "Tải xuống" đang mở sẵn từ trước KHÔNG tự cập nhật cho tới khi bé rời rồi quay lại trang đó.
 * NGHIÊM TRỌNG HƠN: nếu bé ĐÓNG hẳn trình phát (unmount MobilePlayerHostActive, xem
 * MobilePlayerHost.tsx) NGAY TRONG LÚC đang tải dở, `useState` cục bộ của lượt gọi đó bị React
 * bỏ qua nốt phần cập nhật còn lại — file vẫn tải THÀNH CÔNG thật vào Cache API của trình duyệt
 * (đó là API trình duyệt thuần, không phụ thuộc vòng đời React) nhưng danh sách quản lý
 * (localStorage) không bao giờ được ghi nhận mục đó — 1 mục "mồ côi": có bytes thật chiếm chỗ
 * trong máy nhưng không hiện ở tab "Tải xuống", bé/bố mẹ không xoá được, dễ vô tình tải trùng.
 * Dùng 1 "kho" module-level (sống ngoài mọi component) + `useSyncExternalStore` (API chính thức
 * của React 18 cho đúng tình huống này — 1 nguồn dữ liệu ngoài React mà nhiều nơi cùng cần đọc
 * và cùng tự cập nhật khi nó đổi) giải quyết dứt điểm cả 2 vấn đề: mọi nơi gọi hook luôn thấy
 * CÙNG 1 danh sách, và việc ghi khi tải xong không còn phụ thuộc component nào còn sống hay không.
 */
let rowsCache: OfflineDownloadEntry[] | null = null;
const listeners = new Set<() => void>();

function getRowsSnapshot(): OfflineDownloadEntry[] {
  if (rowsCache === null) rowsCache = readRowsFromStorage();
  return rowsCache;
}

function subscribeRows(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeRows(next: OfflineDownloadEntry[]) {
  rowsCache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Hết chỗ lưu / trình duyệt chặn localStorage (hiếm) — mục vẫn đã tải xong thật vào Cache
    // API, chỉ là không nhớ được lâu dài trong danh sách quản lý (mất khi tải lại trang) —
    // không mất dữ liệu đã tải, chỉ mất khả năng NHÌN THẤY nó về sau, chấp nhận được vì hiếm.
  }
  listeners.forEach((l) => l());
}

/**
 * useOfflineDownloads — danh sách "đã tải về máy này" ĐỘC LẬP với Supabase, KHÔNG chia theo
 * hồ sơ (Mina/Cốm) — xem chú thích chi tiết trong tóm tắt phiên làm việc: đây là dữ liệu về
 * BYTES nằm trong CHÍNH trình duyệt này, không phải quy tắc nội dung của bố mẹ, nên lưu bằng
 * localStorage (không đồng bộ nhiều thiết bị — giống hệt cách Spotify/YouTube offline hoạt
 * động: tải ở máy nào, xem offline được ở đúng máy đó).
 *
 * CHỈ áp dụng cho nội dung 'direct' (link trực tiếp/Drive) — KHÔNG BAO GIỜ cho video YouTube
 * (không có hạ tầng tải YouTube hợp lệ, xem chú thích cũ ở MobileDownloadsPage.tsx) — nơi gọi
 * (MobilePlayerHost.tsx) tự đảm bảo chỉ gọi startDownload khi kind === 'direct'.
 */
export function useOfflineDownloads() {
  // Danh sách ĐÃ TẢI XONG — đồng bộ ngoài React (xem chú thích ở kho phía trên), KHÔNG dùng
  // useState. `statusMap` (đang tải dở/lỗi) thì vẫn để state cục bộ bình thường — chỉ có ý
  // nghĩa hiển thị ngay trong trình phát đang mở, MobileDownloadsPage không cần thấy tiến độ
  // tải dở của nơi khác, không cần đồng bộ xuyên component.
  const rows = useSyncExternalStore(subscribeRows, getRowsSnapshot);
  // statusMap (đang tải dở %/lỗi) CHỈ có ý nghĩa hiển thị ngay trong trình phát ĐANG MỞ — nếu
  // trình phát đóng giữa chừng thì không còn ai cần xem tiến độ đó nữa (khác hẳn `rows`, việc
  // GHI kết quả tải xong phải sống sót qua việc đóng trình phát — xem writeRows/kho ở trên),
  // nên giữ ĐÚNG useState bình thường là đủ, không cần kho ngoài React như `rows`.
  const [statusMap, setStatusMap] = useState<Record<string, StatusEntry>>({});
  const setStatus = (k: string, entry: StatusEntry | null) => {
    setStatusMap((prev) => {
      const next = { ...prev };
      if (entry) next[k] = entry;
      else delete next[k];
      return next;
    });
  };

  // Chặn bấm 2 lần liên tiếp khởi động 2 lượt tải TRÙNG NHAU cho cùng 1 mục trong lúc statusMap
  // (cập nhật bất đồng bộ) chưa kịp phản ánh — dùng Set đồng bộ ngay tức thì thay vì chờ đọc
  // lại state (state có thể "cũ" ngay trong cùng 1 lượt render/sự kiện).
  const inFlightRef = useRef<Set<string>>(new Set());

  const isDownloaded = useCallback(
    (sourceId: string, url: string) => rows.some((r) => r.sourceId === sourceId && r.url === url),
    [rows]
  );
  const isDownloading = useCallback(
    (sourceId: string, url: string) => statusMap[keyOf(sourceId, url)]?.status === 'downloading',
    [statusMap]
  );
  const progressFor = useCallback(
    (sourceId: string, url: string) => statusMap[keyOf(sourceId, url)]?.percent ?? null,
    [statusMap]
  );
  const errorFor = useCallback(
    (sourceId: string, url: string) => statusMap[keyOf(sourceId, url)]?.error ?? null,
    [statusMap]
  );

  const startDownload = useCallback(
    (entry: { sourceId: string; url: string; title: string; thumbnail: string | null; playlistId: string | null }) => {
      const k = keyOf(entry.sourceId, entry.url);
      if (inFlightRef.current.has(k)) return;
      inFlightRef.current.add(k);
      setStatus(k, { status: 'downloading', percent: null });

      const playableUrl = resolvePlayableUrl(entry.url);
      downloadAndCache(playableUrl, (percent) => {
        setStatus(k, { status: 'downloading', percent });
      }).then((result) => {
        inFlightRef.current.delete(k);
        if (result.ok) {
          setStatus(k, null);
          const newRow: OfflineDownloadEntry = {
            sourceId: entry.sourceId,
            url: entry.url,
            playlistId: entry.playlistId,
            title: entry.title,
            thumbnail: entry.thumbnail,
            bytes: result.bytes,
            downloadedAt: new Date().toISOString(),
          };
          // ĐỌC LẠI kho MỚI NHẤT (getRowsSnapshot(), không phải biến `rows` đóng trong closure
          // của lượt render lúc BẮT ĐẦU tải) rồi ghi thẳng vào kho ngoài React — hoạt động
          // đúng dù component gọi startDownload() ban đầu đã unmount từ lâu (xem chú thích ở
          // khai báo kho phía trên: đây chính là lý do phải làm vậy, không phải tối ưu thừa).
          const nextRows = [
            newRow,
            ...getRowsSnapshot().filter((r) => !(r.sourceId === entry.sourceId && r.url === entry.url)),
          ];
          writeRows(nextRows);
        } else {
          setStatus(k, { status: 'error', percent: null, error: result.error || 'Không tải được nội dung này.' });
        }
      });
    },
    []
  );

  /** Xoá 1 mục đã tải — dùng lại ĐÚNG resolvePlayableUrl(url) để xoá đúng bản đã lưu trong
      Cache API (xem chú thích ở khai báo `url` phía trên: lý do luôn tính lại, không lưu sẵn). */
  const removeDownload = useCallback((sourceId: string, url: string) => {
    removeCached(resolvePlayableUrl(url));
    writeRows(getRowsSnapshot().filter((r) => !(r.sourceId === sourceId && r.url === url)));
  }, []);

  /** Xoá lỗi cũ (bấm lại nút tải sau khi đã thấy thông báo lỗi) — không tự xoá lỗi theo thời
      gian (setTimeout) để bố mẹ/bé có đủ thời gian đọc, chỉ mất khi bấm thử lại hoặc rời trang. */
  const clearError = useCallback((sourceId: string, url: string) => {
    setStatus(keyOf(sourceId, url), null);
  }, []);

  return {
    rows,
    supported: isOfflineDownloadSupported(),
    isDownloaded,
    isDownloading,
    progressFor,
    errorFor,
    startDownload,
    removeDownload,
    clearError,
  };
}
