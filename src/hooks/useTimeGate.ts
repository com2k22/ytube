import { useEffect, useState } from 'react';
import { useTimeRules } from './useTimeRules';
import { useDailyWatchUsage } from './useDailyWatchUsage';
import { checkTimeGate, type TimeGateResult } from '@/utils/timeRules';

/**
 * useTimeGate — kiểm tra định kỳ (mỗi 30 giây) xem BÂY GIỜ có được xem hay không, dựa
 * trên cấu hình ở trang "Bố mẹ": đúng khung giờ chưa, và đã dùng hết tổng thời gian của
 * hôm nay chưa. Cấu hình này dùng CHUNG cho cả 2 bé.
 *
 * Layout dùng kết quả này để bật màn hình chặn tương ứng:
 *  - reason 'daily_limit'  → "Đã hết thời gian xem hôm nay"
 *  - các trường hợp còn lại → "Chưa đến giờ xem TV"
 */
export function useTimeGate() {
  const { groups, loading } = useTimeRules();
  const { usedMinutes, loading: loadingUsage, refresh: refreshUsage } = useDailyWatchUsage();
  const [gate, setGate] = useState<TimeGateResult>({
    allowed: true,
    reason: 'no_windows_defined',
    nextWindowStart: null,
    group: null,
    usedMinutes: 0,
    dailyLimitMinutes: 0,
  });

  useEffect(() => {
    if (loading || loadingUsage) return;
    const evaluate = () => setGate(checkTimeGate(groups, usedMinutes));
    evaluate();
    const interval = setInterval(evaluate, 30_000);
    return () => clearInterval(interval);
  }, [groups, loading, usedMinutes, loadingUsage]);

  return { ...gate, refreshUsage };
}
