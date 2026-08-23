import type { PanelAction } from '@/hooks/useTvPlayerControls';

interface Props {
  open: boolean;
  actions: PanelAction[];
  activeIndex: number;
  /** Nhãn khi đang tua ("⏩ 3:20") — hiện giữa màn hình, không phụ thuộc bảng điều khiển. */
  seekLabel: string | null;
}

/**
 * PlayerControlBar — bảng điều khiển nổi BÊN TRONG khung video.
 *
 * Cố ý đặt bên trong khung video (không phải dưới trang) để lúc xem TOÀN MÀN HÌNH vẫn
 * thấy được — phần tử nằm ngoài khung toàn màn hình thì trình duyệt không vẽ ra.
 *
 * Mở bằng phím MŨI TÊN LÊN, đóng bằng MŨI TÊN XUỐNG hoặc nút Back (xem useTvPlayerControls).
 *
 * Cố ý KHÔNG hiện dòng nhắc cách dùng phím: xem phim thì màn hình phải sạch, dòng chữ nằm
 * đè lên video gây rối mắt. Ai cần thì bấm ▲ là ra đủ nút.
 */
export function PlayerControlBar({ open, actions, activeIndex, seekLabel }: Props) {
  return (
    <>
      {seekLabel && <div className="player-seek-badge">{seekLabel}</div>}

      {open && (
        <div className="player-panel">
          {actions.map((a, i) => (
            <button
              key={a.key}
              className={`player-panel-btn ${i === activeIndex ? 'active' : ''} ${a.disabled ? 'is-disabled' : ''}`}
              disabled={a.disabled}
              onClick={a.onSelect}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

    </>
  );
}
