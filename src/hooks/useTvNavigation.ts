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
  /** Phần tử đang được chọn thật sự — dùng để phát hiện danh sách ô vừa thay đổi. */
  const focusedElRef = useRef<HTMLElement | null>(null);
  const { onEscape, enabled = true } = options;

  const getFocusables = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    // Nếu đang có 1 lớp phủ "khoá màn hình" (màn hình Chưa đến giờ xem, bảng nhập PIN, danh
    // sách chọn hồ sơ xổ xuống) thì CHỈ những ô bên trong lớp phủ đó mới chọn được — phía
    // sau bị khoá hoàn toàn. Lớp phủ tự khai báo bằng thuộc tính data-nav-scope.
    //
    // Lấy cái CUỐI CÙNG trong danh sách: nếu lỡ có 2 lớp cùng lúc (vd danh sách hồ sơ đang
    // xổ thì màn hình Chưa đến giờ xem bật lên), lớp nằm sau trong mã nguồn là lớp quan
    // trọng hơn (các lớp khoá của Layout luôn đứng cuối) nên phải thắng.
    const scopes = containerRef.current.querySelectorAll<HTMLElement>('[data-nav-scope]');
    const scope = scopes.length > 0 ? scopes[scopes.length - 1] : null;
    const root: HTMLElement = scope ?? containerRef.current;
    return Array.from(root.querySelectorAll<HTMLElement>('[data-region]')).filter(
      // getClientRects().length > 0 = phần tử đang thật sự được vẽ ra màn hình.
      // (Trước đây dùng offsetParent !== null, nhưng cách đó trả về "không thấy" với các
      // phần tử position: fixed — mà khung video lúc TOÀN MÀN HÌNH chính là kiểu đó, nên
      // khung video bị loại khỏi danh sách và bấm OK không tạm dừng được.)
      (el) => el.getClientRects().length > 0
    );
  }, [containerRef]);

  /**
   * Ô mặc định khi mới vào 1 trang. Thứ tự ưu tiên:
   *  1. Khung video (trang phát) — để bấm OK là tạm dừng/phát tiếp ngay.
   *  2. Nội dung thật đầu tiên: video/playlist/thẻ đầu tiên.
   *  3. Cùng lắm mới tới nút "← Quay lại".
   *
   * Cố ý BỎ QUA nút Quay lại ở bước 2: nút đó luôn đứng đầu trang playlist/kênh nên trước
   * đây mở playlist ra là ô chọn nằm ngay trên nút Quay lại — bấm OK theo phản xạ là thoát
   * ra luôn, rất khó chịu. Giờ ô chọn rơi thẳng vào video/playlist đầu tiên.
   */
  const regionOf = (el: HTMLElement) => el.getAttribute('data-region') ?? '';

  /** Ô NỘI DUNG THẬT đầu tiên (video/playlist/khung phát...). -1 nếu trang chưa có gì. */
  const findRealContent = useCallback((focusables: HTMLElement[]): number => {
    const playerIdx = focusables.findIndex((el) => regionOf(el) === 'player');
    if (playerIdx >= 0) return playerIdx;
    const skip = ['side', 'topbar', 'detailback'];
    return focusables.findIndex((el) => !skip.includes(regionOf(el)));
  }, []);

  /** Nút "← Quay lại" — chỗ đậu tạm khi trang chưa có nội dung nào. -1 nếu không có. */
  const findFallback = useCallback(
    (focusables: HTMLElement[]): number => focusables.findIndex((el) => regionOf(el) === 'detailback'),
    []
  );

  const findFirstContent = useCallback(
    (focusables: HTMLElement[]): number => {
      const real = findRealContent(focusables);
      return real >= 0 ? real : findFallback(focusables);
    },
    [findRealContent, findFallback]
  );

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
    //
    // Trước đây dò khối cha bằng cách LEO TỪNG CẤP + gọi getComputedStyle ở MỖI cấp để hỏi
    // "overflow-x của ông này có phải auto/scroll không" — getComputedStyle ép trình duyệt
    // tính lại kiểu dáng ngay lúc đó (khá tốn), mà hàm này chạy lại mỗi lần bấm phím, DOM
    // càng sâu thì càng nhiều lần gọi. Chỗ thật sự cuộn ngang trong app chỉ có đúng 1 kiểu
    // (class .shelf, xem theme.css), nên dùng closest('.shelf') là đủ và rẻ hơn hẳn — không
    // ép tính lại kiểu dáng, chỉ so khớp class thôi.
    const shelfParent = el.closest<HTMLElement>('.shelf');
    if (shelfParent && shelfParent.scrollWidth > shelfParent.clientWidth) {
      const er = el.getBoundingClientRect();
      const pr = shelfParent.getBoundingClientRect();
      const pad = 20;
      if (er.left < pr.left + pad) shelfParent.scrollBy({ left: er.left - pr.left - pad, behavior: 'smooth' });
      else if (er.right > pr.right - pad) shelfParent.scrollBy({ left: er.right - pr.right + pad, behavior: 'smooth' });
    }

    // 2) Cuộn DỌC cả trang, chừa sẵn chỗ cho thanh trên cùng đang dính.
    const bar = document.querySelector<HTMLElement>('.topbar');
    const barHeight = bar ? bar.getBoundingClientRect().height : 0;
    const topLimit = barHeight + 24;
    const bottomLimit = window.innerHeight - 32;
    const r = el.getBoundingClientRect();

    // Lỗi "kéo lên bị mất icon+tên khối": ô thẻ (card) đang chọn nằm NGAY DƯỚI dòng tiêu đề
    // icon+tên của khối (vd "Tiếp tục xem"), nhưng dòng tiêu đề đó KHÔNG PHẢI là ô điều
    // hướng — hàm này trước đây chỉ tính sao cho THẺ hiện đủ, không biết gì tới dòng tiêu đề
    // nằm phía trên thẻ, nên cuộn vừa đủ lọt thẻ là dòng tiêu đề bị chui lên trên, khuất sau
    // thanh trên cùng đang dính. Cách sửa: nếu thẻ đang chọn nằm trong 1 ".section-block"
    // (bọc chung tiêu đề + hàng thẻ, xem HomePage.tsx), lấy luôn mép TRÊN của CẢ KHỐI đó
    // (gồm tiêu đề) làm mốc để so/cuộn, thay vì chỉ mép trên của riêng cái thẻ.
    const block = el.closest<HTMLElement>('.section-block');
    const topRef = block ? block.getBoundingClientRect().top : r.top;

    if (topRef < topLimit) {
      // Lỗi "kéo lên hết thì bị kẹt": ô đang chọn nằm ở HÀNG ĐẦU TIÊN của trang (vd "Tiếp
      // tục xem"), nhưng phía trên nó còn dòng chào "Xin chào, ..." không phải là ô điều
      // hướng được nên hàm này không biết mà chừa chỗ. Cuộn tối thiểu (vừa đủ lọt ô) khi đó
      // vẫn để dòng chào bị khuất phía trên thanh dính — trông như "kẹt", phải vòng qua menu
      // trái mới thấy hết.
      //
      // Cách sửa: tính xem cuộn tối thiểu xong thì trang còn cách đỉnh (scrollY) bao xa. Nếu
      // khoảng đó đã nhỏ hơn topLimit — nghĩa là chẳng còn gì đáng kể phía trên để che nữa —
      // thì cuộn thẳng về ĐỈNH TRANG (scrollY = 0) luôn, lộ hết phần đầu trang.
      const targetScrollY = window.scrollY + (topRef - topLimit);
      if (targetScrollY < topLimit) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Khai rõ behavior:'smooth' thay vì để trống — trước đây dựa hẳn vào CSS
        // scroll-behavior (dòng ~30) để trượt mượt, nhưng khai rõ ở đây chắc ăn hơn trên
        // TV (một số bản trình duyệt TV áp dụng CSS đó không ổn định cho scrollBy/scrollTo
        // gọi bằng JS) — cùng 1 hiệu ứng, chỉ chắc chắn hơn.
        window.scrollBy({ top: topRef - topLimit, behavior: 'smooth' });
      }
    } else if (r.bottom > bottomLimit) {
      // Math.min: với ô cao hơn cả màn hình thì ưu tiên giữ phần ĐẦU của khối (kể cả tiêu
      // đề), đừng cuộn quá tay làm phần đầu chui lên trên khuất mất.
      window.scrollBy({ top: Math.min(r.bottom - bottomLimit, topRef - topLimit), behavior: 'smooth' });
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
      // Trước đây quét (forEach) BỎ class 'tv-focused' qua TOÀN BỘ ô trên trang mỗi lần
      // bấm phím — có khi vài chục ô (mọi thẻ ở mọi hàng đang hiện). Trình duyệt phải tính
      // lại kiểu dáng cho từng ô đó, cộng dồn với việc đọc lại vị trí/cuộn trang ngay sau
      // (bringIntoView) gây giật hẳn lên khi bấm liên tục — nhất là từ khi Phải/Xuống tự
      // nhảy hàng nên phải cuộn trang thường xuyên hơn trước. Giờ chỉ bỏ class ở ĐÚNG 1 ô
      // vừa rời đi, việc còn lại (thêm class ở ô mới) vốn đã chỉ đụng 1 ô — mượt hơn hẳn.
      const clamped = Math.max(0, Math.min(index, focusables.length - 1));
      focusIndexRef.current = clamped;
      const el = focusables[clamped];
      const prevEl = focusedElRef.current;
      if (prevEl && prevEl !== el) prevEl.classList.remove('tv-focused');
      focusedElRef.current = el ?? null;
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
      // --- Đang đứng trong 1 ô NHẬP LIỆU (khu Bố mẹ có rất nhiều ô như vậy) ---
      //
      // Trước đây gặp ô nhập là nhả hết phím cho ô đó xử lý, thành ra vào rồi KHÔNG CÓ
      // ĐƯỜNG RA: bấm mũi tên mãi vẫn quanh quẩn trong ô, phải có chuột mới thoát được.
      //
      // Giờ mỗi ô có đúng 1 "cửa thoát", chọn theo trục di chuyển của chỗ ô đó đứng:
      //   • Ô giờ (type="time") nằm trong hàng ngang "giờ bắt đầu · giờ kết thúc · nút xoá"
      //     → thoát bằng TRÁI/PHẢI. Lên/xuống vẫn để tăng giảm giờ như bình thường.
      //   • Mọi ô còn lại đều xếp DỌC → thoát bằng LÊN/XUỐNG.
      //
      // Nói thẳng cái mất: với ô số và ô chọn, lên/xuống vốn là cách tăng/giảm hoặc đổi
      // lựa chọn — nay bị dùng làm cửa thoát. Bù lại: ô số thì bấm thẳng phím số trên điều
      // khiển, ô chọn thì bấm OK để mở danh sách rồi chọn trong đó. Nếu không đổi thì tệ
      // hơn nhiều: vào ô là kẹt luôn, không có chuột thì không ra được.
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName ?? '';
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) {
        const type = tag === 'INPUT' ? (active as HTMLInputElement).type : '';
        const exitKeys = type === 'time' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
        if (!exitKeys.includes(e.key) && e.key !== 'Escape') return; // gõ liệu bình thường
        // Bỏ tiêu điểm khỏi ô TRƯỚC, rồi để phần bên dưới di chuyển ô chọn như thường —
        // nhờ vậy phím vừa bấm không còn tác dụng lên ô nhập nữa (vd không làm ô số tự
        // tăng/giảm giá trị khi mình chỉ muốn đi sang ô khác).
        active?.blur();
      }

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

      // Danh sách ô vừa đổi (mở/đóng danh sách chọn hồ sơ, tải xong nội dung, đổi trang...)
      // → số thứ tự cũ không còn đúng nữa. Phải neo lại rồi mới xử lý phím tiếp theo, KHÔNG
      // được dùng số cũ: dùng bừa sẽ bấm nhầm sang ô hoàn toàn khác.
      const stale = focusables[idx] !== focusedElRef.current;
      const sec = stale ? undefined : sections.find((s) => idx >= s.start && idx < s.start + s.count);
      if (!sec) {
        // Neo lại vào NỘI DUNG, cố ý không rơi về ô số 0 vì ô số 0 là mục đầu của menu trái.
        const first = findFirstContent(focusables);
        setFocus(first >= 0 ? first : 0, focusables);
        return;
      }
      const local = idx - sec.start;
      const secIdx = sections.indexOf(sec);
      const colInRow = local % sec.cols;

      const sideSecIdx = sections.findIndex((s) => s.region === 'side');
      const inSide = sec.region === 'side';
      /**
       * Khi nhảy sang khối khác thì đứng ở CỘT nào.
       *
       * Khối 1 cột (danh sách xếp dọc: ô nhập, nút bấm...) thì luôn về ô đầu — giữ số cột
       * cũ ở đây là vô nghĩa và gây khó hiểu: đang ở nút "CN" (cột thứ 7) bấm xuống mà rơi
       * vào ô thứ 7 của danh sách dọc thì không ai đoán được.
       */
      const enterCol = (target: { count: number; cols: number }) =>
        target.cols === 1 ? 0 : Math.min(Math.min(colInRow, target.cols - 1), target.count - 1);

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
          } else if (local + 1 < sec.count) {
            // Đi tiếp trong cùng vùng — hết hàng (lưới nhiều hàng) thì tự động rơi xuống
            // Ô ĐẦU HÀNG DƯỚI, giống cách đọc chữ (không dừng khựng lại, không nhảy sang
            // vùng/menu khác). Với vùng chỉ có 1 hàng (cols === count) thì vẫn dừng ở cuối
            // hàng như cũ vì lúc đó local + 1 === count.
            setFocus(idx + 1, focusables);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (inSide) break; // đang ở menu rồi, bấm trái nữa thì đứng yên
          if (local > 0) {
            // Lùi lại trong cùng vùng — đối xứng với Phải: đang ở đầu 1 hàng (không phải
            // hàng đầu tiên của vùng) thì tự động lùi lên CUỐI HÀNG TRÊN.
            setFocus(idx - 1, focusables);
          } else {
            // Chỉ MỞ MENU khi đang đứng ĐÚNG Ở GÓC TRÊN CÙNG BÊN TRÁI của cả trang — tức
            // đang ở Ô ĐẦU TIÊN của NỘI DUNG THẬT ĐẦU TIÊN (vd video đầu tiên của hàng "Tiếp
            // tục xem"/"Video đề xuất" ở Trang chủ) — bỏ qua thanh trên cùng ('topbar') và nút
            // Quay lại ('detailback'), giống hệt cách resetFocus() xác định "nội dung thật"
            // (xem findRealContent phía trên). Trước đây hễ đứng ở mép trái của BẤT KỲ
            // vùng/hàng nào (kể cả những hàng ở tuốt phía dưới trang) bấm Trái cũng mở menu,
            // rất dễ bấm nhầm lúc đang duyệt dở các hàng bên dưới — giờ những chỗ đó đứng yên,
            // muốn vào menu phải cuộn hẳn lên đúng video đầu tiên trước.
            const firstContentSecIdx = sections.findIndex((s) => !['side', 'topbar', 'detailback'].includes(s.region));
            const willOpen = sideSecIdx >= 0 && secIdx === firstContentSecIdx;
            // GHI CHÚ TẠM THỜI ĐỂ DÒ LỖI — sẽ gỡ ở bản sau khi tìm ra nguyên nhân thật.
            // Hiện 1 dòng chữ nhỏ góc trên-phải màn hình mỗi lần bấm Trái ở đầu 1 vùng, cho
            // biết vì sao có/không mở được menu — xem ô đó rồi đọc lại đúng nguyên văn cho
            // mình biết.
            window.dispatchEvent(
              new CustomEvent('tvnav-debug', {
                detail: `region=${sec.region} count=${sec.count} secIdx=${secIdx} firstIdx=${firstContentSecIdx} sideIdx=${sideSecIdx} → ${willOpen ? 'MỞ MENU' : 'KHÔNG MỞ'}`,
              })
            );
            if (willOpen) {
              returnIdxRef.current = idx;
              const side = sections[sideSecIdx];
              setFocus(side.start + Math.min(sideFocusRef.current, side.count - 1), focusables);
            }
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (inSide) {
            if (local + 1 < sec.count) setFocus(idx + 1, focusables);
          } else {
            // Hàng CUỐI của 1 lưới nhiều hàng có thể thiếu ô (vd 7 video/3 cột → hàng cuối
            // chỉ có đúng 1 ô ở cột đầu). Trước đây cứ cộng thẳng sec.cols vào idx, nên đứng
            // ở cột 2/3 của hàng áp chót thì hàng cuối "không có ô nào ở đúng cột đó" → tính
            // sai là hết lưới, nhảy thẳng sang khối khác, bỏ qua mất hàng cuối.
            // Sửa: tính xem còn HÀNG nào phía dưới không (dựa theo số hàng thật, không phải
            // theo đúng cột) — còn thì đi xuống, GHIM về ô cuối cùng của hàng đó nếu hàng đó
            // ngắn hơn (không đủ tới đúng cột đang đứng).
            const rowsInSec = Math.ceil(sec.count / sec.cols);
            const curRow = Math.floor(local / sec.cols);
            if (curRow + 1 < rowsInSec) {
              const target = Math.min((curRow + 1) * sec.cols + colInRow, sec.count - 1);
              setFocus(sec.start + target, focusables);
            } else {
              const next = stepSection(1);
              if (next) setFocus(next.start + enterCol(next), focusables);
            }
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
            // Đi LÊN thì phải rơi vào HÀNG CUỐI của khối phía trên (hàng nằm sát ngay bên
            // trên mình), chứ không phải hàng đầu của khối đó — nếu không, khối 2 hàng bấm
            // lên là nhảy vọt qua cả 1 hàng.
            if (prev) {
              const lastRowStart = Math.floor((prev.count - 1) / prev.cols) * prev.cols;
              setFocus(prev.start + Math.min(lastRowStart + enterCol(prev), prev.count - 1), focusables);
            }
          }
          break;
        case 'Enter':
          e.preventDefault();
          focusables[idx]?.click();
          break;
        case 'Escape':
          e.preventDefault();
          // Đang có lớp phủ (danh sách chọn hồ sơ, bảng PIN...) thì phím Back là để ĐÓNG lớp
          // đó — việc đóng do chính component đó tự lo. Ở đây không quay lại trang trước,
          // nếu không bấm Back 1 cái là vừa đóng vừa nhảy về trang trước.
          if (!containerRef.current?.querySelector('[data-nav-scope]')) onEscape?.();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, getFocusables, buildSections, setFocus, onEscape, findFirstContent, containerRef]);

  /**
   * Đặt ô đang chọn về NỘI DUNG chính (không phải menu trái / thanh trên cùng). Gọi lại
   * mỗi khi đổi trang, hoặc khi mở/đóng lớp phủ khoá màn hình.
   *
   * Có cơ chế CHỜ NỘI DUNG: lúc vừa đổi trang, dữ liệu (playlist của kênh, video trong
   * playlist...) phải tải qua mạng nên chưa có gì để chọn — riêng trang Kênh còn phải gọi
   * YouTube 2 lượt (lấy playlist, rồi lọc bỏ Shorts) nên có thể mất vài giây. Cách xử lý:
   *
   *  - Chưa có gì cả  → chưa chọn ô nào (tuyệt đối không rơi về ô số 0 = mục đầu menu trái).
   *  - Mới có mỗi nút "← Quay lại" → ĐẬU TẠM ở đó để bé vẫn thoát ra được, NHƯNG VẪN CHỜ TIẾP.
   *  - Nội dung thật hiện ra → nhảy vào video/playlist đầu tiên.
   *
   * Chỗ "vẫn chờ tiếp" là mấu chốt: bản trước đậu ở nút Quay lại rồi ngừng chờ luôn, nên
   * mở trang Kênh xong là kẹt mãi ở nút Quay lại.
   *
   * Nếu trong lúc chờ mà bé đã tự bấm mũi tên đi chỗ khác thì dừng hẳn, không giành lại ô
   * chọn nữa (đang dùng dở mà bị giật đi thì rất khó chịu).
   */
  const resetFocus = useCallback(() => {
    clearTimeout(resetTimerRef.current);
    returnIdxRef.current = null;
    let attempts = 0;

    const attempt = () => {
      const focusables = getFocusables();
      const real = findRealContent(focusables);
      const current = focusedElRef.current;
      const userMovedAway =
        attempts > 0 && current !== null && focusables.includes(current) && regionOf(current) !== 'detailback';

      if (userMovedAway) return;

      if (real >= 0) {
        setFocus(real, focusables);
        return;
      }

      // Chưa có nội dung thật: đậu tạm ở nút Quay lại (chỉ làm 1 lần, ở lượt đầu).
      if (attempts === 0) {
        const fallback = findFallback(focusables);
        if (fallback >= 0) setFocus(fallback, focusables);
      }

      attempts += 1;
      if (attempts <= 40) resetTimerRef.current = setTimeout(attempt, 150);
    };

    attempt();
  }, [getFocusables, findRealContent, findFallback, setFocus]);

  useEffect(() => () => clearTimeout(resetTimerRef.current), []);

  return { resetFocus };
}
