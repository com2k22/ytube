// Ứng dụng này chỉ phục vụ đúng 2 hồ sơ cố định: Mina & Cốm — nên dùng ID cố định
// (khởi tạo sẵn trong supabase/001_schema.sql) thay vì để Supabase tự sinh UUID ngẫu
// nhiên, để code frontend có thể tham chiếu trực tiếp mà không cần tra cứu theo tên.
export const PROFILE_IDS = {
  MINA: '11111111-1111-1111-1111-111111111111',
  COM: '22222222-2222-2222-2222-222222222222',
} as const;

// Icon đại diện cho từng bé — dùng ở nút chọn hồ sơ (thanh trên cùng), menu bên trái, và
// nhãn "dành cho bé nào" trong khu Bố mẹ. Đổi ở đây là đổi đồng loạt mọi nơi.
export const PROFILE_EMOJI: Record<string, string> = {
  [PROFILE_IDS.MINA]: '🐵',
  [PROFILE_IDS.COM]: '🦄',
};

// Gmail chủ gia đình — phải khớp đúng với owner_email trong bảng "families"
// (supabase/011_family_auth.sql). Dùng để tự điền sẵn ô email ở màn hình "đăng nhập bằng
// mã gửi qua email" (GoogleSignInGate) — trên TV gõ email bằng điều khiển từ xa rất bất
// tiện, có sẵn rồi thì chỉ cần bấm "Gửi mã" là xong, không phải gõ gì cả.
export const FAMILY_EMAIL = 'ngocphongdo@gmail.com';

// Màu cố định của từng bé trên biểu đồ "Báo cáo tuần". Trỏ sang biến CSS (khai trong
// src/styles/theme.css) vì mỗi giao diện cần một sắc độ riêng cho dễ nhìn: nền tối cần
// màu sáng hơn, nền hồng cần màu đậm hơn.
//
// QUAN TRỌNG — cặp xanh dương + cam này đã được kiểm tra bằng công cụ mô phỏng mù màu,
// vẫn phân biệt rõ ở cả 3 kiểu mù màu phổ biến. Đừng đổi sang cặp xanh lá + đỏ.
// Màu GẮN VỚI TỪNG BÉ chứ không gắn với thứ tự cột — Mina lúc nào cũng là màu xanh.
export const PROFILE_CHART_COLOR: Record<string, string> = {
  [PROFILE_IDS.MINA]: 'var(--chart-mina)',
  [PROFILE_IDS.COM]: 'var(--chart-com)',
};

export const SOURCE_TYPE_ICON: Record<string, string> = {
  youtube_playlist: '📂',
  youtube_video: '🎬',
  youtube_channel: '📺',
  direct_url: '🔗',
  custom_playlist: '🧩',
};
