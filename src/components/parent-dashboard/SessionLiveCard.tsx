import { CircleDot, Square, Undo2, Hourglass, Clock } from 'lucide-react';
import { useWatchSession } from '@/hooks/useWatchSession';
import { useToast } from '@/components/common/Toast';

interface Props {
  profileId: string;
  profileLabel: string;
}

/**
 * SessionLiveCard — hiển thị phiên xem hiện tại của 1 hồ sơ theo thời gian thực
 * (Supabase Realtime), với 2 lựa chọn điều khiển từ xa: tắt ngay, hoặc để xem xong
 * video hiện tại rồi mới tự tắt.
 */
export function SessionLiveCard({ profileId, profileLabel }: Props) {
  const { session, stopNow, toggleStopAfterCurrent } = useWatchSession(profileId);
  const { showToast } = useToast();

  if (!session || !session.is_active) {
    return (
      <div className="settings-card">
        <h4><CircleDot className="icon icon-lead" aria-hidden="true" /> Phiên xem hiện tại</h4>
        <span style={{ opacity: 0.6 }}>Không có phiên xem nào đang diễn ra.</span>
      </div>
    );
  }

  const elapsedMin = Math.round(session.elapsed_seconds / 60);

  return (
    <div className="settings-card">
      <h4><CircleDot className="icon icon-lead" aria-hidden="true" /> Phiên xem hiện tại</h4>
      <div className="session-live">
        <div style={{ width: '100%' }}>
          <div>
            <span className="live-dot" /> <b>{profileLabel}</b> đang xem: "{session.video_title}" — đã xem{' '}
            {elapsedMin} phút
          </div>
          {session.end_after_current && (
            <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 6, display: 'flex', alignItems: 'center' }}>
              <Clock className="icon icon-lead" aria-hidden="true" /> Sẽ tự kết thúc khi xem xong video này
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              data-region="psession"
              tabIndex={0}
              className="stop-btn"
              onClick={async () => {
                await stopNow(session);
                showToast(`Đã kết thúc phiên xem của ${profileLabel}`);
              }}
            >
              <Square className="icon icon-lead" aria-hidden="true" />
              Kết thúc phiên xem ngay
            </button>
            <button
              data-region="psession"
              tabIndex={0}
              className="add-window-btn"
              onClick={async () => {
                await toggleStopAfterCurrent(session);
                showToast(
                  session.end_after_current
                    ? 'Đã huỷ lịch tự tắt'
                    : `Sẽ tự tắt sau khi ${profileLabel} xem xong video này`
                );
              }}
            >
              {session.end_after_current ? (
                <>
                  <Undo2 className="icon icon-lead" aria-hidden="true" /> Huỷ lịch tắt
                </>
              ) : (
                <>
                  <Hourglass className="icon icon-lead" aria-hidden="true" /> Xem xong phiên rồi tắt
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
