// ID gốc của Mina & Cốm — 2 hồ sơ có sẵn từ đầu (khởi tạo trong supabase/001_schema.sql).
// Từ bản có "Hồ sơ các bé linh hoạt" (supabase/012_...), KHÔNG còn gắn cứng danh sách bé
// trong code nữa — thêm/bớt bé làm ngay trong khu Bố mẹ. 2 hằng số này chỉ còn giữ lại để
// dễ đối chiếu với dữ liệu seed sẵn, không dùng để giới hạn số bé trong code nữa.
export const PROFILE_IDS = {
  MINA: '11111111-1111-1111-1111-111111111111',
  COM: '22222222-2222-2222-2222-222222222222',
} as const;

// Icon đại diện của 1 bé — LẤY TỪ CỘT "avatar" trong bảng profiles (mỗi bé tự có emoji
// riêng ngay từ khi tạo, chọn trong khu Bố mẹ > Hồ sơ các bé), không còn tra theo ID cố
// định trong code nữa. Dùng hàm này thay vì đọc thẳng profile.avatar để có sẵn giá trị
// mặc định 🙂 khi vì lý do gì đó chưa có emoji.
export function profileEmoji(profile: { avatar?: string | null } | null | undefined): string {
  return profile?.avatar || '🙂';
}

// Bộ emoji có sẵn để chọn khi thêm bé mới / đổi emoji — gõ emoji bằng điều khiển TV rất
// bất tiện nên cho chọn từ danh sách dựng sẵn thay vì gõ tự do.
// Xếp theo NHÓM 6 emoji/hàng (khớp đúng số cột "pkidemoji" khai trong Layout.tsx) để lưới
// chọn luôn đều hàng, không lẻ ô ở cuối: 2 hàng đầu là bộ cũ (giữ nguyên thứ tự để hồ sơ đã
// tạo từ trước không bị đổi icon), các hàng sau là thú thêm mới + vài icon vui không phải
// con vật, cho bé thích thứ khác vẫn có lựa chọn.
export const PROFILE_EMOJI_PRESETS = [
  '🐵', '🦄', '🐻', '🐰', '🐱', '🐶',
  '🦁', '🐼', '🦊', '🐧', '🐸', '🐯',
  '🐨', '🐹', '🐭', '🐷', '🐮', '🐔',
  '🐤', '🐢', '🦋', '🐙', '🐳', '🦉',
  '🐝', '🦒', '🐘', '🐬', '🦔', '🐴',
  '🌟', '🎈', '🌈', '🚀', '⚽', '👑',
];

// Gmail chủ gia đình — phải khớp đúng với owner_email trong bảng "families"
// (supabase/011_family_auth.sql). Dùng để tự điền sẵn ô email ở màn hình "đăng nhập bằng
// mã gửi qua email" (GoogleSignInGate) — trên TV gõ email bằng điều khiển từ xa rất bất
// tiện, có sẵn rồi thì chỉ cần bấm "Gửi mã" là xong, không phải gõ gì cả.
export const FAMILY_EMAIL = 'ngocphongdo@gmail.com';

// Màu trên biểu đồ "Báo cáo tuần" — trỏ sang biến CSS (khai trong src/styles/theme.css)
// vì mỗi giao diện cần một sắc độ riêng cho dễ nhìn: nền tối cần màu sáng hơn, nền hồng
// cần màu đậm hơn. QUAN TRỌNG — bộ màu này đã kiểm tra bằng công cụ mô phỏng mù màu, vẫn
// phân biệt rõ ở cả 3 kiểu mù màu phổ biến (xanh dương/cam là cặp chính, đừng đổi tuỳ ý).
//
// Từ khi hồ sơ bé không còn cố định số lượng, màu gắn theo THỨ TỰ TẠO HỒ SƠ (bé tạo trước
// luôn giữ đúng 1 màu, không đổi khi thêm bé mới vào sau) thay vì gắn cứng theo ID như
// trước — cần truyền cả danh sách profiles hiện có vào để tính đúng thứ tự.
const CHART_COLOR_VARS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];
export function profileChartColor(profiles: { id: string }[], profileId: string): string {
  const idx = profiles.findIndex((p) => p.id === profileId);
  return idx >= 0 ? CHART_COLOR_VARS[idx % CHART_COLOR_VARS.length] : 'var(--focus-color)';
}

export const SOURCE_TYPE_ICON: Record<string, string> = {
  youtube_playlist: '📂',
  youtube_video: '🎬',
  youtube_channel: '📺',
  direct_url: '🔗',
  custom_playlist: '🧩',
};
