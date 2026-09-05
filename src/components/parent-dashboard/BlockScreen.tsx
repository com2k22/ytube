import { useEffect } from 'react';

export type BlockMode = 'outside_window' | 'daily_limit';

export type RequestState = 'idle' | 'pending' | 'approved' | 'denied';

interface Props {
  /** 'outside_window' = chưa đến giờ xem; 'daily_limit' = đã dùng hết thời gian của hôm nay. */
  mode?: BlockMode;
  nextWindowStart: string | null;
  /** Số phút đã xem / hạn mức hôm nay — chỉ dùng để hiện thông tin khi mode = daily_limit. */
  usedMinutes?: number;
  dailyLimitMinutes?: number;
  /** Mở cổng PIN để vào khu vực Bố mẹ. */
  onOpenParentGate: () => void;
  /** Mở cổng PIN để CHO XEM NGAY (mở khoá tạm tới khi tắt app). */
  onUnlockRequest?: () => void;
  /** Bé bấm "con xin thêm giờ" — gửi lời xin sang điện thoại bố mẹ. */
  onAskForMore?: () => void;
  /** Trạng thái lời xin vừa gửi, để hiện "đang chờ..." / "bố mẹ chưa đồng ý". */
  requestState?: RequestState;
  /** Số phút bé xin mỗi lần bấm — chỉ để hiện lên nút cho rõ ràng. */
  requestMinutes?: number;
  /** true khi đây là màn hình "xem thử" mở từ trang Bố mẹ — nút chính sẽ đóng bản xem thử. */
  isPreview?: boolean;
}

function playGentleChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.28);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.28 + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.28 + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.28);
      osc.stop(now + i * 0.28 + 0.65);
    });
  } catch {
    /* âm thanh không khả dụng trên thiết bị này — bỏ qua, không chặn UI */
  }
}

/**
 * BlockScreen — lớp phủ toàn màn hình khi bé chưa/không được xem. Dùng cho 2 trường hợp:
 *  - 'outside_window': chưa đến khung giờ được phép xem.
 *  - 'daily_limit'   : đúng khung giờ nhưng đã xem hết tổng thời gian của hôm nay.
 *
 * Quan trọng: bé KHÔNG có cách nào tự đóng màn hình này (đã bỏ hẳn nút xác nhận). Chỉ bố mẹ
 * mới thoát được, đều cần mã PIN:
 *  - "Cho xem ngay": mở khoá TẠM, hết hiệu lực khi tắt app.
 *  - "Bố mẹ bấm vào đây": vào hẳn khu Bố mẹ — nút này CHỈ hiện trên ĐIỆN THOẠI (ẩn trên
 *    TV bằng CSS .block-parent-gate-mobile). Trên TV, muốn vào khu Bố mẹ thì đi qua nút
 *    "Bố mẹ" ở Sidebar (lớp phủ này che luôn cả Sidebar, nên phải mở khoá tạm trước).
 */
export function BlockScreen({
  mode = 'outside_window',
  nextWindowStart,
  usedMinutes = 0,
  dailyLimitMinutes = 0,
  onOpenParentGate,
  onUnlockRequest,
  onAskForMore,
  requestState = 'idle',
  requestMinutes = 15,
  isPreview,
}: Props) {
  const isDailyLimit = mode === 'daily_limit';

  useEffect(() => {
    playGentleChime();
  }, []);

  return (
    // data-nav-scope = KHOÁ MÀN HÌNH: khi lớp phủ này hiện ra, bộ điều khiển bằng phím mũi
    // tên chỉ còn thấy các nút BÊN TRONG nó, toàn bộ nội dung phía sau không chọn/bấm được.
    <div className="overlay show" data-nav-scope>
      <div className="block-card">
        <div className="block-emoji">{isDailyLimit ? '⌛' : '🦉'}</div>

        {isDailyLimit ? (
          <>
            <h2>Hết thời gian xem hôm nay rồi!</h2>
            <p>
              Hôm nay mình đã xem <b>{usedMinutes} phút</b>
              {dailyLimitMinutes > 0 && <> trên tổng {dailyLimitMinutes} phút được phép</>}. Mai mình xem tiếp
              nhé, giờ đi chơi hoặc nghỉ mắt một chút thôi nào 💛
            </p>
          </>
        ) : (
          <>
            <h2>Chưa đến giờ xem TV!</h2>
            <p>
              Con xem lại vào lúc <b>{nextWindowStart ?? 'khung giờ tiếp theo'}</b> nhé 💛
            </p>
          </>
        )}

        {/* Nút của BÉ: xin thêm giờ mà không cần ai chạy ra TV nhập mã. Lời xin hiện ngay
            trên điện thoại bố mẹ (xem useTimeRequests + TimeRequestCard). */}
        {!isPreview && onAskForMore && (
          <div className="block-ask">
            {requestState === 'idle' && (
              <button className="submit-btn block-ask-btn" data-region="block" tabIndex={0} onClick={onAskForMore}>
                🙋 Con xin thêm {requestMinutes} phút
              </button>
            )}
            {requestState === 'pending' && (
              <div className="block-ask-status is-waiting">⏳ Đã gửi rồi, mình chờ bố mẹ trả lời nhé...</div>
            )}
            {requestState === 'denied' && (
              <div className="block-ask-status is-denied">
                Bố mẹ chưa đồng ý lần này. Mai mình xem tiếp nhé 💛
              </div>
            )}
          </div>
        )}

        {/* Màn hình thật (không phải xem thử) KHÔNG có nút tự đóng — bé không thể tự tắt,
            chỉ bố mẹ mới thoát được (xem 2 nút bên dưới). Bản "xem thử" từ trang Bố mẹ thì
            cần 1 nút để đóng lại. */}
        {isPreview && (
          <button className="submit-btn" data-region="block" tabIndex={0} onClick={onOpenParentGate}>
            Đóng xem thử
          </button>
        )}

        {!isPreview && (
          <div className="block-parent-actions">
            {onUnlockRequest && (
              <button className="add-window-btn" data-region="block" tabIndex={0} onClick={onUnlockRequest}>
                🔓 Bố mẹ cho xem ngay (nhập PIN)
              </button>
            )}
            {/* Chỉ hiện trên ĐIỆN THOẠI (xem .block-parent-gate-mobile trong theme.css) —
                trên TV không hiện nữa (đã bỏ theo yêu cầu, đi qua Sidebar thay thế). Trên
                điện thoại thì bố mẹ hay mở thẳng khu Bố mẹ để xem/chỉnh từ xa hơn là chờ mở
                khoá tạm, nên vẫn giữ lối tắt này riêng cho điện thoại. */}
            <button
              className="add-window-btn block-parent-gate-mobile"
              data-region="block"
              tabIndex={0}
              onClick={onOpenParentGate}
            >
              🔒 Bố mẹ bấm vào đây
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
