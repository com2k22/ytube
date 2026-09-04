import { useState } from 'react';
import { useFamilyAuth } from '@/hooks/useFamilyAuth';
import { useToast } from '@/components/common/Toast';

interface Props {
  onClose: () => void;
  /** false = bắt buộc đăng nhập, không cho đóng/bỏ qua (dùng khi "Thiết lập lần đầu" cho
      1 thiết bị mới — xem FamilyBindingScreen.tsx). Mặc định true (có thể bấm ✕ để đóng,
      dùng khi mở từ nút 🔒 Bố mẹ như trước giờ). */
  dismissable?: boolean;
}

/**
 * GoogleSignInGate — thay cho PinModal khi vào khu Bố mẹ (xem supabase/011_family_auth.sql
 * + useFamilyAuth.ts). Đăng nhập đúng tài khoản Google của gia đình 1 lần là xong — thiết
 * bị này nhớ luôn, lần sau vào khu Bố mẹ không hỏi lại nữa.
 *
 * Có 2 CÁCH đăng nhập:
 *   1) Nút "Đăng nhập bằng Google" — thử trước, đơn giản nhất nếu trình duyệt TV cho phép.
 *   2) "Hoặc dùng mã gửi qua email" — DỰ PHÒNG cho trường hợp Google chặn trình duyệt TV
 *      (lỗi "disallowed_useragent"). Bấm "Gửi mã" → Supabase gửi 1 email chứa mã 6 số tới
 *      Gmail gia đình → mở email đó bằng điện thoại → gõ mã 6 số vào ô bên dưới bằng điều
 *      khiển TV → xong, không cần Google gì cả.
 */
export function GoogleSignInGate({ onClose, dismissable = true }: Props) {
  const { signInWithGoogle, sendEmailCode, confirmEmailCode } = useFamilyAuth();
  const { showToast } = useToast();
  // Không tự điền sẵn email nữa (trước đây điền sẵn Gmail chủ nhà — giờ app dùng chung cho
  // nhiều gia đình khác nhau nên không còn 1 email cố định đúng cho tất cả).
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async () => {
    setError('');
    setSending(true);
    const { error: err } = await sendEmailCode(email.trim());
    setSending(false);
    if (err) {
      setError('Không gửi được mã — kiểm tra lại email hoặc thử lại sau.');
      return;
    }
    setSent(true);
    showToast('📩 Đã gửi mã tới email — mở email bằng điện thoại để xem mã');
  };

  const handleConfirmCode = async () => {
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('Mã gồm đúng 6 chữ số.');
      return;
    }
    setConfirming(true);
    const { error: err } = await confirmEmailCode(email.trim(), code);
    setConfirming(false);
    if (err) {
      setError('Mã không đúng hoặc đã hết hạn — bấm "Gửi lại mã" để nhận mã mới.');
      return;
    }
    // Đăng nhập xong: onAuthStateChange trong useFamilyAuth tự cập nhật, Layout.tsx tự
    // đóng lớp phủ này khi phát hiện đã có session — không cần tự gọi onClose ở đây.
  };

  return (
    // data-nav-scope: khoá màn hình lại, chỉ bấm được các phím trong lớp phủ này (giống
    // PinModal cũ) — nhờ vậy trên TV không lỡ tay chọn trúng video phía sau.
    <div
      className="overlay show"
      data-nav-scope
      onClick={(e) => dismissable && e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <h3>🔒 Khu vực Bố mẹ</h3>
        <p style={{ opacity: 0.75, margin: '10px 0 22px', lineHeight: 1.5 }}>
          Đăng nhập bằng tài khoản Google của gia đình để vào chỉnh whitelist, giờ giấc...
          Đăng nhập 1 lần, thiết bị này sẽ nhớ luôn cho lần sau.
        </p>
        <button
          data-region="pin"
          tabIndex={0}
          onClick={() => signInWithGoogle()}
          style={{
            width: '100%',
            padding: '16px 20px',
            fontSize: 16,
            fontWeight: 800,
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            background: '#fff',
            color: '#1a1a1a',
          }}
        >
          Đăng nhập bằng Google
        </button>

        <div style={{ margin: '20px 0 14px', opacity: 0.55, fontSize: 13, textAlign: 'center' }}>
          — hoặc dùng mã gửi qua email (nếu TV không cho đăng nhập Google) —
        </div>

        <div className="form-row">
          <label>Email nhận mã</label>
          <input
            type="email"
            data-region="pinemail"
            tabIndex={0}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sent}
          />
        </div>

        {!sent ? (
          <button
            className="add-window-btn"
            style={{ width: '100%' }}
            data-region="pinemail"
            tabIndex={0}
            disabled={sending || !email.trim()}
            onClick={handleSendCode}
          >
            {sending ? 'Đang gửi...' : '📩 Gửi mã'}
          </button>
        ) : (
          <>
            <div className="form-row">
              <label>Mã 6 số nhận được qua email</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                data-region="pinemail"
                tabIndex={0}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
              />
            </div>
            <button
              className="submit-btn"
              style={{ width: '100%' }}
              data-region="pinemail"
              tabIndex={0}
              disabled={confirming}
              onClick={handleConfirmCode}
            >
              {confirming ? 'Đang kiểm tra...' : '✅ Xác nhận mã'}
            </button>
            <button
              className="add-window-btn"
              style={{ width: '100%', marginTop: 8 }}
              data-region="pinemail"
              tabIndex={0}
              disabled={sending}
              onClick={handleSendCode}
            >
              Gửi lại mã
            </button>
          </>
        )}

        {error && <div className="hint bad-text" style={{ height: 'auto', margin: '10px 0 0' }}>✕ {error}</div>}

        {dismissable && (
          <button className="close-x" data-region="pinclose" tabIndex={0} onClick={onClose}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
