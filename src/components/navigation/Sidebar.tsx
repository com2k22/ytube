import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ProfileSwitcher } from './ProfileSwitcher';

// Tách riêng icon và chữ (thay vì gộp chung 1 chuỗi) để chế độ TV giấu được phần chữ đi,
// chỉ chừa dải icon gọn bên trái giống app YouTube trên TV.
//
// ĐÃ BỎ 2 mục "Cho Mina" / "Cho Cốm" khỏi menu này. Lý do: chúng chỉ làm đúng 1 việc là
// đổi hồ sơ đang dùng — mà việc đó nút chọn hồ sơ NGAY ĐẦU menu bên (xem ProfileSwitcher
// bên dưới) đã làm rồi. Hai chỗ cùng một chức năng khiến người dùng phân vân "hai cái này
// khác nhau chỗ nào".
//
// Icon dùng component SVG (lucide-react) thay vì emoji: emoji là 1 hình vẽ có sẵn màu
// riêng, không tô lại được bằng CSS. Icon SVG thì có — nhờ vậy mới đổi được màu icon theo
// trạng thái đang chọn/không chọn, giống hệt cách app YouTube trên TV tô sáng icon focus.
const NAV_ITEMS: { icon: LucideIcon; text: string }[] = [{ icon: Home, text: 'Trang chủ' }];

interface Props {
  onOpenParentGate: () => void;
}

/**
 * Sidebar — dải menu bên trái: chọn hồ sơ, menu điều hướng, trang trí, và nút "Bố mẹ".
 *
 * ĐÃ ĐỔI CHỖ với logo (xem TopBar.tsx): so ảnh app YouTube TV thật bạn gửi, icon avatar
 * chọn hồ sơ nằm ở ĐẦU dải menu bên trái, còn logo YouTube nằm ở góc phải thanh trên cùng —
 * ngược hẳn với bố cục cũ của app này (logo bên trái, hồ sơ bên phải). Đổi lại đúng theo
 * ảnh mẫu. Nút chọn hồ sơ giờ nằm trong component dùng chung ProfileSwitcher — xem file đó
 * để biết vì sao dùng chung được cho cả chỗ này lẫn TopBar (điện thoại).
 *
 * Cùng một đoạn mã này hiện ra 2 kiểu khác nhau, hoàn toàn do CSS quyết định:
 *  • TV / máy tính / iPad → CỘT DỌC bên trái như cũ.
 *  • Điện thoại (bề ngang ≤ 700px) → THANH NGANG DƯỚI ĐÁY màn hình, kiểu app điện thoại,
 *    để ngón cái với tới được — và nút chọn hồ sơ ẩn khỏi đây, quay lại góc phải TopBar
 *    như vị trí quen thuộc trên điện thoại (xem .sidebar-profile trong theme.css).
 * Cố ý không viết 2 component riêng cho phần menu/trang trí: 1 chỗ sửa là cả 2 nơi cùng
 * đổi, không sợ lệch nhau.
 *
 * ĐÃ BỎ nút "Giao diện": app giờ chỉ còn đúng 1 giao diện (Dark TV), không cho đổi nữa
 * — xem ThemeContext.tsx, nơi theme luôn bị ép về 'dark_tv' bất kể hồ sơ từng lưu gì.
 */
export function Sidebar({ onOpenParentGate }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();

  const onSelect = (i: number) => {
    setActiveIndex(i);
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <ProfileSwitcher region="side" className="sidebar-profile" />

      {NAV_ITEMS.map((item, i) => (
        <div
          key={item.text}
          data-region="side"
          tabIndex={0}
          className={`side-item ${activeIndex === i ? 'active' : ''}`}
          onClick={() => onSelect(i)}
        >
          <span className="side-icon">
            <item.icon className="side-icon-svg" aria-hidden="true" />
          </span>
          <span className="side-text">{item.text}</span>
        </div>
      ))}

      {/* Khối trang trí có flex:1 — vừa để lấp chỗ trống cho vui mắt, vừa đóng vai trò
          "lò xo" đẩy nút "Bố mẹ" bên dưới xuống sát đáy. */}
      <div className="sidebar-deco" aria-hidden="true">
        <span className="deco d1">💗</span>
        <span className="deco d2">🌸</span>
        <span className="deco d3">🌷</span>
        <span className="deco d4">💖</span>
        <span className="deco d5">✨</span>
      </div>

      {/* Lưu ý: nút này vẫn để data-region="side" giống nhóm menu ở trên, nên khi điều
          khiển bằng phím mũi tên nó nằm chung 1 cột dọc với menu — bấm xuống là tới, không
          phải học thêm thao tác nào mới. */}
      <div data-region="side" tabIndex={0} className="side-item side-action" onClick={onOpenParentGate}>
        <span className="side-icon">
          <Lock className="side-icon-svg" aria-hidden="true" />
        </span>
        <span className="side-text">Bố mẹ</span>
      </div>
    </aside>
  );
}
