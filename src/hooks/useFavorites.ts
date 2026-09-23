import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Favorite } from '@/types';

/**
 * useFavorites — đọc & bấm tim "yêu thích" cho 1 hồ sơ (xem supabase/021_favorites.sql +
 * supabase/022_favorites_video_ref.sql). KHÁC HẲN nhãn (content_labels/useContentLabels.ts):
 * nhãn do PHỤ HUYNH tự đặt trong Khu vực Bố mẹ; favorite do CHÍNH BÉ tự bấm ngay trong trình
 * phát, theo TỪNG HỒ SƠ riêng.
 *
 * `videoRef` — BẮT BUỘC ở mọi hàm bên dưới, GIỐNG HỆT quy ước của useWatchProgress.ts
 * (progressFor/positionFor/saveProgress): với video/audio đứng RIÊNG LẺ thì đây là videoId/url
 * của chính nó; với 1 TẬP trong playlist thì đây là videoId/url của ĐÚNG tập đó (không phải
 * của playlist) — nhờ vậy nhiều tập khác nhau trong CÙNG 1 playlist (chung 1 sourceId) vẫn
 * thích/bỏ thích ĐỘC LẬP được với nhau, không dính chùm. Nơi gọi (MobilePlayerHost.tsx) luôn
 * truyền đúng `currentKey` (kind === 'direct' ? directUrl : ytVideoId) — CÙNG giá trị dùng để
 * lưu tiến độ xem.
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

  const isFavorite = (sourceId: string, videoRef: string) =>
    rows.some((r) => r.source_id === sourceId && r.video_ref === videoRef);

  /**
   * Bấm tim — CHƯA thích thì thêm, ĐÃ thích thì bỏ (đúng nghĩa "toggle" 1 nút, không phải 2
   * nút riêng), CHO ĐÚNG 1 CẶP (sourceId, videoRef) — không đụng tới các tập KHÁC cùng
   * sourceId (cùng playlist). Cập nhật `rows` NGAY (lạc quan — optimistic) trước khi đợi
   * Supabase trả lời, để tim đổi màu tức thì lúc bé bấm, không phải chờ mạng mới thấy phản
   * hồi; nếu lỡ lưu thất bại thì `refresh()` ở nhánh catch sẽ tự kéo lại đúng trạng thái thật
   * từ server.
   */
  const toggle = async (sourceId: string, videoRef: string) => {
    if (!profileId) return;
    const wasFavorite = isFavorite(sourceId, videoRef);
    if (wasFavorite) {
      setRows((prev) => prev.filter((r) => !(r.source_id === sourceId && r.video_ref === videoRef)));
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('profile_id', profileId)
        .eq('source_id', sourceId)
        .eq('video_ref', videoRef);
      if (error) {
        console.error('[Ytube] Không bỏ thích được:', error.message);
        refresh();
      }
    } else {
      setRows((prev) => [
        ...prev,
        {
          id: `temp-${sourceId}-${videoRef}`,
          profile_id: profileId,
          source_id: sourceId,
          video_ref: videoRef,
          created_at: new Date().toISOString(),
        },
      ]);
      const { error } = await supabase
        .from('favorites')
        .insert({ profile_id: profileId, source_id: sourceId, video_ref: videoRef });
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
