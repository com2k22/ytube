/** Bề ngang tối đa coi là "điện thoại thật" — TRÙNG với mốc đã dùng cho thanh menu dưới
    đáy trong theme.css (xem khối "THANH MENU DƯỚI ĐÁY"). Cố ý KHÔNG dùng 760px (mốc đó
    "dính" luôn cả iPad mini để dọc, 744px) — 700px mới tách bạch được: mọi iPad đều rộng
    hơn mốc này, chỉ điện thoại thật mới lọt vào. */
const PHONE_MAX_WIDTH = 700;

/**
 * isPhoneScreen — true khi đang mở trên điện thoại thật (không phải iPad, không phải TV).
 * Dùng để quyết định: trên điện thoại, khoá thẳng vào Khu vực Bố mẹ, không cho vào Trang
 * chủ/xem video nữa (xem Layout.tsx) — vì giao diện xem video chưa tối ưu cho điện thoại,
 * và trên thực tế bé chỉ xem trên TV, điện thoại chỉ để bố mẹ quản lý.
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
