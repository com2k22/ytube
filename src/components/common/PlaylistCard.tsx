import { SOURCE_TYPE_ICON } from '@/constants';
import type { SourceType } from '@/types';

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
  onClick: () => void;
}

/** Thẻ playlist/video-lẻ/link-trực-tiếp hiển thị ở Trang chủ hoặc trang Kênh. */
export function PlaylistCard({ title, thumbnail, type, region, inProgress, progressPercent = 0, cols, onClick }: Props) {
  return (
    <div className="card" data-region={region} data-cols={cols} tabIndex={0} onClick={onClick}>
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
      <div className="card-body">
        <div className="card-title">{title}</div>
        <div className="card-sub">{inProgress ? `Đã xem ${progressPercent}%` : sourceTypeLabel(type)}</div>
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
