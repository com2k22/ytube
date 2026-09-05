import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { WatchProgress } from '@/types';

/**
 * useWatchProgress — đọc & ghi tiến độ xem từng video (theo % đã xem) cho 1 hồ sơ.
 * Dùng để: (1) xác định playlist nào đang "xem dở" hiện lên trước ở Trang chủ,
 * (2) sắp xếp video đang xem dở lên đầu khi mở 1 playlist.
 */
export function useWatchProgress(profileId: string | null) {
  const [rows, setRows] = useState<WatchProgress[]>([]);
  /**
   * true = CHƯA tải xong lần đầu tiên. Quan trọng cho PlayerPage.tsx: video xem dở lần
   * trước có tua đúng chỗ được hay không phụ thuộc vào rows đã có sẵn hay chưa lúc trình
   * phát khởi tạo — nếu PlayerPage cứ render trình phát ngay (rows vẫn đang rỗng vì còn
   * đợi Supabase trả về), trình phát sẽ khởi tạo với "tua tới giây 0" rồi KHÔNG BAO GIỜ tua
   * lại nữa dù rows tải xong sau đó (trình phát chỉ đọc vị trí tua đúng 1 LẦN lúc khởi tạo).
   * Đây chính là lỗi "đã lưu đúng giây trong cơ sở dữ liệu nhưng vẫn phát lại từ đầu" — nên
   * PlayerPage phải đợi `loading = false` rồi mới cho trình phát khởi tạo.
   */
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('watch_progress').select('*').eq('profile_id', profileId);
    if (error) {
      console.error('[Ytube] Không tải được tiến độ xem:', error.message);
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

  /** positionSeconds — vị trí xem dở tính bằng giây, để lần sau tua trình phát tới đúng
      chỗ (xem supabase/016_watch_progress_position.sql). */
  const saveProgress = async (sourceId: string, videoRef: string, percent: number, positionSeconds: number) => {
    if (!profileId) return;
    const { error } = await supabase
      .from('watch_progress')
      .upsert(
        {
          profile_id: profileId,
          source_id: sourceId,
          video_ref: videoRef,
          progress_percent: Math.max(0, Math.min(100, Math.round(percent))),
          position_seconds: Math.max(0, Math.round(positionSeconds)),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,source_id,video_ref' }
      );
    if (error) console.error('[Ytube] Không lưu được tiến độ xem:', error.message);
    else refresh();
  };

  /** Tóm tắt tiến độ của cả 1 playlist: có đang xem dở không, % và số giây của video xem dở
      gần nhất (latestPositionSeconds — để mở đúng video đó VÀ tua tới đúng chỗ luôn). */
  const summarizeSource = (sourceId: string) => {
    const forSource = rows
      .filter((r) => r.source_id === sourceId && r.progress_percent > 0 && r.progress_percent < 100)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    if (forSource.length === 0) {
      return { inProgress: false, percent: 0, latestVideoRef: null as string | null, latestPositionSeconds: 0 };
    }
    return {
      inProgress: true,
      percent: forSource[0].progress_percent,
      latestVideoRef: forSource[0].video_ref,
      latestPositionSeconds: forSource[0].position_seconds,
    };
  };

  const progressFor = (sourceId: string, videoRef: string) =>
    rows.find((r) => r.source_id === sourceId && r.video_ref === videoRef)?.progress_percent ?? 0;

  /** Vị trí xem dở (giây) của đúng 1 video — dùng để tua trình phát khi mở lại. */
  const positionFor = (sourceId: string, videoRef: string) =>
    rows.find((r) => r.source_id === sourceId && r.video_ref === videoRef)?.position_seconds ?? 0;

  return { rows, loading, refresh, saveProgress, summarizeSource, progressFor, positionFor };
}
