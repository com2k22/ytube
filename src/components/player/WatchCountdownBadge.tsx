import { useWatchCountdown } from '@/hooks/useWatchCountdown';

/** Bán kính vòng tròn tiến trình, tính trong hệ toạ độ 0–64 của thẻ <svg>. */
const RING_RADIUS = 26;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** 95 giây → "1:35" */
function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * WatchCountdownBadge — đồng hồ đếm ngược nhỏ ở góc trên-phải khung video.
 *
 * Chủ ý thiết kế:
 *  - Trên màn hình CHỈ có đồng hồ, KHÔNG hiện chữ câu nhắc. Lời nhắc ở mốc còn 1 phút là
 *    do loa đọc (xem useWatchCountdown) — đang xem phim mà chèn chữ vào là rối mắt.
 *  - CHỈ hiện khi còn ≤ 2 phút. Lúc bé đang xem bình thường thì màn hình phải sạch, không
 *    có gì nhấp nháy làm phân tâm.
 *  - Luôn có ICON + CHỮ đi kèm màu (⚠️ vàng / 🚨 đỏ), không bao giờ chỉ dựa vào màu sắc —
 *    nhà mình có người phân biệt màu kém thì vẫn đọc được trạng thái.
 *  - Đặt BÊN TRONG .player-wrap (giống PlayerControlBar) để lúc xem toàn màn hình vẫn thấy;
 *    phần tử nằm ngoài khung toàn màn hình thì trình duyệt không vẽ ra.
 */
export function WatchCountdownBadge() {
  const { secondsLeft, visible, level, progress } = useWatchCountdown();

  if (!visible || secondsLeft === null) return null;

  const isCritical = level === 'critical';

  return (
    <div className={`watch-countdown ${isCritical ? 'is-critical' : 'is-warn'}`}>
      <div className="watch-countdown-main">
        <div className="watch-countdown-ring">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle className="wc-ring-track" cx="32" cy="32" r={RING_RADIUS} />
            <circle
              className="wc-ring-bar"
              cx="32"
              cy="32"
              r={RING_RADIUS}
              strokeDasharray={RING_LENGTH}
              // Vòng tròn rút dần theo thời gian còn lại. Xoay -90° để bắt đầu từ 12 giờ.
              strokeDashoffset={RING_LENGTH * (1 - progress)}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <span className="watch-countdown-icon">{isCritical ? '🚨' : '⚠️'}</span>
        </div>

        <div className="watch-countdown-text">
          <div className="watch-countdown-label">Còn lại</div>
          <div className="watch-countdown-time">{formatClock(secondsLeft)}</div>
        </div>
      </div>
    </div>
  );
}
