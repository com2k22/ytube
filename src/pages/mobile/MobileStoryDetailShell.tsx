import { ChevronLeft, Play } from 'lucide-react';

export interface MobileStoryListItem {
  id: string;
  title: string;
  thumbnail: string | null;
  /** 0-100, undefined = không hiện thanh tiến độ (dùng cho danh sách playlist của 1 kênh —
      1 playlist không có "% đã xem" chung, chỉ từng video bên trong nó mới có). */
  progressPercent?: number;
  onSelect: () => void;
}

interface Props {
  title: string;
  thumbnail: string | null;
  /** VD "12 video" hoặc "5 playlist" — tự nhãn hoá theo nơi gọi, không đoán số nhiều/ít. */
  itemCountLabel: string;
  items: MobileStoryListItem[];
  loading?: boolean;
  error?: string | null;
  onBack: () => void;
  /** Có/không có nút "Phát tất cả" — chỉ có ý nghĩa khi mỗi item LÀ 1 video phát thẳng được
      (PlaylistVideosView). Trang danh sách PLAYLIST của 1 kênh (ChannelPage) không truyền
      prop này — bấm vào 1 playlist còn phải mở tiếp trang con chọn video, không "phát tất
      cả" trực tiếp được. */
  onPlayAll?: () => void;
}

/**
 * MobileStoryDetailShell — khung chi tiết dùng chung cho 2 trang trên điện thoại: danh sách
 * video của 1 playlist (PlaylistVideosView.tsx) VÀ danh sách playlist của 1 kênh
 * (ChannelPage.tsx) — cùng bố cục ảnh lớn/tên/số lượng/danh sách dọc theo SCREEN_MAP.md mục
 * "04 — Chi tiết Playlist", chỉ khác nhau ở việc có nút "Phát tất cả" hay không và mỗi dòng
 * dẫn tới đâu (nơi gọi tự quyết định qua `onSelect` của từng item).
 */
export function MobileStoryDetailShell({ title, thumbnail, itemCountLabel, items, loading, error, onBack, onPlayAll }: Props) {
  return (
    <main className="main mobile-story-detail">
      <button className="mobile-story-back" onClick={onBack} aria-label="Quay lại">
        <ChevronLeft size={20} /> Quay lại
      </button>

      <div className="mobile-story-hero" style={thumbnail ? { backgroundImage: `url(${thumbnail})` } : undefined}>
        {!thumbnail && <span className="mobile-content-thumb-fallback">🎵</span>}
      </div>

      <div className="mobile-story-title">{title}</div>
      <div className="mobile-story-count">{itemCountLabel}</div>

      {onPlayAll && items.length > 0 && (
        <button className="mobile-story-playall" onClick={onPlayAll}>
          <Play size={16} /> Phát tất cả
        </button>
      )}

      {loading && <p style={{ opacity: 0.6, marginTop: 16 }}>Đang tải...</p>}
      {error && (
        <p style={{ opacity: 0.7, color: '#e05a5a', maxWidth: 480, marginTop: 16 }}>{error}</p>
      )}

      <div className="mobile-story-list">
        {items.map((item) => (
          <button key={item.id} className="mobile-story-item" onClick={item.onSelect}>
            <div
              className="mobile-story-item-thumb"
              style={item.thumbnail ? { backgroundImage: `url(${item.thumbnail})` } : undefined}
            >
              {!item.thumbnail && <span className="mobile-content-thumb-fallback">🎵</span>}
            </div>
            <div className="mobile-story-item-info">
              <div className="mobile-story-item-title">{item.title}</div>
              {typeof item.progressPercent === 'number' && item.progressPercent > 0 && (
                <div className="mobile-story-item-progress">
                  <div
                    className="mobile-story-item-progress-fill"
                    style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
                  />
                </div>
              )}
            </div>
            <Play size={16} className="mobile-story-item-play" aria-hidden="true" />
          </button>
        ))}
      </div>
    </main>
  );
}
