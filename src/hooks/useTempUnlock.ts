import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ytube.tempUnlock';

/** Hình dạng dữ liệu lưu lại: until = mốc hết hạn (mili-giây), null = tới khi tắt app. */
interface StoredUnlock {
  until: number | null;
}

function read(): StoredUnlock | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // '1' là định dạng CŨ (mở khoá tới khi tắt app) — vẫn đọc được, để bản cũ đang mở dở
    // không bị khoá đột ngột ngay lúc cập nhật app.
    if (raw === '1') return { until: null };
    const parsed = JSON.parse(raw) as StoredUnlock;
    return parsed && (typeof parsed.until === 'number' || parsed.until === null) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * useTempUnlock — "mở khoá tạm", bỏ qua giới hạn giờ để bé được xem ngay. Có 2 kiểu:
 *
 *  1. `grant()`   → mở tới khi TẮT APP. Dùng khi bố mẹ đứng tại TV nhập mã PIN.
 *  2. `grant(15)` → mở đúng 15 phút rồi TỰ khoá lại. Dùng cho "con xin thêm giờ" được bố
 *                   mẹ duyệt từ xa — cho đúng số phút đã hứa, không ai phải nhớ quay lại tắt.
 *
 * Chỗ lưu là sessionStorage — đúng loại bộ nhớ mất sạch khi đóng app, khác localStorage
 * (còn mãi). Nhờ vậy bố mẹ không bao giờ phải nhớ đi khoá lại. Vẫn lưu (thay vì chỉ giữ
 * trong bộ nhớ tạm của React) để lỡ trang bị tải lại giữa chừng thì bé không bị chặn lại
 * ngay giữa lúc đang xem.
 */
export function useTempUnlock() {
  const [stored, setStored] = useState<StoredUnlock | null>(() => read());
  /** Chỉ để ép React vẽ lại mỗi giây khi đang đếm ngược suất có hạn giờ. */
  const [, setTick] = useState(0);

  const revoke = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* bỏ qua */
    }
    setStored(null);
  }, []);

  // Suất có hạn giờ: đếm mỗi giây để đúng lúc hết hạn là khoá lại ngay, chứ không phải
  // chờ bé bấm gì đó app mới nhận ra.
  useEffect(() => {
    const until = stored?.until;
    if (!stored || until == null) return;
    const timer = setInterval(() => {
      if (Date.now() >= until) revoke();
      else setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [stored, revoke]);

  const grant = useCallback((minutes?: number) => {
    const value: StoredUnlock = { until: minutes && minutes > 0 ? Date.now() + minutes * 60_000 : null };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* trình duyệt chặn lưu — vẫn mở khoá được, chỉ là tải lại trang thì mất */
    }
    setStored(value);
  }, []);

  const unlocked = stored !== null && (stored.until === null || Date.now() < stored.until);
  /** Mốc hết hạn của suất đang mở (mili-giây). null = mở tới khi tắt app / không mở. */
  const expiresAt = unlocked ? stored?.until ?? null : null;

  return { unlocked, expiresAt, grant, revoke };
}
