import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2 } from 'lucide-react';
import {
  disablePush,
  enablePush,
  isIos,
  isStandalone,
  isSubscribed,
  permissionState,
  pushSupported,
} from '@/lib/push';

/**
 * PushSetupCard — nút bật/tắt thông báo đẩy cho CHÍNH máy đang mở trang này.
 *
 * Vì sao là "máy này" chứ không phải một công tắc chung: mỗi điện thoại phải tự đăng ký
 * riêng. Bật trên máy bố thì máy mẹ vẫn im — muốn cả hai nhận thì mỗi máy vào đây bấm một
 * lần. Nói rõ điều này trên màn hình luôn, để khỏi tưởng bật 1 lần là xong cả nhà.
 *
 * Nút phải do NGƯỜI DÙNG CHẠM mới chạy: iPhone/Android chỉ cho hiện hộp thoại xin quyền
 * ngay sau một cú chạm thật, không cho tự bật lúc mở trang.
 */
export function PushSetupCard() {
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  useEffect(() => {
    isSubscribed().then(setSubscribed);
  }, []);

  const supported = pushSupported();
  const blocked = permissionState() === 'denied';
  /** iPhone mở trong tab Safari thì không bao giờ bật được — phải mở từ icon màn hình chính. */
  const iosNeedsHomeScreen = isIos() && !isStandalone();

  const onEnable = async () => {
    setBusy(true);
    setMessage(null);
    const result = await enablePush(label.trim() || 'Điện thoại bố mẹ');
    setMessage(result.message);
    if (result.ok) setSubscribed(true);
    setBusy(false);
  };

  const onDisable = async () => {
    setBusy(true);
    const result = await disablePush();
    setMessage(result.message);
    setSubscribed(false);
    setBusy(false);
  };

  return (
    <div className="settings-card">
      <h4><Bell className="icon icon-lead" aria-hidden="true" /> Thông báo trên máy này</h4>
      <p style={{ fontSize: 12.5, opacity: 0.7, margin: '-8px 0 14px' }}>Bật riêng từng máy.</p>

      {!supported && <div className="hint bad-text" style={{ height: 'auto' }}>Máy này không hỗ trợ thông báo đẩy.</div>}

      {supported && iosNeedsHomeScreen && (
        <div className="hint bad-text" style={{ height: 'auto', marginBottom: 12 }}>
          Đang mở trong Safari. Trên iPhone/iPad phải mở app bằng <b>icon Ytube ngoài màn hình chính</b> thì mới bật
          được thông báo — đây là quy định của Apple.
        </div>
      )}

      {supported && blocked && (
        <div className="hint bad-text" style={{ height: 'auto', marginBottom: 12 }}>
          Máy đang CHẶN thông báo của app. Vào Cài đặt của điện thoại (phần Thông báo / Trang web) để bật lại rồi
          quay lại đây.
        </div>
      )}

      {supported && !subscribed && (
        <>
          <div className="form-row">
            <label>Đặt tên máy này (để sau còn nhớ)</label>
            <input
              data-region="ppush"
              tabIndex={0}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="VD: iPhone của bố"
            />
          </div>
          <button
            className="submit-btn"
            style={{ width: 'auto', padding: '12px 26px' }}
            data-region="ppush"
            tabIndex={0}
            disabled={busy || blocked || iosNeedsHomeScreen}
            onClick={onEnable}
          >
            {busy ? (
              'Đang bật...'
            ) : (
              <>
                <Bell className="icon icon-lead" aria-hidden="true" /> Bật thông báo cho máy này
              </>
            )}
          </button>
        </>
      )}

      {supported && subscribed && (
        <>
          <div className="hint ok-text" style={{ height: 'auto', marginBottom: 12, display: 'flex', alignItems: 'center' }}>
            <CheckCircle2 className="icon icon-lead" aria-hidden="true" /> Máy này đang nhận thông báo.
          </div>
          <button
            className="add-window-btn"
            data-region="ppush"
            tabIndex={0}
            disabled={busy}
            onClick={onDisable}
          >
            <BellOff className="icon icon-lead" aria-hidden="true" /> Tắt thông báo trên máy này
          </button>
        </>
      )}

      {message && (
        <div className="hint" style={{ height: 'auto', marginTop: 12, opacity: 0.85 }}>
          {message}
        </div>
      )}
    </div>
  );
}
