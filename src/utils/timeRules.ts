import type { DayCode, TimeRuleGroup } from '@/types';

/** Thứ hiện tại theo mã dùng trong app (T2 = Thứ 2 ... CN = Chủ nhật). */
export function currentDayCode(date: Date = new Date()): DayCode {
  const map: DayCode[] = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return map[date.getDay()];
}

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Tìm nhóm ngày áp dụng cho hôm nay (nếu có nhiều nhóm trùng ngày, lấy nhóm đầu tiên khớp). */
export function findGroupForToday(
  groups: TimeRuleGroup[],
  date: Date = new Date()
): TimeRuleGroup | null {
  const day = currentDayCode(date);
  return groups.find((g) => g.days.includes(day)) ?? null;
}

export type TimeGateReason =
  | 'no_rule_today'
  | 'in_window'
  | 'outside_window'
  | 'no_windows_defined'
  /** Đang trong khung giờ được xem, nhưng đã dùng hết tổng thời gian cho phép của hôm nay. */
  | 'daily_limit';

export interface TimeGateResult {
  allowed: boolean;
  reason: TimeGateReason;
  nextWindowStart: string | null;
  group: TimeRuleGroup | null;
  /** Số phút đã xem hôm nay / hạn mức của hôm nay — để hiện cho bố mẹ biết. */
  usedMinutes: number;
  dailyLimitMinutes: number;
}

/**
 * Kiểm tra hiện tại bé có được xem hay không, gồm 2 lớp:
 *  1. KHUNG GIỜ — hôm nay có thuộc nhóm ngày nào không, và giờ này có nằm trong khung giờ
 *     được phép không.
 *  2. TỔNG THỜI GIAN TRONG NGÀY — dù đang đúng khung giờ, nếu đã xem đủ số phút cho phép
 *     của hôm nay thì cũng dừng (reason: daily_limit).
 *
 * - Hôm nay không thuộc nhóm ngày nào => không được xem (no_rule_today).
 * - Nhóm áp dụng không có khung giờ nào (windows rỗng) => được xem bất kỳ lúc nào trong
 *   ngày đó, nhưng VẪN bị giới hạn bởi tổng thời gian/ngày.
 * - daily_minutes = 0 nghĩa là không giới hạn tổng thời gian.
 */
export function checkTimeGate(
  groups: TimeRuleGroup[],
  usedMinutes = 0,
  now: Date = new Date()
): TimeGateResult {
  const base = { usedMinutes, dailyLimitMinutes: 0 };
  const group = findGroupForToday(groups, now);
  if (!group) {
    return { allowed: false, reason: 'no_rule_today', nextWindowStart: null, group: null, ...base };
  }

  const dailyLimitMinutes = group.daily_minutes ?? 0;
  const overDailyLimit = dailyLimitMinutes > 0 && usedMinutes >= dailyLimitMinutes;
  const withGroup = { usedMinutes, dailyLimitMinutes, group };

  if (group.windows.length === 0) {
    return overDailyLimit
      ? { allowed: false, reason: 'daily_limit', nextWindowStart: null, ...withGroup }
      : { allowed: true, reason: 'no_windows_defined', nextWindowStart: null, ...withGroup };
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sorted = [...group.windows].sort((a, b) => parseMinutes(a.start) - parseMinutes(b.start));

  for (const w of sorted) {
    const start = parseMinutes(w.start);
    const end = parseMinutes(w.end);
    if (nowMin >= start && nowMin < end) {
      // Đúng khung giờ rồi — chỉ còn kiểm tra đã xem hết hạn mức của ngày chưa.
      return overDailyLimit
        ? { allowed: false, reason: 'daily_limit', nextWindowStart: null, ...withGroup }
        : { allowed: true, reason: 'in_window', nextWindowStart: null, ...withGroup };
    }
  }

  const upcoming = sorted.find((w) => parseMinutes(w.start) > nowMin);
  return {
    allowed: false,
    reason: 'outside_window',
    nextWindowStart: upcoming ? upcoming.start : sorted[0]?.start ?? null,
    ...withGroup,
  };
}
