import { useCallback, useEffect, useRef } from 'react';

/**
 * useTvNavigation — điều hướng kiểu Remote TV (D-pad) bằng phím mũi tên + Enter + Esc.
 *
 * Cách dùng: gắn `containerRef` vào 1 thẻ bao ngoài (thường là <main>). Bên trong, mọi
 * phần tử muốn nhận điều hướng phải có `tabIndex={0}` và `data-region="<tên vùng>"`.
 * Các phần tử liền kề có cùng `data-region` được gom thành 1 "vùng" (section) tự động.
 *
 * `sectionCols` khai báo số cột của từng vùng — ví dụ lưới 3 thẻ/hàng thì truyền
 * `{ playlist: 3 }`. Vùng không khai báo mặc định nằm trên đúng 1 hàng ngang.
 *
 * QUY TẮC DI CHUYỂN (cố ý làm giống hệt app TV chuẩn):
 *  - Trái/Phải chỉ chạy TRONG CÙNG 1 HÀNG. Hết hàng là dừng, KHÔNG tự vòng xuống hàng
 *    dưới (muốn xuống hàng thì bấm mũi tên xuống — rõ ràng, không bị "trôi" ngoài ý muốn).
 *  - Lên/Xuống đi giữa các hàng, và giữa các khối nội dung (thanh trên cùng ↔ các hàng).
 *  - Menu bên trái là 1 cột riêng: chỉ vào được bằng phím TRÁI khi đang ở cột ngoài cùng,
 *    và bấm PHẢI để quay lại đúng ô vừa đứng. Lên/Xuống không bao giờ lạc vào menu.
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
  /** Bộ đếm thử lại của resetFocus (xem giải thích ở hàm đó). */
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const { onEscape, enabled = true } = options;

  const getFocusables = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    // Nếu đang có 1 lớp phủ "khoá màn hình" (màn hình Chưa đến giờ xem, bảng nhập PIN) thì
    // CHỈ những ô bên trong lớp phủ đó mới chọn được — phía sau bị khoá hoàn toàn. Lớp phủ
    // tự khai báo bằng thuộc tính data-nav-scope.
    const scope = containerRef.current.querySelector<HTMLElement>('[data-nav-scope]');
    const root: HTMLElement = scope ?? containerRef.current;
    return Array.from(root.querySelectorAll<HTMLElement>('[data-region]')).filter(
      // getClientRects().length > 0 = phần tử đang thật sự được vẽ ra màn hình.
      // (Trước đây dùng offsetParent !== null, nhưng cách đó trả về "không thấy" với các
      // phần tử position: fixed — mà khung video lúc TOÀN MÀN HÌNH chính là kiểu đó, nên
      // khung video bị loại khỏi danh sách và bấm OK không tạm dừng được.)
      (el) => el.getClientRects().length > 0
    );
  }, [containerRef]);

  /** Ô nội dung đầu tiên (bỏ qua menu trái và thanh trên cùng) — dùng làm điểm đứng mặc định. */
  const findFirstContent = useCallback((focusables: HTMLElement[]): number => {
    // Trang phát video: ưu tiên đứng ngay ở KHUNG VIDEO, để bấm OK là tạm dừng/phát tiếp.
    const playerIdx = focusables.findIndex((el) => el.getAttribute('data-region') === 'player');
    if (playerIdx >= 0) return playerIdx;
    return focusables.findIndex((el) => {
      const region = el.getAttribute('data-region');
      return region !== 'side' && region !== 'topbar';
    });
  }, []);

  /**
   * Cuộn màn hình sao cho ô đang chọn hiện ra TRỌN VẸN.
   *
   * Cố ý tự tính thay vì dùng thẳng scrollIntoView của trình duyệt: thanh trên cùng
   * (Cốm/Mina) luôn dính tại chỗ và che mất phần trên màn hình, nhưng trình duyệt không
   * biết điều đó — nó cuộn sao cho ô "vừa đủ lọt", thành ra phần đầu của ô nằm lọt thỏm
   * DƯỚI thanh kia, bị che mất. Đây chính là lỗi "kéo lên trên thì khối Tiếp tục xem bị
   * che một phần". Ở đây ta tự chừa đúng chiều cao thật của thanh đó rồi mới cuộn.
   */
  const bringIntoView = useCallback((el: HTMLElement) => {
    // 1) Cuộn NGANG bên trong hàng thẻ (khối nào có thanh cuộn ngang thì cuộn khối đó).
    let parent: HTMLElement | null = el.parentElement;
    while (parent && parent !== document.body) {
      const overflowX = getComputedStyle(parent).overflowX;
      if ((overflowX === 'auto' || overflowX === 'scroll') && parent.scrollWidth > parent.clientWidth) {
        const er = el.getBoundingClientRect();
        const pr = parent.getBoundingClientRect();
        const pad = 20;
        if (er.left < pr.left + pad) parent.scrollLeft += er.left - pr.left - pad;
        else if (er.right > pr.right - pad) parent.scrollLeft += er.right - pr.right + pad;
        break;
      }
      parent = parent.parentElement;
    }

    // 2) Cuộn DỌC cả trang, chừa sẵn chỗ cho thanh trên cùng đang dính.
    const bar = document.querySelector<HTMLElement>('.topbar');
    const barHeight = bar ? bar.getBoundingClientRect().height : 0;
    const topLimit = barHeight + 24;
    const bottomLimit = window.innerHeight - 32;
    const r = el.getBoundingClientRect();
    if (r.top < topLimit) {
      window.scrollBy(0, r.top - topLimit);
    } else if (r.bottom > bottomLimit) {
      // Math.min: với ô cao hơn cả màn hình thì ưu tiên giữ phần ĐẦU của ô, đừng cuộn quá
      // tay làm phần đầu chui lên trên khuất mất.
      window.scrollBy(0, Math.min(r.bottom - bottomLimit, r.top - topLimit));
    }
  }, []);

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
        bringIntoView(el);
      }
    },
    [bringIntoView]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName)) return; // gõ liệu bình thường

      // Đang xem video TOÀN MÀN HÌNH: khoá hẳn việc di chuyển ô chọn bằng phím mũi tên.
      // Lúc này bé chẳng nhìn thấy ô nào cả (video che kín màn hình), để mũi tên vẫn chạy
      // ngầm thì bấm OK sau đó sẽ rơi trúng 1 ô vô hình nào đó — đúng kiểu lỗi "đang xem
      // tự nhiên nhảy về trang trước". Chỉ còn OK (tạm dừng/phát tiếp) là có tác dụng;
      // muốn thoát thì bấm nút Back của điều khiển.
      if (document.fullscreenElement && e.key !== 'Enter') return;

      const focusables = getFocusables();
      if (focusables.length === 0) return;
      const sections = buildSections(focusables);
      const idx = focusIndexRef.current;
      const sec = sections.find((s) => idx >= s.start && idx < s.start + s.count);
      if (!sec) {
        // Mất dấu ô đang chọn (thường do vừa đổi trang) → đặt lại vào NỘI DUNG, cố ý không
        // rơi về ô số 0 vì ô số 0 là mục đầu của menu bên trái.
        const first = findFirstContent(focusables);
        setFocus(first >= 0 ? first : 0, focusables);
        return;
      }
      const local = idx - sec.start;
      const secIdx = sections.indexOf(sec);
      const colInRow = local % sec.cols;

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
            const fallback = findFirstContent(focusables);
            setFocus(
              back !== null && back < focusables.length ? back : fallback >= 0 ? fallback : 0,
              focusables
            );
          } else if (colInRow + 1 < sec.cols && local + 1 < sec.count) {
            // Chỉ đi tiếp khi vẫn còn ô nữa TRONG CÙNG HÀNG. Hết hàng thì đứng yên —
            // KHÔNG tự nhảy xuống hàng dưới (muốn xuống hàng phải bấm mũi tên xuống).
            setFocus(idx + 1, focusables);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (inSide) break; // đang ở menu rồi, bấm trái nữa thì đứng yên
          if (colInRow > 0) {
            setFocus(idx - 1, focusables);
          } else if (sideSecIdx >= 0) {
            // Đang ở sát mép trái của nội dung → mở menu bên trái.
            returnIdxRef.current = idx;
            const side = sections[sideSecIdx];
            setFocus(side.start + Math.min(sideFocusRef.current, side.count - 1), focusables);
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
            if (next) setFocus(next.start + Math.min(colInRow, next.count - 1), focusables);
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
            if (prev) setFocus(prev.start + Math.min(colInRow, prev.count - 1), focusables);
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
  }, [enabled, getFocusables, buildSections, setFocus, onEscape, findFirstContent]);

  /**
   * Đặt ô đang chọn về NỘI DUNG chính (không phải menu trái / thanh trên cùng). Gọi lại
   * mỗi khi đổi trang, hoặc khi mở/đóng lớp phủ khoá màn hình.
   *
   * Có cơ chế THỬ LẠI: lúc vừa đổi trang, dữ liệu (playlist, video...) thường chưa tải
   * xong nên chưa có ô nội dung nào để chọn. Nếu lúc đó cứ chọn đại ô đầu tiên thì sẽ rơi
   * vào mục đầu của menu bên trái — đúng hiện tượng "bấm Back 2 lần là nhảy lên menu
   * trái". Nên khi chưa có nội dung, hàm này KHÔNG chọn gì cả mà hẹn thử lại một lát sau,
   * tối đa khoảng 2 giây.
   */
  const resetFocus = useCallback(() => {
    clearTimeout(resetTimerRef.current);
    returnIdxRef.current = null;
    let attempts = 0;

    const attempt = () => {
      const focusables = getFocusables();
      const first = findFirstContent(focusables);
      if (first >= 0) {
        setFocus(first, focusables);
        return;
      }
      attempts += 1;
      if (attempts <= 16) resetTimerRef.current = setTimeout(attempt, 125);
    };

    attempt();
  }, [getFocusables, findFirstContent, setFocus]);

  useEffect(() => () => clearTimeout(resetTimerRef.current), []);

  return { resetFocus };
}
