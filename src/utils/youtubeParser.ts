// Tách videoId / playlistId / channelId từ các dạng link YouTube khác nhau mà phụ huynh
// có thể dán vào (link đầy đủ, link rút gọn youtu.be, link chia sẻ có ?si=...).

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      return u.pathname.replace('/', '') || null;
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] ?? null;
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function extractPlaylistId(url: string): string | null {
  try {
    const u = new URL(url);
    return u.searchParams.get('list');
  } catch {
    return null;
  }
}

/** Nhận diện channelId (UC...) hoặc @handle từ link kênh — @handle cần thêm 1 lượt gọi API để đổi ra channelId. */
export function extractChannelRef(url: string): { channelId: string | null; handle: string | null } {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'channel' && parts[1]) return { channelId: parts[1], handle: null };
    if (parts[0]?.startsWith('@')) return { channelId: null, handle: parts[0] };
  } catch {
    /* ignore */
  }
  return { channelId: null, handle: null };
}
