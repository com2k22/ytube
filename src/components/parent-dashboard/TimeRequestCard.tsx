import { useProfileContext } from '@/context/ProfileContext';
import { useTimeRequests } from '@/hooks/useTimeRequests';
import { PROFILE_EMOJI } from '@/constants';

/** Các mức phút bố mẹ bấm 1 nút là cho luôn, khỏi phải gõ số. */
const QUICK_MINUTES = [10, 15, 30];

/** "3 phút trước" — cho biết lời xin mới hay đã lâu, để bố mẹ biết bé còn đang chờ không. */
function agoLabel(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'vừa xong';
  return `${minutes} phút trước`;
}

/**
 * TimeRequestCard — thẻ "con đang xin thêm giờ" trong khu Bố mẹ.
 *
 * Chỉ hiện khi THẬT SỰ có bé đang chờ, còn lại ẩn hẳn để tab Quản lý thời gian không bị
 * thêm một khối trống vô nghĩa.
 *
 * Bấm duyệt ở đây thì TV mở khoá NGAY (qua Realtime của Supabase — xem useTimeRequests),
 * đúng số phút đã cho, hết thì tự khoá lại. Bố mẹ không phải nhớ quay lại tắt.
 */
export function TimeRequestCard() {
  const { profiles } = useProfileContext();
  const { pending, approve, deny } = useTimeRequests(null);

  if (pending.length === 0) return null;

  return (
    <div className="settings-card request-card">
      <h4>🙋 Con đang xin thêm giờ ({pending.length})</h4>

      {pending.map((req) => {
        const child = profiles.find((p) => p.id === req.profile_id);
        return (
          <div className="request-row" key={req.id}>
            <div className="request-who">
              <span className="request-emoji">{PROFILE_EMOJI[req.profile_id] ?? '🙂'}</span>
              <div>
                <div className="request-name">{child?.name ?? 'Bé'} xin thêm {req.requested_minutes} phút</div>
                <div className="request-meta">
                  {agoLabel(req.created_at)}
                  {req.reason === 'outside_window' ? ' · chưa tới giờ xem' : ' · đã hết giờ hôm nay'}
                </div>
              </div>
            </div>

            <div className="request-actions">
              {QUICK_MINUTES.map((m) => (
                <button
                  key={m}
                  className="add-window-btn"
                  data-region="prequest"
                  tabIndex={0}
                  onClick={() => approve(req.id, m)}
                >
                  +{m}′
                </button>
              ))}
              <button
                className="add-window-btn request-deny"
                data-region="prequest"
                tabIndex={0}
                onClick={() => deny(req.id)}
              >
                ✕ Không
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
