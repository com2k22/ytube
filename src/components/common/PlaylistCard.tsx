import { SOURCE_TYPE_ICON } from '@/constants';
import type { ContentLabel, SourceType } from '@/types';

interface Props {
  title: string;
  thumbnail?: string | null;
  type: SourceType;
  /**
   * Tên vùng điều hướng bằng điều khiển TV. Mỗi kiểu bố cục 1 tên riêng:
   *  - 'continue' / 'playlistrec' / 'videorec': các hàng ngang ở Trang chủ.
   *  - 'playlist': lưới 3 cột ở trang Kênh (số cột khai báo ở SECTION_COLS, Layout.tsx).
   */
  region: 'continue' | 'playlist' | 'playlistrec' | 'videorec';
  inProgress?: boolean;
  progressPercent?: number;
  /** Số cột của vùng điều hướng D-pad chứa thẻ này (dùng cho lưới nhiều hàng, cột tính động — xem useTvNavigation). */
  cols?: number;
  /** Nhãn đã gán cho nội dung này (xem useContentLabels.ts) — hiện thành CHỮ THƯỜNG, cùng
      kiểu với "Playlist"/"Video lẻ".., nối tiếp trên CÙNG DÒNG với dòng "Đã xem.."/"Playlist"
      bằng dấu phẩy, KHÔNG tô màu/làm nổi bật riêng. Rỗng/không truyền = không hiện nhãn nào.
      Nhãn "Ẩn" cố ý KHÔNG truyền vào đây — nội dung gán nhãn Ẩn không được render ra card
      nào cả (lọc từ trước, xem HomePage.tsx), nên component này không cần tự né riêng. */
  labels?: ContentLabel[];
  onClick: () => void;
}

/** Thẻ playlist/video-lẻ/link-trực-tiếp hiển thị ở Trang chủ hoặc trang Kênh. */
export function PlaylistCard({
  title,
  thumbnail,
  type,
  region,
  inProgress,
  progressPercent = 0,
  cols,
  labels,
  onClick,
}: Props) {
  return (
    <div className="card" data-region={region} data-cols={cols} tabIndex={0} onClick={onClick}>
      {/* card-highlight bọc RIÊNG ảnh + tên video/playlist — xem giải thích chi tiết ở
          VideoCard.tsx (2 file dùng chung đúng 1 kiểu CSS trong theme.css). */}
      <div className="card-highlight">
        <div
          className="card-thumb"
          style={thumbnail ? { backgroundImage: `url(${thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          {!thumbnail && SOURCE_TYPE_ICON[type]}
          {inProgress && <span className="watching-badge">Đang xem</span>}
          {inProgress && (
            <div className="progress-wrap">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          )}
        </div>
        <div className="card-title">{title}</div>
      </div>
      <div className="card-sub">
        {[inProgress ? `Đã xem ${progressPercent}%` : sourceTypeLabel(type), ...(labels ?? []).map((l) => l.name)].join(', ')}
      </div>
    </div>
  );
}

function sourceTypeLabel(type: SourceType) {
  switch (type) {
    case 'youtube_playlist':
      return 'Playlist';
    case 'youtube_video':
      return 'Video lẻ';
    case 'youtube_channel':
      return 'Kênh';
    case 'direct_url':
      return 'Link trực tiếp';
    case 'custom_playlist':
      return 'Playlist tự tạo';
  }
}
