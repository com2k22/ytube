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

export interface TimeGateResult {
  allowed: boolean;
  reason: 'no_rule_today' | 'in_window' | 'outside_window' | 'no_windows_defined';
  nextWindowStart: string | null;
  group: TimeRuleGroup | null;
}

/**
 * Kiểm tra thời điểm hiện tại có nằm trong khung giờ được phép xem hay không,
 * dựa trên nhóm ngày áp dụng cho hôm nay.
 * - Nếu hôm nay không thuộc nhóm ngày nào => không được xem (reason: no_rule_today).
 * - Nếu nhóm áp dụng không có khung giờ nào (windows rỗng) => được xem cả ngày.
 */
export function checkTimeGate(groups: TimeRuleGroup[], now: Date = new Date()): TimeGateResult {
  const group = findGroupForToday(groups, now);
  if (!group) {
    return { allowed: false, reason: 'no_rule_today', nextWindowStart: null, group: null };
  }
  if (group.windows.length === 0) {
    return { allowed: true, reason: 'no_windows_defined', nextWindowStart: null, group };
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sorted = [...group.windows].sort((a, b) => parseMinutes(a.start) - parseMinutes(b.start));

  for (const w of sorted) {
    const start = parseMinutes(w.start);
    const end = parseMinutes(w.end);
    if (nowMin >= start && nowMin < end) {
      return { allowed: true, reason: 'in_window', nextWindowStart: null, group };
    }
  }

  const upcoming = sorted.find((w) => parseMinutes(w.start) > nowMin);
  return {
    allowed: false,
    reason: 'outside_window',
    nextWindowStart: upcoming ? upcoming.start : sorted[0]?.start ?? null,
    group,
  };
}
