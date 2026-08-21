import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
import { useThemeContext } from '@/context/ThemeContext';
import { PROFILE_IDS } from '@/constants';

// Tách riêng icon và chữ (thay vì gộp chung 1 chuỗi như trước) để chế độ TV giấu được
// phần chữ đi, chỉ chừa dải icon gọn bên trái giống app YouTube trên TV — bấm sang menu
// thì dải đó tự bung ra hiện lại chữ. Bản web/điện thoại vẫn hiện đủ icon + chữ như cũ.
const NAV_ITEMS: { icon: string; text: string; profileId?: string }[] = [
  { icon: '🏠', text: 'Trang chủ' },
  { icon: '🧒', text: 'Cho Mina', profileId: PROFILE_IDS.MINA },
  { icon: '🎒', text: 'Cho Cốm', profileId: PROFILE_IDS.COM },
  { icon: '🕘', text: 'Video mới' },
];

interface Props {
  onOpenParentGate: () => void;
}

/**
 * Sidebar cố định bên trái — logo, menu điều hướng, trang trí, và 2 nút chức năng
 * (đổi giao diện + khu vực Bố mẹ) nằm dưới cùng.
 *
 * 2 nút chức năng trước đây nằm ở thanh trên cùng bên phải, nay dời hẳn vào đây cho
 * giống bố cục app TV chuẩn: mọi thứ điều hướng gom về 1 cột bên trái, thanh trên cùng
 * chỉ còn việc chọn hồ sơ của bé. Nhờ khối trang trí ở giữa có flex:1 nên 2 nút này
 * luôn tự bị đẩy xuống sát đáy màn hình, tách bạch với nhóm menu ở trên.
 */
export function Sidebar({ onOpenParentGate }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { switchProfile } = useProfileContext();
  const { toggleTheme } = useThemeContext();
  const navigate = useNavigate();

  const onSelect = (i: number) => {
    setActiveIndex(i);
    const item = NAV_ITEMS[i];
    if (item.profileId) switchProfile(item.profileId);
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="logo-badge">▶</span> <span className="brand-text">Ytube</span>
      </div>

      {NAV_ITEMS.map((item, i) => (
        <div
          key={item.text}
          data-region="side"
          tabIndex={0}
          className={`side-item ${activeIndex === i ? 'active' : ''}`}
          style={i === 0 ? { marginTop: 14 } : undefined}
          onClick={() => onSelect(i)}
        >
          <span className="side-icon">{item.icon}</span>
          <span className="side-text">{item.text}</span>
        </div>
      ))}

      {/* Khối trang trí có flex:1 — vừa để lấp chỗ trống cho vui mắt, vừa đóng vai trò
          "lò xo" đẩy 2 nút chức năng bên dưới xuống sát đáy. */}
      <div className="sidebar-deco" aria-hidden="true">
        <span className="deco d1">💗</span>
        <span className="deco d2">🌸</span>
        <span className="deco d3">🌷</span>
        <span className="deco d4">💖</span>
        <span className="deco d5">✨</span>
      </div>

      {/* Lưu ý: 2 nút này vẫn để data-region="side" giống nhóm menu ở trên, nên khi điều
          khiển bằng phím mũi tên chúng nằm chung 1 cột dọc với menu — bấm xuống là tới,
          không phải học thêm thao tác nào mới. */}
      <div data-region="side" tabIndex={0} className="side-item side-action" onClick={toggleTheme}>
        <span className="side-icon">🎨</span>
        <span className="side-text">Giao diện</span>
      </div>
      <div data-region="side" tabIndex={0} className="side-item side-action" onClick={onOpenParentGate}>
        <span className="side-icon">🔒</span>
        <span className="side-text">Bố mẹ</span>
      </div>
    </aside>
  );
}
