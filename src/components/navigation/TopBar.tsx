import { ProfileSwitcher } from './ProfileSwitcher';
import { useIsPhoneScreen } from '@/lib/screenSize';

/**
 * Thanh trên cùng.
 *
 * ĐÃ ĐỔI CHỖ với nút chọn hồ sơ (xem Sidebar.tsx): so ảnh app YouTube TV thật bạn gửi, logo
 * YouTube nằm ở góc phải thanh trên cùng, còn avatar/hồ sơ nằm ở đầu dải menu bên trái —
 * ngược với bố cục cũ của app này.
 *
 * • TV / máy tính / iPad → chỉ hiện LOGO Ytube (góc phải). Nút chọn hồ sơ đã dời hẳn sang
 *   Sidebar.
 * • Điện thoại (≤700px) → KHÔNG hiện gì cả nữa (logo đã ẩn từ trước; nút chọn hồ sơ trước
 *   đây quay lại góc phải, giờ đã dời hẳn xuống banner chào ở Trang chủ — xem
 *   MobileHomePage.tsx, region "homebanner"). Thanh này trên điện thoại giờ chỉ còn tác
 *   dụng duy nhất: chừa đúng khoảng đệm an toàn (tai thỏ/thanh trạng thái), thu nhỏ + để
 *   trong suốt (xem theme.css) — không còn nội dung nào bên trong nên không cần render
 *   ProfileSwitcher lãng phí (dù có render CSS cũng ẩn hẳn) — bỏ luôn cho gọn.
 *
 * Logo: khối đỏ bo góc + tam giác play trắng (vẽ bằng SVG) + chữ "Ytube" đứng sau — ĐỒNG
 * BỘ với bộ icon app (icon màn hình chính điện thoại/TV, xem scripts/gen-icons.py): cùng
 * màu đỏ, cùng độ bo góc, cùng tỉ lệ tam giác. Trước đây icon là ký tự "▶" gõ bằng chữ —
 * đổi sang SVG để hình tam giác giống hệt nhau ở MỌI nơi (không phụ thuộc font chữ của
 * từng máy/TV, vốn có thể hiện lệch/mỏng khác nhau tuỳ thiết bị).
 */
export function TopBar() {
  const isPhone = useIsPhoneScreen();
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
      {!isPhone && <ProfileSwitcher region="topbar" className="topbar-profile" />}
    </div>
  );
}
