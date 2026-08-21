import { SOURCE_TYPE_ICON } from '@/constants';
import type { SourceType } from '@/types';

interface Props {
  title: string;
  thumbnail?: string | null;
  type: SourceType;
  region: 'continue' | 'playlist';
  inProgress?: boolean;
  progressPercent?: number;
  onClick: () => void;
}

/** Thẻ playlist/video-lẻ/link-trực-tiếp hiển thị ở Trang chủ hoặc trang Kênh. */
export function PlaylistCard({ title, thumbnail, type, region, inProgress, progressPercent = 0, onClick }: Props) {
  return (
    <div className="card" data-region={region} tabIndex={0} onClick={onClick}>
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
