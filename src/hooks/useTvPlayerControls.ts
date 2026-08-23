import { useCallback, useEffect, useRef, useState } from 'react';

/** Cầu nối tới trình phát thật (YouTube hoặc thẻ video thường) — mỗi trình phát tự cắm vào. */
export interface PlayerAdapter {
  getCurrentTime: () => number;
  getDuration: () => number;
  /** final = true khi người dùng đã thả phím (lúc đó mới thật sự tải lại video tại mốc mới). */
  seekTo: (seconds: number, final: boolean) => void;
  isPaused: () => boolean;
  play: () => void;
  pause: () => void;
}

export interface PanelAction {
  key: string;
  label: string;
  disabled?: boolean;
  /** true = bấm xong vẫn giữ bảng điều khiển mở (vd nút bật/tắt phụ đề, để thấy chữ đổi). */
  keepOpen?: boolean;
  onSelect: () => void;
}

interface Options {
  /** Thẻ bọc trình phát — dùng để biết khi nào trình phát đang "cầm lái" bàn phím. */
  wrapRef: React.RefObject<HTMLElement>;
  adapter: PlayerAdapter;
  actions: PanelAction[];
  onPrev?: () => void;
  onNext?: () => void;
  enabled?: boolean;
}

/** Chờ bao lâu thì coi là ĐANG GIỮ phím (dưới mức này là bấm nhả — chuyển video). */
const HOLD_MS = 450;
/** Nhịp tua khi đang giữ phím. */
const SEEK_TICK_MS = 220;

/**
 * useTvPlayerControls — bộ điều khiển trình phát bằng ĐIỀU KHIỂN TV.
 *
 * Quy ước phím (chỉ có tác dụng khi ô chọn đang nằm ở khung video, hoặc đang xem toàn
 * màn hình — lúc khác thì nhường phím lại cho việc di chuyển trong trang):
 *   • OK            → tạm dừng / phát tiếp
 *   • Trái/Phải BẤM NHẢ  → video trước / video tiếp theo
 *   • Trái/Phải GIỮ      → tua lùi / tua tới, giữ càng lâu tua càng nhanh
 *   • Lên           → mở bảng điều khiển (phụ đề, chuyển video, cài đặt...)
 *   • Xuống         → đóng bảng điều khiển; nếu đang đóng thì nhường phím cho trang
 *
 * Vì sao nghe phím ở "pha bắt" (capture): bộ điều hướng chung của app (useTvNavigation)
 * cũng nghe phím trên cùng 1 chỗ và được gắn TRƯỚC. Nghe ở pha bắt giúp trình phát được
 * quyền xử lý trước, rồi chặn luôn không cho sự kiện lan xuống — nếu không, bấm mũi tên
 * vừa tua video vừa làm ô chọn chạy lung tung ngoài trang.
 */
export function useTvPlayerControls({ wrapRef, adapter, actions, onPrev, onNext, enabled = true }: Options) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelIndex, setPanelIndex] = useState(0);
  /** Nhãn hiện lên giữa màn hình khi đang tua, vd "⏩ 3:20". null = không hiện. */
  const [seekLabel, setSeekLabel] = useState<string | null>(null);

  const holdRef = useRef<{
    key: string;
    dir: 1 | -1;
    timer: ReturnType<typeof setTimeout> | null;
    interval: ReturnType<typeof setInterval> | null;
    seeking: boolean;
    target: number;
    ticks: number;
  } | null>(null);

  // Giữ bản mới nhất của các thứ hay đổi, để bộ nghe phím (chỉ gắn 1 lần) luôn dùng đúng.
  const stateRef = useRef({ adapter, actions, onPrev, onNext, panelOpen, panelIndex });
  stateRef.current = { adapter, actions, onPrev, onNext, panelOpen, panelIndex };

  const clearHold = useCallback(() => {
    const h = holdRef.current;
    if (!h) return;
    if (h.timer) clearTimeout(h.timer);
    if (h.interval) clearInterval(h.interval);
    holdRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    /** Trình phát có đang "cầm lái" bàn phím không. */
    const inCharge = () => {
      const el = wrapRef.current;
      if (!el) return false;
      if (document.fullscreenElement === el) return true;
      return document.activeElement === el || el.contains(document.activeElement);
    };

    const take = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    /** "125" giây → "2:05" — hiện mốc đang tua tới cho dễ hình dung. */
    const formatClock = (totalSeconds: number) => {
      const s = Math.max(0, Math.floor(totalSeconds));
      const mm = Math.floor(s / 60);
      const ss = s % 60;
      return `${mm}:${String(ss).padStart(2, '0')}`;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!inCharge()) return;
      const { adapter: ad, actions: acts, panelOpen: open, panelIndex: idx } = stateRef.current;

      // --- Khi BẢNG ĐIỀU KHIỂN đang mở: phím chỉ để đi lại trong bảng ---
      if (open) {
        if (e.key === 'ArrowRight') {
          take(e);
          setPanelIndex((i) => Math.min(i + 1, acts.length - 1));
        } else if (e.key === 'ArrowLeft') {
          take(e);
          setPanelIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
          take(e);
          const action = acts[idx];
          if (action && !action.disabled) {
            action.onSelect();
            // Bấm xong thì đóng bảng lại để xem tiếp cho thoáng — trừ nút cần thấy chữ đổi.
            if (!action.keepOpen) setPanelOpen(false);
          }
        } else if (e.key === 'ArrowDown' || e.key === 'Escape' || e.key === 'ArrowUp') {
          take(e);
          setPanelOpen(false);
        }
        return;
      }

      // --- Khi bảng điều khiển đang đóng ---
      switch (e.key) {
        case 'Enter':
          take(e);
          if (ad.isPaused()) ad.play();
          else ad.pause();
          break;

        case 'ArrowUp':
          take(e);
          setPanelIndex(0);
          setPanelOpen(true);
          break;

        case 'ArrowDown':
          // Cố ý KHÔNG chặn: đây là lối thoát để ô chọn đi xuống danh sách video bên dưới.
          break;

        case 'ArrowRight':
        case 'ArrowLeft': {
          take(e);
          if (holdRef.current?.key === e.key) return; // đang giữ rồi, bỏ qua sự kiện lặp
          clearHold();
          const dir: 1 | -1 = e.key === 'ArrowRight' ? 1 : -1;
          const hold = {
            key: e.key,
            dir,
            timer: null as ReturnType<typeof setTimeout> | null,
            interval: null as ReturnType<typeof setInterval> | null,
            seeking: false,
            target: 0,
            ticks: 0,
          };
          hold.timer = setTimeout(() => {
            // Giữ đủ lâu → chuyển sang chế độ TUA.
            hold.seeking = true;
            hold.target = ad.getCurrentTime();
            hold.interval = setInterval(() => {
              hold.ticks += 1;
              // Giữ càng lâu, mỗi nhịp tua càng xa: 5 → 15 → 30 giây.
              const step = hold.ticks > 12 ? 30 : hold.ticks > 5 ? 15 : 5;
              const duration = ad.getDuration();
              hold.target = Math.max(0, Math.min(duration || Infinity, hold.target + dir * step));
              ad.seekTo(hold.target, false);
              // Hiện mốc thời gian đang tua tới cho dễ hình dung.
              setSeekLabel(`${dir > 0 ? '⏩' : '⏪'} ${formatClock(hold.target)}`);
            }, SEEK_TICK_MS);
          }, HOLD_MS);
          holdRef.current = hold;
          break;
        }
        default:
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const h = holdRef.current;
      if (!h || h.key !== e.key) return;
      const { adapter: ad, onPrev: prev, onNext: next } = stateRef.current;
      const wasSeeking = h.seeking;
      const target = h.target;
      clearHold();

      if (wasSeeking) {
        // Thả phím → chốt mốc đã tua tới (lúc này mới thật sự tải video tại mốc đó).
        ad.seekTo(target, true);
        setSeekLabel(null);
        return;
      }
      // Bấm nhả nhanh → chuyển video.
      if (h.dir > 0) next?.();
      else prev?.();
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      clearHold();
    };
  }, [enabled, wrapRef, clearHold]);

  // Dọn sạch khi rời trang / đổi video.
  useEffect(() => () => clearHold(), [clearHold]);

  return { panelOpen, setPanelOpen, panelIndex, setPanelIndex, seekLabel };
}
