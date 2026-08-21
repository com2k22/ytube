import { useProfileContext } from '@/context/ProfileContext';
import { useThemeContext } from '@/context/ThemeContext';
import { PROFILE_EMOJI } from '@/constants';

interface Props {
  onOpenParentGate: () => void;
}

/** Thanh trên cùng — chuyển hồ sơ, đổi giao diện, và nút vào khu vực Bố mẹ. */
export function TopBar({ onOpenParentGate }: Props) {
  const { profiles, activeProfile, switchProfile } = useProfileContext();
  const { theme, toggleTheme } = useThemeContext();

  return (
    <div className="topbar">
      <div className="profiles">
        {profiles.map((p) => (
          <div
            key={p.id}
            className={`profile-btn ${activeProfile?.id === p.id ? 'active' : ''}`}
            onClick={() => switchProfile(p.id)}
          >
            <span className="avatar">{PROFILE_EMOJI[p.id] ?? '🙂'}</span> {p.name}
          </div>
        ))}
      </div>
      <div className="top-actions">
        <button className="theme-toggle" onClick={toggleTheme}>
          🎨 <span>{theme === 'dark_tv' ? 'Dark TV' : 'Chibi Cute'}</span>
        </button>
        <button className="lock-btn" onClick={onOpenParentGate}>
          🔒 Bố mẹ
        </button>
      </div>
    </div>
  );
}
