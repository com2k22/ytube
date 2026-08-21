import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
import { PROFILE_IDS } from '@/constants';

const NAV_ITEMS: { label: string; profileId?: string }[] = [
  { label: '🏠 Trang chủ' },
  { label: '🧒 Cho Mina', profileId: PROFILE_IDS.MINA },
  { label: '🎒 Cho Cốm', profileId: PROFILE_IDS.COM },
  { label: '🕘 Video mới' },
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
        <span className="logo-badge">▶</span> Ytube
      </div>

      {NAV_ITEMS.map((item, i) => (
        <div
          key={item.label}
          data-region="side"
          tabIndex={0}
          className={`side-item ${activeIndex === i ? 'active' : ''}`}
          style={i === 0 ? { marginTop: 14 } : undefined}
          onClick={() => onSelect(i)}
        >
          {item.label}
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
