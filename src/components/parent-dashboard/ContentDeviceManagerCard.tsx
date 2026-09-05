import { useEffect } from 'react';
import { Tv, Unplug } from 'lucide-react';
import { useFamilyContentDevices } from '@/hooks/useFamilyContentDevices';
import { useToast } from '@/components/common/Toast';
import { getFamilyId } from '@/lib/familyId';

/** "5 phút trước" / "hôm qua"... — giống hệt DeviceManagerCard.tsx. */
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
 * ContentDeviceManagerCard — "Thiết bị đã ghép xem nội dung" trong khu Bố mẹ (tab Tài
 * khoản). KHÁC với DeviceManagerCard ("Thiết bị đã đăng nhập") — đây là danh sách MỌI thiết
 * bị đang xem được nội dung gia đình, kể cả TV ghép bằng mã chưa từng đăng nhập gì (xem
 * supabase/015_content_devices.sql). "Ngắt ghép" 1 thiết bị ở đây = chặn hẳn không cho TV
 * đó xem phim nữa, khác với "Đăng xuất" bên kia (chỉ chặn vào Khu vực Bố mẹ).
 */
export function ContentDeviceManagerCard() {
  const familyId = getFamilyId();
  const { devices, loading, deviceId, refresh, removeDevice } = useFamilyContentDevices(familyId);
  const { showToast } = useToast();

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRemove = async (id: string, label: string, isThisDevice: boolean) => {
    const msg = isThisDevice
      ? `Đây là THIẾT BỊ ĐANG DÙNG (${label}) — ngắt ghép sẽ khiến chính thiết bị này KHÔNG xem được nội dung nữa. Vẫn ngắt ghép?`
      : `Ngắt ghép "${label}" khỏi gia đình? Thiết bị đó sẽ không xem được nội dung nữa cho tới khi ghép lại.`;
    if (!window.confirm(msg)) return;
    const ok = await removeDevice(id);
    if (ok) showToast('Đã ngắt ghép thiết bị');
    else showToast('Có lỗi khi ngắt ghép — thử lại nhé.');
  };

  return (
    <div className="settings-card" style={{ marginTop: 20 }}>
      <h4><Tv className="icon icon-lead" aria-hidden="true" /> Thiết bị đã ghép xem nội dung</h4>
      <p style={{ opacity: 0.65, margin: '-6px 0 16px', fontSize: 12.5 }}>Ngắt ghép = thiết bị hết xem được phim.</p>

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
                data-region="pcontentdevice"
                tabIndex={0}
                title="Ngắt ghép thiết bị này"
                onClick={() => onRemove(d.id, d.label, isThisDevice)}
              >
                <Unplug className="icon" aria-hidden="true" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
