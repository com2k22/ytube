const FAMILY_ID_STORAGE_KEY = 'ytube.familyId';

/**
 * familyId — mỗi THIẾT BỊ (TV, điện thoại...) tự nhớ nó thuộc GIA ĐÌNH nào, lưu trong
 * localStorage — KHÔNG phải phiên đăng nhập (session đăng nhập Google có thể hết hạn/đăng
 * xuất, nhưng thiết bị vẫn nhớ gia đình để bé xem tiếp bình thường không cần đăng nhập).
 *
 * Thiết lập 1 LẦN DUY NHẤT khi mở app lần đầu trên thiết bị đó (xem FamilyBindingScreen.tsx
 * — yêu cầu đăng nhập Google đúng 1 lần để "nhận diện gia đình"), sau đó mọi lần mở app
 * tiếp theo đọc thẳng từ đây, không cần đăng nhập lại.
 */
export function getFamilyId(): string | null {
  try {
    return localStorage.getItem(FAMILY_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setFamilyId(id: string): void {
  try {
    localStorage.setItem(FAMILY_ID_STORAGE_KEY, id);
  } catch {
    // localStorage bị chặn (hiếm) — thiết bị này sẽ phải "thiết lập lần đầu" lại mỗi khi
    // mở app, không nhớ được qua lần sau. Không có cách khắc phục nào tốt hơn ở phía app.
  }
}
