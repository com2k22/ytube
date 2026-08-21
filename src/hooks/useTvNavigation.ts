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

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          if (local + 1 < sec.count) setFocus(idx + 1, focusables);
          else if (sections[secIdx + 1]) setFocus(sections[secIdx + 1].start, focusables);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (local > 0) setFocus(idx - 1, focusables);
          else if (sections[secIdx - 1]) {
            const prev = sections[secIdx - 1];
            setFocus(prev.start + prev.count - 1, focusables);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (local + sec.cols < sec.count) setFocus(idx + sec.cols, focusables);
          else if (sections[secIdx + 1]) {
            const next = sections[secIdx + 1];
            setFocus(next.start + Math.min(local % sec.cols, next.count - 1), focusables);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (local - sec.cols >= 0) setFocus(idx - sec.cols, focusables);
          else if (sections[secIdx - 1]) {
            const prev = sections[secIdx - 1];
            setFocus(prev.start + Math.min(local % sec.cols, prev.count - 1), focusables);
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

  /** Gọi lại hàm này sau khi danh sách nội dung thay đổi (ví dụ tải xong video) để focus về đầu. */
  const resetFocus = useCallback(() => {
    const focusables = getFocusables();
    setFocus(0, focusables);
  }, [getFocusables, setFocus]);

  return { resetFocus };
}
