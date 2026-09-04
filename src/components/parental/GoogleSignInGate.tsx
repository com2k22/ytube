import { useState } from 'react';
import { useFamilyAuth } from '@/hooks/useFamilyAuth';
import { useFamilyPairing } from '@/hooks/useFamilyPairing';
import { useToast } from '@/components/common/Toast';
import { setFamilyId } from '@/lib/familyId';

interface Props {
  onClose: () => void;
  /** false = bắt buộc đăng nhập, không cho đóng/bỏ qua (dùng khi "Thiết lập lần đầu" cho
      1 thiết bị mới — xem FamilyBindingScreen.tsx). Mặc định true (có thể bấm ✕ để đóng,
      dùng khi mở từ nút 🔒 Bố mẹ như trước giờ). */
  dismissable?: boolean;
  /** true = cho phép "Ghép bằng mã từ điện thoại" (xem PairingCodeCard.tsx +
      supabase/014_pairing_codes.sql) — CHỈ bật ở màn "Thiết lập lần đầu" (Layout.tsx,
      needsFamilySetup). Khi đã có gia đình rồi (mở khu Bố mẹ bình thường) thì ghép mã không
      còn ý nghĩa gì nữa, nên mặc định false, ẩn hẳn lựa chọn này đi. */
  allowPairing?: boolean;
  /** Gọi khi ghép mã THÀNH CÔNG — family_id đã lưu vào thiết bị (setFamilyId), Layout.tsx
      cập nhật state + tải lại hồ sơ. KHÔNG tạo phiên đăng nhập Google/email nào cho thiết
      bị này — khác với đăng nhập trực tiếp, nhờ vậy bé không tự vào được Khu vực Bố mẹ. */
  onPaired?: (familyId: string) => void;
}

const PAIR_CODE_LENGTH = 6;
const PAIR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'xóa', '0', 'nhập'];

/**
 * GoogleSignInGate — thay cho PinModal khi vào khu Bố mẹ (xem supabase/011_family_auth.sql
 * + useFamilyAuth.ts). Màn "Thiết lập lần đầu" (allowPairing=true) làm nổi bật 2 lựa chọn
 * RÕ RÀNG, tách biệt hẳn (xem .gate-option--login / .gate-option--pair trong theme.css):
 *   A) 🔑 ĐĂNG NHẬP — TV đầu tiên của gia đình, hoặc đã có tài khoản Google gia đình.
 *      Nút Google to, nổi bật nhất. "Dùng mã gửi qua email" thu gọn phía dưới dạng 1 nút
 *      chữ nhỏ (bấm mới hiện form) — DỰ PHÒNG khi Google chặn trình duyệt TV (lỗi
 *      "disallowed_useragent"), đỡ rối mắt lúc mới mở màn hình.
 *   B) 🔗 GHÉP MÃ TV — đã có tài khoản gia đình rồi, chỉ cần ghép thêm 1 TV mới, không muốn
 *      bé tự vào được Khu vực Bố mẹ trên TV đó. Bấm mở bàn phím số, gõ mã lấy từ điện thoại
 *      (xem PairingCodeCard.tsx).
 * Khi mở từ nút 🔒 Bố mẹ bình thường (allowPairing=false, đã có gia đình rồi) thì CHỈ còn
 * lựa chọn A — ghép mã lúc này không còn ý nghĩa gì nữa.
 */
export function GoogleSignInGate({ onClose, dismissable = true, allowPairing = false, onPaired }: Props) {
  const { signInWithGoogle, sendEmailCode, confirmEmailCode } = useFamilyAuth();
  const { redeemPairingCode, redeeming } = useFamilyPairing();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'pairing'>('login');
  const [showEmailFallback, setShowEmailFallback] = useState(false);
  // Không tự điền sẵn email nữa (trước đây điền sẵn Gmail chủ nhà — giờ app dùng chung cho
  // nhiều gia đình khác nhau nên không còn 1 email cố định đúng cho tất cả).
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [pairError, setPairError] = useState('');

  const handleSendCode = async () => {
    setError('');
    setSending(true);
    const { error: err } = await sendEmailCode(email.trim());
    setSending(false);
    if (err) {
      // Kèm luôn nội dung lỗi thật từ Supabase (thay vì chỉ 1 câu chung chung) — để biết
      // chính xác vì sao gửi hỏng (vd sai cấu hình SMTP, giới hạn số email/giờ...).
      setError(`Không gửi được mã: ${err.message}`);
      return;
    }
    setSent(true);
    showToast('📩 Đã gửi mã tới email — mở email bằng điện thoại để xem mã');
  };

  const handleConfirmCode = async () => {
    setError('');
    if (!/^\d{4,10}$/.test(code)) {
      setError('Mã gồm từ 4 đến 10 chữ số.');
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

  const submitPairCode = async (candidate: string) => {
    if (redeeming) return;
    setPairError('');
    const { familyId, error: err } = await redeemPairingCode(candidate);
    if (err || !familyId) {
      setPairError(err ?? 'Mã sai hoặc đã hết hạn.');
      setPairCode('');
      return;
    }
    setFamilyId(familyId);
    showToast('✅ Đã ghép TV vào gia đình');
    onPaired?.(familyId);
  };

  const pressPairKey = (k: string) => {
    if (redeeming) return;
    if (k === 'xóa') {
      setPairCode((p) => p.slice(0, -1));
      return;
    }
    if (k === 'nhập') {
      if (pairCode.length === PAIR_CODE_LENGTH) submitPairCode(pairCode);
      return;
    }
    setPairCode((p) => {
      const next = p.length < PAIR_CODE_LENGTH ? p + k : p;
      if (next.length === PAIR_CODE_LENGTH) submitPairCode(next);
      return next;
    });
  };

  return (
    // data-nav-scope: khoá màn hình lại, chỉ bấm được các phím trong lớp phủ này (giống
    // PinModal cũ) — nhờ vậy trên TV không lỡ tay chọn trúng video phía sau.
    <div
      className="overlay show"
      data-nav-scope
      onClick={(e) => dismissable && e.target === e.currentTarget && onClose()}
    >
      <div className="modal gate-modal">
        {mode === 'login' ? (
          <>
            <h3>👋 Vào Ytube</h3>

            <div className="gate-option gate-option--login">
              <div className="gate-option-head">
                <span className="gate-option-icon">🔑</span>
                <span className="gate-option-title">Đăng nhập</span>
              </div>
              <p className="gate-option-sub">Tài khoản Google của gia đình (tạo mới nếu chưa có).</p>
              <button className="gate-google-btn" data-region="pin" tabIndex={0} onClick={() => signInWithGoogle()}>
                Đăng nhập bằng Google
              </button>

              {!showEmailFallback ? (
                <button
                  className="gate-link-btn"
                  data-region="pinemail"
                  tabIndex={0}
                  onClick={() => setShowEmailFallback(true)}
                >
                  TV không đăng nhập Google được? Dùng mã email
                </button>
              ) : (
                <>
                  <div className="form-row" style={{ marginTop: 14 }}>
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
                        <label>Mã nhận được qua email</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          data-region="pinemail"
                          tabIndex={0}
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="Nhập mã trong email"
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

                  {error && (
                    <div className="hint bad-text" style={{ height: 'auto', margin: '10px 0 0' }}>✕ {error}</div>
                  )}
                </>
              )}
            </div>

            {allowPairing && (
              <div className="gate-option gate-option--pair">
                <div className="gate-option-head">
                  <span className="gate-option-icon">🔗</span>
                  <span className="gate-option-title">Ghép mã TV</span>
                </div>
                <p className="gate-option-sub">Đã có tài khoản gia đình — chỉ ghép thêm TV này.</p>
                <button
                  className="gate-pair-btn"
                  data-region="pinemail"
                  tabIndex={0}
                  onClick={() => {
                    setMode('pairing');
                    setPairCode('');
                    setPairError('');
                  }}
                >
                  Nhập mã ghép
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <h3>🔗 Ghép mã TV</h3>
            <p className="gate-desc">Mở khu Bố mẹ trên điện thoại → Tài khoản → "Ghép TV mới" để lấy mã.</p>
            <div className="pin-dots">
              {Array.from({ length: PAIR_CODE_LENGTH }).map((_, i) => (
                <div key={i} className={`pin-dot ${i < pairCode.length ? 'filled' : ''}`} />
              ))}
            </div>
            <div className="keypad">
              {/* data-region + tabIndex: bấm được bằng điều khiển TV, giống hệt bàn phím PIN
                  cũ (xem PinModal.tsx) — dễ dùng hơn nhiều so với gõ email bằng bàn phím chữ. */}
              {PAIR_KEYS.map((k) => (
                <button
                  key={k}
                  className={`key ${k.length > 1 ? 'wide' : ''}`}
                  data-region="ppaircode"
                  tabIndex={0}
                  disabled={redeeming}
                  onClick={() => pressPairKey(k)}
                >
                  {k === 'xóa' ? '⌫' : k === 'nhập' ? '✓' : k}
                </button>
              ))}
            </div>
            {redeeming && <p style={{ textAlign: 'center', opacity: 0.6, fontSize: 13 }}>Đang kiểm tra...</p>}
            {pairError && (
              <div className="hint bad-text" style={{ height: 'auto', margin: '10px 0 0' }}>✕ {pairError}</div>
            )}
            <button
              className="add-window-btn"
              style={{ width: '100%', marginTop: 14 }}
              data-region="ppaircode"
              tabIndex={0}
              onClick={() => setMode('login')}
            >
              ← Quay lại
            </button>
          </>
        )}

        {dismissable && (
          <button className="close-x" data-region="pinclose" tabIndex={0} onClick={onClose}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
