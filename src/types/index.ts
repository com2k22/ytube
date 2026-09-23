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

export type SourceType =
  | 'youtube_playlist'
  | 'youtube_video'
  | 'youtube_channel'
  | 'direct_url'
  | 'custom_playlist'
  | 'gdrive_folder';

/** 1 video trong playlist tự tạo (custom_playlist) — lưu trực tiếp trong cột items, không gọi API. */
export interface CustomPlaylistItem {
  /** Với kind = 'youtube' (mặc định, kể cả dữ liệu cũ chưa có trường "kind"): videoId YouTube
      thật. Với kind = 'direct': link phát trực tiếp (Google Drive/mp4/m3u8...) — vẫn dùng
      chung tên trường "videoId" để mọi chỗ đang đọc trường này khỏi phải đổi tên, chỉ cần biết
      thêm "kind" để hiểu đúng nội dung bên trong là gì. */
  videoId: string;
  title: string;
  thumbnail: string | null;
  /** 'youtube' | 'direct' — thiếu trường này (dữ liệu cũ) = coi như 'youtube'. */
  kind?: 'youtube' | 'direct';
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
  /** id các nhãn đã gán (xem ContentLabel bên dưới) — [] = chưa gán nhãn nào. */
  label_ids: string[];
  created_at: string;
}

/**
 * ContentLabel — 1 nhãn dùng để gán cho video/playlist đã thêm (VD: "Học tập", "Giải
 * trí"...), xem supabase/010_content_labels.sql + supabase/019_device_visibility_labels.sql.
 *
 * 4 nhãn có sẵn giữ HÀNH VI ĐẶC BIỆT cố định (is_builtin = true, không xoá được):
 *  - is_priority: nội dung gán nhãn này hiện ĐẦU TIÊN trong mỗi mục ở Trang chủ.
 *  - is_hidden: nội dung gán nhãn này KHÔNG hiện ở Trang chủ nữa (vẫn xem được nếu vào
 *    thẳng trang Kênh chứa nó).
 *  - is_phone_only: nội dung gán nhãn này CHỈ hiện ở Trang chủ/Khám phá trên ĐIỆN THOẠI —
 *    ẩn khỏi TV/iPad/máy tính (vẫn không phải xoá hẳn, giống is_hidden).
 *  - is_desktop_only: ngược lại is_phone_only — CHỈ hiện trên TV/iPad/máy tính, ẩn khỏi
 *    điện thoại.
 * Nhãn khác (kể cả do phụ huynh tự đặt tên) chỉ là nhãn mô tả thường.
 */
export interface ContentLabel {
  id: string;
  name: string;
  is_priority: boolean;
  is_hidden: boolean;
  is_phone_only: boolean;
  is_desktop_only: boolean;
  is_builtin: boolean;
  created_at: string;
}

/** Một video đã được "giải mã" ra từ nguồn whitelist (YouTube hoặc link trực tiếp) để hiển thị. */
export interface ResolvedVideo {
  videoId: string; // với YouTube: chính là videoId; với direct_url: chính url
  title: string;
  thumbnail: string | null;
  durationLabel?: string;
  sourceType: SourceType;
  /** id dòng trong allowed_sources mà video này thuộc về — CHỈ cần khi video đến từ 1 dòng
      whitelist RIÊNG của chính nó (video lẻ/link trực tiếp, xem PlayerPage.tsx: danh sách
      "video lẻ khác" khi đang xem 1 video không nằm trong playlist nào). Video trong 1
      playlist (custom_playlist/youtube_playlist) thì để trống — mọi video trong đó dùng
      CHUNG đúng 1 sourceId của trang đang mở, không cần khai riêng từng video. */
  sourceId?: string;
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
  /** Vị trí xem dở tính bằng GIÂY — dùng để tua trình phát tới đúng chỗ khi mở lại video
      (xem supabase/016_watch_progress_position.sql). Dòng lưu từ trước khi có cột này = 0. */
  position_seconds: number;
  updated_at: string;
}

export type BlockedItemType = 'playlist' | 'video';

/**
 * 1 playlist hoặc video YouTube bị phụ huynh CHỦ ĐỘNG chặn thủ công (xem
 * supabase/018_blocked_items.sql) — dùng khi 1 kênh đã whitelist có playlist/video "lạc
 * nguồn" (VD: playlist tổng hợp kênh gộp cả video của kênh khác vào) mà không muốn chặn
 * hẳn cả kênh, chỉ ẩn riêng đúng playlist/video đó.
 */
export interface BlockedItem {
  id: string;
  item_type: BlockedItemType;
  /** playlistId hoặc videoId THẬT trên YouTube — không phải id trong allowed_sources. */
  item_id: string;
  /** Tên hiển thị lúc chặn — chỉ để phụ huynh dễ nhận ra trong danh sách, không dùng để so khớp. */
  title: string | null;
  created_at: string;
}

/**
 * 1 lượt bé BẤM TIM để tự đánh dấu "yêu thích" ĐÚNG 1 VIDEO/AUDIO (xem
 * supabase/021_favorites.sql + supabase/022_favorites_video_ref.sql + src/hooks/useFavorites.ts).
 * Khác hẳn nhãn (ContentLabel): nhãn do PHỤ HUYNH tự đặt trong Khu vực Bố mẹ để phân loại nội
 * dung; favorite do CHÍNH BÉ tự chọn ngay trên giao diện, không cần vào Khu vực Bố mẹ, theo
 * TỪNG HỒ SƠ (Mina bấm tim 1 video thì Cốm không thấy video đó trong "Bé thích" của Cốm).
 *
 * `video_ref` — GIỐNG HỆT quy ước của WatchProgress.video_ref (xem struct bên trên): với
 * video/audio đứng RIÊNG LẺ (không nằm trong playlist nào) thì đây là videoId YouTube/url
 * trực tiếp của CHÍNH nó — cũng là dòng whitelist duy nhất luôn nên `source_id` một mình đã
 * đủ xác định; với 1 TẬP nằm TRONG 1 playlist (youtube_playlist/custom_playlist) thì
 * `source_id` là dòng whitelist của CẢ playlist (chia sẻ chung giữa mọi tập), nên PHẢI có
 * thêm `video_ref` (videoId của đúng tập đó) mới phân biệt được tập nào trong playlist đang
 * được thích — bấm tim tập 3 sẽ KHÔNG khiến tập 5 cùng playlist tự hiện "đã thích" theo.
 * (profile_id, source_id, video_ref) là bộ khoá duy nhất — xem migration 022.
 */
export interface Favorite {
  id: string;
  profile_id: string;
  source_id: string;
  video_ref: string;
  created_at: string;
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
