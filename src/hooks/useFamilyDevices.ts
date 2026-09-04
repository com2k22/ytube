import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

const DEVICE_ID_STORAGE_KEY = 'ytube.deviceId';

/** Sinh 1 mã ngẫu nhiên nhận diện thiết bị này — KHÔNG dùng crypto.randomUUID() vì trình
    duyệt cũ trên 1 số TV (webOS đời trước) chưa có hàm này, dễ vỡ im lặng. */
function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Đọc (hoặc tạo mới nếu chưa có) mã nhận diện RIÊNG của thiết bị này, lưu vào localStorage
    nên sống sót qua việc tắt/mở lại app — chỉ mất khi xoá dữ liệu trình duyệt/cài lại app. */
function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = randomId();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    // localStorage bị chặn (hiếm) → vẫn trả về 1 mã dùng tạm cho phiên này, chỉ là sẽ
    // không nhớ được qua lần mở app sau.
    return randomId();
  }
}

/** Đoán tên gợi nhớ cho thiết bị dựa vào user agent — chỉ để phụ huynh dễ nhận ra "thiết bị
    nào là thiết bị nào" trong danh sách, không cần chính xác tuyệt đối. */
function guessDeviceLabel(): string {
  const ua = navigator.userAgent || '';
  if (/Web0S|webOS/i.test(ua)) return '📺 TV LG webOS';
  if (/SmartTV|SMART-TV|TV;/i.test(ua)) return '📺 Smart TV';
  if (/Android/i.test(ua) && /TV/i.test(ua)) return '📺 TV Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return '📱 iPhone/iPad';
  if (/Android/i.test(ua)) return '📱 Điện thoại Android';
  if (/Mobile/i.test(ua)) return '📱 Điện thoại';
  return '💻 Máy tính';
}

export interface FamilyDevice {
  id: string;
  device_id: string;
  label: string;
  last_seen: string;
  created_at: string;
}

/**
 * useFamilyDevices — danh sách thiết bị đã đăng nhập tài khoản Google gia đình + khả năng
 * "đăng xuất từ xa" 1 thiết bị (xem supabase/012_...sql).
 *
 * Cách hoạt động: mỗi thiết bị tự nhớ 1 mã riêng (localStorage). Khi đăng nhập xong, thiết
 * bị tự ghi/refresh 1 dòng trong bảng family_devices. Phụ huynh mở danh sách này TỪ BẤT KỲ
 * thiết bị nào đã đăng nhập, thấy hết các thiết bị khác, bấm "Đăng xuất" là XOÁ dòng của
 * thiết bị đó — thiết bị bị xoá đang lắng nghe Realtime nên phát hiện ngay và tự đăng xuất
 * (không cần đợi thiết bị đó tự làm mới trang).
 */
export function useFamilyDevices(session: Session | null) {
  const [devices, setDevices] = useState<FamilyDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const deviceId = getOrCreateDeviceId();

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('family_devices')
      .select('*')
      .order('last_seen', { ascending: false });
    if (error) {
      console.error('[Ytube] Không tải được danh sách thiết bị:', error.message);
      setLoading(false);
      return;
    }
    setDevices(data ?? []);
    setLoading(false);
  }, []);

  // Vừa đăng nhập xong trên thiết bị này → ghi/refresh dòng của CHÍNH thiết bị này, đồng
  // thời lắng nghe: nếu dòng của mình bị phụ huynh xoá TỪ thiết bị khác thì tự đăng xuất
  // ngay lập tức, không đợi bấm gì thêm.
  useEffect(() => {
    if (!session) return;

    supabase
      .from('family_devices')
      .upsert(
        { device_id: deviceId, label: guessDeviceLabel(), last_seen: new Date().toISOString() },
        { onConflict: 'family_id,device_id' }
      )
      .then(({ error }) => {
        if (error) console.error('[Ytube] Không ghi được thiết bị:', error.message);
      });

    // Hậu tố ngẫu nhiên trong tên kênh: hook này có thể được gọi ở nhiều nơi cùng lúc
    // (Layout.tsx + màn hình quản lý thiết bị) — mỗi lần gọi phải là 1 kênh Realtime
    // RIÊNG, đặt trùng tên dễ bị Supabase ghi đè/mất kênh của nhau.
    const channel = supabase
      .channel(`family_devices_self_${deviceId}_${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'family_devices', filter: `device_id=eq.${deviceId}` },
        () => {
          supabase.auth.signOut();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Danh sách thiết bị chỉ cần tải khi thật sự mở màn hình quản lý (gọi refresh() thủ công
  // từ component), không tự tải ngay khi đăng nhập — tránh 1 câu truy vấn thừa mỗi lần mở
  // app trên TV trong lúc bé xem phim bình thường.

  const removeDevice = async (id: string) => {
    const { error } = await supabase.from('family_devices').delete().eq('id', id);
    if (error) {
      console.error('[Ytube] Không xoá được thiết bị:', error.message);
      return false;
    }
    await refresh();
    return true;
  };

  return { devices, loading, deviceId, refresh, removeDevice };
}
