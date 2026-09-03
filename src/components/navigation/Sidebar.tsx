import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeContext } from '@/context/ThemeContext';

// Tách riêng icon và chữ (thay vì gộp chung 1 chuỗi) để chế độ TV giấu được phần chữ đi,
// chỉ chừa dải icon gọn bên trái giống app YouTube trên TV.
//
// ĐÃ BỎ 2 mục "Cho Mina" / "Cho Cốm" khỏi menu này. Lý do: chúng chỉ làm đúng 1 việc là
// đổi hồ sơ đang dùng — mà việc đó nút chọn hồ sơ ở GÓC PHẢI THANH TRÊN CÙNG đã làm rồi
// (xem TopBar). Hai chỗ cùng một chức năng khiến người dùng phân vân "hai cái này khác
// nhau chỗ nào", và trên điện thoại thì chiếm mất chỗ của thanh menu dưới đáy.
const NAV_ITEMS: { icon: string; text: string }[] = [{ icon: '🏠', text: 'Trang chủ' }];

interface Props {
  onOpenParentGate: () => void;
}

/**
 * Sidebar — logo, menu điều hướng, trang trí, và 2 nút chức năng (đổi giao diện + khu vực
 * Bố mẹ) nằm dưới cùng.
 *
 * Cùng một đoạn mã này hiện ra 2 kiểu khác nhau, hoàn toàn do CSS quyết định:
 *  • TV / máy tính / iPad → CỘT DỌC bên trái như cũ.
 *  • Điện thoại (bề ngang ≤ 700px) → THANH NGANG DƯỚI ĐÁY màn hình, kiểu app điện thoại,
 *    để ngón cái với tới được. Xem khối "THANH MENU DƯỚI ĐÁY" ở cuối theme.css.
 * Cố ý không viết 2 component riêng: 1 chỗ sửa là cả 2 nơi cùng đổi, không sợ lệch nhau.
 *
 * 2 nút chức năng trước đây nằm ở thanh trên cùng bên phải, nay dời hẳn vào đây cho
 * giống bố cục app TV chuẩn: mọi thứ điều hướng gom về 1 cột bên trái, thanh trên cùng
 * chỉ còn việc chọn hồ sơ của bé. Nhờ khối trang trí ở giữa có flex:1 nên 2 nút này
 * luôn tự bị đẩy xuống sát đáy màn hình, tách bạch với nhóm menu ở trên.
 */
export function Sidebar({ onOpenParentGate }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { toggleTheme } = useThemeContext();
  const navigate = useNavigate();

  const onSelect = (i: number) => {
    setActiveIndex(i);
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
