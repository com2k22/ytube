import { NavLink } from 'react-router-dom';
import { Home, Compass, Download, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ITEMS: { to: string; icon: LucideIcon; label: string; end?: boolean }[] = [
  { to: '/', icon: Home, label: 'Trang chủ', end: true },
  { to: '/discover', icon: Compass, label: 'Khám phá' },
  { to: '/downloads', icon: Download, label: 'Đã tải' },
  { to: '/parent', icon: Users, label: 'Khu vực Bố mẹ' },
];

/**
 * MobileBottomNav — thanh menu 4 mục dưới đáy màn hình, CHỈ dùng cho điện thoại thật (xem
 * Layout.tsx: render component này thay cho <Sidebar> khi `useIsPhoneScreen()` đúng).
 *
 * Cố ý tách RIÊNG khỏi Sidebar.tsx thay vì thêm điều kiện vào đó — Sidebar vẫn phải giữ
 * nguyên y hệt cho TV/iPad/máy tính (chỉ 1 mục "Trang chủ" + nút "Bố mẹ"), sửa chung 1 file
 * cho cả 2 kiểu dễ lỡ tay đụng vào giao diện không phải điện thoại.
 *
 * Dùng <NavLink> để tự tô sáng đúng mục đang mở theo URL (thay vì Sidebar cũ tự lưu
 * activeIndex bằng useState — trên điện thoại có nhiều trang thật (Trang chủ/Khám phá/Đã
 * tải/Khu vực Bố mẹ) nên phải theo đúng URL, không tự đoán được như trước).
 */
export function MobileBottomNav() {
  return (
    <nav className="mobile-tabbar" aria-label="Điều hướng chính">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `mobile-tabbar-item ${isActive ? 'active' : ''}`}
        >
          <item.icon className="mobile-tabbar-icon" aria-hidden="true" />
          <span className="mobile-tabbar-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
