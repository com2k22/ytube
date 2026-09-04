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
      {/* card-highlight bọc RIÊNG ảnh + tên video — khi ô này được chọn (xem theme.css:
          .card.tv-focused .card-highlight) chỉ 2 phần này đổi sang nền trắng/chữ đen, dòng
          "Đã xem..." bên dưới nằm NGOÀI khối này nên không bị bọc theo. */}
      <div className="card-highlight">
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
        <div className="card-title">{title}</div>
      </div>
      <div className="card-sub">{watching ? `Đã xem ${progressPercent}%` : 'Chưa xem'}</div>
    </div>
  );
}
