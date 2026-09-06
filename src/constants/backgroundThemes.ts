/**
 * Bộ hình nền Trang chủ theo mùa/dịp lễ — chọn được trong khu Bố mẹ (xem
 * HomeBackgroundCard.tsx), áp dụng cho Trang chủ + menu (Sidebar/TopBar) của bé, xem
 * useHomeBackground.ts + Layout.tsx.
 *
 * CỐ Ý tự vẽ bằng CSS (gradient màu + hoạ tiết chấm nhỏ nhẹ nhàng), KHÔNG dùng ảnh thật:
 *  - Không lo nội dung ảnh không phù hợp (mọi chi tiết đều do mình vẽ ra).
 *  - Tải tức thì, không tốn dữ liệu, không phụ thuộc mạng.
 *  - Độ trong suốt (alpha) rất thấp — chỉ là 1 lớp "ánh màu" mờ phía sau, KHÔNG che hay làm
 *    giảm độ rõ của thẻ video/chữ (mọi thẻ vẫn có nền riêng đặc màu, xem theme.css phần
 *    "HÌNH NỀN TRANG CHỦ THEO MÙA/DỊP LỄ") — không ảnh hưởng mắt bé khi nhìn app.
 *
 * id của từng hình nền được LƯU THẲNG vào cơ sở dữ liệu (family_settings.home_background,
 * xem supabase/017_home_background.sql) — ĐỔI id ở đây thì hình đã chọn từ trước sẽ "mất
 * tích" (không khớp id nào), rơi về nền mặc định. Muốn đổi tên hiển thị thì sửa `label`,
 * đừng đụng `id`.
 */
export interface BackgroundTheme {
  id: string;
  /** Tên tiếng Việt hiện trong khu Bố mẹ. */
  label: string;
  /** 1 emoji đại diện, hiện kèm tên cho dễ nhận ra. */
  emoji: string;
}

export const BACKGROUND_THEMES: BackgroundTheme[] = [
  { id: 'xuan', label: 'Mùa xuân', emoji: '🌸' },
  { id: 'ha', label: 'Mùa hè', emoji: '☀️' },
  { id: 'thu', label: 'Mùa thu', emoji: '🍂' },
  { id: 'dong', label: 'Mùa đông', emoji: '❄️' },
  { id: 'trungthu', label: 'Trung Thu', emoji: '🏮' },
  { id: 'giangsinh', label: 'Giáng Sinh', emoji: '🎄' },
  { id: 'tet', label: 'Tết', emoji: '🧧' },
];

/** Tra tên + emoji theo id — dùng khi cần hiện "đang chọn: ..." mà chỉ có sẵn id. */
export function findBackgroundTheme(id: string | null): BackgroundTheme | null {
  if (!id) return null;
  return BACKGROUND_THEMES.find((t) => t.id === id) ?? null;
}
