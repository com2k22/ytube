import { useCallback, useRef, useState } from 'react';
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

function readRows(): OfflineDownloadEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRows(rows: OfflineDownloadEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // Hết chỗ lưu / trình duyệt chặn localStorage (hiếm) — mục vẫn đã tải xong thật vào Cache
    // API, chỉ là không nhớ được trong danh sách quản lý ở tab "Tải xuống" — không mất dữ liệu
    // đã tải, chỉ mất khả năng NHÌN THẤY nó trong danh sách, chấp nhận được vì rất hiếm gặp.
  }
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
  const [rows, setRows] = useState<OfflineDownloadEntry[]>(() => readRows());
  const [statusMap, setStatusMap] = useState<Record<string, StatusEntry>>({});
  // Chặn bấm 2 lần liên tiếp khởi động 2 lượt tải TRÙNG NHAU cho cùng 1 mục trong lúc statusMap
  // (state, cập nhật bất đồng bộ) chưa kịp phản ánh — dùng Set đồng bộ ngay tức thì thay vì chờ
  // đọc lại state (state có thể "cũ" ngay trong cùng 1 lượt render/sự kiện).
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
      setStatusMap((prev) => ({ ...prev, [k]: { status: 'downloading', percent: null } }));

      const playableUrl = resolvePlayableUrl(entry.url);
      downloadAndCache(playableUrl, (percent) => {
        setStatusMap((prev) => ({ ...prev, [k]: { status: 'downloading', percent } }));
      }).then((result) => {
        inFlightRef.current.delete(k);
        if (result.ok) {
          setStatusMap((prev) => {
            const next = { ...prev };
            delete next[k];
            return next;
          });
          const newRow: OfflineDownloadEntry = {
            sourceId: entry.sourceId,
            url: entry.url,
            playlistId: entry.playlistId,
            title: entry.title,
            thumbnail: entry.thumbnail,
            bytes: result.bytes,
            downloadedAt: new Date().toISOString(),
          };
          setRows((prev) => {
            const next = [newRow, ...prev.filter((r) => !(r.sourceId === entry.sourceId && r.url === entry.url))];
            writeRows(next);
            return next;
          });
        } else {
          setStatusMap((prev) => ({
            ...prev,
            [k]: { status: 'error', percent: null, error: result.error || 'Không tải được nội dung này.' },
          }));
        }
      });
    },
    []
  );

  /** Xoá 1 mục đã tải — dùng lại ĐÚNG resolvePlayableUrl(url) để xoá đúng bản đã lưu trong
      Cache API (xem chú thích ở khai báo `url` phía trên: lý do luôn tính lại, không lưu sẵn). */
  const removeDownload = useCallback((sourceId: string, url: string) => {
    removeCached(resolvePlayableUrl(url));
    setRows((prev) => {
      const next = prev.filter((r) => !(r.sourceId === sourceId && r.url === url));
      writeRows(next);
      return next;
    });
  }, []);

  /** Xoá lỗi cũ (bấm lại nút tải sau khi đã thấy thông báo lỗi) — không tự xoá lỗi theo thời
      gian (setTimeout) để bố mẹ/bé có đủ thời gian đọc, chỉ mất khi bấm thử lại hoặc rời trang. */
  const clearError = useCallback((sourceId: string, url: string) => {
    const k = keyOf(sourceId, url);
    setStatusMap((prev) => {
      if (!(k in prev)) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
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
