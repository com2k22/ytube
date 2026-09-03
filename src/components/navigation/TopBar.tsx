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
 * Logo CHỈ còn icon ▶ (đã bỏ chữ "Ytube") — đúng kiểu app YouTube TV thật: chỉ có icon
 * play đỏ, không kèm chữ "YouTube" ở logo góc màn hình.
 */
export function TopBar() {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="logo-badge">▶</span>
      </div>
      <ProfileSwitcher region="topbar" className="topbar-profile" />
    </div>
  );
}
