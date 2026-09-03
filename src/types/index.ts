// Các kiểu dữ liệu dùng chung trong toàn app — khớp với các bảng trong Supabase.
// Xem file supabase/001_schema.sql và supabase/002_time_management.sql để đối chiếu.

export type ProfileId = 'mina' | 'com' | string;

export type ThemeName = 'dark_tv' | 'chibi_cute';

export interface Profile {
  id: string;
  name: string;
  avatar: string | null;
  theme_preference: ThemeName;
  created_at: string;
}

export type SourceType = 'youtube_playlist' | 'youtube_video' | 'youtube_channel' | 'direct_url' | 'custom_playlist';

/** 1 video trong playlist tự tạo (custom_playlist) — lưu trực tiếp trong cột items, không gọi API. */
export interface CustomPlaylistItem {
  videoId: string;
  title: string;
  thumbnail: string | null;
}

export interface AllowedSource {
  id: string;
  /** null = nội dung dùng chung cho cả Mina & Cốm (không giới hạn riêng 1 bé). */
  profile_id: string | null;
  type: SourceType;
  title: string;
  url: string;
  thumbnail: string | null;
  /** Chỉ dùng khi type = 'custom_playlist' — danh sách video do phụ huynh tự ghép. */
  items: CustomPlaylistItem[];
  created_at: string;
}

/** Một video đã được "giải mã" ra từ nguồn whitelist (YouTube hoặc link trực tiếp) để hiển thị. */
export interface ResolvedVideo {
  videoId: string; // với YouTube: chính là videoId; với direct_url: chính url
  title: string;
  thumbnail: string | null;
  durationLabel?: string;
  sourceType: SourceType;
}

export interface TimeRuleGroup {
  id: string;
  /**
   * null = cấu hình DÙNG CHUNG cho cả 2 bé — đây là cách app dùng hiện nay (xem
   * supabase/006_shared_time_rules.sql). Kiểu vẫn để nhận string để tương thích với dữ
   * liệu cũ còn sót lại từ thời mỗi bé có cấu hình riêng.
   */
  profile_id: string | null;
  days: DayCode[];
  daily_minutes: number;
  session_minutes: number;
  windows: TimeWindow[];
  created_at?: string;
  updated_at?: string;
}

export type DayCode = 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN';

export interface TimeWindow {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface WatchSession {
  id: string;
  profile_id: string;
  video_title: string | null;
  source_id: string | null;
  is_active: boolean;
  end_after_current: boolean;
  elapsed_seconds: number;
  started_at: string;
  updated_at: string;
}

export interface WatchProgress {
  id: string;
  profile_id: string;
  source_id: string;
  video_ref: string;
  progress_percent: number;
  updated_at: string;
}

/** Trạng thái 1 lời xin thêm giờ (xem supabase/007_time_requests.sql). */
export type TimeRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

/** Một lần bé bấm "Con xin thêm giờ" ở màn hình chặn. */
export interface TimeRequest {
  id: string;
  profile_id: string;
  status: TimeRequestStatus;
  requested_minutes: number;
  /** Số phút bố mẹ thực sự cho — có thể khác số bé xin. null khi chưa duyệt. */
  granted_minutes: number | null;
  /** Lúc xin thì đang bị chặn vì lý do gì: 'daily_limit' hay 'outside_window'. */
  reason: string | null;
  created_at: string;
  resolved_at: string | null;
}
