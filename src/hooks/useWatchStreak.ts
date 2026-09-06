import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { findGroupForToday } from '@/utils/timeRules';
import type { TimeRuleGroup } from '@/types';

/** Đếm lùi tối đa bao nhiêu ngày để tìm chuỗi — đủ xa để không bao giờ "cụt" chuỗi thật sự
    dài, nhưng vẫn nhẹ (1 lần tải, không phân trang). */
const LOOKBACK_DAYS = 90;

/** Các mốc chuỗi ngày để khen — dùng chọn lời chúc mừng phù hợp (xem currentMilestone). */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

/** "2026-08-24" theo giờ ĐỊA PHƯƠNG — giống hệt cách làm ở useWeeklyReport.ts, KHÔNG dùng
    toISOString (quy về giờ quốc tế, dễ lệch ngày). */
function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * useWatchStreak — tính "chuỗi ngày liên tiếp giữ đúng giờ xem" của 1 bé, để thưởng huy
 * hiệu nhỏ ở Trang chủ (xem StreakBadge.tsx) — tạo động lực TỰ GIÁC, khác hẳn màn hình chặn
 * chỉ biết ngăn khi vi phạm chứ không khen khi làm tốt.
 *
 * 1 "NGÀY TỐT" = ngày đó có ít nhất 1 nhóm ngày (time_rule_groups) áp dụng, VÀ số phút đã
 * xem trong ngày đó KHÔNG VƯỢT hạn mức của nhóm đó (daily_minutes = 0 nghĩa là không giới
 * hạn tổng giờ/ngày, theo đúng quy ước của checkTimeGate trong timeRules.ts → luôn tính là
 * ngày tốt, phần giữ khung giờ trong ngày bé không tự phá được nên không cần kiểm thêm).
 *
 * Ngày KHÔNG có nhóm ngày nào áp dụng (gia đình không đặt lịch hôm đó, vd chưa cấu hình gì
 * cho Chủ nhật) → BỎ QUA, không tính tốt/xấu, KHÔNG làm đứt chuỗi — vì hôm đó vốn dĩ không
 * có luật gì để "giữ".
 *
 * Đếm lùi bắt đầu từ HÔM QUA (cố ý bỏ qua HÔM NAY vì dữ liệu hôm nay chưa xong, bé còn có
 * thể xem thêm bất cứ lúc nào trong ngày — tính hôm nay vào rồi báo "giữ được" ngay từ sáng
 * là sai). Gặp ngày đầu tiên KHÔNG tốt thì dừng đếm ngay.
 */
export function useWatchStreak(profileId: string | null, groups: TimeRuleGroup[], groupsLoading: boolean) {
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (groupsLoading) {
      setLoading(true);
      return;
    }
    if (!profileId || groups.length === 0) {
      // Chưa chọn bé, hoặc gia đình chưa đặt lịch giờ xem nào — chưa có gì để "giữ", không
      // hiện huy hiệu (xem StreakBadge.tsx, tự ẩn khi streak = 0).
      setStreak(0);
      setLoading(false);
      return;
    }
    setLoading(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

    const { data, error } = await supabase
      .from('watch_sessions')
      .select('elapsed_seconds, started_at')
      .eq('profile_id', profileId)
      .gte('started_at', cutoff.toISOString());

    if (error) {
      console.error('[Ytube] Không tính được chuỗi ngày giữ giờ:', error.message);
      setStreak(0);
      setLoading(false);
      return;
    }

    // Gộp tổng số phút đã xem theo từng ngày (giờ địa phương) — cùng cách làm với
    // useWeeklyReport.ts, đổi giây sang phút ở bước cuối để đỡ sai số làm tròn cộng dồn.
    const secondsByDate = new Map<string, number>();
    for (const row of (data ?? []) as { elapsed_seconds: number | null; started_at: string }[]) {
      const seconds = row.elapsed_seconds ?? 0;
      if (seconds <= 0) continue;
      const key = localDateKey(new Date(row.started_at));
      secondsByDate.set(key, (secondsByDate.get(key) ?? 0) + seconds);
    }

    let count = 0;
    for (let i = 1; i <= LOOKBACK_DAYS; i += 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const group = findGroupForToday(groups, d);
      if (!group) continue; // hôm đó không có luật gì áp dụng — bỏ qua, không đứt chuỗi

      const limitMinutes = group.daily_minutes ?? 0;
      const usedMinutes = (secondsByDate.get(localDateKey(d)) ?? 0) / 60;
      const isGoodDay = limitMinutes === 0 || usedMinutes <= limitMinutes;

      if (isGoodDay) count += 1;
      else break; // gặp ngày đầu tiên không giữ được → chuỗi dừng ở đây
    }

    setStreak(count);
    setLoading(false);
  }, [profileId, groups, groupsLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { streak, loading, refresh };
}

/** Mốc chuỗi ngày CAO NHẤT mà "streak" đã đạt được — null nếu chưa đạt mốc nào (STREAK_
    MILESTONES là các mốc tăng dần, xem StreakBadge.tsx dùng để chọn lời khen). */
export function currentMilestone(streak: number): number | null {
  let best: number | null = null;
  for (const m of STREAK_MILESTONES) {
    if (streak >= m) best = m;
  }
  return best;
}
