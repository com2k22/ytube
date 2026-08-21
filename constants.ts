// Ứng dụng này chỉ phục vụ đúng 2 hồ sơ cố định: Mina & Cốm — nên dùng ID cố định
// (khởi tạo sẵn trong supabase/001_schema.sql) thay vì để Supabase tự sinh UUID ngẫu
// nhiên, để code frontend có thể tham chiếu trực tiếp mà không cần tra cứu theo tên.
export const PROFILE_IDS = {
  MINA: '11111111-1111-1111-1111-111111111111',
  COM: '22222222-2222-2222-2222-222222222222',
} as const;

export const PROFILE_EMOJI: Record<string, string> = {
  [PROFILE_IDS.MINA]: '🐻',
  [PROFILE_IDS.COM]: '🦊',
};

export const SOURCE_TYPE_ICON: Record<string, string> = {
  youtube_playlist: '📂',
  youtube_video: '🎬',
  youtube_channel: '📺',
  direct_url: '🔗',
  custom_playlist: '🧩',
};
