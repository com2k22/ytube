import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Trash2 } from 'lucide-react';
import { useMobilePlayback } from '@/context/MobilePlaybackContext';
import { useOfflineDownloads, type OfflineDownloadEntry } from '@/hooks/useOfflineDownloads';
import { estimateStorageUsage, formatBytes } from '@/lib/offlineCache';

/**
 * MobileDownloadsPage — tab "Đã tải" trong thanh menu điện thoại.
 *
 * TRƯỚC ĐÂY đây CỐ Ý là 1 trạng thái rỗng THẬT (chưa có hạ tầng tải nội dung về máy). GIỜ ĐÃ
 * CÓ tính năng "Tải xuống nghe offline" thật sự (Google Drive/Dropbox/link trực tiếp — xem
 * src/lib/offlineCache.ts + src/hooks/useOfflineDownloads.ts + public/sw.js), nên trang này đổi
 * vai trò thành nơi QUẢN LÝ/XEM LẠI những gì ĐÃ tải — đúng yêu cầu ("Trong tab Tải xuống dùng để
 * quản lý các nội dung đã tải xuống và xem lại"). Nút TẢI vẫn nằm trong trình phát (giống nút
 * tim — xem MobilePlayerHost.tsx), trang này KHÔNG có nút "tải mới" nào cả.
 *
 * VẪN GIỮ đúng tinh thần "không giả vờ hỗ trợ" (UI_SPEC.md mục 8): KHÔNG BAO GIỜ có video
 * YouTube ở đây (không có hạ tầng tải YouTube hợp lệ) — useOfflineDownloads.ts chỉ ghi nhận
 * nội dung 'direct' đã tải THẬT SỰ thành công (kiểm tra lỗi mạng/máy chủ đầy đủ, xem
 * downloadAndCache() ở offlineCache.ts), không hiện mục nào chưa thật sự có bytes trong máy.
 */
export function MobileDownloadsPage() {
  const { rows, removeDownload } = useOfflineDownloads();
  const { playVideo } = useMobilePlayback();
  const navigate = useNavigate();

  /** Ước lượng dung lượng trình duyệt đang dùng (xem chú thích "ước lượng, không tách riêng
      được" ở estimateStorageUsage()) — chỉ tải lại khi SỐ MỤC đã tải đổi (thêm/xoá), không cần
      hỏi lại mỗi lần render. */
  const [storageUsage, setStorageUsage] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    estimateStorageUsage().then((bytes) => {
      if (!cancelled) setStorageUsage(bytes);
    });
    return () => {
      cancelled = true;
    };
  }, [rows.length]);

  /** Bấm vào 1 mục đã tải → mở trình phát y hệt bấm từ "Bé thích"/"Gần đây" (xem
      openFavorite/openContinuing ở MobileHomePage.tsx, cùng cách dựng PlayerEngineParams).
      KHÔNG gán playlistId nếu mục này thuộc 1 playlist — cố tình: phát LẺ đúng tập đã tải,
      không cố tải/điều hướng thêm dữ liệu playlist nào khác lúc đang có thể đang mất mạng. */
  const openEntry = (entry: OfflineDownloadEntry) => {
    playVideo({
      sourceId: entry.sourceId,
      videoId: null,
      directUrl: entry.url,
      title: entry.title,
      playlistId: null,
      thumbnail: entry.thumbnail,
    });
    navigate('/player');
  };

  if (rows.length === 0) {
    return (
      <main className="main mobile-downloads">
        <div className="mobile-page-title">Đã tải</div>
        <div className="mobile-empty-page">
          <div className="mobile-empty-state">
            <Download size={40} className="mobile-empty-icon" aria-hidden="true" />
            <div className="mobile-empty-title">Chưa có nội dung đã tải</div>
            <p className="mobile-empty-text">
              Bấm biểu tượng tải xuống ngay trong trình phát (cạnh nút tim) để nghe/xem lại ở đây
              khi không có mạng. Chỉ áp dụng cho nội dung Google Drive/Dropbox/link trực tiếp —
              video YouTube luôn cần có mạng để phát.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="main mobile-downloads">
      <div className="mobile-page-title">Đã tải</div>
      {storageUsage !== null && (
        <p className="mobile-downloads-summary">
          Ước lượng dung lượng trình duyệt đang dùng cho Ytube: {formatBytes(storageUsage)}
        </p>
      )}
      <div className="mobile-story-list">
        {rows.map((entry) => (
          <div
            key={`${entry.sourceId}:${entry.url}`}
            className="mobile-story-item"
            role="button"
            tabIndex={0}
            onClick={() => openEntry(entry)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openEntry(entry);
              }
            }}
            aria-label={`Phát lại: ${entry.title}`}
          >
            <div
              className="mobile-story-item-thumb"
              style={entry.thumbnail ? { backgroundImage: `url(${entry.thumbnail})` } : undefined}
              aria-hidden="true"
            />
            <div className="mobile-story-item-info">
              <div className="mobile-story-item-title">{entry.title}</div>
              <div className="mobile-story-item-size">{formatBytes(entry.bytes)}</div>
            </div>
            <button
              className="favorite-heart-btn mobile-downloads-delete"
              onClick={(e) => {
                e.stopPropagation();
                removeDownload(entry.sourceId, entry.url);
              }}
              aria-label={`Xoá "${entry.title}" khỏi máy`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
