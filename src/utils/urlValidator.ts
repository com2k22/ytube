// Kiểm tra & làm sạch URL trước khi lưu vào whitelist — chống nhập nhầm link rác
// hoặc link có thể gây hại (ví dụ javascript:, data: URL).

export function isSafeHttpsUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl.trim());
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeTitle(rawTitle: string): string {
  return rawTitle.trim().slice(0, 120);
}

const DIRECT_VIDEO_EXTENSIONS = ['.mp4', '.m3u8', '.webm'];

export function looksLikeDirectVideoUrl(rawUrl: string): boolean {
  const lower = rawUrl.toLowerCase();
  return DIRECT_VIDEO_EXTENSIONS.some((ext) => lower.includes(ext));
}
