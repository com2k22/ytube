// Gọi YouTube Data API v3 để lấy danh sách video trong 1 playlist, hoặc danh sách
// playlist thuộc 1 kênh — dùng khi phụ huynh nhập link Playlist/Kênh vào whitelist.
//
// Cần VITE_YOUTUBE_API_KEY trong .env (xem .env.example). Nếu thiếu key, các hàm ở
// đây sẽ trả về mảng rỗng và ghi cảnh báo — UI sẽ tự hiển thị thông báo phù hợp
// thay vì crash.

const API_BASE = 'https://www.googleapis.com/youtube/v3';

function getApiKey(): string | null {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
  return key && key.length > 0 ? key : null;
}

export interface YtPlaylistItem {
  videoId: string;
  title: string;
  thumbnail: string | null;
  position: number;
}

export interface YtPlaylistInfo {
  playlistId: string;
  title: string;
  thumbnail: string | null;
  itemCount: number;
}

/** Lấy danh sách video trong 1 playlist YouTube (tối đa 50 video / trang, lấy 1 trang đầu). */
export async function fetchPlaylistItems(playlistId: string): Promise<YtPlaylistItem[]> {
  const key = getApiKey();
  if (!key) {
    console.warn('[Ytube] Thiếu VITE_YOUTUBE_API_KEY — không thể tải danh sách video thật.');
    return [];
  }
  const url = `${API_BASE}/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(
    playlistId
  )}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('[Ytube] Lỗi gọi YouTube API (playlistItems):', await res.text());
    return [];
  }
  const data = await res.json();
  return (data.items ?? []).map((item: any) => ({
    videoId: item.snippet?.resourceId?.videoId ?? '',
    title: item.snippet?.title ?? 'Không có tiêu đề',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    position: item.snippet?.position ?? 0,
  }));
}

/** Lấy thông tin cơ bản 1 playlist (tiêu đề, ảnh, số video). */
export async function fetchPlaylistInfo(playlistId: string): Promise<YtPlaylistInfo | null> {
  const key = getApiKey();
  if (!key) return null;
  const url = `${API_BASE}/playlists?part=snippet,contentDetails&id=${encodeURIComponent(
    playlistId
  )}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    playlistId,
    title: item.snippet?.title ?? 'Playlist',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? null,
    itemCount: item.contentDetails?.itemCount ?? 0,
  };
}

/** Lấy tên + ảnh đại diện của 1 kênh YouTube từ channelId thật (UC...). */
export async function fetchChannelInfo(
  channelId: string
): Promise<{ title: string; thumbnail: string | null } | null> {
  const key = getApiKey();
  if (!key) return null;
  const url = `${API_BASE}/channels?part=snippet&id=${encodeURIComponent(channelId)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    title: item.snippet?.title ?? 'Kênh YouTube',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
  };
}

/**
 * Đổi @handle của 1 kênh (VD: @tenkenh) sang channelId thật (UC...), dùng tham số
 * "forHandle" của YouTube Data API v3 — không cần đổi thủ công qua trang ngoài nữa.
 */
export async function resolveChannelHandle(
  handle: string
): Promise<{ channelId: string; title: string; thumbnail: string | null } | null> {
  const key = getApiKey();
  if (!key) return null;
  const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
  const url = `${API_BASE}/channels?part=snippet&forHandle=${encodeURIComponent(cleanHandle)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('[Ytube] Lỗi gọi YouTube API (forHandle):', await res.text());
    return null;
  }
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    channelId: item.id,
    title: item.snippet?.title ?? 'Kênh YouTube',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
  };
}

/** Từ 1 kênh YouTube, lấy danh sách các playlist công khai của kênh đó. */
export async function fetchChannelPlaylists(channelId: string): Promise<YtPlaylistInfo[]> {
  const key = getApiKey();
  if (!key) return [];
  const url = `${API_BASE}/playlists?part=snippet,contentDetails&maxResults=50&channelId=${encodeURIComponent(
    channelId
  )}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((item: any) => ({
    playlistId: item.id,
    title: item.snippet?.title ?? 'Playlist',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? null,
    itemCount: item.contentDetails?.itemCount ?? 0,
  }));
}

/** Lấy tiêu đề + ảnh của 1 video đơn lẻ (dùng cho loại nguồn "youtube_video"). */
export async function fetchVideoInfo(
  videoId: string
): Promise<{ title: string; thumbnail: string | null } | null> {
  const key = getApiKey();
  if (!key) return null;
  const url = `${API_BASE}/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    title: item.snippet?.title ?? 'Video',
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? null,
  };
}

/** Ghép URL nhúng an toàn: không rel, không modestbranding không cookie theo dõi. */
export function buildSafeEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
