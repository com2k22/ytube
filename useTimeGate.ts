import { useEffect, useState } from 'react';
import { useTimeRules } from './useTimeRules';
import { checkTimeGate, type TimeGateResult } from '@/utils/timeRules';

/**
 * useTimeGate — kiểm tra định kỳ (mỗi 30 giây) xem hồ sơ hiện tại có đang trong khung
 * giờ được phép xem hay không, dựa trên cấu hình nhóm ngày ở trang "Bố mẹ".
 * Dùng kết quả này để hiển thị <BlockScreen /> khi `allowed === false`.
 */
export function useTimeGate(profileId: string | null) {
  const { groups, loading } = useTimeRules(profileId);
  const [gate, setGate] = useState<TimeGateResult>({
    allowed: true,
    reason: 'no_windows_defined',
    nextWindowStart: null,
    group: null,
  });

  useEffect(() => {
    if (loading) return;
    const evaluate = () => setGate(checkTimeGate(groups));
    evaluate();
    const interval = setInterval(evaluate, 30_000);
    return () => clearInterval(interval);
  }, [groups, loading]);

  return gate;
}
