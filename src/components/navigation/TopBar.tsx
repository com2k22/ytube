import { useProfileContext } from '@/context/ProfileContext';
import { PROFILE_EMOJI } from '@/constants';

/**
 * Thanh trên cùng — giờ chỉ còn đúng 1 việc: chọn hồ sơ của bé (Cốm / Mina).
 *
 * 2 nút "Giao diện" và "Bố mẹ" trước đây nằm ở góc phải thanh này đã được dời hẳn xuống
 * menu bên trái (xem Sidebar.tsx), cho giống bố cục app TV chuẩn — mọi thứ điều hướng
 * gom về 1 cột bên trái, thanh trên để trống thoáng.
 *
 * Lưu ý về điều khiển TV: mọi nút ở đây đều PHẢI có `data-region` + `tabIndex={0}` thì
 * phím mũi tên trên điều khiển mới nhảy tới được (xem useTvNavigation — hook đó chỉ tìm
 * các phần tử có thuộc tính data-region).
 */
export function TopBar() {
  const { profiles, activeProfile, switchProfile } = useProfileContext();

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
    </div>
  );
}
