import { useEffect } from 'react';
import { useFamilyAuth } from '@/hooks/useFamilyAuth';
import { useFamilyDevices } from '@/hooks/useFamilyDevices';
import { useToast } from '@/components/common/Toast';

/** "5 phút trước" / "hôm qua"... — tương tự agoLabel ở TimeRequestCard nhưng có thêm mốc
    xa hơn, vì thiết bị có thể không đăng nhập lại trong nhiều ngày. */
function lastSeenLabel(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

/**
 * DeviceManagerCard — "Thiết bị đã đăng nhập Khu Bố mẹ" trong khu Bố mẹ (tab Tài khoản).
 * Xem toàn bộ thiết bị/TV đã đăng nhập tài khoản Google gia đình, đăng xuất từ xa 1 thiết bị
 * nếu cần (vd lỡ đăng nhập nhầm chỗ nào đó, hoặc đổi TV không dùng cái cũ nữa).
 *
 * KHÁC với ContentDeviceManagerCard.tsx ("Thiết bị đã ghép xem nội dung") — đăng xuất ở đây
 * chỉ chặn thiết bị đó vào Khu vực Bố mẹ, KHÔNG chặn xem phim (TV ghép bằng mã thậm chí
 * không hề xuất hiện ở danh sách này, vì nó chưa từng đăng nhập gì cả).
 */
export function DeviceManagerCard() {
  const { session } = useFamilyAuth();
  const { devices, loading, deviceId, refresh, removeDevice } = useFamilyDevices(session);
  const { showToast } = useToast();

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRemove = async (id: string, label: string, isThisDevice: boolean) => {
    const msg = isThisDevice
      ? `Đây là THIẾT BỊ ĐANG DÙNG (${label}) — đăng xuất sẽ thoát khỏi khu Bố mẹ ngay trên chính thiết bị này. Vẫn đăng xuất?`
      : `Đăng xuất "${label}" khỏi tài khoản gia đình? Thiết bị đó sẽ tự đăng xuất trong giây lát.`;
    if (!window.confirm(msg)) return;
    const ok = await removeDevice(id);
    if (ok) showToast('✅ Đã đăng xuất thiết bị');
    else showToast('Có lỗi khi đăng xuất — thử lại nhé.');
  };

  return (
    <div className="settings-card" style={{ marginTop: 20 }}>
      <h4>🔑 Thiết bị đã đăng nhập Khu Bố mẹ</h4>
      <p style={{ opacity: 0.65, margin: '-6px 0 16px', fontSize: 12.5, lineHeight: 1.5 }}>
        Mọi TV/thiết bị đã từng đăng nhập tài khoản Google gia đình. Đăng xuất 1 thiết bị ở
        đây thì thiết bị đó tự thoát khỏi khu Bố mẹ ngay (nhưng vẫn xem phim bình thường —
        muốn chặn xem phim thì dùng mục "📺 Thiết bị đã ghép xem nội dung" bên dưới).
      </p>

      {loading ? (
        <p style={{ opacity: 0.6 }}>Đang tải...</p>
      ) : devices.length === 0 ? (
        <p style={{ opacity: 0.6 }}>Chưa có thiết bị nào — thử tải lại trang này.</p>
      ) : (
        devices.map((d) => {
          const isThisDevice = d.device_id === deviceId;
          return (
            <div key={d.id} className="added-item" style={{ marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div>
                  {d.label} {isThisDevice && <span style={{ opacity: 0.6 }}>(thiết bị này)</span>}
                </div>
                <div style={{ opacity: 0.55, fontSize: 12 }}>Hoạt động gần nhất: {lastSeenLabel(d.last_seen)}</div>
              </div>
              <button
                className="icon-btn"
                data-region="pdevice"
                tabIndex={0}
                title="Đăng xuất thiết bị này"
                onClick={() => onRemove(d.id, d.label, isThisDevice)}
              >
                🚪
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
