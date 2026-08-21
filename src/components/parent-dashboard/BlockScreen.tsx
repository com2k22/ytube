import { useEffect, useState } from 'react';

interface Props {
  nextWindowStart: string | null;
  /** Mở cổng PIN phụ huynh — cách DUY NHẤT để thoát màn hình chặn khi đang ngoài giờ xem. */
  onOpenParentGate: () => void;
  /** true khi đây là màn hình "xem thử" mở từ trang Bố mẹ — nút chính sẽ đóng bản xem thử thay vì chỉ xác nhận. */
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
 * BlockScreen — hiển thị toàn màn hình khi bé mở app ngoài khung giờ được phép xem.
 * Được gọi từ Layout.tsx dựa trên kết quả của useTimeGate().
 *
 * Quan trọng: màn hình này KHÔNG có cách nào để bé tự đóng và xem nội dung được — nút
 * "VÂNG, con hiểu rồi" chỉ đổi trạng thái hiển thị tại chỗ (xác nhận đã đọc) chứ không gọi
 * ra ngoài, nên component cha vẫn giữ nguyên overlay. Cách duy nhất để rời màn hình này là
 * bố mẹ bấm "🔒 Bố mẹ vào đây" rồi nhập đúng mã PIN.
 */
export function BlockScreen({ nextWindowStart, onOpenParentGate, isPreview }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    playGentleChime();
  }, []);

  return (
    <div className="overlay show">
      <div className="block-card">
        <div className="block-emoji">🦉</div>
        <h2>Chưa đến giờ xem TV rồi!</h2>
        <p>
          Bây giờ chưa trong khung giờ được xem. Con hãy hoàn thành nhiệm vụ bố mẹ giao nhé, mình sẽ được xem lại
          vào lúc <b>{nextWindowStart ?? 'khung giờ được phép tiếp theo'}</b> nay 💛
        </p>
        <div className="block-sound-note">🔈 đang phát một giai điệu nhẹ nhàng...</div>
        <button
          className="submit-btn"
          onClick={() => (isPreview ? onOpenParentGate() : setAcknowledged(true))}
        >
          {isPreview ? 'Đóng xem thử' : acknowledged ? '💛 Con đã hiểu rồi' : 'VÂNG, con hiểu rồi'}
        </button>
        {!isPreview && (
          <button
            className="icon-btn"
            style={{ display: 'block', margin: '14px auto 0', fontSize: 12.5, opacity: 0.6 }}
            onClick={onOpenParentGate}
          >
            🔒 Bố mẹ vào đây
          </button>
        )}
      </div>
    </div>
  );
}
