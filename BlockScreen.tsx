import { useEffect } from 'react';

interface Props {
  nextWindowStart: string | null;
  onAcknowledge: () => void;
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
 * Được gọi từ App.tsx dựa trên kết quả của useTimeGate().
 */
export function BlockScreen({ nextWindowStart, onAcknowledge }: Props) {
  useEffect(() => {
    playGentleChime();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') onAcknowledge();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onAcknowledge]);

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
        <button className="submit-btn" onClick={onAcknowledge}>
          VÂNG, con hiểu rồi
        </button>
      </div>
    </div>
  );
}
