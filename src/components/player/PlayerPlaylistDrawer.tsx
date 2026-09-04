import type { ResolvedVideo } from '@/types';

interface Props {
  open: boolean;
  videos: ResolvedVideo[];
  activeIndex: number;
  /** videoId của video ĐANG PHÁT — để đánh dấu "▶ Đang xem" trong danh sách, phân biệt với
      ô đang được TÔ SÁNG do bấm mũi tên lên/xuống (2 khái niệm khác nhau). */
  currentVideoId?: string;
}

/**
 * PlayerPlaylistDrawer — danh sách video trong playlist, mở bằng phím MŨI TÊN XUỐNG khi
 * đang xem (giống app YouTube Kids trên TV: Lên = bảng điều khiển, Xuống = danh sách).
 *
 * Cố ý đặt BÊN TRONG .player-wrap (giống PlayerControlBar) để lúc xem toàn màn hình vẫn
 * thấy được — phần tử nằm ngoài khung toàn màn hình thì trình duyệt không vẽ ra.
 *
 * Đóng bằng: bấm OK (chọn xem video đó), bấm Back, hoặc bấm Lên khi đang đứng ở video đầu
 * danh sách (xem useTvPlayerControls) — tất cả xử lý bằng phím đều nằm ở hook đó, component
 * này chỉ lo phần hiển thị.
 */
export function PlayerPlaylistDrawer({ open, videos, activeIndex, currentVideoId }: Props) {
  if (!open) return null;
  return (
    <div className="player-playlist">
      <div className="player-playlist-title">📂 Video trong playlist</div>
      <div className="player-playlist-list">
        {videos.map((v, i) => (
          <div
            key={v.videoId}
            className={`player-playlist-item ${i === activeIndex ? 'active' : ''} ${
              v.videoId === currentVideoId ? 'is-current' : ''
            }`}
          >
            <div
              className="player-playlist-thumb"
              style={v.thumbnail ? { backgroundImage: `url(${v.thumbnail})` } : undefined}
            >
              {v.videoId === currentVideoId && <span className="player-playlist-playing">▶</span>}
            </div>
            <div className="player-playlist-item-title">{v.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
