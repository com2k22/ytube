import { useCallback, useEffect, useRef } from 'react';

/**
 * useTvNavigation — điều hướng kiểu Remote TV (D-pad) bằng phím mũi tên + Enter + Esc.
 *
 * Cách dùng: gắn `containerRef` vào 1 thẻ bao ngoài (thường là <main>). Bên trong, mọi
 * phần tử muốn nhận điều hướng phải có `tabIndex={0}` và `data-region="<tên vùng>"`.
 * Các phần tử liền kề có cùng `data-region` được gom thành 1 "vùng" (section) tự động.
 *
 * `sectionCols` khai báo số cột/hàng của từng vùng — ví dụ lưới video 3 khung/hàng thì
 * truyền `{ playlist: 3, video: 3 }`. Vùng không khai báo mặc định là 1 hàng ngang
 * (toàn bộ phần tử cùng 1 hàng, dùng cho danh sách kênh trượt ngang).
 *
 * `onEscape` (tuỳ chọn) được gọi khi bấm Esc — dùng để quay lại trang trước.
 */
export function useTvNavigation(
  containerRef: React.RefObject<HTMLElement>,
  sectionCols: Record<string, number> = {},
  options: { onEscape?: () => void; enabled?: boolean } = {}
) {
  const focusIndexRef = useRef(0);
  /** Ô nội dung đang xem dở trước khi nhảy sang menu trái — để bấm phải là quay lại đúng chỗ. */
  const returnIdxRef = useRef<number | null>(null);
  /** Mục menu trái đã chọn lần gần nhất — để lần sau mở menu vẫn đứng đúng mục đó. */
  const sideFocusRef = useRef(0);
  const { onEscape, enabled = true } = options;

  const getFocusables = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-region]')).filter(
      (el) => el.offsetParent !== null // bỏ qua phần tử đang ẩn (display:none)
    );
  }, [containerRef]);

  interface Section {
    region: string;
    start: number;
    count: number;
    cols: number;
  }

  const buildSections = useCallback(
    (focusables: HTMLElement[]): Section[] => {
      const sections: Section[] = [];
      let i = 0;
      while (i < focusables.length) {
        const region = focusables[i].getAttribute('data-region') ?? '';
        let j = i;
        while (j < focusables.length && focusables[j].getAttribute('data-region') === region) j++;
        const count = j - i;
        // Cho phép từng vùng tự khai báo số cột riêng qua thuộc tính `data-cols` trên phần
        // tử đầu tiên (dùng cho lưới nhiều hàng có số cột tính động, ví dụ shelf 2 hàng ở
        // Trang chủ) — nếu không có thì dùng cấu hình tĩnh `sectionCols`, cuối cùng mặc định
        // cả vùng nằm trên 1 hàng ngang (cols = count).
        const dataCols = Number(focusables[i].dataset.cols);
        const cols = dataCols > 0 ? dataCols : sectionCols[region] || count;
        sections.push({ region, start: i, count, cols });
        i = j;
      }
      return sections;
    },
    [sectionCols]
  );

  const setFocus = useCallback(
    (index: number, focusables: HTMLElement[]) => {
      focusables.forEach((el) => el.classList.remove('tv-focused'));
      const clamped = Math.max(0, Math.min(index, focusables.length - 1));
      focusIndexRef.current = clamped;
      const el = focusables[clamped];
      if (el) {
        el.classList.add('tv-focused');
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName)) return; // gõ liệu bình thường

      const focusables = getFocusables();
      if (focusables.length === 0) return;
      const sections = buildSections(focusables);
      const idx = focusIndexRef.current;
      const sec = sections.find((s) => idx >= s.start && idx < s.start + s.count);
      if (!sec) {
        setFocus(0, focusables);
        return;
      }
      const local = idx - sec.start;
      const secIdx = sections.indexOf(sec);

      // Menu bên trái được coi là 1 "cột riêng" nằm ngoài luồng lên/xuống của nội dung,
      // đúng như cách app YouTube trên TV hoạt động:
      //   - Bấm TRÁI khi đang ở cột ngoài cùng bên trái của nội dung → nhảy sang menu.
      //   - Bấm PHẢI khi đang ở menu → quay lại ĐÚNG ô vừa đứng trước đó.
      //   - Bấm LÊN/XUỐNG ở nội dung → chỉ đi giữa thanh trên cùng và các hàng nội dung,
      //     KHÔNG bao giờ lạc vào menu (trước đây hay bị, rất khó chịu).
      const sideSecIdx = sections.findIndex((s) => s.region === 'side');
      const inSide = sec.region === 'side';
      /** Vùng liền trước/sau, nhưng bỏ qua menu trái. */
      const stepSection = (dir: 1 | -1) => {
        let k = secIdx + dir;
        while (k >= 0 && k < sections.length && sections[k].region === 'side') k += dir;
        return k >= 0 && k < sections.length ? sections[k] : undefined;
      };

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          if (inSide) {
            // Rời menu, quay về đúng ô đang xem dở trước đó (nếu ô đó vẫn còn tồn tại).
            sideFocusRef.current = local;
            const back = returnIdxRef.current;
            const fallback = sections.find((s) => s.region !== 'side');
            setFocus(back !== null && back < focusables.length ? back : (fallback?.start ?? 0), focusables);
          } else if (sec.cols > 1 && local + 1 < sec.count) {
            setFocus(idx + 1, focusables);
          } else {
            const next = stepSection(1);
            if (next) setFocus(next.start, focusables);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (inSide) break; // đang ở menu rồi, bấm trái nữa thì đứng yên
          if (sec.cols > 1 && local % sec.cols > 0) {
            setFocus(idx - 1, focusables);
          } else if (sideSecIdx >= 0) {
            // Đang ở sát mép trái của nội dung → mở menu bên trái.
            returnIdxRef.current = idx;
            const side = sections[sideSecIdx];
            setFocus(side.start + Math.min(sideFocusRef.current, side.count - 1), focusables);
          } else {
            const prev = stepSection(-1);
            if (prev) setFocus(prev.start + prev.count - 1, focusables);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (inSide) {
            if (local + 1 < sec.count) setFocus(idx + 1, focusables);
          } else if (local + sec.cols < sec.count) {
            setFocus(idx + sec.cols, focusables);
          } else {
            const next = stepSection(1);
            if (next) setFocus(next.start + Math.min(local % sec.cols, next.count - 1), focusables);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (inSide) {
            if (local > 0) setFocus(idx - 1, focusables);
          } else if (local - sec.cols >= 0) {
            setFocus(idx - sec.cols, focusables);
          } else {
            const prev = stepSection(-1);
            if (prev) setFocus(prev.start + Math.min(local % sec.cols, prev.count - 1), focusables);
          }
          break;
        case 'Enter':
          e.preventDefault();
          focusables[idx]?.click();
          break;
        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, getFocusables, buildSections, setFocus, onEscape]);

  /**
   * Gọi lại hàm này sau khi danh sách nội dung thay đổi (ví dụ tải xong video) để đưa ô
   * đang chọn về đầu. Cố ý bỏ qua menu trái và thanh trên cùng, đặt luôn vào NỘI DUNG
   * đầu tiên (thẻ video/playlist đầu) — giống app YouTube trên TV: vừa mở lên là con trỏ
   * đã nằm sẵn ở video đầu tiên, bấm Enter là xem được ngay.
   */
  const resetFocus = useCallback(() => {
    const focusables = getFocusables();
    const firstContent = focusables.findIndex((el) => {
      const region = el.getAttribute('data-region');
      return region !== 'side' && region !== 'topbar';
    });
    returnIdxRef.current = null;
    setFocus(firstContent >= 0 ? firstContent : 0, focusables);
  }, [getFocusables, setFocus]);

  return { resetFocus };
}
