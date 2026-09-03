import { useCallback, useEffect, useState } from 'react';
import { useTimeRules } from './useTimeRules';
import { findGroupForToday } from '@/utils/timeRules';

const STORAGE_KEY = 'ytube.watchStretch';

/** Nghỉ giải lao bao lâu mỗi lần. Sửa đúng 1 con số này là đổi được. */
export const BREAK_MINUTES = 5;

/**
 * Ngừng xem bao lâu thì coi như "đã nghỉ rồi", xoá sạch mạch xem đang đếm.
 *
 * Để đúng bằng thời gian nghỉ: bé tự tắt đi chơi 5 phút thì cũng là nghỉ thật, quay lại
 * không việc gì phải bắt nghỉ tiếp. Nhờ mốc này mà xem buổi sáng rồi tối mở lại sẽ không
 * bị bắt nghỉ ngay lập tức.
 */
const IDLE_RESET_MS = BREAK_MINUTES * 60_000;

interface Stretch {
  /** Số giây đã xem LIÊN TỤC trong mạch hiện tại. */
  seconds: number;
  /** Lần cuối cùng đếm được 1 giây xem (mili-giây). */
  lastTickAt: number;
  /** Đang trong giờ nghỉ tới mốc này (mili-giây). 0 = không nghỉ. */
  breakUntil: number;
}

const EMPTY: Stretch = { seconds: 0, lastTickAt: 0, breakUntil: 0 };

/**
 * Cố ý dùng localStorage (còn sau khi tắt app), KHÔNG dùng sessionStorage: nếu để mất khi
 * tắt app thì bé chỉ cần thoát ra vào lại là né được giờ nghỉ — đúng thứ mà bé sẽ tìm ra
 * trong vòng một tuần.
 */
function read(): Stretch {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Stretch;
    return {
      seconds: Number(p?.seconds) || 0,
      lastTickAt: Number(p?.lastTickAt) || 0,
      breakUntil: Number(p?.breakUntil) || 0,
    };
  } catch {
    return EMPTY;
  }
}

function write(s: Stretch) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* trình duyệt chặn lưu — tính năng nghỉ giải lao coi như tắt, không làm hỏng gì khác */
  }
}

/** Số phút mỗi lượt xem của hôm nay (0 = không giới hạn lượt). */
function useSessionMinutes(): number {
  const { groups } = useTimeRules();
  const group = findGroupForToday(groups);
  return group?.session_minutes ?? 0;
}

/**
 * useWatchStretchTicker — đặt ở TRANG PHÁT. Mỗi giây bé đang xem thì cộng 1 vào mạch xem;
 * xem liên tục đủ "Thời gian mỗi lượt xem" thì bật giờ nghỉ giải lao.
 *
 * ⚠️ Đây chính là chỗ vá cho ô "Thời gian mỗi lượt xem" trong tab Quản lý thời gian:
 * trước đây ô đó lưu được, sửa được, nhưng KHÔNG CÓ TÁC DỤNG GÌ — phần kiểm tra giờ chỉ
 * đọc "tổng thời gian/ngày" chứ chưa bao giờ đọc tới nó. Bố mẹ cài 20 phút/lượt mà bé vẫn
 * xem một mạch tới hết hạn mức ngày.
 *
 * `active` = có đang thật sự xem không (trang phát đang mở và cửa sổ đang hiện).
 */
export function useWatchStretchTicker(active: boolean) {
  const sessionMinutes = useSessionMinutes();

  useEffect(() => {
    if (!active || sessionMinutes <= 0) return;

    // Đếm trong BỘ NHỚ TẠM, chỉ thỉnh thoảng mới ghi xuống bộ nhớ máy.
    //
    // Vì sao: ghi vào localStorage là thao tác ĐỒNG BỘ — máy phải dừng lại chờ ghi xong
    // mới chạy tiếp. Ghi mỗi giây, liên tục suốt lúc bé xem phim, trên TV cấu hình yếu là
    // đủ để thỉnh thoảng thấy khựng hình. Ghi 10 giây một lần thì nhẹ hơn 10 lần, mà xấu
    // nhất cũng chỉ sai lệch 10 giây trong mạch xem — hoàn toàn không đáng kể.
    let pending = read();

    const flush = () => write(pending);

    const timer = setInterval(() => {
      const now = Date.now();
      // Đang trong giờ nghỉ thì không đếm tiếp (bé có mở trang phát cũng không tính).
      if (pending.breakUntil > now) return;

      // Nghỉ đủ lâu giữa 2 lần xem → coi như mạch mới.
      const seconds = now - pending.lastTickAt > IDLE_RESET_MS ? 1 : pending.seconds + 1;

      if (seconds >= sessionMinutes * 60) {
        // Bắt đầu giờ nghỉ là việc HỆ TRỌNG — ghi xuống ngay lập tức, không chờ gom nhóm,
        // vì màn hình nghỉ (useBreakGate) đọc từ chính chỗ lưu đó ra.
        pending = { seconds: 0, lastTickAt: now, breakUntil: now + BREAK_MINUTES * 60_000 };
        flush();
        return;
      }

      pending = { seconds, lastTickAt: now, breakUntil: 0 };
      if (seconds % 10 === 0) flush();
    }, 1000);

    return () => {
      clearInterval(timer);
      // Rời trang phát thì ghi nốt phần đang đếm dở, đừng để mất mấy giây cuối.
      flush();
    };
  }, [active, sessionMinutes]);
}

export interface BreakState {
  /** Có đang phải nghỉ giải lao không. */
  onBreak: boolean;
  /** Số giây còn lại của giờ nghỉ. */
  secondsLeft: number;
  /** Kết thúc giờ nghỉ ngay (bố mẹ nhập PIN). */
  endBreak: () => void;
}

/**
 * useBreakGate — đặt ở KHUNG SƯỜN (Layout), để biết lúc nào cần bật màn hình nghỉ giải lao.
 * Đọc chung một chỗ lưu với useWatchStretchTicker ở trên.
 */
export function useBreakGate(): BreakState {
  /**
   * Gộp cả 2 giá trị vào 1 state, và mỗi giây chỉ ĐỔI STATE KHI THẬT SỰ CÓ GÌ KHÁC.
   *
   * ⚠️ Đây là chỗ rất dễ làm chậm cả app mà không ai để ý. Hook này chạy trong Layout —
   * khung sườn bọc ngoài MỌI trang. Nếu cứ mỗi giây lại đổi state (kiểu setNow(Date.now()))
   * thì React vẽ lại toàn bộ trang mỗi giây, suốt cả ngày, kể cả khi chẳng có gì xảy ra.
   * Trên máy tính không cảm nhận được, nhưng TV yếu hơn nhiều nên rất phí.
   *
   * Cách tránh: trong hàm cập nhật, nếu giá trị mới y hệt giá trị cũ thì TRẢ VỀ CHÍNH
   * object cũ — React thấy không đổi sẽ bỏ qua, không vẽ lại gì cả. Nhờ vậy lúc bình
   * thường (không trong giờ nghỉ) app đứng yên hoàn toàn.
   */
  const [state, setState] = useState<{ onBreak: boolean; secondsLeft: number }>(() => compute());

  useEffect(() => {
    const timer = setInterval(() => {
      setState((prev) => {
        const next = compute();
        return next.onBreak === prev.onBreak && next.secondsLeft === prev.secondsLeft ? prev : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const endBreak = useCallback(() => {
    // Xoá luôn mạch xem đang đếm: bố mẹ đã cho xem tiếp thì đừng để 30 giây sau lại bắt
    // nghỉ lần nữa.
    write({ seconds: 0, lastTickAt: Date.now(), breakUntil: 0 });
    setState({ onBreak: false, secondsLeft: 0 });
  }, []);

  return { ...state, endBreak };
}

/** Đọc chỗ lưu và tính ra trạng thái nghỉ hiện tại. */
function compute(): { onBreak: boolean; secondsLeft: number } {
  const { breakUntil } = read();
  const now = Date.now();
  const onBreak = breakUntil > now;
  return { onBreak, secondsLeft: onBreak ? Math.ceil((breakUntil - now) / 1000) : 0 };
}
