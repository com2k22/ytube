interface Props {
  /** Số giây còn lại của giờ nghỉ. */
  secondsLeft: number;
  /** Mở cổng PIN để bố mẹ cho xem tiếp ngay, không phải chờ hết giờ nghỉ. */
  onSkipRequest: () => void;
}

/** 95 giây → "1:35" */
function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * BreakScreen — màn hình "nghỉ giải lao giữa giờ".
 *
 * Bật lên khi bé xem liên tục đủ số phút bố mẹ cài ở ô "Thời gian mỗi lượt xem". Khác hẳn
 * BlockScreen: đây KHÔNG phải hết giờ, chỉ là nghỉ cho đỡ mỏi mắt — hết vài phút là tự
 * biến mất và bé xem tiếp bình thường. Vì vậy giọng điệu cũng nhẹ nhàng, có đồng hồ đếm
 * ngược để bé thấy sắp được xem lại, không phải một cái cửa đóng sập.
 *
 * data-nav-scope = khoá màn hình: lúc này điều khiển chỉ bấm được các nút BÊN TRONG đây,
 * phía sau không thao tác được (xem useTvNavigation).
 */
export function BreakScreen({ secondsLeft, onSkipRequest }: Props) {
  return (
    <div className="overlay show" data-nav-scope>
      <div className="block-card">
        <div className="block-emoji">🌿</div>
        <h2>Nghỉ một chút cho đỡ mỏi mắt nhé!</h2>
        <p>
          Mình xem lâu rồi đó. Con đứng dậy vươn vai, nhìn ra xa một lát — hết {formatClock(secondsLeft)} nữa là
          xem tiếp được ngay thôi 💛
        </p>

        <div className="break-count">{formatClock(secondsLeft)}</div>

        <div className="break-tips">Thử nhìn ra cửa sổ, hoặc chớp mắt thật chậm 10 lần xem nào!</div>

        <div className="block-parent-actions">
          <button className="add-window-btn" data-region="block" tabIndex={0} onClick={onSkipRequest}>
            🔓 Bố mẹ cho xem tiếp ngay (nhập PIN)
          </button>
        </div>
      </div>
    </div>
  );
}
