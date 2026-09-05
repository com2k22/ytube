import { useEffect, useRef, useState } from 'react';
import { Link2, RefreshCw, Plus } from 'lucide-react';
import { useFamilyPairing } from '@/hooks/useFamilyPairing';
import { useToast } from '@/components/common/Toast';

const CODE_TTL_SECONDS = 15 * 60;

/**
 * PairingCodeCard — "Ghép TV mới" trong khu Bố mẹ (tab Tài khoản). Dùng khi có 1 TV mới
 * muốn xem được nội dung của gia đình, nhưng KHÔNG muốn bé tự vào được Khu vực Bố mẹ trên
 * TV đó (xem supabase/014_pairing_codes.sql + GoogleSignInGate.tsx phần "Ghép bằng mã").
 *
 * Bấm "Tạo mã ghép" ở ĐÂY (điện thoại/máy tính đã đăng nhập sẵn) → hiện ra 1 mã 6 số, có
 * hiệu lực 15 phút, dùng 1 lần → sang TV mới, chọn "Ghép bằng mã từ điện thoại" và gõ đúng
 * mã đó bằng điều khiển TV.
 */
export function PairingCodeCard() {
  const { creating, createPairingCode } = useFamilyPairing();
  const { showToast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const onCreate = async () => {
    const { code: newCode, error } = await createPairingCode();
    if (error || !newCode) {
      showToast(`Không tạo được mã: ${error ?? 'lỗi không rõ'}`);
      return;
    }
    setCode(newCode);
    setSecondsLeft(CODE_TTL_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const expired = code !== null && secondsLeft === 0;

  return (
    <div className="settings-card" style={{ marginTop: 20 }}>
      <h4><Link2 className="icon icon-lead" aria-hidden="true" /> Ghép TV mới</h4>
      <p style={{ opacity: 0.65, margin: '-6px 0 16px', fontSize: 12.5 }}>Tạo mã, nhập trên TV mới để ghép.</p>

      {code && !expired && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: 8,
            padding: '14px 0',
            marginBottom: 10,
          }}
        >
          {code}
        </div>
      )}
      {code && !expired && (
        <p style={{ textAlign: 'center', opacity: 0.6, fontSize: 12.5, margin: '0 0 16px' }}>
          Còn hiệu lực {mm}:{ss} — dùng 1 lần
        </p>
      )}
      {expired && (
        <p style={{ textAlign: 'center', opacity: 0.7, fontSize: 13, margin: '0 0 16px' }}>
          Mã đã hết hạn — tạo mã mới nhé.
        </p>
      )}

      <button
        className="add-window-btn"
        data-region="ppair"
        tabIndex={0}
        disabled={creating}
        onClick={onCreate}
      >
        {creating ? (
          'Đang tạo...'
        ) : code ? (
          <>
            <RefreshCw className="icon icon-lead" aria-hidden="true" /> Tạo mã mới
          </>
        ) : (
          <>
            <Plus className="icon icon-lead" aria-hidden="true" /> Tạo mã ghép
          </>
        )}
      </button>
    </div>
  );
}
