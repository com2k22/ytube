import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
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

/** Sidebar cố định bên trái — logo, menu điều hướng, và trái tim/hoa trang trí. */
export function Sidebar() {
  const [activeIndex, setActiveIndex] = useState(0);
  const { switchProfile } = useProfileContext();
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

      <div className="sidebar-deco" aria-hidden="true">
        <span className="deco d1">💗</span>
        <span className="deco d2">🌸</span>
        <span className="deco d3">🌷</span>
        <span className="deco d4">💖</span>
        <span className="deco d5">✨</span>
      </div>
    </aside>
  );
}
