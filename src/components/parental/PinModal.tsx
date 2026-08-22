import { useEffect, useState } from 'react';
import { useParentalPin } from '@/hooks/useParentalPin';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'xóa', '0', 'nhập'];

/** Modal nhập mã PIN phụ huynh — xác thực qua RPC verify_parent_pin (không lộ PIN thật). */
export function PinModal({ open, onClose, onSuccess }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const { verifyPin, verifying } = useParentalPin();

  useEffect(() => {
    if (open) {
      setPin('');
      setError('');
    }
  }, [open]);

  const submit = async (candidate: string) => {
    const ok = await verifyPin(candidate);
    if (ok) {
      onSuccess();
    } else {
      setError('Sai mã PIN, thử lại nhé');
      setShake(true);
      setTimeout(() => setShake(false), 350);
      setPin('');
    }
  };

  const pressKey = (k: string) => {
    if (verifying) return;
    if (k === 'xóa') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (k === 'nhập') {
      submit(pin);
      return;
    }
    setPin((p) => {
      const next = p.length < 4 ? p + k : p;
      if (next.length === 4) submit(next);
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (/^[0-9]$/.test(e.key)) pressKey(e.key);
      else if (e.key === 'Backspace') pressKey('xóa');
      else if (e.key === 'Enter') pressKey('nhập');
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pin]);

  if (!open) return null;

  return (
    // data-nav-scope: khoá màn hình lại, chỉ bấm được các phím trong bảng này (giống
    // BlockScreen) — nhờ vậy trên TV không lỡ tay chọn trúng video phía sau.
    <div className="overlay show" data-nav-scope onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${shake ? 'shake' : ''}`}>
        <h3>🔒 Nhập mã PIN phụ huynh</h3>
        <p className="sub">Mã mặc định demo: 1234</p>
        <div className="pin-dots">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
          ))}
        </div>
        <div className="keypad">
          {/* data-region + tabIndex: để bấm được bàn phím số này bằng điều khiển TV
              (4 hàng × 3 cột — số cột khai báo ở SECTION_COLS trong Layout.tsx). */}
          {KEYS.map((k) => (
            <button
              key={k}
              className={`key ${k.length > 1 ? 'wide' : ''}`}
              data-region="pin"
              tabIndex={0}
              onClick={() => pressKey(k)}
            >
              {k === 'xóa' ? '⌫' : k === 'nhập' ? '✓' : k}
            </button>
          ))}
        </div>
        <div className="err">{error}</div>
        {/* Nút ✕ cố ý đặt CUỐI trong mã nguồn (vị trí hiển thị vẫn ở góc trên phải nhờ CSS
            position: absolute). Lý do: điều khiển TV chạy theo thứ tự trong mã nguồn — để
            nút này lên đầu thì mở bảng ra ô chọn nằm ngay trên nút Đóng, bấm OK là thoát
            luôn. Đặt xuống cuối thì ô chọn rơi đúng vào phím số 1. */}
        <button className="close-x" data-region="pinclose" tabIndex={0} onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
}
