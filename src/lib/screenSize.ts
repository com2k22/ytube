import { useEffect, useState } from 'react';

/** Bề ngang tối đa coi là "điện thoại thật" — TRÙNG với mốc đã dùng cho thanh menu dưới
    đáy trong theme.css (xem khối "THANH MENU DƯỚI ĐÁY"). Cố ý KHÔNG dùng 760px (mốc đó
    "dính" luôn cả iPad mini để dọc, 744px) — 700px mới tách bạch được: mọi iPad đều rộng
    hơn mốc này, chỉ điện thoại thật mới lọt vào. */
const PHONE_MAX_WIDTH = 700;

/**
 * isPhoneScreen — true khi đang mở trên điện thoại thật (không phải iPad, không phải TV).
 * Dùng để chọn đúng giao diện phone (Trang chủ dạng nghe truyện, trình phát dạng âm thanh,
 * Khu vực Bố mẹ gộp 1 trang cuộn...) — xem các trang trong `src/pages/mobile/`. TRƯỚC ĐÂY
 * hàm này còn được Layout.tsx dùng để khoá điện thoại thẳng vào Khu vực Bố mẹ (không cho
 * vào Trang chủ/xem video) — từ bản nâng cấp giao diện điện thoại, quy tắc đó đã bỏ: điện
 * thoại giờ là 1 thiết bị xem thật sự, y hệt TV/iPad/máy tính, chỉ khác giao diện.
 *
 * Chặn riêng data-tv: TV vật lý cũng có bề ngang rộng (1920/1280px) nên không lọt vào điều
 * kiện bên dưới, nhưng vẫn kiểm tra cho chắc — data-tv KHÔNG dựa vào kích thước màn hình
 * (xem main.tsx), là cách chắc chắn nhất phân biệt TV thật với 1 cửa sổ trình duyệt hẹp.
 */
export function isPhoneScreen(): boolean {
  try {
    if (document.documentElement.hasAttribute('data-tv')) return false;
    return window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`).matches;
  } catch {
    return false;
  }
}

/**
 * useIsPhoneScreen — bản "hook" của isPhoneScreen(), tự cập nhật lại khi cửa sổ đổi bề
 * ngang qua mốc điện thoại (vd xoay ngang, hoặc thu nhỏ cửa sổ trình duyệt lúc test) — dùng
 * ở các trang cần chọn NGAY giữa 2 giao diện (phone/không-phone) trong lúc render, thay vì
 * gọi thẳng isPhoneScreen() (chỉ đọc đúng 1 lần, không tự vẽ lại khi bề ngang đổi).
 */
export function useIsPhoneScreen(): boolean {
  const [phone, setPhone] = useState(isPhoneScreen);
  useEffect(() => {
    const update = () => setPhone(isPhoneScreen());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return phone;
}
