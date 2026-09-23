import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Favorite } from '@/types';

/**
 * useFavorites — đọc & bấm tim "yêu thích" cho 1 hồ sơ (xem supabase/021_favorites.sql).
 * KHÁC HẲN nhãn (content_labels/useContentLabels.ts): nhãn do PHỤ HUYNH tự đặt trong Khu vực
 * Bố mẹ; favorite do CHÍNH BÉ tự bấm ngay trên Trang chủ/Khám phá, theo TỪNG HỒ SƠ riêng.
 */
export function useFavorites(profileId: string | null) {
  const [rows, setRows] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('favorites').select('*').eq('profile_id', profileId);
    if (error) {
      console.error('[Ytube] Không tải được danh sách yêu thích:', error.message);
      setLoading(false);
      return;
    }
    setRows(data ?? []);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const isFavorite = (sourceId: string) => rows.some((r) => r.source_id === sourceId);

  /**
   * Bấm tim — CHƯA thích thì thêm, ĐÃ thích thì bỏ (đúng nghĩa "toggle" 1 nút, không phải 2
   * nút riêng). Cập nhật `rows` NGAY (lạc quan — optimistic) trước khi đợi Supabase trả lời,
   * để tim đổi màu tức thì lúc bé bấm, không phải chờ mạng mới thấy phản hồi; nếu lỡ lưu thất
   * bại thì `refresh()` ở nhánh catch sẽ tự kéo lại đúng trạng thái thật từ server.
   */
  const toggle = async (sourceId: string) => {
    if (!profileId) return;
    const wasFavorite = isFavorite(sourceId);
    if (wasFavorite) {
      setRows((prev) => prev.filter((r) => r.source_id !== sourceId));
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('profile_id', profileId)
        .eq('source_id', sourceId);
      if (error) {
        console.error('[Ytube] Không bỏ thích được:', error.message);
        refresh();
      }
    } else {
      setRows((prev) => [
        ...prev,
        { id: `temp-${sourceId}`, profile_id: profileId, source_id: sourceId, created_at: new Date().toISOString() },
      ]);
      const { error } = await supabase.from('favorites').insert({ profile_id: profileId, source_id: sourceId });
      if (error) {
        console.error('[Ytube] Không lưu được yêu thích:', error.message);
        refresh();
      } else {
        refresh();
      }
    }
  };

  return { rows, loading, isFavorite, toggle, refresh };
}
