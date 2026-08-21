interface Props {
  title: string;
  thumbnail?: string | null;
  watching?: boolean;
  progressPercent?: number;
  onClick: () => void;
}

/** Thẻ 1 video cụ thể — dùng trong danh sách video của playlist và "video tiếp theo". */
export function VideoCard({ title, thumbnail, watching, progressPercent = 0, onClick }: Props) {
  return (
    <div className="card" data-region="video" tabIndex={0} onClick={onClick}>
      <div
        className="card-thumb"
        style={thumbnail ? { backgroundImage: `url(${thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {!thumbnail && '▶'}
        {watching && <span className="watching-badge">Đang xem</span>}
        {watching && (
          <div className="progress-wrap">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>
      <div className="card-body">
        <div className="card-title">{title}</div>
        <div className="card-sub">{watching ? `Đã xem ${progressPercent}%` : 'Chưa xem'}</div>
      </div>
    </div>
  );
}
