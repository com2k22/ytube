import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * useDailyWatchUsage — tổng số PHÚT đã xem trong NGÀY HÔM NAY, tính chung cho cả 2 bé.
 *
 * Vì sao tính chung: từ bản này, "Quản lý thời gian" là một bộ dùng chung cho cả nhà
 * (xem useTimeRules), nên hạn mức mỗi ngày cũng là hạn mức chung — Mina xem 30 phút rồi
 * thì Cốm chỉ còn phần thời gian còn lại, không phải mỗi bé một suất riêng.
 *
 * Số liệu lấy từ bảng watch_sessions: mỗi lần bắt đầu xem 1 video, app tạo 1 dòng ở đó và
 * cập nhật elapsed_seconds trong lúc xem (xem useWatchSession). Cộng elapsed_seconds của
 * mọi dòng bắt đầu từ 0h hôm nay là ra tổng thời gian đã xem.
 *
 * Cách này KHÔNG cần thêm bảng mới, nhưng con số chỉ là ƯỚC LƯỢNG (bám theo % đã xem của
 * trình phát, cập nhật mỗi ~5 giây) — đủ dùng để giới hạn giờ xem của bé, không phải để
 * tính toán chính xác từng giây.
 */
export function useDailyWatchUsage(refreshMs = 30_000) {
  const [usedMinutes, setUsedMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('watch_sessions')
      .select('elapsed_seconds')
      .gte('started_at', startOfToday.toISOString());

    if (error) {
      console.error('[Ytube] Không đọc được thời gian đã xem hôm nay:', error.message);
      setLoading(false);
      return;
    }
    const seconds = (data ?? []).reduce((sum, row: { elapsed_seconds: number | null }) => sum + (row.elapsed_seconds ?? 0), 0);
    setUsedMinutes(Math.floor(seconds / 60));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, refreshMs);
    return () => clearInterval(timer);
  }, [refresh, refreshMs]);

  return { usedMinutes, loading, refresh };
}
