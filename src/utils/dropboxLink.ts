/**
 * normalizeDropboxLink — chuyển 1 link CHIA SẺ Dropbox thường (dạng xem trước trong trình
 * duyệt, có "dl=0") thành link TẢI THẲNG ("dl=1") — dùng được ngay làm `src` cho thẻ
 * <video>/<audio>, y hệt 1 "Link trực tiếp" (mp4/m3u8) bình thường, KHÔNG cần đăng nhập hay
 * xin API key riêng nào (khác hẳn Google Drive — xem chú thích ở googleDrive.ts).
 *
 * Không phải link Dropbox thì trả lại NGUYÊN VĂN, không đụng vào — an toàn khi gọi cho MỌI
 * link nhập vào ô "Link trực tiếp", không cần biết trước đó có phải Dropbox hay không.
 *
 * ĐÁNH ĐỔI đã biết (xem thêm ghi chú lúc trao đổi): Dropbox thỉnh thoảng không hỗ trợ tua
 * tới/lui (byte-range) ổn định bằng Google Drive/mp4 thường — nếu bé bấm tua mà bị giật/lỗi,
 * đây là giới hạn của Dropbox, không phải lỗi app.
 */
export function normalizeDropboxLink(rawUrl: string): string {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return rawUrl;
  }
  if (!u.hostname.endsWith('dropbox.com')) return rawUrl;
  u.searchParams.set('dl', '1');
  return u.toString();
}

/** true = link TRÔNG GIỐNG 1 link chia sẻ Dropbox — chỉ dùng để tự hiện gợi ý/nhãn trong
    form thêm nội dung, không ảnh hưởng gì tới việc lưu (normalizeDropboxLink luôn tự lo). */
export function looksLikeDropboxLink(rawUrl: string): boolean {
  try {
    return new URL(rawUrl.trim()).hostname.endsWith('dropbox.com');
  } catch {
    return false;
  }
}
