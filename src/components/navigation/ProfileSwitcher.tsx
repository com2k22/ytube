import { useEffect, useRef, useState } from 'react';
import { useProfileContext } from '@/context/ProfileContext';
import { profileEmoji } from '@/constants';

interface Props {
  /**
   * Vùng điều hướng bằng điều khiển TV cho nút chính:
   *  - 'side'   → đặt trong Sidebar (TV/máy tính/iPad): nằm chung 1 cột dọc với menu bên,
   *               bấm lên/xuống mà tới (xem SECTION_COLS.side trong Layout.tsx).
   *  - 'topbar' → đặt trong TopBar (chỉ hiện trên ĐIỆN THOẠI, xem .topbar-profile trong
   *               theme.css): cố tình KHÔNG khai ở SECTION_COLS → mặc định 1 hàng ngang.
   */
  region: 'side' | 'topbar';
  /** Class bọc ngoài — để CSS quyết định đặt ở đâu (đầu Sidebar hay góc phải TopBar) và
      hiện/ẩn theo bề ngang màn hình (xem .sidebar-profile / .topbar-profile). */
  className: string;
}

/**
 * ProfileSwitcher — nút chọn hồ sơ đang xem + danh sách xổ ra để đổi sang bé kia.
 *
 * Dùng CHUNG 1 component ở 2 chỗ (Sidebar và TopBar), CSS quyết định lúc nào chỗ nào hiện:
 *  - TV / máy tính / iPad: hiện bản trong Sidebar, ở ĐẦU dải menu bên trái — đúng vị trí
 *    avatar/"Đăng nhập" trong app YouTube TV thật.
 *  - Điện thoại (≤700px): hiện bản trong TopBar, góc phải — giữ nguyên chỗ cũ trên điện
 *    thoại, không đổi (menu bên trên điện thoại đã biến thành thanh dưới đáy, không phải
 *    chỗ hợp lý để đặt nút chọn hồ sơ).
 * Chỉ 1 trong 2 bản HIỆN RA tại một thời điểm (bản kia bị CSS ẩn hẳn với display:none) nên
 * 2 state `open` độc lập của 2 component không bao giờ xung đột nhau.
 */
export function ProfileSwitcher({ region, className }: Props) {
  const { profiles, activeProfile, switchProfile } = useProfileContext();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Bấm/chạm ra ngoài, hoặc bấm Back/Esc → đóng danh sách.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!activeProfile) return null;

  return (
    <div className={`profile-switch ${className}`} ref={wrapRef}>
      <div data-region={region} tabIndex={0} className="profile-btn active" onClick={() => setOpen((o) => !o)}>
        <span className="avatar">{profileEmoji(activeProfile)}</span>
        {/* .profile-name-text (KHÔNG dùng chung class .side-text với menu điều hướng): 2
            chỗ đặt cần ẩn/hiện tên theo quy luật khác nhau — dùng chung .side-text sẽ bị
            "dính" luôn cả kiểu chữ nhỏ xíu của thanh menu dưới đáy điện thoại, sai ý. */}
        <span className="profile-name-text">{activeProfile.name}</span>
        <span className={`profile-caret ${open ? 'up' : ''}`}>▾</span>
      </div>

      {open && (
        <div className="profile-menu" data-nav-scope>
          {profiles.map((p) => (
            <div
              key={p.id}
              data-region="profmenu"
              tabIndex={0}
              className={`profile-menu-item ${activeProfile.id === p.id ? 'active' : ''}`}
              onClick={() => {
                switchProfile(p.id);
                setOpen(false);
              }}
            >
              <span className="avatar">{profileEmoji(p)}</span>
              {p.name}
              {activeProfile.id === p.id && <span className="profile-check">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
