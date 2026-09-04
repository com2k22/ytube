const DEVICE_ID_STORAGE_KEY = 'ytube.deviceId';

/**
 * deviceId — mã nhận diện RIÊNG của thiết bị này, DÙNG CHUNG giữa 2 việc khác nhau:
 *   1) "Thiết bị đã đăng nhập Khu Bố mẹ" (xem useFamilyDevices.ts).
 *   2) "Thiết bị đã ghép xem nội dung" (xem useFamilyContentDevices.ts).
 * Tách ra file riêng để 2 nơi trên nhận diện ĐÚNG CÙNG 1 thiết bị (cùng 1 mã), nhờ vậy bố mẹ
 * nhìn vào 2 danh sách trong khu Bố mẹ > Tài khoản là biết ngay TV nào đang ở trạng thái nào.
 */

/** Sinh 1 mã ngẫu nhiên nhận diện thiết bị này — KHÔNG dùng crypto.randomUUID() vì trình
    duyệt cũ trên 1 số TV (webOS đời trước) chưa có hàm này, dễ vỡ im lặng. */
function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Đọc (hoặc tạo mới nếu chưa có) mã nhận diện RIÊNG của thiết bị này, lưu vào localStorage
    nên sống sót qua việc tắt/mở lại app — chỉ mất khi xoá dữ liệu trình duyệt/cài lại app. */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = randomId();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch {
    // localStorage bị chặn (hiếm) → vẫn trả về 1 mã dùng tạm cho phiên này, chỉ là sẽ
    // không nhớ được qua lần mở app sau.
    return randomId();
  }
}

/** Đoán tên gợi nhớ cho thiết bị dựa vào user agent — chỉ để phụ huynh dễ nhận ra "thiết bị
    nào là thiết bị nào" trong danh sách, không cần chính xác tuyệt đối. */
export function guessDeviceLabel(): string {
  const ua = navigator.userAgent || '';
  if (/Web0S|webOS/i.test(ua)) return '📺 TV LG webOS';
  if (/SmartTV|SMART-TV|TV;/i.test(ua)) return '📺 Smart TV';
  if (/Android/i.test(ua) && /TV/i.test(ua)) return '📺 TV Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return '📱 iPhone/iPad';
  if (/Android/i.test(ua)) return '📱 Điện thoại Android';
  if (/Mobile/i.test(ua)) return '📱 Điện thoại';
  return '💻 Máy tính';
}
