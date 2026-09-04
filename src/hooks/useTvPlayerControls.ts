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

/** Số video/hàng trong danh sách playlist dạng LƯỚI ở giai đoạn 2 (xem PlayerPlaylistDrawer). */
const GRID_COLS = 3;

interface Options {
  /** Thẻ bọc trình phát — dùng để biết khi nào trình phát đang "cầm lái" bàn phím. */
  wrapRef: React.RefObject<HTMLElement>;
  adapter: PlayerAdapter;
  actions: PanelAction[];
  enabled?: boolean;
  /** Số video trong danh sách "bấm Xuống để xem" (0/undefined = tắt tính năng, phím Xuống
      nhường lại cho trang như trước — vd khi không có playlist). */
  playlistCount?: number;
  /** Bấm OK chọn 1 video trong danh sách đó (chỉ số trong mảng đã truyền cho playlistCount). */
  onSelectPlaylistItem?: (index: number) => void;
}

/** Chờ bao lâu thì coi là ĐANG GIỮ phím (dưới mức này là tua nhẹ 1 nấc). */
const HOLD_MS = 450;
/** Nhịp tua khi đang giữ phím. */
const SEEK_TICK_MS = 220;
/** Icon Play/Pause to giữa màn hình hiện bao lâu rồi tự ẩn (mili giây). */
const CENTER_ICON_MS = 700;

/**
 * useTvPlayerControls — bộ điều khiển trình phát bằng ĐIỀU KHIỂN TV, giống app YouTube
 * Kids trên TV.
 *
 * Quy ước phím (chỉ có tác dụng khi ô chọn đang nằm ở khung video, hoặc đang xem toàn
 * màn hình — lúc khác thì nhường phím lại cho việc di chuyển trong trang):
 *   • OK             → tạm dừng video + hiện GIAI ĐOẠN 1 của danh sách playlist (xem dưới);
 *                       bấm OK lần nữa (lúc đang ở giai đoạn 1) → phát tiếp, ẩn danh sách.
 *   • Lên             → mở bảng điều khiển (chuyển video, phụ đề, cài đặt...)
 *   • Xuống           → mở/đi sâu thêm danh sách playlist, qua ĐÚNG 2 GIAI ĐOẠN:
 *                         1) "lấp ló" — hiện hờ 3 video đầu, chỉ để BÁO có danh sách bên
 *                            dưới, chưa chọn được ô nào.
 *                         2) bấm Xuống thêm 1 lần nữa → hiện ĐẦY ĐỦ, dạng LƯỚI 3 video/hàng,
 *                            di chuyển chọn bằng Lên/Xuống/Trái/Phải, bấm OK để xem video đó.
 *                       Không có playlist → nhường phím Xuống cho trang như trước.
 *   • Trái/Phải GIỮ  → tua lùi / tua tới, giữ càng lâu tua càng nhanh (chỉ khi KHÔNG đang ở
 *                       giai đoạn 2 — lúc đó Trái/Phải dùng để dò ngang trong lưới).
 *
 * ĐÃ BỎ "bấm nhả Trái/Phải để chuyển video trước/sau": muốn chuyển video thì bắt buộc phải
 * qua nút "⏮/⏭" trong bảng điều khiển (Lên) hoặc chọn thẳng trong lưới playlist (Xuống x2).
 *
 * Vì sao nghe phím ở "pha bắt" (capture): bộ điều hướng chung của app (useTvNavigation)
 * cũng nghe phím trên cùng 1 chỗ và được gắn TRƯỚC. Nghe ở pha bắt giúp trình phát được
 * quyền xử lý trước, rồi chặn luôn không cho sự kiện lan xuống — nếu không, bấm mũi tên
 * vừa tua video vừa làm ô chọn chạy lung tung ngoài trang.
 */
export function useTvPlayerControls({
  wrapRef,
  adapter,
  actions,
  enabled = true,
  playlistCount = 0,
  onSelectPlaylistItem,
}: Options) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelIndex, setPanelIndex] = useState(0);
  /** 0 = đóng hẳn. 1 = "lấp ló" (giai đoạn 1, chỉ báo có danh sách, chưa chọn ô nào).
      2 = lưới đầy đủ (giai đoạn 2, chọn được từng video bằng Lên/Xuống/Trái/Phải). */
  const [playlistStage, setPlaylistStage] = useState<0 | 1 | 2>(0);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  /** Nhãn hiện lên giữa màn hình khi đang tua, vd "⏩ 3:20". null = không hiện. */
  const [seekLabel, setSeekLabel] = useState<string | null>(null);
  /** Icon ▶/⏸ to giữa màn hình, chớp lên rồi tự ẩn mỗi khi tạm dừng/phát tiếp bằng OK —
      xem CENTER_ICON_MS. null = không hiện. */
  const [centerIcon, setCenterIcon] = useState<'play' | 'pause' | null>(null);
  const centerIconTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const flashCenterIcon = useCallback((icon: 'play' | 'pause') => {
    clearTimeout(centerIconTimerRef.current);
    setCenterIcon(icon);
    centerIconTimerRef.current = setTimeout(() => setCenterIcon(null), CENTER_ICON_MS);
  }, []);

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
  const stateRef = useRef({
    adapter,
    actions,
    panelOpen,
    panelIndex,
    playlistStage,
    playlistIndex,
    playlistCount,
    onSelectPlaylistItem,
  });
  stateRef.current = {
    adapter,
    actions,
    panelOpen,
    panelIndex,
    playlistStage,
    playlistIndex,
    playlistCount,
    onSelectPlaylistItem,
  };

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
      const {
        adapter: ad,
        actions: acts,
        panelOpen: open,
        panelIndex: idx,
        playlistStage: stage,
        playlistIndex: plIdx,
        playlistCount: plCount,
        onSelectPlaylistItem: selectPlaylistItem,
      } = stateRef.current;

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
        } else if (e.key === 'ArrowUp' || e.key === 'Escape') {
          take(e);
          setPanelOpen(false);
        } else if (e.key === 'ArrowDown') {
          // Đang mở bảng điều khiển mà bấm Xuống nữa → chuyển thẳng sang giai đoạn 1 của
          // danh sách playlist (giống YouTube Kids: Lên/Xuống là 2 khu khác nhau).
          take(e);
          setPanelOpen(false);
          if (plCount > 0) setPlaylistStage(1);
        }
        return;
      }

      // --- Khi danh sách playlist đang mở, GIAI ĐOẠN 1 ("lấp ló" — chưa chọn được ô nào) ---
      if (stage === 1) {
        if (e.key === 'ArrowDown') {
          take(e);
          setPlaylistIndex(0);
          setPlaylistStage(2); // đi sâu thêm 1 nấc → hiện đầy đủ dạng lưới.
        } else if (e.key === 'ArrowUp' || e.key === 'Escape') {
          take(e);
          setPlaylistStage(0);
        } else if (e.key === 'Enter') {
          // Đang tạm dừng (chính là lý do giai đoạn 1 mở ra) → OK lần nữa = phát tiếp, ẩn
          // danh sách — xem chú thích ở nhánh "Enter" bên dưới, cùng 1 quy tắc.
          take(e);
          ad.play();
          flashCenterIcon('play');
          setPlaylistStage(0);
        }
        return;
      }

      // --- Khi danh sách playlist đang mở, GIAI ĐOẠN 2 (lưới đầy đủ, 3 video/hàng) ---
      if (stage === 2) {
        const col = plIdx % GRID_COLS;
        if (e.key === 'ArrowRight') {
          take(e);
          if (col < GRID_COLS - 1 && plIdx + 1 < plCount) setPlaylistIndex(plIdx + 1);
        } else if (e.key === 'ArrowLeft') {
          take(e);
          if (col > 0) setPlaylistIndex(plIdx - 1);
        } else if (e.key === 'ArrowDown') {
          take(e);
          if (plIdx + GRID_COLS < plCount) setPlaylistIndex(plIdx + GRID_COLS);
        } else if (e.key === 'ArrowUp') {
          take(e);
          if (plIdx - GRID_COLS >= 0) setPlaylistIndex(plIdx - GRID_COLS);
          else setPlaylistStage(1); // đã ở hàng đầu lưới → lùi về giai đoạn 1 "lấp ló".
        } else if (e.key === 'Enter') {
          take(e);
          selectPlaylistItem?.(plIdx);
          setPlaylistStage(0);
        } else if (e.key === 'Escape') {
          take(e);
          setPlaylistStage(0);
        }
        return;
      }

      // --- Khi cả bảng điều khiển lẫn danh sách playlist đều đóng ---
      switch (e.key) {
        case 'Enter':
          take(e);
          // Giống YouTube Kids trên TV: bấm OK khi đang phát → TẠM DỪNG, đồng thời hiện
          // luôn giai đoạn 1 của danh sách playlist (bé dừng lại thường là để xem có gì
          // khác không). Bấm OK lần nữa (xử lý ở nhánh "stage === 1" phía trên) mới phát
          // tiếp và ẩn danh sách đi.
          if (ad.isPaused()) {
            ad.play();
            flashCenterIcon('play');
          } else {
            ad.pause();
            flashCenterIcon('pause');
            if (plCount > 0) setPlaylistStage(1);
          }
          break;

        case 'ArrowUp':
          take(e);
          setPanelIndex(0);
          setPanelOpen(true);
          break;

        case 'ArrowDown':
          if (plCount > 0) {
            take(e);
            setPlaylistStage(1);
          }
          // Không có playlist (vd video đơn lẻ) → cố ý KHÔNG chặn: nhường phím để ô chọn đi
          // xuống nội dung bên dưới trang, như trước.
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
            // Giữ đủ lâu → chuyển sang chế độ TUA. Bấm nhả nhanh (không giữ đủ lâu) giờ
            // KHÔNG còn tác dụng gì nữa — trước đây bấm nhả là chuyển video trước/sau, nay
            // việc đó chỉ làm được qua nút trong bảng điều khiển hoặc lưới playlist.
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
      const { adapter: ad } = stateRef.current;
      const wasSeeking = h.seeking;
      const target = h.target;
      clearHold();

      if (wasSeeking) {
        // Thả phím → chốt mốc đã tua tới (lúc này mới thật sự tải video tại mốc đó).
        ad.seekTo(target, true);
        setSeekLabel(null);
      }
      // Bấm nhả nhanh (chưa kịp giữ đủ lâu để tua): cố ý không làm gì — đã bỏ hẳn việc
      // chuyển video trước/sau bằng Trái/Phải (xem ghi chú ở đầu file).
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      clearHold();
    };
  }, [enabled, wrapRef, clearHold, flashCenterIcon]);

  // Dọn sạch khi rời trang / đổi video.
  useEffect(
    () => () => {
      clearHold();
      clearTimeout(centerIconTimerRef.current);
    },
    [clearHold]
  );

  return {
    panelOpen,
    setPanelOpen,
    panelIndex,
    setPanelIndex,
    seekLabel,
    playlistStage,
    setPlaylistStage,
    playlistIndex,
    setPlaylistIndex,
    centerIcon,
  };
}
