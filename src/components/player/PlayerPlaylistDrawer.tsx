import type { ResolvedVideo } from '@/types';

interface Props {
  /** 0 = ẩn hẳn. 1 = "lấp ló" (chỉ báo có danh sách, hiện hờ 3 video đầu, CHƯA chọn được ô
      nào). 2 = lưới đầy đủ, 3 video/hàng, chọn được từng ô. Xem useTvPlayerControls. */
  stage: 0 | 1 | 2;
  videos: ResolvedVideo[];
  /** Ô đang được TÔ SÁNG bằng mũi tên — chỉ có ý nghĩa ở giai đoạn 2. */
  activeIndex: number;
  /** videoId của video ĐANG PHÁT — đánh dấu "▶ Đang xem" trong danh sách, phân biệt với ô
      đang được TÔ SÁNG do bấm mũi tên (2 khái niệm khác nhau). */
  currentVideoId?: string;
}

/**
 * PlayerPlaylistDrawer — danh sách video trong playlist, mở bằng phím MŨI TÊN XUỐNG khi
 * đang xem, qua 2 giai đoạn (giống app YouTube Kids trên TV):
 *
 *  1) "Lấp ló" — chỉ hiện hờ mép trên của 3 thẻ đầu, nhô lên từ mép dưới màn hình, đủ để
 *     báo "còn danh sách bên dưới, bấm Xuống nữa để xem hết" — CHƯA có ô nào được chọn.
 *  2) Bấm Xuống thêm 1 lần → "nở" ra thành lưới ĐẦY ĐỦ, 3 thẻ/hàng, cuộn dọc được nếu
 *     nhiều hơn 1 hàng, di chuyển chọn bằng Lên/Xuống/Trái/Phải, ô đang chọn được tô sáng.
 *
 * Cố ý đặt BÊN TRONG .player-wrap (giống PlayerControlBar) để lúc xem toàn màn hình vẫn
 * thấy được — phần tử nằm ngoài khung toàn màn hình thì trình duyệt không vẽ ra.
 */
export function PlayerPlaylistDrawer({ stage, videos, activeIndex, currentVideoId }: Props) {
  if (stage === 0 || videos.length === 0) return null;
  const peekVideos = stage === 1 ? videos.slice(0, 3) : videos;

  return (
    <div className={`player-playlist player-playlist-stage${stage}`}>
      {stage === 2 && <div className="player-playlist-title">📂 Video trong playlist</div>}
      <div className="player-playlist-grid">
        {peekVideos.map((v, i) => (
          <div
            key={v.videoId}
            className={`player-playlist-item ${stage === 2 && i === activeIndex ? 'active' : ''} ${
              v.videoId === currentVideoId ? 'is-current' : ''
            }`}
          >
            <div
              className="player-playlist-thumb"
              style={v.thumbnail ? { backgroundImage: `url(${v.thumbnail})` } : undefined}
            >
              {v.videoId === currentVideoId && <span className="player-playlist-playing">▶</span>}
            </div>
            {stage === 2 && <div className="player-playlist-item-title">{v.title}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
