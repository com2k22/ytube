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

  const refresh = useCallback(async () => {
    if (!profileId) return;
    const { data, error } = await supabase.from('watch_progress').select('*').eq('profile_id', profileId);
    if (error) {
      console.error('[Ytube] Không tải được tiến độ xem:', error.message);
      return;
    }
    setRows(data ?? []);
  }, [profileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveProgress = async (sourceId: string, videoRef: string, percent: number) => {
    if (!profileId) return;
    const { error } = await supabase
      .from('watch_progress')
      .upsert(
        {
          profile_id: profileId,
          source_id: sourceId,
          video_ref: videoRef,
          progress_percent: Math.max(0, Math.min(100, Math.round(percent))),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,source_id,video_ref' }
      );
    if (error) console.error('[Ytube] Không lưu được tiến độ xem:', error.message);
    else refresh();
  };

  /** Tóm tắt tiến độ của cả 1 playlist: có đang xem dở không, % của video xem dở gần nhất. */
  const summarizeSource = (sourceId: string) => {
    const forSource = rows
      .filter((r) => r.source_id === sourceId && r.progress_percent > 0 && r.progress_percent < 100)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    if (forSource.length === 0) return { inProgress: false, percent: 0, latestVideoRef: null as string | null };
    return { inProgress: true, percent: forSource[0].progress_percent, latestVideoRef: forSource[0].video_ref };
  };

  const progressFor = (sourceId: string, videoRef: string) =>
    rows.find((r) => r.source_id === sourceId && r.video_ref === videoRef)?.progress_percent ?? 0;

  return { rows, refresh, saveProgress, summarizeSource, progressFor };
}
