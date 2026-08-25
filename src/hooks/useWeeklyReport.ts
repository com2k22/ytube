import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { currentDayCode } from '@/utils/timeRules';
import type { DayCode, SourceType } from '@/types';

/** Số ngày của 1 báo cáo — trọn 1 tuần, Thứ 2 đến Chủ nhật. */
const REPORT_DAYS = 7;
/** Mỗi bé hiện tối đa từng này nội dung xem nhiều nhất. */
const TOP_ITEMS_PER_PROFILE = 5;

/** Một cột ngày trong biểu đồ. */
export interface ReportDay {
  /** "2026-08-24" — khoá gộp theo ngày, cũng dùng làm key khi vẽ. */
  dateKey: string;
  /** "T5" — thứ trong tuần, dùng làm nhãn dưới cột. */
  dayCode: DayCode;
  /** Ngày trong tháng, vd 24 — hiện trong bảng số liệu cho biết chính xác là ngày nào. */
  dayOfMonth: number;
  /** true nếu cột này là NGÀY HÔM NAY — để tô đậm nhãn cho dễ định vị. */
  isToday: boolean;
  /** true nếu ngày này còn ở TƯƠNG LAI trong tuần (chưa tới) — cột luôn bằng 0. */
  isFuture: boolean;
  /** Số phút đã xem của từng bé trong ngày đó, khoá là profile_id. */
  minutesByProfile: Record<string, number>;
}

/** Một dòng trong danh sách "Nội dung xem nhiều nhất". */
export interface TopContentItem {
  key: string;
  title: string;
  /** Loại nguồn để chọn icon (xem SOURCE_TYPE_ICON). null = không tra được nguồn gốc. */
  sourceType: SourceType | null;
  minutes: number;
}

export interface WeeklyReport {
  days: ReportDay[];
  /** Tổng số phút cả tuần của từng bé, khoá là profile_id. */
  totalByProfile: Record<string, number>;
  /** Top nội dung của từng bé, khoá là profile_id. */
  topByProfile: Record<string, TopContentItem[]>;
  /** Số phút của cột cao nhất — dùng để quy đổi chiều cao các cột. */
  maxDayMinutes: number;
}

const EMPTY_REPORT: WeeklyReport = {
  days: [],
  totalByProfile: {},
  topByProfile: {},
  maxDayMinutes: 0,
};

interface SessionRow {
  profile_id: string;
  video_title: string | null;
  source_id: string | null;
  elapsed_seconds: number | null;
  started_at: string;
}

/**
 * Thứ 2 của TUẦN ĐANG CHỨA ngày truyền vào, lúc 0h00.
 *
 * getDay() trả 0 cho Chủ nhật, 1 cho Thứ 2... nên Chủ nhật phải lùi 6 ngày mới về Thứ 2
 * (chứ không phải lùi 0 ngày) — đây là chỗ rất hay bị sai khi tính tuần.
 */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const weekday = d.getDay();
  d.setDate(d.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return d;
}

/** "2026-08-24" theo giờ ĐỊA PHƯƠNG (không dùng toISOString vì nó quy về giờ quốc tế, lệch ngày). */
function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * useWeeklyReport — tổng hợp báo cáo xem của TUẦN NÀY (Thứ 2 → Chủ nhật) cho khu Bố mẹ.
 *
 * Vì sao cố định T2→CN chứ không phải "7 ngày gần nhất": trục ngang đứng yên thì tuần nào
 * cũng đọc giống tuần nào, dễ so sánh "thứ 4 tuần này bé xem nhiều hơn mọi hôm". Kiểu
 * "7 ngày gần nhất" thì mỗi ngày mở lên các cột lại xê dịch một chỗ, rất khó theo dõi.
 * Các ngày chưa tới trong tuần vẫn hiện cột trống, để luôn đủ 7 cột.
 *
 * Dữ liệu lấy từ bảng watch_sessions đã có sẵn (mỗi lần bé mở 1 video là 1 dòng, kèm
 * elapsed_seconds cập nhật trong lúc xem — xem useWatchSession). KHÔNG thêm bảng hay cột
 * mới: mọi phép cộng/nhóm/xếp hạng đều làm ngay tại máy đang mở trang, vì cả tuần cũng
 * chỉ vài trăm dòng, nhẹ hơn nhiều so với việc dựng thêm hạ tầng ở Supabase.
 *
 * Lưu ý về độ chính xác: elapsed_seconds là con số ƯỚC LƯỢNG bám theo % đã xem của trình
 * phát (cập nhật ~5 giây/lần), giống hệt cách tính giờ ở useDailyWatchUsage — đủ để nhìn
 * xu hướng "hôm nào xem nhiều, xem gì nhiều", không phải số liệu chính xác từng giây.
 */
export function useWeeklyReport() {
  const [report, setReport] = useState<WeeklyReport>(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Mốc bắt đầu: 0h00 Thứ 2 của tuần này.
    const now = new Date();
    const start = startOfWeek(now);
    const todayKey = localDateKey(now);

    // Lấy song song: các phiên xem trong tuần + danh sách nguồn (để biết icon loại nội dung).
    const [sessionsRes, sourcesRes] = await Promise.all([
      supabase
        .from('watch_sessions')
        .select('profile_id, video_title, source_id, elapsed_seconds, started_at')
        .gte('started_at', start.toISOString()),
      supabase.from('allowed_sources').select('id, type, title'),
    ]);

    if (sessionsRes.error) {
      console.error('[Ytube] Không đọc được báo cáo tuần:', sessionsRes.error.message);
      setError('Không tải được dữ liệu báo cáo. Thử lại sau nhé.');
      setReport(EMPTY_REPORT);
      setLoading(false);
      return;
    }

    // Tra cứu nhanh nguồn theo id — dùng để lấy icon loại nội dung và tên dự phòng.
    const sourceById = new Map<string, { type: SourceType; title: string }>();
    for (const s of (sourcesRes.data ?? []) as { id: string; type: SourceType; title: string }[]) {
      sourceById.set(s.id, { type: s.type, title: s.title });
    }

    // Dựng sẵn đủ 7 cột T2→CN (kể cả ngày không xem gì, kể cả ngày chưa tới) để trục ngang
    // luôn cố định 7 cột.
    const days: ReportDay[] = [];
    const dayIndex = new Map<string, ReportDay>();
    for (let i = 0; i < REPORT_DAYS; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateKey = localDateKey(d);
      const day: ReportDay = {
        dateKey,
        dayCode: currentDayCode(d),
        dayOfMonth: d.getDate(),
        isToday: dateKey === todayKey,
        isFuture: d.getTime() > now.getTime() && dateKey !== todayKey,
        minutesByProfile: {},
      };
      days.push(day);
      dayIndex.set(day.dateKey, day);
    }

    const secondsByProfile: Record<string, number> = {};
    // profile_id -> (khoá nội dung -> tổng giây)
    const contentSeconds = new Map<string, Map<string, { title: string; sourceType: SourceType | null; seconds: number }>>();

    for (const row of (sessionsRes.data ?? []) as SessionRow[]) {
      const seconds = row.elapsed_seconds ?? 0;
      if (seconds <= 0) continue;

      // Bỏ qua dòng không rơi vào đúng 1 trong 7 cột (giờ máy bị lệch, dữ liệu lạ...).
      // Cố ý bỏ TRƯỚC khi cộng tổng: nếu không, con số tổng và biểu đồ sẽ đá nhau — nhìn
      // biểu đồ cộng nhẩm ra 30 phút mà thẻ tổng lại ghi 197 phút thì không ai tin nữa.
      const day = dayIndex.get(localDateKey(new Date(row.started_at)));
      if (!day) continue;

      day.minutesByProfile[row.profile_id] = (day.minutesByProfile[row.profile_id] ?? 0) + seconds;
      secondsByProfile[row.profile_id] = (secondsByProfile[row.profile_id] ?? 0) + seconds;

      // Gộp theo source_id nếu có (chính xác hơn: cùng 1 playlist/kênh dù tên video khác
      // nhau vẫn được gộp làm một), không có thì đành gộp theo tên video.
      const source = row.source_id ? sourceById.get(row.source_id) : undefined;
      const key = row.source_id ?? row.video_title ?? 'khac';
      const title = row.video_title || source?.title || 'Nội dung không rõ tên';

      if (!contentSeconds.has(row.profile_id)) contentSeconds.set(row.profile_id, new Map());
      const bucket = contentSeconds.get(row.profile_id)!;
      const current = bucket.get(key);
      if (current) current.seconds += seconds;
      else bucket.set(key, { title, sourceType: source?.type ?? null, seconds });
    }

    // Đổi giây sang phút ở bước cuối cùng, để không bị sai số làm tròn cộng dồn.
    let maxDayMinutes = 0;
    for (const day of days) {
      for (const profileId of Object.keys(day.minutesByProfile)) {
        const minutes = Math.round(day.minutesByProfile[profileId] / 60);
        day.minutesByProfile[profileId] = minutes;
        if (minutes > maxDayMinutes) maxDayMinutes = minutes;
      }
    }

    const totalByProfile: Record<string, number> = {};
    for (const [profileId, seconds] of Object.entries(secondsByProfile)) {
      totalByProfile[profileId] = Math.round(seconds / 60);
    }

    const topByProfile: Record<string, TopContentItem[]> = {};
    for (const [profileId, bucket] of contentSeconds) {
      topByProfile[profileId] = [...bucket.entries()]
        .map(([key, v]) => ({ key, title: v.title, sourceType: v.sourceType, minutes: Math.round(v.seconds / 60) }))
        .filter((item) => item.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, TOP_ITEMS_PER_PROFILE);
    }

    setReport({ days, totalByProfile, topByProfile, maxDayMinutes });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { report, loading, error, refresh };
}
