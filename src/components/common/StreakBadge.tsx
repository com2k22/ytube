import { Flame } from 'lucide-react';
import { useTimeRules } from '@/hooks/useTimeRules';
import { useWatchStreak, currentMilestone } from '@/hooks/useWatchStreak';

interface Props {
  profileId: string;
}

/**
 * StreakBadge — huy hiệu nhỏ "giữ đúng giờ xem N ngày liên tiếp" hiện ở Trang chủ, ngay
 * dưới lời chào (xem HomePage.tsx). Mục đích tạo động lực TỰ GIÁC cho bé — khác hẳn màn
 * hình chặn (BlockScreen) chỉ biết ngăn khi hết giờ chứ không khen khi bé tự giữ đúng giờ.
 *
 * Tự ẩn hoàn toàn (không hiện gì) khi: đang tải, bé chưa giữ được ngày nào (streak = 0),
 * hoặc gia đình chưa đặt lịch giờ xem nào — xem useWatchStreak.ts.
 */
export function StreakBadge({ profileId }: Props) {
  const { groups, loading: groupsLoading } = useTimeRules();
  const { streak, loading } = useWatchStreak(profileId, groups, groupsLoading);

  if (loading || streak <= 0) return null;

  const milestone = currentMilestone(streak);

  return (
    <div className="streak-badge" title={`Giữ đúng giờ xem ${streak} ngày liên tiếp — giỏi lắm!`}>
      <Flame className="icon" aria-hidden="true" />
      <span>
        {streak} ngày liên tiếp giữ đúng giờ{milestone ? ' 🎉' : ''}
      </span>
    </div>
  );
}
