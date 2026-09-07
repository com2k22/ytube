import { ProfileSwitcher } from './ProfileSwitcher';

/**
 * Thanh trên cùng.
 *
 * ĐÃ ĐỔI CHỖ với nút chọn hồ sơ (xem Sidebar.tsx): so ảnh app YouTube TV thật bạn gửi, logo
 * YouTube nằm ở góc phải thanh trên cùng, còn avatar/hồ sơ nằm ở đầu dải menu bên trái —
 * ngược với bố cục cũ của app này.
 *
 * • TV / máy tính / iPad → chỉ hiện LOGO Ytube (góc phải). Nút chọn hồ sơ đã dời hẳn sang
 *   Sidebar.
 * • Điện thoại (≤700px) → logo ẩn đi (đã ẩn từ trước, xem theme.css), thay vào đó hiện lại
 *   nút chọn hồ sơ ở đúng góc phải này — chỗ quen thuộc trên điện thoại, vì trên điện thoại
 *   Sidebar đã biến thành thanh menu dưới đáy, không phải chỗ hợp lý để đặt nút này.
 *
 * Cả 2 phần bên dưới CÙNG NẰM TRONG MÃ, CSS quyết định cái nào hiện theo bề ngang màn hình
 * — xem .topbar-profile trong theme.css.
 *
 * Logo: khối đỏ bo góc + tam giác play trắng (vẽ bằng SVG) + chữ "Ytube" đứng sau — ĐỒNG
 * BỘ với bộ icon app (icon màn hình chính điện thoại/TV, xem scripts/gen-icons.py): cùng
 * màu đỏ, cùng độ bo góc, cùng tỉ lệ tam giác. Trước đây icon là ký tự "▶" gõ bằng chữ —
 * đổi sang SVG để hình tam giác giống hệt nhau ở MỌI nơi (không phụ thuộc font chữ của
 * từng máy/TV, vốn có thể hiện lệch/mỏng khác nhau tuỳ thiết bị).
 */
export function TopBar() {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="logo-badge">
          <svg className="logo-badge-icon" viewBox="0 0 24 24" aria-hidden="true">
            <polygon points="7,4 7,20 20,12" />
          </svg>
        </span>
        <span className="brand-text">Ytube</span>
      </div>
      <ProfileSwitcher region="topbar" className="topbar-profile" />
    </div>
  );
}
