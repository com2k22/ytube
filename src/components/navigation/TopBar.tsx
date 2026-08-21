import { useProfileContext } from '@/context/ProfileContext';
import { useThemeContext } from '@/context/ThemeContext';
import { PROFILE_EMOJI } from '@/constants';

interface Props {
  onOpenParentGate: () => void;
}

/**
 * Thanh trên cùng — chuyển hồ sơ, đổi giao diện, và nút vào khu vực Bố mẹ.
 *
 * Lưu ý về điều khiển TV: mọi nút ở đây đều PHẢI có `data-region` + `tabIndex={0}` thì
 * phím mũi tên trên điều khiển mới nhảy tới được (xem useTvNavigation — hook đó chỉ tìm
 * các phần tử có thuộc tính data-region). Trước đây thanh này thiếu 2 thuộc tính đó nên
 * dùng điều khiển TV không tài nào chọn được hàng Cốm/Mina, đổi giao diện hay nút Bố mẹ.
 *
 * Cả 3 nhóm nút dùng CHUNG 1 tên vùng "topbar" để nằm trên cùng 1 hàng ngang khi điều
 * hướng — bấm mũi tên trái/phải chạy hết từ hồ sơ đầu tiên sang tới nút Bố mẹ.
 */
export function TopBar({ onOpenParentGate }: Props) {
  const { profiles, activeProfile, switchProfile } = useProfileContext();
  const { theme, toggleTheme } = useThemeContext();

  return (
    <div className="topbar">
      <div className="profiles">
        {profiles.map((p) => (
          <div
            key={p.id}
            data-region="topbar"
            tabIndex={0}
            className={`profile-btn ${activeProfile?.id === p.id ? 'active' : ''}`}
            onClick={() => switchProfile(p.id)}
          >
            <span className="avatar">{PROFILE_EMOJI[p.id] ?? '🙂'}</span> {p.name}
          </div>
        ))}
      </div>
      <div className="top-actions">
        <button className="theme-toggle" data-region="topbar" tabIndex={0} onClick={toggleTheme}>
          🎨 <span>{theme === 'dark_tv' ? 'Dark TV' : 'Chibi Cute'}</span>
        </button>
        <button className="lock-btn" data-region="topbar" tabIndex={0} onClick={onOpenParentGate}>
          🔒 Bố mẹ
        </button>
      </div>
    </div>
  );
}
