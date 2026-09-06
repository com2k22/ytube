import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getFamilyId } from '@/lib/familyId';

/**
 * useHomeBackground — đọc/đổi hình nền Trang chủ theo mùa/dịp lễ của CẢ GIA ĐÌNH (xem
 * supabase/017_home_background.sql + src/constants/backgroundThemes.ts).
 *
 * Đọc dùng được ở MỌI THIẾT BỊ kể cả bé chưa đăng nhập gì (Layout.tsx gọi hook này để tự
 * hiện đúng hình nền gia đình đã chọn) — chỉ cần biết familyId của thiết bị (lưu sẵn trong
 * localStorage, xem src/lib/familyId.ts). Đổi hình nền (setBackground) thì phải đăng nhập
 * đúng gia đình — chỉ gọi từ khu Bố mẹ (HomeBackgroundCard.tsx), gọi từ thiết bị chưa đăng
 * nhập sẽ bị Supabase từ chối (RLS) một cách âm thầm (trả về error, không có gì hỏng).
 */
export function useHomeBackground() {
  const [backgroundId, setBackgroundIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const familyId = getFamilyId();
    if (!familyId) {
      setBackgroundIdState(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('family_settings')
      .select('home_background')
      .eq('family_id', familyId)
      .maybeSingle();
    if (error) {
      console.error('[Ytube] Không tải được hình nền Trang chủ:', error.message);
      setLoading(false);
      return;
    }
    setBackgroundIdState(data?.home_background ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** id = null nghĩa là quay về nền mặc định. */
  const setBackground = async (id: string | null): Promise<boolean> => {
    const familyId = getFamilyId();
    if (!familyId) return false;
    const previous = backgroundId;
    setBackgroundIdState(id); // cập nhật ngay trên màn hình, khỏi phải chờ mạng
    const { error } = await supabase
      .from('family_settings')
      .upsert({ family_id: familyId, home_background: id, updated_at: new Date().toISOString() }, { onConflict: 'family_id' });
    if (error) {
      console.error('[Ytube] Không lưu được hình nền Trang chủ:', error.message);
      setBackgroundIdState(previous); // lưu hỏng thì trả lại lựa chọn cũ, tránh hiện sai
      return false;
    }
    return true;
  };

  return { backgroundId, loading, setBackground, refresh };
}
