import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { clearFamilyId } from '@/lib/familyId';
import { getOrCreateDeviceId, guessDeviceLabel } from '@/lib/deviceId';

export interface FamilyContentDevice {
  id: string;
  device_id: string;
  label: string;
  last_seen: string;
  created_at: string;
}

/**
 * useFamilyContentDevices — song song với useFamilyDevices (đăng nhập Khu Bố mẹ), nhưng
 * theo dõi 1 THỨ KHÁC HẲN: thiết bị nào đang "ghép" được XEM NỘI DUNG của gia đình (family_id
 * lưu trong localStorage, xem src/lib/familyId.ts) — bất kể thiết bị đó có từng đăng nhập
 * Khu Bố mẹ hay không. 1 TV ghép bằng "mã ghép TV" (xem GoogleSignInGate.tsx +
 * supabase/015_content_devices.sql) sẽ CHỈ xuất hiện ở đây, không hề có trong
 * "Thiết bị đã đăng nhập" — đúng ý muốn tách 2 quyền riêng biệt.
 *
 * 2 việc hook này làm:
 *   1) Tự ghi/refresh dòng của CHÍNH thiết bị này mỗi khi có familyId (gọi từ Layout.tsx,
 *      chạy trên MỌI thiết bị, không cần đăng nhập gì) — và lắng nghe Realtime: nếu bố mẹ
 *      bấm "Ngắt ghép" từ 1 thiết bị khác, THIẾT BỊ NÀY tự xoá familyId khỏi máy ngay lập
 *      tức, quay lại màn "Thiết lập lần đầu", không xem được nội dung nữa.
 *   2) refresh()/removeDevice(): dùng ở màn hình quản lý trong khu Bố mẹ — chỉ hoạt động khi
 *      đã đăng nhập (đọc toàn bộ danh sách và NGẮT GHÉP đều yêu cầu current_family_id(), xem
 *      file SQL — chỉ bố mẹ thật sự mới ngắt ghép được, không phải ai biết family_id cũng
 *      xoá được thiết bị của người khác).
 */
export function useFamilyContentDevices(familyId: string | null, onRevoked?: () => void) {
  const [devices, setDevices] = useState<FamilyContentDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const deviceId = getOrCreateDeviceId();

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('family_content_devices')
      .select('*')
      .order('last_seen', { ascending: false });
    if (error) {
      console.error('[Ytube] Không tải được danh sách thiết bị đã ghép:', error.message);
      setLoading(false);
      return;
    }
    setDevices(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!familyId) return;

    supabase
      .from('family_content_devices')
      .upsert(
        { family_id: familyId, device_id: deviceId, label: guessDeviceLabel(), last_seen: new Date().toISOString() },
        { onConflict: 'family_id,device_id' }
      )
      .then(({ error }) => {
        if (error) console.error('[Ytube] Không ghi được thiết bị đã ghép:', error.message);
      });

    // Hậu tố ngẫu nhiên trong tên kênh: hook này có thể được gọi ở nhiều nơi cùng lúc
    // (Layout.tsx + màn hình quản lý thiết bị) — mỗi lần gọi phải là 1 kênh Realtime RIÊNG.
    const channel = supabase
      .channel(`family_content_devices_self_${deviceId}_${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'family_content_devices', filter: `device_id=eq.${deviceId}` },
        () => {
          clearFamilyId();
          onRevoked?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  const removeDevice = async (id: string) => {
    const { error } = await supabase.from('family_content_devices').delete().eq('id', id);
    if (error) {
      console.error('[Ytube] Không ngắt ghép được thiết bị:', error.message);
      return false;
    }
    await refresh();
    return true;
  };

  return { devices, loading, deviceId, refresh, removeDevice };
}
