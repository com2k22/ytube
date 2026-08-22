import { useCallback, useState } from 'react';

const STORAGE_KEY = 'ytube.tempUnlock';

/**
 * useTempUnlock — "mở khoá tạm": bố mẹ nhập đúng mã PIN ở màn hình chặn để cho bé xem
 * ngay, bỏ qua giới hạn giờ/thời gian.
 *
 * Hiệu lực CHỈ trong phiên đang mở: tắt app rồi mở lại là khoá trở lại theo đúng cấu hình
 * trong "Quản lý thời gian". Chỗ lưu là sessionStorage — đúng loại bộ nhớ mất sạch khi
 * đóng app, khác localStorage (còn mãi). Nhờ vậy bố mẹ không cần nhớ đi khoá lại.
 *
 * Vẫn lưu (thay vì chỉ giữ trong bộ nhớ tạm của React) để lỡ trang bị tải lại giữa chừng
 * thì bé không bị chặn lại ngay giữa lúc đang xem.
 */
export function useTempUnlock() {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const grant = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* trình duyệt chặn lưu — vẫn mở khoá được, chỉ là tải lại trang thì mất */
    }
    setUnlocked(true);
  }, []);

  const revoke = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* bỏ qua */
    }
    setUnlocked(false);
  }, []);

  return { unlocked, grant, revoke };
}
