import { Image, RotateCcw } from 'lucide-react';
import { useHomeBackground } from '@/hooks/useHomeBackground';
import { BACKGROUND_THEMES } from '@/constants/backgroundThemes';
import { useToast } from '@/components/common/Toast';

/**
 * HomeBackgroundCard — chọn hình nền Trang chủ theo mùa/dịp lễ cho cả gia đình (khu Bố mẹ >
 * Tài khoản). Hình tự vẽ bằng CSS (xem theme.css + backgroundThemes.ts), áp dụng cho Trang
 * chủ + menu của bé, KHÔNG đụng tới trang phát video hay chính khu Bố mẹ (xem Layout.tsx).
 */
export function HomeBackgroundCard() {
  const { backgroundId, loading, setBackground } = useHomeBackground();
  const { showToast } = useToast();

  const pick = async (id: string | null) => {
    const ok = await setBackground(id);
    if (!ok) showToast('Không lưu được hình nền — thử lại nhé.');
  };

  return (
    <div className="settings-card" style={{ marginTop: 20 }}>
      <h4>
        <Image className="icon icon-lead" aria-hidden="true" /> Hình nền Trang chủ
      </h4>
      <p style={{ opacity: 0.65, margin: '-6px 0 16px', fontSize: 12.5 }}>Đổi theo mùa/dịp lễ, không ảnh hưởng mắt bé.</p>

      <div className="bg-theme-grid">
        <div
          className={`bg-theme-pick ${!backgroundId ? 'on' : ''}`}
          data-region="pbg"
          tabIndex={0}
          onClick={() => pick(null)}
        >
          <div className="bg-swatch bg-swatch--default">
            <RotateCcw className="icon" aria-hidden="true" />
          </div>
          <span>Mặc định</span>
        </div>

        {BACKGROUND_THEMES.map((t) => (
          <div
            key={t.id}
            className={`bg-theme-pick ${backgroundId === t.id ? 'on' : ''}`}
            data-region="pbg"
            tabIndex={0}
            onClick={() => pick(t.id)}
          >
            <div className={`bg-swatch bg-swatch--${t.id}`}>{t.emoji}</div>
            <span>{t.label}</span>
          </div>
        ))}
      </div>

      {loading && <p style={{ opacity: 0.5, fontSize: 12.5, marginTop: 10 }}>Đang tải...</p>}
    </div>
  );
}
