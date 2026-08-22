import { useEffect, useRef, useState } from 'react';
import { useProfileContext } from '@/context/ProfileContext';
import { PROFILE_EMOJI } from '@/constants';

/**
 * Thanh trên cùng — chỉ còn đúng 1 việc: chọn hồ sơ của bé, đặt ở GÓC PHẢI.
 *
 * Trước đây hiện sẵn cả 2 bé cạnh nhau. Nay chỉ hiện hồ sơ ĐANG DÙNG; bấm vào đó mới xổ
 * xuống danh sách để đổi sang bé kia. Gọn hơn, và nhìn là biết ngay đang ở hồ sơ nào.
 *
 * Lưu ý về điều khiển TV: khi danh sách xổ ra, lớp đó mang data-nav-scope — nghĩa là phím
 * mũi tên chỉ chạy trong danh sách, không lạc ra ngoài (xem getFocusables ở useTvNavigation).
 */
export function TopBar() {
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

  if (!activeProfile) return <div className="topbar" />;

  return (
    <div className="topbar">
      <div className="profile-switch" ref={wrapRef}>
        <div
          data-region="topbar"
          tabIndex={0}
          className="profile-btn active"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="avatar">{PROFILE_EMOJI[activeProfile.id] ?? '🙂'}</span>
          {activeProfile.name}
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
                <span className="avatar">{PROFILE_EMOJI[p.id] ?? '🙂'}</span>
                {p.name}
                {activeProfile.id === p.id && <span className="profile-check">✓</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
